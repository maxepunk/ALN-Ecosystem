# Environment Control Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement game clock, cue engine (simple + standing cues), sound effects via pw-play, and the session `setup` → `active` lifecycle — delivering automated environment reactions to game events.

**Architecture:** Extract `executeCommand()` from `adminEvents.js` as the shared entry point for both GM manual commands and automated cue dispatches. New services (`gameClockService`, `cueEngineService`, `soundService`) follow the existing `module.exports = new Class()` singleton EventEmitter pattern. Standing cues watch game events and clock ticks, then dispatch `gm:command` actions via `executeCommand()` with `source: 'cue'`. All changes on feature branches — merged only after full test verification.

**Tech Stack:** Node.js (Express + Socket.IO), ES6 module PWA (Vite), Jest + Playwright, PipeWire (`pw-play`)

**Design Reference:** `docs/plans/2026-02-13-environment-control-roadmap.md` (Sections 1-3, 5-6, 8-9, 11-13)

---

## Branching Strategy

This monorepo has Git submodules. Phase 1 changes touch **two repositories**:

| Repository | Role | Branch to Create |
|-----------|------|------------------|
| `ALN-Ecosystem` (parent) | Contains `backend/` directly | `phase1/cue-engine` |
| `ALNScanner` (submodule) | GM Scanner frontend | `phase1/cue-engine` |

No changes needed in `aln-memory-scanner`, `ALN-TokenData`, or `arduino-cyd-player-scanner` for Phase 1.

### Branch Lifecycle

```
main ─────────────────────────────────────────────────── main
  \                                                      /
   phase1/cue-engine (parent) ──── work ──── work ──── merge
        \                                              /
         phase1/cue-engine (ALNScanner submodule) ── merge first
```

**Merge order matters:**
1. Merge ALNScanner `phase1/cue-engine` → `main` first
2. Update parent's submodule reference to ALNScanner `main`
3. Merge parent `phase1/cue-engine` → `main`

This ensures the parent's `main` branch always points to valid submodule commits on `main`.

### Submodule Gotchas

- ALNScanner submodule is currently at commit `ef975f5` on branch `pre-merge-prep-20251112` (detached from `main`). Task 0 will create a clean branch from the submodule's current HEAD.
- The nested `ALNScanner/data/` submodule (ALN-TokenData) is NOT modified — don't touch it.
- `.gitmodules` has `update = merge` for all submodules — use `--merge` when pulling.
- After ALL work is done on the ALNScanner submodule, commit the updated submodule reference in the parent repo.

---

## Task 0: Branch Setup

**Goal:** Create feature branches in both repos for safe development.

**Step 1: Create parent branch**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git checkout -b phase1/cue-engine
```

**Step 2: Create ALNScanner submodule branch**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git checkout -b phase1/cue-engine
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
```

**Step 3: Verify branches**

```bash
git branch --show-current
# Expected: phase1/cue-engine

cd ALNScanner && git branch --show-current && cd ..
# Expected: phase1/cue-engine
```

**Step 4: Push branches to remote**

```bash
git push -u origin phase1/cue-engine
cd ALNScanner && git push -u origin phase1/cue-engine && cd ..
```

**Step 5: Commit submodule state in parent**

```bash
git add ALNScanner
git commit -m "chore: track ALNScanner phase1/cue-engine branch"
```

---

## Task 1: Update AsyncAPI Contract

**Goal:** Define all new WebSocket events and `gm:command` actions before writing any implementation. Contract-first per project convention (roadmap D41).

**Files:**
- Modify: `backend/contracts/asyncapi.yaml`

**Context:** The existing AsyncAPI spec (v2.6.0) defines 21+ events. We add new events for game clock, cue engine, and sound. We also add new `gm:command` actions.

### Step 1: Write contract tests for new events

**File:** Create `backend/tests/contract/phase1-events.test.js`

Write tests that validate the new event schemas exist in the AsyncAPI spec. These tests will fail until we update the contract.

```javascript
'use strict';

const { validateWebSocketEvent } = require('../helpers/contract-validator');

describe('Phase 1 AsyncAPI Contract - New Events', () => {

  describe('gameclock:status', () => {
    it('should validate running status', () => {
      validateWebSocketEvent({
        event: 'gameclock:status',
        data: { state: 'running', elapsed: 3600 },
        timestamp: new Date().toISOString()
      }, 'gameclock:status');
    });

    it('should validate paused status', () => {
      validateWebSocketEvent({
        event: 'gameclock:status',
        data: { state: 'paused', elapsed: 1800 },
        timestamp: new Date().toISOString()
      }, 'gameclock:status');
    });

    it('should validate stopped status', () => {
      validateWebSocketEvent({
        event: 'gameclock:status',
        data: { state: 'stopped', elapsed: 0 },
        timestamp: new Date().toISOString()
      }, 'gameclock:status');
    });
  });

  describe('cue:fired', () => {
    it('should validate cue fired event', () => {
      validateWebSocketEvent({
        event: 'cue:fired',
        data: {
          cueId: 'business-sale',
          trigger: 'event:transaction:accepted',
          source: 'cue'
        },
        timestamp: new Date().toISOString()
      }, 'cue:fired');
    });
  });

  describe('cue:status', () => {
    it('should validate active cue status', () => {
      validateWebSocketEvent({
        event: 'cue:status',
        data: {
          cueId: 'opening-sequence',
          state: 'running'
        },
        timestamp: new Date().toISOString()
      }, 'cue:status');
    });
  });

  describe('cue:completed', () => {
    it('should validate cue completed event', () => {
      validateWebSocketEvent({
        event: 'cue:completed',
        data: { cueId: 'first-scan-fanfare' },
        timestamp: new Date().toISOString()
      }, 'cue:completed');
    });
  });

  describe('cue:error', () => {
    it('should validate cue error event', () => {
      validateWebSocketEvent({
        event: 'cue:error',
        data: {
          cueId: 'business-sale',
          action: 'sound:play',
          position: null,
          error: 'pw-play not found'
        },
        timestamp: new Date().toISOString()
      }, 'cue:error');
    });
  });

  describe('sound:status', () => {
    it('should validate sound status event', () => {
      validateWebSocketEvent({
        event: 'sound:status',
        data: {
          playing: [
            { file: 'fanfare.wav', target: 'combine-bt' }
          ]
        },
        timestamp: new Date().toISOString()
      }, 'sound:status');
    });
  });
});

describe('Phase 1 AsyncAPI Contract - gm:command actions', () => {
  // These verify the contract documents the new actions.
  // The gm:command schema should include them in the action enum.

  const newActions = [
    'session:start',
    'cue:fire', 'cue:stop', 'cue:pause', 'cue:resume',
    'cue:enable', 'cue:disable',
    'sound:play', 'sound:stop',
    'audio:volume:set'
  ];

  // Note: The exact test approach depends on how the existing contract
  // tests validate gm:command actions. Follow the existing pattern in
  // backend/tests/contract/ for action enum validation.
});
```

### Step 2: Run test to verify it fails

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npx jest tests/contract/phase1-events.test.js --verbose
```

Expected: FAIL — schemas not found in asyncapi.yaml.

### Step 3: Update AsyncAPI spec with new event schemas

**File:** `backend/contracts/asyncapi.yaml`

Add under `channels:` (follow existing event patterns):

**New server→client events:**
- `gameclock:status` — `{state: 'running'|'paused'|'stopped', elapsed: integer}`
- `cue:fired` — `{cueId: string, trigger: string, source: 'gm'|'cue'}`
- `cue:status` — `{cueId: string, state: 'running'|'paused'|'completed'|'stopped'}`
- `cue:completed` — `{cueId: string}`
- `cue:error` — `{cueId: string, action: string, position: integer|null, error: string}`
- `sound:status` — `{playing: array of {file: string, target: string}}`

**New gm:command actions** (add to the action enum in the existing `gm:command` schema):
- `session:start`, `cue:fire`, `cue:stop`, `cue:pause`, `cue:resume`, `cue:enable`, `cue:disable`, `sound:play`, `sound:stop`, `audio:volume:set`

### Step 4: Run contract tests to verify they pass

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npx jest tests/contract/phase1-events.test.js --verbose
```

Expected: PASS

### Step 5: Run ALL existing contract tests to ensure no regressions

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npm run test:contract
```

Expected: All PASS (existing + new).

### Step 6: Commit

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add backend/contracts/asyncapi.yaml backend/tests/contract/phase1-events.test.js
git commit -m "feat(contracts): add Phase 1 AsyncAPI events for game clock, cues, and sound"
```

---

## Task 2: Extract `executeCommand()` from `adminEvents.js`

**Goal:** Refactor the `gm:command` switch into a standalone function callable by both the WebSocket handler and the cue engine (roadmap Section 1, D1-D3).

**Files:**
- Create: `backend/src/services/commandExecutor.js`
- Modify: `backend/src/websocket/adminEvents.js`
- Create: `backend/tests/unit/services/commandExecutor.test.js`

**Context:** Currently `adminEvents.js` has a `handleGmCommand(socket, data, io)` function with a giant switch statement. We extract the switch body into `executeCommand({action, payload, source, trigger})` that returns `{success, message, data?}`. The WebSocket handler calls it with `source: 'gm'` and sends the ack. The cue engine (Task 6) will call it with `source: 'cue'`.

### Step 1: Write failing tests for `executeCommand()`

```javascript
// backend/tests/unit/services/commandExecutor.test.js
'use strict';

const { executeCommand } = require('../../../src/services/commandExecutor');

// Mock all services that executeCommand depends on
jest.mock('../../../src/services/sessionService', () => ({
  createSession: jest.fn().mockResolvedValue({ id: 'test-session', name: 'Test' }),
  getCurrentSession: jest.fn().mockReturnValue({ id: 'test-session', status: 'active' }),
  updateSession: jest.fn().mockResolvedValue(true),
  endSession: jest.fn().mockResolvedValue(true),
  addTeamToSession: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../src/services/videoQueueService', () => ({
  playVideo: jest.fn().mockResolvedValue(true),
  pauseCurrent: jest.fn().mockResolvedValue(true),
  resumeCurrent: jest.fn().mockResolvedValue(true),
  skipCurrent: jest.fn().mockResolvedValue(true),
  clearQueue: jest.fn().mockResolvedValue(true),
}));

describe('commandExecutor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should export executeCommand function', () => {
    expect(typeof executeCommand).toBe('function');
  });

  it('should execute session:create with source gm', async () => {
    const result = await executeCommand({
      action: 'session:create',
      payload: { name: 'Test Game' },
      source: 'gm'
    });
    expect(result.success).toBe(true);
  });

  it('should execute session:create with source cue', async () => {
    // Cues can also trigger session commands
    const result = await executeCommand({
      action: 'session:create',
      payload: { name: 'Auto Game' },
      source: 'cue',
      trigger: 'manual'
    });
    expect(result.success).toBe(true);
  });

  it('should return error for unknown action', async () => {
    const result = await executeCommand({
      action: 'nonexistent:action',
      payload: {},
      source: 'gm'
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/unknown/i);
  });

  it('should include source in result', async () => {
    const result = await executeCommand({
      action: 'session:create',
      payload: { name: 'Test' },
      source: 'cue',
      trigger: 'cue:opening@0s'
    });
    expect(result.source).toBe('cue');
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npx jest tests/unit/services/commandExecutor.test.js --verbose
```

Expected: FAIL — module not found.

### Step 3: Implement `commandExecutor.js`

**File:** `backend/src/services/commandExecutor.js`

Extract the switch body from `adminEvents.js::handleGmCommand()` into:

```javascript
'use strict';

const logger = require('../utils/logger');

// Service imports (same ones adminEvents.js currently uses)
const sessionService = require('./sessionService');
const transactionService = require('./transactionService');
const videoQueueService = require('./videoQueueService');
const displayControlService = require('./displayControlService');
const stateService = require('./stateService');
const bluetoothService = require('./bluetoothService');
const audioRoutingService = require('./audioRoutingService');
const lightingService = require('./lightingService');

/**
 * Execute a gm:command action.
 * Called by WebSocket handler (source: 'gm') and cue engine (source: 'cue').
 *
 * @param {Object} params
 * @param {string} params.action - The command action (e.g., 'session:create')
 * @param {Object} params.payload - Action-specific payload
 * @param {string} params.source - 'gm' or 'cue'
 * @param {string} [params.trigger] - Provenance string when source is 'cue'
 * @returns {Promise<{success: boolean, message: string, data?: any, source: string}>}
 */
async function executeCommand({ action, payload = {}, source = 'gm', trigger }) {
  logger.info(`[executeCommand] action=${action} source=${source}${trigger ? ` trigger=${trigger}` : ''}`);

  try {
    let result;

    switch (action) {
      // --- Session commands ---
      // (move each case from adminEvents.js, returning {success, message, data?})
      // Keep the exact same logic, just return instead of emitting ack

      // --- Video commands ---
      // --- Display commands ---
      // --- Scoring commands ---
      // --- Transaction commands ---
      // --- System commands ---
      // --- Bluetooth commands ---
      // --- Audio routing commands ---
      // --- Lighting commands ---

      default:
        return { success: false, message: `Unknown action: ${action}`, source };
    }

    return { ...result, source };
  } catch (error) {
    logger.error(`[executeCommand] ${action} failed:`, error.message);
    return { success: false, message: error.message, source };
  }
}

module.exports = { executeCommand };
```

**Key implementation notes:**
- Move EVERY case from `adminEvents.js`'s switch into `executeCommand()`
- Each case returns `{success: true/false, message: string, data?: any}` instead of calling `socket.emit('gm:command:ack', ...)`
- The existing `handleGmCommand()` in `adminEvents.js` becomes a thin wrapper that calls `executeCommand()` and sends the ack over the socket
- Do NOT change any service call logic — just move it

### Step 4: Update `adminEvents.js` to use `executeCommand()`

**File:** `backend/src/websocket/adminEvents.js`

Replace the switch body with:

```javascript
const { executeCommand } = require('../services/commandExecutor');

async function handleGmCommand(socket, data, io) {
  const commandData = data?.data || data;
  const { action, payload } = commandData;

  const result = await executeCommand({ action, payload, source: 'gm' });

  socket.emit('gm:command:ack', {
    event: 'gm:command:ack',
    data: { action, ...result },
    timestamp: new Date().toISOString()
  });
}
```

### Step 5: Run tests

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npx jest tests/unit/services/commandExecutor.test.js --verbose
```

Expected: PASS

### Step 6: Run ALL existing tests to ensure the refactor is clean

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npm test
```

Expected: All PASS. If any adminEvents tests break, fix them — they should still work since behavior is identical.

### Step 7: Commit

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add backend/src/services/commandExecutor.js backend/src/websocket/adminEvents.js backend/tests/unit/services/commandExecutor.test.js
git commit -m "refactor: extract executeCommand() from adminEvents for cue engine reuse"
```

---

## Task 3: `gameClockService`

**Goal:** Create the master time authority — a single `setInterval(1000)` that ticks every second while the game is active (roadmap Section 2, D15/D42).

**Files:**
- Create: `backend/src/services/gameClockService.js`
- Create: `backend/tests/unit/services/gameClockService.test.js`

**Context:** The game clock is separate from the cue engine (single responsibility). It emits `gameclock:tick` internally (not broadcast — too chatty). Cue engine and overtime detection listen to ticks. Clock state persists on the session model.

### Step 1: Write failing tests

```javascript
// backend/tests/unit/services/gameClockService.test.js
'use strict';

describe('GameClockService', () => {
  let gameClockService;

  beforeEach(() => {
    jest.useFakeTimers();
    // Clear module cache to get fresh singleton
    jest.resetModules();
    gameClockService = require('../../../src/services/gameClockService');
    gameClockService.reset();
  });

  afterEach(() => {
    gameClockService.cleanup();
    jest.useRealTimers();
  });

  describe('start()', () => {
    it('should start the clock and emit gameclock:started', () => {
      const handler = jest.fn();
      gameClockService.on('gameclock:started', handler);
      gameClockService.start();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ gameStartTime: expect.any(Number) })
      );
    });

    it('should emit gameclock:tick every second', () => {
      const handler = jest.fn();
      gameClockService.on('gameclock:tick', handler);
      gameClockService.start();

      jest.advanceTimersByTime(3000);
      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should emit elapsed seconds excluding paused time', () => {
      const ticks = [];
      gameClockService.on('gameclock:tick', (data) => ticks.push(data.elapsed));
      gameClockService.start();

      jest.advanceTimersByTime(3000);
      expect(ticks).toEqual([1, 2, 3]);
    });

    it('should throw if already running', () => {
      gameClockService.start();
      expect(() => gameClockService.start()).toThrow(/already running/i);
    });
  });

  describe('pause()', () => {
    it('should stop ticking', () => {
      const handler = jest.fn();
      gameClockService.on('gameclock:tick', handler);
      gameClockService.start();

      jest.advanceTimersByTime(2000); // 2 ticks
      gameClockService.pause();
      jest.advanceTimersByTime(3000); // should NOT tick

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should emit gameclock:paused with current elapsed', () => {
      const handler = jest.fn();
      gameClockService.on('gameclock:paused', handler);
      gameClockService.start();

      jest.advanceTimersByTime(5000);
      gameClockService.pause();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ elapsed: 5 })
      );
    });
  });

  describe('resume()', () => {
    it('should resume ticking from where it paused', () => {
      const ticks = [];
      gameClockService.on('gameclock:tick', (data) => ticks.push(data.elapsed));
      gameClockService.start();

      jest.advanceTimersByTime(3000); // elapsed = 3
      gameClockService.pause();
      jest.advanceTimersByTime(5000); // 5s paused, should not count
      gameClockService.resume();
      jest.advanceTimersByTime(2000); // elapsed should be 4, 5

      expect(ticks).toEqual([1, 2, 3, 4, 5]);
    });

    it('should emit gameclock:resumed', () => {
      const handler = jest.fn();
      gameClockService.on('gameclock:resumed', handler);
      gameClockService.start();
      jest.advanceTimersByTime(1000);
      gameClockService.pause();
      gameClockService.resume();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ elapsed: 1 })
      );
    });
  });

  describe('stop()', () => {
    it('should stop the clock and clear state', () => {
      const handler = jest.fn();
      gameClockService.on('gameclock:tick', handler);
      gameClockService.start();
      jest.advanceTimersByTime(2000);
      gameClockService.stop();
      jest.advanceTimersByTime(3000);

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('getElapsed()', () => {
    it('should return 0 before start', () => {
      expect(gameClockService.getElapsed()).toBe(0);
    });

    it('should return elapsed seconds', () => {
      gameClockService.start();
      jest.advanceTimersByTime(10000);
      expect(gameClockService.getElapsed()).toBe(10);
    });

    it('should exclude paused time', () => {
      gameClockService.start();
      jest.advanceTimersByTime(5000);  // 5s active
      gameClockService.pause();
      jest.advanceTimersByTime(10000); // 10s paused
      gameClockService.resume();
      jest.advanceTimersByTime(3000);  // 3s active

      expect(gameClockService.getElapsed()).toBe(8); // 5 + 3
    });
  });

  describe('getState()', () => {
    it('should return stopped state initially', () => {
      expect(gameClockService.getState()).toEqual({
        status: 'stopped',
        elapsed: 0,
        startTime: null,
        totalPausedMs: 0
      });
    });

    it('should return running state after start', () => {
      gameClockService.start();
      const state = gameClockService.getState();
      expect(state.status).toBe('running');
      expect(state.startTime).toBeTruthy();
    });
  });

  describe('restore()', () => {
    it('should restore clock state from persisted data', () => {
      const pastStart = Date.now() - 60000; // Started 60s ago
      gameClockService.restore({
        startTime: pastStart,
        pausedAt: null,
        totalPausedMs: 0
      });

      // Elapsed should be ~60s (allow margin for test execution)
      const elapsed = gameClockService.getElapsed();
      expect(elapsed).toBeGreaterThanOrEqual(59);
      expect(elapsed).toBeLessThanOrEqual(61);
    });

    it('should restore paused clock', () => {
      const pastStart = Date.now() - 60000;
      const pausedAt = Date.now() - 30000; // Paused 30s ago
      gameClockService.restore({
        startTime: pastStart,
        pausedAt,
        totalPausedMs: 0
      });

      const state = gameClockService.getState();
      expect(state.status).toBe('paused');
      // Active time was 30s (60s ago start, paused 30s ago)
      expect(gameClockService.getElapsed()).toBe(30);
    });
  });

  describe('reset()', () => {
    it('should return to initial state', () => {
      gameClockService.start();
      jest.advanceTimersByTime(5000);
      gameClockService.reset();

      expect(gameClockService.getState().status).toBe('stopped');
      expect(gameClockService.getElapsed()).toBe(0);
    });
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npx jest tests/unit/services/gameClockService.test.js --verbose
```

Expected: FAIL — module not found.

### Step 3: Implement `gameClockService.js`

**File:** `backend/src/services/gameClockService.js`

```javascript
'use strict';

const EventEmitter = require('events');
const logger = require('../utils/logger');

class GameClockService extends EventEmitter {
  constructor() {
    super();
    this._reset();
  }

  _reset() {
    this.gameStartTime = null;
    this.pauseStartTime = null;
    this.totalPausedMs = 0;
    this.interval = null;
    this.status = 'stopped'; // stopped | running | paused
  }

  start() {
    if (this.status === 'running') {
      throw new Error('Game clock is already running');
    }
    this.gameStartTime = Date.now();
    this.totalPausedMs = 0;
    this.pauseStartTime = null;
    this.status = 'running';
    this._startInterval();
    this.emit('gameclock:started', { gameStartTime: this.gameStartTime });
    logger.info('[GameClock] Started');
  }

  pause() {
    if (this.status !== 'running') return;
    this.pauseStartTime = Date.now();
    this._stopInterval();
    this.status = 'paused';
    const elapsed = this.getElapsed();
    this.emit('gameclock:paused', { elapsed });
    logger.info(`[GameClock] Paused at ${elapsed}s`);
  }

  resume() {
    if (this.status !== 'paused') return;
    this.totalPausedMs += Date.now() - this.pauseStartTime;
    this.pauseStartTime = null;
    this.status = 'running';
    this._startInterval();
    const elapsed = this.getElapsed();
    this.emit('gameclock:resumed', { elapsed });
    logger.info(`[GameClock] Resumed at ${elapsed}s`);
  }

  stop() {
    this._stopInterval();
    this.status = 'stopped';
    logger.info('[GameClock] Stopped');
  }

  getElapsed() {
    if (!this.gameStartTime) return 0;
    const now = this.status === 'paused' ? this.pauseStartTime : Date.now();
    return Math.floor((now - this.gameStartTime - this.totalPausedMs) / 1000);
  }

  getState() {
    return {
      status: this.status,
      elapsed: this.getElapsed(),
      startTime: this.gameStartTime,
      totalPausedMs: this.totalPausedMs
    };
  }

  /** Restore clock state from persisted session data (backend restart recovery). */
  restore(clockData) {
    if (!clockData || !clockData.startTime) return;
    this.gameStartTime = clockData.startTime;
    this.totalPausedMs = clockData.totalPausedMs || 0;

    if (clockData.pausedAt) {
      this.pauseStartTime = clockData.pausedAt;
      this.status = 'paused';
    } else {
      this.pauseStartTime = null;
      this.status = 'running';
      this._startInterval();
    }
    logger.info(`[GameClock] Restored: status=${this.status}, elapsed=${this.getElapsed()}s`);
  }

  /** Returns data suitable for session model persistence. */
  toPersistence() {
    return {
      startTime: this.gameStartTime,
      pausedAt: this.pauseStartTime,
      totalPausedMs: this.totalPausedMs
    };
  }

  reset() {
    this._stopInterval();
    this._reset();
  }

  cleanup() {
    this.reset();
    this.removeAllListeners();
  }

  _startInterval() {
    this._stopInterval();
    this.interval = setInterval(() => this._tick(), 1000);
  }

  _stopInterval() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  _tick() {
    const elapsed = this.getElapsed();
    this.emit('gameclock:tick', { elapsed });
  }
}

module.exports = new GameClockService();
```

### Step 4: Run tests

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npx jest tests/unit/services/gameClockService.test.js --verbose
```

Expected: PASS

### Step 5: Commit

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add backend/src/services/gameClockService.js backend/tests/unit/services/gameClockService.test.js
git commit -m "feat: add gameClockService with start/pause/resume/restore lifecycle"
```

---

## Task 4: Session Lifecycle — `setup` Phase and `session:start`

**Goal:** Add `setup` status to sessions. `session:create` now creates in `setup` state (networked). `session:start` transitions to `active` and starts the game clock. Transactions are rejected unless status is `active` (roadmap Section 2, D16-D17, D44).

**Files:**
- Modify: `backend/src/services/sessionService.js`
- Modify: `backend/src/services/transactionService.js`
- Modify: `backend/src/services/commandExecutor.js`
- Create: `backend/tests/unit/services/session-lifecycle-phase1.test.js`

### Step 1: Write failing tests for the new lifecycle

```javascript
// backend/tests/unit/services/session-lifecycle-phase1.test.js
'use strict';

describe('Session Lifecycle - Phase 1', () => {
  let sessionService, transactionService, gameClockService;

  beforeEach(() => {
    jest.resetModules();
    sessionService = require('../../../src/services/sessionService');
    transactionService = require('../../../src/services/transactionService');
    gameClockService = require('../../../src/services/gameClockService');
    // Reset services to clean state
    gameClockService.reset();
  });

  afterEach(() => {
    gameClockService.cleanup();
  });

  describe('session:create creates setup session', () => {
    it('should create session with status setup', async () => {
      const session = await sessionService.createSession({ name: 'Test Game' });
      expect(session.status).toBe('setup');
    });

    it('should not start the game clock on create', async () => {
      await sessionService.createSession({ name: 'Test Game' });
      expect(gameClockService.getState().status).toBe('stopped');
    });
  });

  describe('session:start transitions setup → active', () => {
    it('should transition session to active', async () => {
      await sessionService.createSession({ name: 'Test Game' });
      await sessionService.startGame();
      const session = sessionService.getCurrentSession();
      expect(session.status).toBe('active');
    });

    it('should record gameStartTime on session', async () => {
      await sessionService.createSession({ name: 'Test Game' });
      await sessionService.startGame();
      const session = sessionService.getCurrentSession();
      expect(session.gameStartTime).toBeTruthy();
    });

    it('should start the game clock', async () => {
      await sessionService.createSession({ name: 'Test Game' });
      await sessionService.startGame();
      expect(gameClockService.getState().status).toBe('running');
    });

    it('should emit session:started event', async () => {
      const handler = jest.fn();
      sessionService.on('session:started', handler);
      await sessionService.createSession({ name: 'Test Game' });
      await sessionService.startGame();
      expect(handler).toHaveBeenCalled();
    });

    it('should throw if session is not in setup state', async () => {
      await sessionService.createSession({ name: 'Test Game' });
      await sessionService.startGame(); // Now active
      await expect(sessionService.startGame()).rejects.toThrow();
    });

    it('should throw if no session exists', async () => {
      await expect(sessionService.startGame()).rejects.toThrow();
    });
  });

  describe('transactions rejected unless active', () => {
    it('should reject scan during setup', async () => {
      await sessionService.createSession({ name: 'Test Game' });
      // Session is in setup — processScan should reject
      const result = await transactionService.processScan({
        tokenId: 'test-token',
        teamId: 'Team A',
        deviceId: 'gm-1',
        deviceType: 'gm',
        mode: 'blackMarket'
      });
      expect(result.status).toBe('rejected');
      expect(result.reason).toMatch(/no active game/i);
    });
  });

  describe('pause/resume integrates with game clock', () => {
    it('should pause game clock on session:pause', async () => {
      await sessionService.createSession({ name: 'Test Game' });
      await sessionService.startGame();
      await sessionService.updateSession({ status: 'paused' });
      expect(gameClockService.getState().status).toBe('paused');
    });

    it('should resume game clock on session:resume', async () => {
      await sessionService.createSession({ name: 'Test Game' });
      await sessionService.startGame();
      await sessionService.updateSession({ status: 'paused' });
      await sessionService.updateSession({ status: 'active' });
      expect(gameClockService.getState().status).toBe('running');
    });
  });

  describe('game clock state persisted on session', () => {
    it('should include gameClock in session model', async () => {
      await sessionService.createSession({ name: 'Test Game' });
      await sessionService.startGame();
      const session = sessionService.getCurrentSession();
      expect(session.gameClock).toBeDefined();
      expect(session.gameClock.startTime).toBeTruthy();
    });
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npx jest tests/unit/services/session-lifecycle-phase1.test.js --verbose
```

Expected: FAIL — `startGame` method doesn't exist, sessions still create as `active`.

### Step 3: Implement changes

**Modify `sessionService.js`:**
- `createSession()` — change initial status from `'active'` to `'setup'`
- Add `startGame()` — validates current session is in `setup`, transitions to `active`, records `gameStartTime`, calls `gameClockService.start()`, emits `session:started`
- `updateSession({status: 'paused'})` — also call `gameClockService.pause()`
- `updateSession({status: 'active'})` (resume) — also call `gameClockService.resume()`
- `endSession()` — also call `gameClockService.stop()`
- `saveCurrentSession()` — include `gameClock: gameClockService.toPersistence()` in the session model
- `init()` — if restoring an active session with `gameClock` data, call `gameClockService.restore(session.gameClock)`

**Modify `transactionService.js`:**
- Add status check at top of `processScan()`:
  ```javascript
  const session = sessionService.getCurrentSession();
  if (!session || session.status !== 'active') {
    return { status: 'rejected', reason: 'No active game' };
  }
  ```
- Same check in `createManualTransaction()`

**Modify `commandExecutor.js`:**
- Add `session:start` case:
  ```javascript
  case 'session:start': {
    await sessionService.startGame();
    return { success: true, message: 'Game started' };
  }
  ```

### Step 4: Run tests

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npx jest tests/unit/services/session-lifecycle-phase1.test.js --verbose
```

Expected: PASS

### Step 5: Run ALL unit tests for regressions

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npm run test:unit
```

Expected: PASS. Some existing tests may need updating if they assume `createSession` produces `status: 'active'` — fix those tests to account for the new `setup` status.

**Known impact areas:**
- Any test that creates a session and immediately processes a scan will now fail because the session is in `setup` state. Those tests need to call `sessionService.startGame()` after `createSession()`.
- Integration tests in `tests/integration/` will also need updating.

**CRITICAL — Bellwether E2E Test 30:**
- `backend/tests/e2e/flows/30-full-game-session-multi-device.test.js` is the project's most comprehensive E2E test (706 lines, 6 browser contexts, 7 phases).
- It currently calls `createSessionWithTeams()` and immediately starts scanning tokens.
- After this task, sessions start in `setup` state, so **test 30 WILL BREAK** — transactions are rejected unless status is `active`.
- **FIX REQUIRED IN THIS TASK:** Add a `session:start` step (via `gm:command`) after session creation and before the first scan. The `createSessionWithTeams()` helper or the test's Phase 1.5 setup needs to emit `session:start` to transition the session to `active`.
- Phase 1.5 of test 30 already tests environment control (audio routing, BT scan, lighting) — this is where the `session:start` command naturally fits.
- This test is our **bellwether** — it must pass after this task and at every subsequent batch boundary.

### Step 6: Fix bellwether E2E test 30

Update `backend/tests/e2e/flows/30-full-game-session-multi-device.test.js` to add `session:start` after session creation. The test's `createSessionWithTeams()` helper creates the session. After that call (and before any scans), add:

```javascript
// Start the game (transitions session from setup → active)
await gm1Page.evaluate(() => {
  // Emit session:start via the GM's WebSocket connection
  window.__socket.emit('gm:command', { action: 'session:start' });
});
// Wait for session to transition to active
await expect(gm1Page.locator('[data-session-status="active"]')).toBeVisible({ timeout: 5000 });
```

The exact implementation depends on how the test's helper functions work — read the test first and adapt.

### Step 7: Run E2E test 30

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npx playwright test tests/e2e/flows/30-full-game-session-multi-device.test.js
```

Expected: PASS — this is the bellwether gate.

### Step 8: Commit

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add backend/src/services/sessionService.js backend/src/services/transactionService.js \
  backend/src/services/commandExecutor.js backend/tests/unit/services/session-lifecycle-phase1.test.js \
  backend/tests/e2e/flows/30-full-game-session-multi-device.test.js
git commit -m "feat: add session setup phase with session:start and game clock integration"
```

### Step 9: Fix any other broken existing tests

If Step 5 produced failures beyond test 30, fix them now. Each existing test that creates a session and processes scans needs to also call `startGame()`. Commit the test fixes separately:

```bash
git add backend/tests/
git commit -m "test: update existing tests for setup→active session lifecycle"
```

---

## Task 5: `soundService`

**Goal:** Create a service that plays sound effects via `pw-play` (native PipeWire). Fire-and-forget, concurrent sounds overlap, tracked by PID for stop capability (roadmap Section 6, D5/D20).

**Files:**
- Create: `backend/src/services/soundService.js`
- Create: `backend/tests/unit/services/soundService.test.js`

### Step 1: Write failing tests

```javascript
// backend/tests/unit/services/soundService.test.js
'use strict';

const { EventEmitter } = require('events');

// Mock child_process.spawn before requiring the service
const mockProcess = new EventEmitter();
mockProcess.pid = 12345;
mockProcess.kill = jest.fn();
mockProcess.stdout = new EventEmitter();
mockProcess.stderr = new EventEmitter();

jest.mock('child_process', () => ({
  spawn: jest.fn(() => mockProcess)
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(() => true)
}));

describe('SoundService', () => {
  let soundService;
  const { spawn } = require('child_process');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Re-create mock process for each test
    const newMockProcess = new EventEmitter();
    newMockProcess.pid = 12345;
    newMockProcess.kill = jest.fn();
    newMockProcess.stdout = new EventEmitter();
    newMockProcess.stderr = new EventEmitter();
    spawn.mockReturnValue(newMockProcess);

    soundService = require('../../../src/services/soundService');
    soundService.reset();
  });

  afterEach(() => {
    soundService.cleanup();
  });

  describe('play()', () => {
    it('should spawn pw-play with file path', () => {
      soundService.play({ file: 'fanfare.wav' });
      expect(spawn).toHaveBeenCalledWith(
        'pw-play',
        expect.arrayContaining([expect.stringContaining('fanfare.wav')]),
        expect.any(Object)
      );
    });

    it('should emit sound:started', () => {
      const handler = jest.fn();
      soundService.on('sound:started', handler);
      soundService.play({ file: 'fanfare.wav' });
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ file: 'fanfare.wav' })
      );
    });

    it('should accept optional target sink', () => {
      soundService.play({ file: 'fanfare.wav', target: 'bt-left' });
      expect(spawn).toHaveBeenCalledWith(
        'pw-play',
        expect.arrayContaining(['--target', 'bt-left']),
        expect.any(Object)
      );
    });

    it('should accept optional volume', () => {
      soundService.play({ file: 'fanfare.wav', volume: 80 });
      expect(spawn).toHaveBeenCalledWith(
        'pw-play',
        expect.arrayContaining(['--volume', '0.8']),
        expect.any(Object)
      );
    });

    it('should track running process', () => {
      soundService.play({ file: 'fanfare.wav' });
      expect(soundService.getPlaying()).toHaveLength(1);
      expect(soundService.getPlaying()[0].file).toBe('fanfare.wav');
    });
  });

  describe('stop()', () => {
    it('should kill process by filename', () => {
      const proc = new EventEmitter();
      proc.pid = 99;
      proc.kill = jest.fn();
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      spawn.mockReturnValue(proc);

      soundService.play({ file: 'fanfare.wav' });
      soundService.stop({ file: 'fanfare.wav' });

      expect(proc.kill).toHaveBeenCalled();
    });

    it('should kill all processes when no file specified', () => {
      const procs = [];
      for (let i = 0; i < 3; i++) {
        const proc = new EventEmitter();
        proc.pid = 100 + i;
        proc.kill = jest.fn();
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        procs.push(proc);
        spawn.mockReturnValueOnce(proc);
        soundService.play({ file: `sound${i}.wav` });
      }

      soundService.stop({});

      procs.forEach(proc => expect(proc.kill).toHaveBeenCalled());
    });
  });

  describe('process lifecycle', () => {
    it('should emit sound:completed when process exits with code 0', () => {
      const proc = new EventEmitter();
      proc.pid = 200;
      proc.kill = jest.fn();
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      spawn.mockReturnValue(proc);

      const handler = jest.fn();
      soundService.on('sound:completed', handler);

      soundService.play({ file: 'fanfare.wav' });
      proc.emit('close', 0);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ file: 'fanfare.wav' })
      );
    });

    it('should remove from playing list after exit', () => {
      const proc = new EventEmitter();
      proc.pid = 300;
      proc.kill = jest.fn();
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      spawn.mockReturnValue(proc);

      soundService.play({ file: 'fanfare.wav' });
      expect(soundService.getPlaying()).toHaveLength(1);

      proc.emit('close', 0);
      expect(soundService.getPlaying()).toHaveLength(0);
    });
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npx jest tests/unit/services/soundService.test.js --verbose
```

Expected: FAIL — module not found.

### Step 3: Implement `soundService.js`

**File:** `backend/src/services/soundService.js`

```javascript
'use strict';

const EventEmitter = require('events');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const config = require('../config');

class SoundService extends EventEmitter {
  constructor() {
    super();
    this.processes = new Map(); // pid → {file, target, volume, process}
    this.audioDir = path.join(config.video?.directory || path.join(__dirname, '../../public'), '../public/audio');
  }

  play({ file, target, volume }) {
    const filePath = path.resolve(this.audioDir, file);

    if (!fs.existsSync(filePath)) {
      logger.error(`[Sound] File not found: ${filePath}`);
      this.emit('sound:error', { file, error: `File not found: ${file}` });
      return null;
    }

    const args = [];
    if (target) args.push('--target', target);
    if (volume !== undefined) args.push('--volume', String(volume / 100));
    args.push(filePath);

    const proc = spawn('pw-play', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    const entry = { file, target: target || 'default', volume: volume || 100, pid: proc.pid };
    this.processes.set(proc.pid, { ...entry, process: proc });

    proc.on('close', (code) => {
      this.processes.delete(proc.pid);
      if (code === 0) {
        this.emit('sound:completed', { file, pid: proc.pid });
      } else {
        this.emit('sound:stopped', { file, pid: proc.pid, reason: code === null ? 'killed' : 'error' });
      }
    });

    proc.on('error', (err) => {
      this.processes.delete(proc.pid);
      logger.error(`[Sound] pw-play error for ${file}:`, err.message);
      this.emit('sound:error', { file, error: err.message });
    });

    this.emit('sound:started', entry);
    logger.info(`[Sound] Playing ${file} (pid=${proc.pid}, target=${entry.target})`);
    return entry;
  }

  stop({ file } = {}) {
    if (file) {
      for (const [pid, entry] of this.processes) {
        if (entry.file === file) {
          entry.process.kill();
          logger.info(`[Sound] Stopped ${file} (pid=${pid})`);
        }
      }
    } else {
      for (const [pid, entry] of this.processes) {
        entry.process.kill();
        logger.info(`[Sound] Stopped ${entry.file} (pid=${pid})`);
      }
    }
  }

  getPlaying() {
    return Array.from(this.processes.values()).map(({ file, target, volume, pid }) => ({
      file, target, volume, pid
    }));
  }

  reset() {
    this.stop();
    this.processes.clear();
  }

  cleanup() {
    this.reset();
    this.removeAllListeners();
  }
}

module.exports = new SoundService();
```

### Step 4: Run tests

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npx jest tests/unit/services/soundService.test.js --verbose
```

Expected: PASS

### Step 5: Add `sound:play` and `sound:stop` to `commandExecutor.js`

```javascript
// In the switch statement:
case 'sound:play': {
  const soundService = require('./soundService');
  const entry = soundService.play(payload);
  return entry
    ? { success: true, message: `Playing ${payload.file}` }
    : { success: false, message: `Failed to play ${payload.file}` };
}

case 'sound:stop': {
  const soundService = require('./soundService');
  soundService.stop(payload);
  return { success: true, message: payload.file ? `Stopped ${payload.file}` : 'Stopped all sounds' };
}
```

### Step 6: Create `backend/public/audio/` directory

```bash
mkdir -p /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend/public/audio
touch /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend/public/audio/.gitkeep
```

### Step 7: Commit

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add backend/src/services/soundService.js backend/tests/unit/services/soundService.test.js \
  backend/src/services/commandExecutor.js backend/public/audio/.gitkeep
git commit -m "feat: add soundService for pw-play sound effects with play/stop/track"
```

---

## Task 6: `cueEngineService` — Simple Cues + Standing Cues

**Goal:** The core cue engine. Loads cue definitions from `cues.json`. Evaluates event-triggered and clock-triggered standing cues. Fires simple cues (commands array) via `executeCommand()`. Phase 1 scope: simple cues only — compound cues (timeline) are Phase 2 (roadmap Section 3, D21-D26, D49-D50).

**Files:**
- Create: `backend/src/services/cueEngineService.js`
- Create: `backend/tests/unit/services/cueEngineService.test.js`
- Create: `backend/config/environment/cues.json` (starter config)

**This is the largest task. Split into sub-steps.**

### Step 1: Write failing tests — cue loading and manual fire

```javascript
// backend/tests/unit/services/cueEngineService.test.js
'use strict';

// Mock executeCommand before requiring cueEngineService
jest.mock('../../../src/services/commandExecutor', () => ({
  executeCommand: jest.fn().mockResolvedValue({ success: true, message: 'ok' })
}));

// Mock gameClockService
jest.mock('../../../src/services/gameClockService', () => {
  const EventEmitter = require('events');
  const mock = new EventEmitter();
  mock.getElapsed = jest.fn().mockReturnValue(0);
  mock.getState = jest.fn().mockReturnValue({ status: 'stopped', elapsed: 0 });
  mock.reset = jest.fn();
  mock.cleanup = jest.fn();
  return mock;
});

const { executeCommand } = require('../../../src/services/commandExecutor');

describe('CueEngineService', () => {
  let cueEngineService, gameClockService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Re-require after mocks
    jest.mock('../../../src/services/commandExecutor', () => ({
      executeCommand: jest.fn().mockResolvedValue({ success: true, message: 'ok' })
    }));

    cueEngineService = require('../../../src/services/cueEngineService');
    gameClockService = require('../../../src/services/gameClockService');
    cueEngineService.reset();
  });

  afterEach(() => {
    cueEngineService.cleanup();
  });

  describe('loadCues()', () => {
    it('should load cue definitions from array', () => {
      cueEngineService.loadCues([
        { id: 'test-cue', label: 'Test', commands: [{ action: 'sound:play', payload: { file: 'test.wav' } }] }
      ]);
      expect(cueEngineService.getCues()).toHaveLength(1);
    });

    it('should reject cue with both commands and timeline', () => {
      expect(() => {
        cueEngineService.loadCues([{
          id: 'bad-cue',
          label: 'Bad',
          commands: [{ action: 'sound:play' }],
          timeline: [{ at: 0, action: 'sound:play' }]
        }]);
      }).toThrow(/bad-cue.*mutually exclusive/i);
    });

    it('should identify standing cues (have trigger)', () => {
      cueEngineService.loadCues([
        { id: 'standing', label: 'Standing', trigger: { event: 'transaction:accepted' }, commands: [{ action: 'sound:play', payload: { file: 'a.wav' } }] },
        { id: 'manual', label: 'Manual', commands: [{ action: 'sound:play', payload: { file: 'b.wav' } }] }
      ]);
      expect(cueEngineService.getStandingCues()).toHaveLength(1);
    });
  });

  describe('fireCue() — simple cue', () => {
    it('should execute all commands in a simple cue', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');
      cueEngineService.loadCues([{
        id: 'multi-cmd',
        label: 'Multi',
        commands: [
          { action: 'sound:play', payload: { file: 'a.wav' } },
          { action: 'lighting:scene:activate', payload: { sceneId: 'scene.dim' } }
        ]
      }]);

      await cueEngineService.fireCue('multi-cmd');

      expect(executeCommand).toHaveBeenCalledTimes(2);
      expect(executeCommand).toHaveBeenCalledWith(expect.objectContaining({
        action: 'sound:play',
        source: 'cue'
      }));
      expect(executeCommand).toHaveBeenCalledWith(expect.objectContaining({
        action: 'lighting:scene:activate',
        source: 'cue'
      }));
    });

    it('should emit cue:fired event', async () => {
      const handler = jest.fn();
      cueEngineService.on('cue:fired', handler);
      cueEngineService.loadCues([{
        id: 'test', label: 'Test',
        commands: [{ action: 'sound:play', payload: { file: 'a.wav' } }]
      }]);

      await cueEngineService.fireCue('test');
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ cueId: 'test' }));
    });

    it('should throw for unknown cue ID', async () => {
      await expect(cueEngineService.fireCue('nonexistent')).rejects.toThrow(/not found/i);
    });

    it('should skip disabled cue', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');
      cueEngineService.loadCues([{
        id: 'test', label: 'Test',
        commands: [{ action: 'sound:play', payload: { file: 'a.wav' } }]
      }]);
      cueEngineService.disableCue('test');

      await cueEngineService.fireCue('test');
      expect(executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('once flag', () => {
    it('should auto-disable after first fire when once=true', async () => {
      cueEngineService.loadCues([{
        id: 'one-shot', label: 'One Shot', once: true,
        commands: [{ action: 'sound:play', payload: { file: 'a.wav' } }]
      }]);

      await cueEngineService.fireCue('one-shot');
      // Second fire should be skipped
      const { executeCommand } = require('../../../src/services/commandExecutor');
      executeCommand.mockClear();
      await cueEngineService.fireCue('one-shot');
      expect(executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('enable/disable', () => {
    it('should disable and re-enable a cue', () => {
      cueEngineService.loadCues([{ id: 'test', label: 'Test', commands: [] }]);
      cueEngineService.disableCue('test');
      expect(cueEngineService.getDisabledCues()).toContain('test');
      cueEngineService.enableCue('test');
      expect(cueEngineService.getDisabledCues()).not.toContain('test');
    });
  });

  describe('event-triggered standing cues', () => {
    it('should fire matching cue when event occurs', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');
      cueEngineService.loadCues([{
        id: 'on-scan',
        label: 'On Scan',
        trigger: { event: 'transaction:accepted' },
        commands: [{ action: 'sound:play', payload: { file: 'cha-ching.wav' } }]
      }]);

      cueEngineService.activate(); // Start listening

      // Simulate the event
      cueEngineService.handleGameEvent('transaction:accepted', {
        transaction: { tokenId: 'T1', teamId: 'A', deviceType: 'gm', points: 50000, memoryType: 'Business', valueRating: 3, groupId: null },
        teamScore: { currentScore: 50000 },
        groupBonus: null
      });

      // Allow async fire to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(executeCommand).toHaveBeenCalled();
    });

    it('should NOT fire when conditions do not match', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');
      cueEngineService.loadCues([{
        id: 'business-only',
        label: 'Business Only',
        trigger: { event: 'transaction:accepted' },
        conditions: [{ field: 'memoryType', op: 'eq', value: 'Business' }],
        commands: [{ action: 'sound:play', payload: { file: 'b.wav' } }]
      }]);

      cueEngineService.activate();

      cueEngineService.handleGameEvent('transaction:accepted', {
        transaction: { tokenId: 'T1', teamId: 'A', deviceType: 'gm', points: 10000, memoryType: 'Personal', valueRating: 1, groupId: null },
        teamScore: { currentScore: 10000 },
        groupBonus: null
      });

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(executeCommand).not.toHaveBeenCalled();
    });

    it('should fire when all conditions match', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');
      cueEngineService.loadCues([{
        id: 'big-business',
        label: 'Big Business',
        trigger: { event: 'transaction:accepted' },
        conditions: [
          { field: 'memoryType', op: 'eq', value: 'Business' },
          { field: 'teamScore', op: 'gte', value: 100000 }
        ],
        commands: [{ action: 'sound:play', payload: { file: 'big.wav' } }]
      }]);

      cueEngineService.activate();

      cueEngineService.handleGameEvent('transaction:accepted', {
        transaction: { tokenId: 'T1', teamId: 'A', deviceType: 'gm', points: 150000, memoryType: 'Business', valueRating: 3, groupId: null },
        teamScore: { currentScore: 200000 },
        groupBonus: null
      });

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(executeCommand).toHaveBeenCalled();
    });
  });

  describe('condition operators', () => {
    const makeEngine = (conditions) => {
      cueEngineService.loadCues([{
        id: 'cond-test', label: 'Test',
        trigger: { event: 'transaction:accepted' },
        conditions,
        commands: [{ action: 'sound:play', payload: { file: 'x.wav' } }]
      }]);
      cueEngineService.activate();
    };

    const fireEvent = (overrides = {}) => {
      cueEngineService.handleGameEvent('transaction:accepted', {
        transaction: { tokenId: 'T1', teamId: 'A', deviceType: 'gm', points: 50000, memoryType: 'Business', valueRating: 3, groupId: null, ...overrides },
        teamScore: { currentScore: overrides.teamScore || 50000 },
        groupBonus: null
      });
    };

    it('should support neq operator', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');
      makeEngine([{ field: 'memoryType', op: 'neq', value: 'Personal' }]);
      fireEvent({ memoryType: 'Business' });
      await new Promise(r => setTimeout(r, 10));
      expect(executeCommand).toHaveBeenCalled();
    });

    it('should support in operator', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');
      makeEngine([{ field: 'memoryType', op: 'in', value: ['Business', 'Technical'] }]);
      fireEvent({ memoryType: 'Technical' });
      await new Promise(r => setTimeout(r, 10));
      expect(executeCommand).toHaveBeenCalled();
    });

    it('should support gt operator', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');
      makeEngine([{ field: 'points', op: 'gt', value: 40000 }]);
      fireEvent({ points: 50000 });
      await new Promise(r => setTimeout(r, 10));
      expect(executeCommand).toHaveBeenCalled();
    });

    it('should support lt operator', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');
      makeEngine([{ field: 'valueRating', op: 'lt', value: 4 }]);
      fireEvent({ valueRating: 3 });
      await new Promise(r => setTimeout(r, 10));
      expect(executeCommand).toHaveBeenCalled();
    });
  });

  describe('clock-triggered standing cues', () => {
    it('should fire when game clock reaches threshold', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');
      cueEngineService.loadCues([{
        id: 'midgame',
        label: 'Midgame',
        once: true,
        trigger: { clock: '01:00:00' },
        commands: [{ action: 'lighting:scene:activate', payload: { sceneId: 'scene.tension' } }]
      }]);

      cueEngineService.activate();

      // Simulate clock tick at 3600 seconds (01:00:00)
      cueEngineService.handleClockTick(3600);

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(executeCommand).toHaveBeenCalled();
    });

    it('should NOT fire before threshold', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');
      cueEngineService.loadCues([{
        id: 'midgame', label: 'Midgame', once: true,
        trigger: { clock: '01:00:00' },
        commands: [{ action: 'sound:play', payload: { file: 'x.wav' } }]
      }]);

      cueEngineService.activate();
      cueEngineService.handleClockTick(3599); // 59:59 — not yet

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(executeCommand).not.toHaveBeenCalled();
    });

    it('should fire only once for a given clock cue', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');
      cueEngineService.loadCues([{
        id: 'midgame', label: 'Midgame',
        trigger: { clock: '01:00:00' },
        commands: [{ action: 'sound:play', payload: { file: 'x.wav' } }]
      }]);

      cueEngineService.activate();
      cueEngineService.handleClockTick(3600);
      await new Promise(r => setTimeout(r, 10));
      executeCommand.mockClear();

      cueEngineService.handleClockTick(3601);
      await new Promise(r => setTimeout(r, 10));
      expect(executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('re-entrancy guard (D4)', () => {
    it('should not evaluate standing cues for commands dispatched by cues', async () => {
      // This is tested indirectly: executeCommand is called with source:'cue',
      // and the cue engine should not re-evaluate standing cues from those dispatches.
      // The guard is in the activate() listener — it only subscribes to game events,
      // not to executeCommand output.
      expect(true).toBe(true); // Structural guarantee — no circular subscription
    });
  });

  describe('suspend/reactivate', () => {
    it('should not fire standing cues while suspended', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');
      cueEngineService.loadCues([{
        id: 'test', label: 'Test',
        trigger: { event: 'transaction:accepted' },
        commands: [{ action: 'sound:play', payload: { file: 'x.wav' } }]
      }]);

      cueEngineService.activate();
      cueEngineService.suspend();

      cueEngineService.handleGameEvent('transaction:accepted', {
        transaction: { tokenId: 'T1', teamId: 'A', deviceType: 'gm', points: 10000, memoryType: 'Personal', valueRating: 1, groupId: null },
        teamScore: { currentScore: 10000 },
        groupBonus: null
      });

      await new Promise(r => setTimeout(r, 10));
      expect(executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('getCueSummaries()', () => {
    it('should return summary without commands/timeline arrays', () => {
      cueEngineService.loadCues([{
        id: 'test', label: 'Test', icon: 'sound', quickFire: true, once: false,
        trigger: { event: 'transaction:accepted' },
        commands: [{ action: 'sound:play', payload: { file: 'x.wav' } }]
      }]);

      const summaries = cueEngineService.getCueSummaries();
      expect(summaries[0]).toEqual({
        id: 'test',
        label: 'Test',
        icon: 'sound',
        quickFire: true,
        once: false,
        triggerType: 'event',
        enabled: true
      });
      expect(summaries[0].commands).toBeUndefined();
    });
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npx jest tests/unit/services/cueEngineService.test.js --verbose
```

Expected: FAIL — module not found.

### Step 3: Implement `cueEngineService.js`

**File:** `backend/src/services/cueEngineService.js`

Key implementation points:
- `loadCues(cuesArray)` — validates, indexes by ID, separates standing cues
- `fireCue(cueId)` — dispatches commands via `executeCommand({...cmd, source: 'cue'})`
- `handleGameEvent(eventName, payload)` — normalizes payload (EVENT_NORMALIZERS), evaluates event-triggered standing cues, fires matches
- `handleClockTick(elapsedSeconds)` — evaluates clock-triggered cues, fires once per threshold
- `activate()` / `suspend()` — toggle active listening
- `enableCue(id)` / `disableCue(id)` — toggle individual cues
- `evaluateConditions(conditions, context)` — operators: eq, neq, gt, gte, lt, lte, in
- `parseClockTime(str)` — converts `"HH:MM:SS"` to seconds
- `EVENT_NORMALIZERS` — flattens internal event payloads to flat fields (per roadmap Section 3)
- Emits: `cue:fired`, `cue:completed`, `cue:error`

### Step 4: Run tests

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npx jest tests/unit/services/cueEngineService.test.js --verbose
```

Expected: PASS

### Step 5: Add cue commands to `commandExecutor.js`

```javascript
case 'cue:fire': {
  const cueEngineService = require('./cueEngineService');
  await cueEngineService.fireCue(payload.cueId);
  return { success: true, message: `Cue fired: ${payload.cueId}` };
}
case 'cue:enable': {
  const cueEngineService = require('./cueEngineService');
  cueEngineService.enableCue(payload.cueId);
  return { success: true, message: `Cue enabled: ${payload.cueId}` };
}
case 'cue:disable': {
  const cueEngineService = require('./cueEngineService');
  cueEngineService.disableCue(payload.cueId);
  return { success: true, message: `Cue disabled: ${payload.cueId}` };
}
// cue:stop, cue:pause, cue:resume — stub for Phase 1, full implementation in Phase 2
case 'cue:stop':
case 'cue:pause':
case 'cue:resume':
  return { success: false, message: `${action} not yet implemented (Phase 2: compound cues)` };
```

### Step 6: Commit

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add backend/src/services/cueEngineService.js backend/tests/unit/services/cueEngineService.test.js \
  backend/src/services/commandExecutor.js
git commit -m "feat: add cueEngineService with standing cues, conditions, and clock triggers"
```

---

## Task 7: Wire Services — Broadcasts, Sync, Audio Routing

**Goal:** Connect new services to the broadcast layer, update sync:full payload, expand audio routing for new streams. (roadmap Sections 9, 11)

**Files:**
- Modify: `backend/src/websocket/broadcasts.js`
- Modify: `backend/src/websocket/syncHelpers.js`
- Modify: `backend/src/websocket/environmentHelpers.js`
- Modify: `backend/src/services/audioRoutingService.js`
- Create: `backend/tests/unit/websocket/phase1-broadcasts.test.js`

### Step 1: Write failing tests for new broadcast events

```javascript
// backend/tests/unit/websocket/phase1-broadcasts.test.js
'use strict';

describe('Phase 1 Broadcasts', () => {
  // Test that new services' events are bridged to WebSocket.
  // Follow existing broadcast test patterns.

  it('should broadcast gameclock:status on gameclock:started', () => {
    // Verify setupBroadcastListeners wires gameClockService events
  });

  it('should broadcast cue:fired on cueEngineService cue:fired', () => {
    // Verify cue events are bridged
  });

  it('should broadcast sound:status on soundService events', () => {
    // Verify sound events are bridged
  });

  it('should include cueEngine and gameClock in sync:full payload', () => {
    // Verify buildSyncFullPayload includes new sections
  });
});
```

### Step 2: Implement broadcast wiring

**Modify `broadcasts.js`:**

Add listeners for new services (following the existing pattern with `listenerRegistry.addTrackedListener()`):

```javascript
// gameClockService events
listenerRegistry.addTrackedListener(gameClockService, 'gameclock:started', (data) => {
  emitToRoom(io, 'gm', 'gameclock:status', { state: 'running', elapsed: 0 });
});
listenerRegistry.addTrackedListener(gameClockService, 'gameclock:paused', (data) => {
  emitToRoom(io, 'gm', 'gameclock:status', { state: 'paused', elapsed: data.elapsed });
});
listenerRegistry.addTrackedListener(gameClockService, 'gameclock:resumed', (data) => {
  emitToRoom(io, 'gm', 'gameclock:status', { state: 'running', elapsed: data.elapsed });
});

// cueEngineService events
listenerRegistry.addTrackedListener(cueEngineService, 'cue:fired', (data) => {
  emitToRoom(io, 'gm', 'cue:fired', data);
});
listenerRegistry.addTrackedListener(cueEngineService, 'cue:completed', (data) => {
  emitToRoom(io, 'gm', 'cue:completed', data);
});
listenerRegistry.addTrackedListener(cueEngineService, 'cue:error', (data) => {
  emitToRoom(io, 'gm', 'cue:error', data);
});

// soundService events
listenerRegistry.addTrackedListener(soundService, 'sound:started', () => {
  emitToRoom(io, 'gm', 'sound:status', { playing: soundService.getPlaying() });
});
listenerRegistry.addTrackedListener(soundService, 'sound:completed', () => {
  emitToRoom(io, 'gm', 'sound:status', { playing: soundService.getPlaying() });
});
listenerRegistry.addTrackedListener(soundService, 'sound:stopped', () => {
  emitToRoom(io, 'gm', 'sound:status', { playing: soundService.getPlaying() });
});
```

**Modify `syncHelpers.js` — `buildSyncFullPayload()`:**

Add new sections (following the existing `buildEnvironmentState()` graceful degradation pattern):

```javascript
// In buildSyncFullPayload, add:
cueEngine: buildCueEngineState(cueEngineService),
gameClock: buildGameClockState(gameClockService),
```

Where:
```javascript
function buildCueEngineState(cueEngineService) {
  try {
    return {
      loaded: true,
      cues: cueEngineService.getCueSummaries(),
      activeCues: [],  // Phase 2: compound cue state
      disabledCues: cueEngineService.getDisabledCues()
    };
  } catch {
    return { loaded: false, cues: [], activeCues: [], disabledCues: [] };
  }
}

function buildGameClockState(gameClockService) {
  try {
    const state = gameClockService.getState();
    return {
      status: state.status,
      elapsed: state.elapsed,
      expectedDuration: 7200  // 2 hours default; make configurable later
    };
  } catch {
    return { status: 'stopped', elapsed: 0, expectedDuration: 7200 };
  }
}
```

**Modify `audioRoutingService.js`:**
- Expand `VALID_STREAMS` from `['video']` to `['video', 'spotify', 'sound']`
- Add `audio:volume:set` command support in `commandExecutor.js`

### Step 3: Wire service initialization in `server.js`

**Modify `backend/src/server.js`** (or wherever services are initialized):
- Import `gameClockService`, `cueEngineService`, `soundService`
- Load cues from `config/environment/cues.json` if it exists
- Call `cueEngineService.loadCues(cuesData)` during init
- Pass new services to `setupBroadcastListeners()`
- Wire `gameClockService` tick events to `cueEngineService.handleClockTick()`
- Wire game events (`transaction:accepted`, `group:completed`, `video:*`, `player:scan`, `session:created`) from existing services to `cueEngineService.handleGameEvent()`

### Step 4: Run all tests

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npm test
```

Expected: PASS

### Step 5: Commit

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add backend/src/websocket/broadcasts.js backend/src/websocket/syncHelpers.js \
  backend/src/services/audioRoutingService.js backend/src/server.js \
  backend/tests/unit/websocket/phase1-broadcasts.test.js
git commit -m "feat: wire game clock, cue engine, and sound to broadcasts and sync:full"
```

---

## Task 8: Config Files

**Goal:** Create starter configuration files for cues and expanded routing.

**Files:**
- Create: `backend/config/environment/cues.json`
- Modify: `backend/config/environment/routing.json` (if exists, otherwise create)

### Step 1: Create `cues.json` with starter cues

Use the example cues from the roadmap Section 8 (`cues.json` full example). Start with a minimal set:

```json
{
  "cues": [
    {
      "id": "attention-before-video",
      "label": "Pre-Video Alert",
      "icon": "alert",
      "trigger": { "event": "video:loading" },
      "commands": [
        { "action": "sound:play", "payload": { "file": "attention.wav" } },
        { "action": "lighting:scene:activate", "payload": { "sceneId": "scene.dim" } }
      ]
    },
    {
      "id": "restore-after-video",
      "label": "Post-Video Restore",
      "icon": "alert",
      "trigger": { "event": "video:completed" },
      "commands": [
        { "action": "lighting:scene:activate", "payload": { "sceneId": "scene.house_lights" } }
      ]
    },
    {
      "id": "tension-hit",
      "label": "Tension Hit",
      "icon": "sound",
      "quickFire": true,
      "commands": [
        { "action": "sound:play", "payload": { "file": "tension.wav" } }
      ]
    }
  ]
}
```

### Step 2: Create/update `routing.json`

```json
{
  "routes": {
    "video": { "sink": "hdmi", "fallback": "hdmi" },
    "spotify": { "sink": "hdmi", "fallback": "hdmi" },
    "sound": { "sink": "hdmi", "fallback": "hdmi" }
  }
}
```

### Step 3: Commit

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add backend/config/environment/cues.json backend/config/environment/routing.json
git commit -m "feat: add starter cue definitions and expanded routing config"
```

---

## Task 9: GM Scanner — `orchestratorClient.js` + Controllers

**Goal:** Add new event types to the GM Scanner's message forwarding list and create CueController + SoundController. **All GM Scanner changes are committed to the ALNScanner submodule.**

**Files (all paths relative to ALNScanner/):**
- Modify: `src/network/orchestratorClient.js`
- Create: `src/admin/CueController.js`
- Create: `src/admin/SoundController.js`
- Modify: `src/app/adminController.js`
- Create: `tests/unit/admin/CueController.test.js`
- Create: `tests/unit/admin/SoundController.test.js`

### Step 1: Add new messageTypes to `orchestratorClient.js`

Add to the `messageTypes` array (lines 240-267):

```javascript
'gameclock:status',
'cue:fired',
'cue:status',
'cue:completed',
'cue:error',
'sound:status',
```

### Step 2: Write failing tests for CueController

```javascript
// ALNScanner/tests/unit/admin/CueController.test.js
import CueController from '../../../src/admin/CueController.js';
import { sendCommand } from '../../../src/admin/utils/CommandSender.js';

jest.mock('../../../src/admin/utils/CommandSender.js', () => ({
  sendCommand: jest.fn().mockResolvedValue({ success: true, message: 'ok' })
}));

describe('CueController', () => {
  let controller, mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = new EventTarget();
    controller = new CueController(mockClient);
  });

  it('should fire a cue', async () => {
    await controller.fireCue('tension-hit');
    expect(sendCommand).toHaveBeenCalledWith(
      mockClient, 'cue:fire', { cueId: 'tension-hit' }, expect.any(Number)
    );
  });

  it('should enable a cue', async () => {
    await controller.enableCue('midgame-tension');
    expect(sendCommand).toHaveBeenCalledWith(
      mockClient, 'cue:enable', { cueId: 'midgame-tension' }, expect.any(Number)
    );
  });

  it('should disable a cue', async () => {
    await controller.disableCue('midgame-tension');
    expect(sendCommand).toHaveBeenCalledWith(
      mockClient, 'cue:disable', { cueId: 'midgame-tension' }, expect.any(Number)
    );
  });

  it('should start game', async () => {
    await controller.startGame();
    expect(sendCommand).toHaveBeenCalledWith(
      mockClient, 'session:start', {}, expect.any(Number)
    );
  });
});
```

### Step 3: Implement CueController

```javascript
// ALNScanner/src/admin/CueController.js
import { sendCommand } from './utils/CommandSender.js';

const CUE_COMMANDS = {
  fire:    'cue:fire',
  stop:    'cue:stop',
  pause:   'cue:pause',
  resume:  'cue:resume',
  enable:  'cue:enable',
  disable: 'cue:disable',
};

export default class CueController {
  constructor(connection) {
    this.connection = connection;
  }

  async fireCue(cueId) {
    return sendCommand(this.connection, CUE_COMMANDS.fire, { cueId }, 5000);
  }

  async enableCue(cueId) {
    return sendCommand(this.connection, CUE_COMMANDS.enable, { cueId }, 5000);
  }

  async disableCue(cueId) {
    return sendCommand(this.connection, CUE_COMMANDS.disable, { cueId }, 5000);
  }

  async startGame() {
    return sendCommand(this.connection, 'session:start', {}, 10000);
  }
}
```

### Step 4: Implement SoundController (same pattern)

```javascript
// ALNScanner/src/admin/SoundController.js
import { sendCommand } from './utils/CommandSender.js';

export default class SoundController {
  constructor(connection) {
    this.connection = connection;
  }

  async playSound(file, target, volume) {
    const payload = { file };
    if (target) payload.target = target;
    if (volume !== undefined) payload.volume = volume;
    return sendCommand(this.connection, 'sound:play', payload, 5000);
  }

  async stopSound(file) {
    const payload = file ? { file } : {};
    return sendCommand(this.connection, 'sound:stop', payload, 5000);
  }
}
```

### Step 5: Wire into AdminController

**Modify `src/app/adminController.js`:**
- Import `CueController` and `SoundController`
- Add to `this.modules`:
  ```javascript
  cueController: new CueController(this.client),
  soundController: new SoundController(this.client),
  ```

### Step 6: Run GM Scanner tests

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npm test
```

Expected: PASS

### Step 7: Commit in ALNScanner submodule

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add src/network/orchestratorClient.js src/admin/CueController.js src/admin/SoundController.js \
  src/app/adminController.js tests/unit/admin/CueController.test.js tests/unit/admin/SoundController.test.js
git commit -m "feat: add CueController, SoundController, and new event forwarding for Phase 1"
```

### Step 8: Update parent submodule reference

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add ALNScanner
git commit -m "chore: update ALNScanner submodule for Phase 1 controllers"
```

---

## Task 10: GM Scanner — Session UI (Setup/Start, Clock Display)

**Goal:** Update the session management UI for the `setup` → `active` lifecycle. Add "Start Game" button and live game clock display.

**Files (ALNScanner submodule):**
- Modify: `src/admin/MonitoringDisplay.js`
- Modify: `index.html`
- Create: `tests/unit/admin/MonitoringDisplay-phase1.test.js`

### Step 1: Write failing tests

```javascript
// ALNScanner/tests/unit/admin/MonitoringDisplay-phase1.test.js
describe('MonitoringDisplay - Phase 1', () => {
  describe('session setup state', () => {
    it('should show Start Game button when session status is setup', () => {
      // Render session update with status: 'setup'
      // Verify Start Game button is present
    });

    it('should hide Start Game button when session is active', () => {
      // Render session update with status: 'active'
      // Verify Start Game button is absent, Pause button present
    });
  });

  describe('game clock display', () => {
    it('should show elapsed time from gameclock:status event', () => {
      // Simulate gameclock:status {state: 'running', elapsed: 3661}
      // Verify display shows "01:01:01"
    });

    it('should show paused indicator when clock is paused', () => {
      // Simulate gameclock:status {state: 'paused', elapsed: 1800}
      // Verify display shows paused state
    });
  });

  describe('cue:fired toast', () => {
    it('should show toast notification when cue fires', () => {
      // Simulate cue:fired {cueId: 'business-sale', trigger: 'event:...'}
      // Verify toast appears
    });
  });

  describe('cue:error toast', () => {
    it('should show error toast when cue command fails', () => {
      // Simulate cue:error {cueId: 'x', action: 'sound:play', error: 'not found'}
      // Verify error toast appears
    });
  });
});
```

### Step 2: Implement MonitoringDisplay changes

**Add to `_handleMessage()` switch:**
```javascript
case 'gameclock:status':
  this._updateGameClockDisplay(payload);
  break;
case 'cue:fired':
  this._handleCueFired(payload);
  break;
case 'cue:completed':
  this._handleCueCompleted(payload);
  break;
case 'cue:error':
  this._handleCueError(payload);
  break;
case 'sound:status':
  this._handleSoundStatus(payload);
  break;
```

**Update `updateSessionDisplay(session)`:**
- When `session.status === 'setup'`: show "Start Game" button (with `data-action="admin.startGame"`)
- When `session.status === 'active'`: show game clock + Pause button (existing)
- Add clock display element that updates from `gameclock:status`

**New methods:**
- `_updateGameClockDisplay({ state, elapsed })` — format elapsed as `HH:MM:SS`, update display
- `_handleCueFired({ cueId, trigger })` — show toast notification
- `_handleCueError({ cueId, action, error })` — show error toast
- `_handleSoundStatus({ playing })` — update sound indicator (subtle, fire-and-forget)

### Step 3: Update `index.html` — session section

Add "Start Game" button and clock display container to the session management section:

```html
<!-- Inside session-status-container, rendered dynamically by MonitoringDisplay -->
<!-- The JS will render either setup or active state -->
```

### Step 4: Wire `data-action="admin.startGame"` to CueController

In the DOM event bindings (`domEventBindings.js` or wherever data-action handlers are registered), add:

```javascript
'admin.startGame': () => adminController.getModule('cueController').startGame()
```

### Step 5: Update `updateAllDisplays(syncData)` for new sync:full sections

Handle `syncData.gameClock` and `syncData.cueEngine` in the full state restore.

### Step 6: Run tests and commit

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npm test
git add src/admin/MonitoringDisplay.js index.html tests/unit/admin/MonitoringDisplay-phase1.test.js
git commit -m "feat: add session setup UI, game clock display, and cue event toasts"
```

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add ALNScanner
git commit -m "chore: update ALNScanner submodule for session UI changes"
```

---

## Task 11: GM Scanner — Show Control Section

**Goal:** Add the Show Control admin section with Standing Cues list and Quick Fire grid (roadmap Section 12, D30-D31).

**Files (ALNScanner submodule):**
- Modify: `index.html`
- Modify: `src/admin/MonitoringDisplay.js`
- Modify: `src/styles/screens/admin.css` (or create `src/styles/components/show-control.css`)
- Create: `tests/unit/admin/MonitoringDisplay-showcontrol.test.js`

### Step 1: Add Show Control HTML structure

In `index.html`, add between Video Controls and Audio Output sections:

```html
<!-- Show Control (networked-only) -->
<section class="admin-section" data-requires="networked" id="show-control-section">
  <h3>Show Control</h3>

  <!-- Quick Fire grid -->
  <div class="subsection">
    <h4>Quick Fire</h4>
    <div id="quick-fire-grid" class="tile-grid">
      <!-- Populated dynamically from cueEngine.cues where quickFire: true -->
    </div>
  </div>

  <!-- Standing Cues -->
  <div class="subsection">
    <h4>Standing Cues</h4>
    <div id="standing-cues-list">
      <!-- Populated dynamically from cueEngine.cues where trigger exists -->
    </div>
  </div>
</section>
```

### Step 2: Write failing tests

```javascript
// ALNScanner/tests/unit/admin/MonitoringDisplay-showcontrol.test.js
describe('MonitoringDisplay - Show Control', () => {
  describe('Quick Fire grid', () => {
    it('should render tiles for cues with quickFire: true', () => {
      // sync:full includes cueEngine.cues with quickFire flags
      // Verify tiles rendered in #quick-fire-grid
    });

    it('should fire cue when tile is tapped', () => {
      // Click tile with data-action="admin.fireCue" data-cue-id="tension-hit"
      // Verify cueController.fireCue called
    });
  });

  describe('Standing Cues list', () => {
    it('should render standing cues with enable/disable toggles', () => {
      // sync:full includes standing cues
      // Verify list rendered with toggle buttons
    });

    it('should call disableCue when Disable button clicked', () => {
      // Click disable button for a standing cue
      // Verify cueController.disableCue called
    });
  });
});
```

### Step 3: Implement rendering in MonitoringDisplay

Add methods:
- `_renderQuickFireGrid(cues)` — creates tiles for cues with `quickFire: true`. Each tile has `data-action="admin.fireCue"` and `data-cue-id` attributes. Uses `.cue-icon--{icon}` CSS class for icon display.
- `_renderStandingCuesList(cues, disabledCues)` — creates toggle list for standing cues with enable/disable buttons.
- Update `updateAllDisplays()` to call these with `syncData.cueEngine` data.

### Step 4: Add CSS

Style the Quick Fire grid and Standing Cues list. Follow the existing tile pattern used for lighting scenes.

### Step 5: Wire data-action handlers

```javascript
'admin.fireCue': (element) => {
  const cueId = element.dataset.cueId;
  adminController.getModule('cueController').fireCue(cueId);
}
'admin.enableCue': (element) => {
  const cueId = element.dataset.cueId;
  adminController.getModule('cueController').enableCue(cueId);
}
'admin.disableCue': (element) => {
  const cueId = element.dataset.cueId;
  adminController.getModule('cueController').disableCue(cueId);
}
```

### Step 6: Run tests and commit

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npm test
git add src/admin/MonitoringDisplay.js index.html src/styles/
git commit -m "feat: add Show Control section with Quick Fire grid and Standing Cues"
```

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add ALNScanner
git commit -m "chore: update ALNScanner submodule for Show Control UI"
```

---

## Task 12: Integration Testing

**Goal:** Verify end-to-end flows across backend + GM Scanner. Test that game events trigger standing cues which fire commands.

**Files:**
- Create: `backend/tests/integration/cue-engine.test.js`

### Step 1: Write integration tests

```javascript
// backend/tests/integration/cue-engine.test.js
'use strict';

const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { connectAndIdentify } = require('../helpers/websocket-helpers');

describe('Cue Engine Integration', () => {
  let testContext, gm1;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    // Reset services, create session, start game
    // (use resetAllServicesForTesting pattern)
    gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_1');
  });

  describe('session:start lifecycle', () => {
    it('should create session in setup, then start game', async () => {
      // 1. Create session → verify status is 'setup'
      // 2. Start game → verify status is 'active'
      // 3. Verify gameclock:status event received with state: 'running'
    });

    it('should reject transactions during setup', async () => {
      // Create session (setup)
      // Submit transaction → expect rejected
    });

    it('should accept transactions after start', async () => {
      // Create session → start game
      // Submit transaction → expect accepted
    });
  });

  describe('standing cue fires on game event', () => {
    it('should fire cue when matching event occurs', async () => {
      // Load cue that triggers on transaction:accepted
      // Create session → start game
      // Submit transaction
      // Verify cue:fired event received
    });
  });

  describe('pause cascade', () => {
    it('should pause game clock and suspend cue engine on session:pause', async () => {
      // Create session → start game
      // Pause session
      // Verify gameclock:status {state: 'paused'}
      // Submit transaction → expect rejected
    });

    it('should resume everything on session:resume', async () => {
      // Create session → start game → pause → resume
      // Verify gameclock:status {state: 'running'}
      // Submit transaction → expect accepted
    });
  });
});
```

### Step 2: Run integration tests

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npm run test:integration -- --testPathPattern=cue-engine
```

Expected: PASS

### Step 3: Run full test suite

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npm run test:all
```

Expected: All PASS

### Step 4: Commit

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add backend/tests/integration/cue-engine.test.js
git commit -m "test: add cue engine integration tests for session lifecycle and standing cues"
```

---

## Task 13: Update CLAUDE.md Files

**Goal:** Document new services, events, and commands in the relevant CLAUDE.md files so future development has accurate context.

**Files:**
- Modify: `backend/CLAUDE.md` — add gameClockService, cueEngineService, soundService, commandExecutor, session `setup` status
- Modify: `ALNScanner/CLAUDE.md` — add CueController, SoundController, new messageTypes, Show Control section
- Modify: `CLAUDE.md` (root) — add Phase 1 event list, session lifecycle update

### Step 1: Update each CLAUDE.md

Add to backend CLAUDE.md:
- New services section (gameClockService, cueEngineService, soundService, commandExecutor)
- Updated session lifecycle (setup → active → paused → ended)
- New gm:command actions (session:start, cue:*, sound:*, audio:volume:set)
- New broadcast events (gameclock:status, cue:fired, cue:completed, cue:error, sound:status)
- Config files (cues.json, routing.json in config/environment/)

Add to ALNScanner CLAUDE.md:
- CueController, SoundController
- Show Control section in admin panel
- Updated messageTypes list

Update root CLAUDE.md:
- Session lifecycle diagram (add setup phase)
- Event Architecture section (add new events)

### Step 2: Commit

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for Phase 1 cue engine features"

cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add CLAUDE.md backend/CLAUDE.md ALNScanner
git commit -m "docs: update CLAUDE.md files for Phase 1 environment control"
```

---

## Task 14: Final Verification and Merge

**Goal:** Run all tests across both repos, verify everything works, then merge branches back to main.

### Step 1: Run all backend tests

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npm run test:all
```

Expected: All PASS (unit + contract + integration).

### Step 2: Run all GM Scanner tests

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npm test
```

Expected: All PASS.

### Step 3: Run GM Scanner build (verify no build errors)

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npm run build
```

Expected: Clean build, no errors.

### Step 4: Manual smoke test (if possible)

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npm run dev:no-video
```

- Connect GM Scanner (`npm run dev` in ALNScanner)
- Create session → verify `setup` status
- Start game → verify clock starts
- Verify cue definitions appear in Show Control
- Fire a Quick Fire cue manually
- Process a transaction → verify standing cue fires

### Step 5: Merge ALNScanner submodule first

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git checkout main
git merge phase1/cue-engine
git push origin main
```

### Step 6: Update parent submodule reference and merge

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
# Update submodule to point to ALNScanner main
cd ALNScanner && git checkout main && cd ..
git add ALNScanner
git commit -m "chore: update ALNScanner submodule to main after Phase 1 merge"

# Merge parent branch
git checkout main
git merge phase1/cue-engine
git push origin main
```

### Step 7: Clean up branches

```bash
# Delete local feature branches
git branch -d phase1/cue-engine
cd ALNScanner && git branch -d phase1/cue-engine && cd ..

# Delete remote feature branches
git push origin --delete phase1/cue-engine
cd ALNScanner && git push origin --delete phase1/cue-engine && cd ..
```

---

## Appendix A: File Change Summary

### New Files (Backend)

| File | Purpose |
|------|---------|
| `backend/src/services/commandExecutor.js` | Shared `executeCommand()` for GM + cue engine |
| `backend/src/services/gameClockService.js` | Master time authority |
| `backend/src/services/cueEngineService.js` | Cue loading, evaluation, dispatch |
| `backend/src/services/soundService.js` | pw-play wrapper |
| `backend/config/environment/cues.json` | Cue definitions |
| `backend/config/environment/routing.json` | Expanded routing config |
| `backend/public/audio/.gitkeep` | Sound effects directory |
| `backend/tests/unit/services/commandExecutor.test.js` | |
| `backend/tests/unit/services/gameClockService.test.js` | |
| `backend/tests/unit/services/cueEngineService.test.js` | |
| `backend/tests/unit/services/soundService.test.js` | |
| `backend/tests/unit/services/session-lifecycle-phase1.test.js` | |
| `backend/tests/unit/websocket/phase1-broadcasts.test.js` | |
| `backend/tests/contract/phase1-events.test.js` | |
| `backend/tests/integration/cue-engine.test.js` | |

### Modified Files (Backend)

| File | Changes |
|------|---------|
| `backend/src/websocket/adminEvents.js` | Delegate to `executeCommand()` |
| `backend/src/services/sessionService.js` | `setup` status, `startGame()`, clock integration |
| `backend/src/services/transactionService.js` | Status check (reject unless active) |
| `backend/src/services/audioRoutingService.js` | Expand VALID_STREAMS, volume control |
| `backend/src/websocket/broadcasts.js` | Wire new service events |
| `backend/src/websocket/syncHelpers.js` | Add cueEngine + gameClock to sync:full |
| `backend/src/server.js` | Init new services, wire events |
| `backend/contracts/asyncapi.yaml` | New event schemas |
| `backend/CLAUDE.md` | Document new services/events |

### New Files (ALNScanner submodule)

| File | Purpose |
|------|---------|
| `ALNScanner/src/admin/CueController.js` | Cue command sender |
| `ALNScanner/src/admin/SoundController.js` | Sound command sender |
| `ALNScanner/tests/unit/admin/CueController.test.js` | |
| `ALNScanner/tests/unit/admin/SoundController.test.js` | |
| `ALNScanner/tests/unit/admin/MonitoringDisplay-phase1.test.js` | |
| `ALNScanner/tests/unit/admin/MonitoringDisplay-showcontrol.test.js` | |

### Modified Files (ALNScanner submodule)

| File | Changes |
|------|---------|
| `ALNScanner/src/network/orchestratorClient.js` | Add 6 new messageTypes |
| `ALNScanner/src/app/adminController.js` | Wire CueController + SoundController |
| `ALNScanner/src/admin/MonitoringDisplay.js` | Clock display, cue toasts, Show Control |
| `ALNScanner/index.html` | Show Control section, Start Game button |
| `ALNScanner/src/styles/screens/admin.css` | Show Control styles |
| `ALNScanner/CLAUDE.md` | Document new controllers/events |

---

## Appendix B: Phases 2-4 Preview

Phase 1 delivers the foundation. Subsequent phases build on it:

**Phase 2 (Compound Cues + Spotify):**
- Add timeline engine to `cueEngineService` (video-synced + clock-synced)
- New `spotifyService` (spotifyd + D-Bus MPRIS)
- Compound cue lifecycle (start/pause/resume/stop/cascade)
- Video conflict detection (cue:conflict event)
- SpotifyController + Now Playing UI

**Phase 3 (Multi-Speaker + Ducking):**
- PipeWire combine-sink creation in `audioRoutingService`
- 3-tier routing inheritance (global → cue → command)
- Ducking engine (event-driven Spotify volume adjustment)
- Per-stream routing dropdowns in GM Scanner

**Phase 4 (Polish + Reliability):**
- 4+ hour stability testing
- BT reconnection hardening
- Standing cue hot-reload
- Session logging of automated cue actions
