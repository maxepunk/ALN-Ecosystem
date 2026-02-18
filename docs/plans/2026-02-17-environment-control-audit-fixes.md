# Environment Control Audit Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all issues identified by the 2026-02-17 deep code audit of environment control Phases 0-3: 61 failing integration tests, 1 UI bug, 5 unwired features, stale test assertions, and documentation drift.

**Architecture:** Fixes are grouped by blast radius — test infrastructure first (unblocks 55 tests), then the live UI bug, then unwired features, stale assertions, and documentation. All changes on the existing `phase2/compound-cues-spotify` branch. Each task is independently committable.

**Tech Stack:** Node.js (backend), ES6 modules (GM Scanner/Vite), Jest (testing), Socket.IO (WebSocket)

---

## Priority Grouping

| Group | Tasks | Impact |
|-------|-------|--------|
| **A: Test Infrastructure** | 1 | Unblocks ~55 of 61 failing integration tests |
| **B: UI Bug** | 2 | Standing Cues list always empty in GM Scanner |
| **C: Stale Test Assertions** | 3-4 | Fixes remaining ~6 failing integration tests |
| **D: Unwired Features** | 5-8 | Connects documented features that are missing wiring |
| **E: Documentation** | 9-11 | Fixes CLAUDE.md, roadmap, .env.example drift |

---

## Task 1: Fix MockDataManager in browser-mocks.js

**Root cause:** Phase 2 refactored `MonitoringDisplay` to call `this.dataManager.addEventListener(...)` and `networkedSession.js` calls `this.dataManager.updateSessionState(...)`. The real `UnifiedDataManager` extends `EventTarget` (line 17 of `unifiedDataManager.js`). But the mock at `browser-mocks.js:357` is a plain object literal — no `EventTarget` API, no Phase 2+ methods.

**This single fix unblocks ~55 of 61 failing integration tests.**

**Files:**
- Modify: `backend/tests/helpers/browser-mocks.js`

### Step 1: Run integration tests and record current failures

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npm run test:integration 2>&1 | tail -5
```

Expected: `Tests: 61 failed, 195 passed, 256 total`

### Step 2: Rewrite the MockDataManager as an EventTarget class

**File:** `backend/tests/helpers/browser-mocks.js`

Replace lines 354-496 (the plain object `global.DataManager = { ... }`) with a class extending `EventTarget`. Preserve all existing methods and properties, and add the Phase 2+ methods that the real `UnifiedDataManager` has but the mock lacks.

**Methods the mock already has** (keep all of these):
- `markTokenAsScanned(tokenId)`, `isTokenScanned(tokenId)`, `clearScannedTokens()`
- `setScannedTokensFromServer(serverTokens)`, `setPlayerScansFromServer(serverPlayerScans)`
- `clearAll()`, `initializeNetworkedMode(socket)`, `initializeStandaloneMode()`
- `addTransaction()`, `addTransactionFromBroadcast(tx)`, `handlePlayerScan()`
- `loadTransactions()`, `loadScannedTokens()`, `saveScannedTokens()`, `clearSession()`
- `removeTransaction(transactionId)`, `resetForNewSession(sessionId)`
- `calculateTokenValue()`, `clearBackendScores()`, `updateTeamScoreFromBackend(scoreData)`
- `parseGroupInfo(groupName)`, `normalizeGroupName(name)`

**Methods the mock is MISSING** (add these — all called by `networkedSession.js` or `MonitoringDisplay.js`):
- `updateSessionState(payload)` — dispatches `CustomEvent('session-state:updated', { detail: { session: this.sessionState } })`
- `updateAudioState(payload)` — dispatches `CustomEvent('audio-state:updated', { detail: { audio } })`
- `updateLightingState(payload)` — dispatches `CustomEvent('lighting-state:updated', { detail: { lighting } })`
- `updateBluetoothState(payload)` — dispatches `CustomEvent('bluetooth-state:updated', { detail: { bluetooth } })`
- `updateCueState(payload)` — dispatches `CustomEvent('cue-state:updated', { detail: payload })`
- `reportCueConflict(payload)` — dispatches `CustomEvent('cue:conflict', { detail: payload })`

**Properties to add:**
- `sessionState: {}` — tracks session state for `updateSessionState`
- `environmentState: { audio: {}, lighting: {}, bluetooth: {} }` — tracks environment state
- `cueState: { cues: new Map(), activeCues: new Map(), disabledCues: new Set() }` — tracks cue state

The new mock structure should be:

```javascript
// Mock DataManager global — extends EventTarget for Phase 2+ event-based wiring
// In browser, loaded via separate <script> tag
class MockDataManager extends EventTarget {
  constructor() {
    super();
    this.transactions = [];
    this.scannedTokens = new Set();
    this.playerScans = [];
    this._networkedStrategy = null;
    this.backendScores = new Map();
    this.currentSessionId = null;
    this.sessionState = {};
    this.environmentState = {
      audio: { routes: {}, availableSinks: [], defaultSink: 'hdmi' },
      lighting: { connected: false, scenes: [], activeScene: null },
      bluetooth: { scanning: false, pairedDevices: [], connectedDevices: [] },
    };
    this.cueState = { cues: new Map(), activeCues: new Map(), disabledCues: new Set() };
  }

  // ... all existing methods from lines 361-495 converted to class methods ...

  // Phase 2+ methods called by networkedSession.js and MonitoringDisplay
  updateSessionState(payload) {
    if (!payload) {
      this.sessionState = {};
      this.currentSessionId = null;
    } else {
      this.sessionState = { ...this.sessionState, ...payload };
      if (payload.id) this.currentSessionId = payload.id;
    }
    this.dispatchEvent(new CustomEvent('session-state:updated', {
      detail: { session: this.sessionState }
    }));
  }

  updateAudioState(payload) {
    if (!payload) return;
    if (payload.routes) this.environmentState.audio.routes = { ...payload.routes };
    if (payload.availableSinks) this.environmentState.audio.availableSinks = payload.availableSinks;
    this.dispatchEvent(new CustomEvent('audio-state:updated', {
      detail: { audio: { ...this.environmentState.audio } }
    }));
  }

  updateLightingState(payload) {
    if (!payload) return;
    const lighting = this.environmentState.lighting;
    if (payload.connected !== undefined) lighting.connected = payload.connected;
    if (payload.scenes) lighting.scenes = payload.scenes;
    if (payload.sceneId) lighting.activeScene = { id: payload.sceneId };
    this.dispatchEvent(new CustomEvent('lighting-state:updated', {
      detail: { lighting: { ...lighting } }
    }));
  }

  updateBluetoothState(payload) {
    if (!payload) return;
    const bt = this.environmentState.bluetooth;
    if (payload.scanning !== undefined) bt.scanning = payload.scanning;
    if (payload.pairedDevices) bt.pairedDevices = payload.pairedDevices;
    if (payload.connectedDevices) bt.connectedDevices = payload.connectedDevices;
    this.dispatchEvent(new CustomEvent('bluetooth-state:updated', {
      detail: { bluetooth: { ...bt } }
    }));
  }

  updateCueState(payload) {
    this.dispatchEvent(new CustomEvent('cue-state:updated', { detail: payload }));
  }

  reportCueConflict(payload) {
    this.dispatchEvent(new CustomEvent('cue:conflict', { detail: payload }));
  }

  getCueState() {
    return {
      cues: this.cueState.cues,
      activeCues: this.cueState.activeCues,
      disabledCues: this.cueState.disabledCues,
    };
  }
}

global.DataManager = new MockDataManager();
```

**CRITICAL:** The `global.window.DataManager = global.DataManager;` line (currently at line 500) MUST remain after the mock definition.

### Step 3: Run integration tests

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npm run test:integration 2>&1 | tail -5
```

Expected: The ~55 tests that failed with `addEventListener is not a function`, `updateSessionState is not a function`, and cascading `insertAdjacentHTML is not a function` should now pass or reveal their actual assertions. Some may still fail for other reasons — those are tracked in Tasks 3-4.

### Step 4: Commit

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add backend/tests/helpers/browser-mocks.js
git commit -m "fix(tests): upgrade MockDataManager to EventTarget for Phase 2+ compatibility"
```

---

## Task 2: Fix CueRenderer Standing Cues Filter Bug

**Root cause:** Backend `getCueSummaries()` returns `{ triggerType: 'event'|'clock'|null }` (line 201 of `cueEngineService.js`). CueRenderer line 72 filters on `cue.trigger` (doesn't exist on summaries) and line 87 displays `cue.trigger` as text (would show `undefined`).

**Impact:** The Standing Cues list in the GM Scanner admin panel is always empty — GM cannot see or enable/disable standing cues during a game.

**Files:**
- Modify: `ALNScanner/src/ui/renderers/CueRenderer.js`
- Modify: `ALNScanner/tests/unit/ui/renderers/CueRenderer.test.js` (if exists, otherwise create)

### Step 1: Write failing test

**File:** `ALNScanner/tests/unit/ui/renderers/CueRenderer.test.js`

Add a test that verifies standing cues with `triggerType` (not `trigger`) are rendered:

```javascript
it('should render standing cues with triggerType field from backend summaries', () => {
  const cuesMap = new Map([
    ['attention-before-video', {
      id: 'attention-before-video',
      label: 'Pre-Video Alert',
      triggerType: 'event',
      quickFire: false,
      enabled: true,
    }],
    ['midgame-tension', {
      id: 'midgame-tension',
      label: 'Midgame Tension',
      triggerType: 'clock',
      quickFire: false,
      enabled: true,
    }],
    ['tension-hit', {
      id: 'tension-hit',
      label: 'Tension Hit',
      triggerType: null,
      quickFire: true,
      enabled: true,
    }],
  ]);

  cueRenderer.render({ cues: cuesMap, activeCues: new Map(), disabledCues: new Set() });

  // Standing cues = has triggerType, not quickFire
  const standingItems = standingListEl.querySelectorAll('.standing-cue-item');
  expect(standingItems.length).toBe(2);

  // Verify trigger type is displayed as readable text (not undefined or [object Object])
  const triggerTexts = Array.from(standingItems).map(el =>
    el.querySelector('.standing-cue-item__trigger').textContent
  );
  expect(triggerTexts).not.toContain('undefined');
  expect(triggerTexts).not.toContain('[object Object]');
});
```

### Step 2: Run test to verify it fails

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/ui/renderers/CueRenderer.test.js --verbose
```

Expected: FAIL — standing cues list empty because filter uses `cue.trigger` which is `undefined`.

### Step 3: Fix the filter and display

**File:** `ALNScanner/src/ui/renderers/CueRenderer.js`

**Line 72 — fix filter:** Change from `cue.trigger` to `cue.triggerType`:

```javascript
// BEFORE (line 72):
const standingCues = Array.from(cuesMap.values()).filter(cue => cue.trigger && !cue.quickFire);

// AFTER:
const standingCues = Array.from(cuesMap.values()).filter(cue => cue.triggerType && !cue.quickFire);
```

**Line 87 — fix display:** Change from `cue.trigger` to a readable string from `cue.triggerType`:

```javascript
// BEFORE (line 87):
<span class="standing-cue-item__trigger">${this._escapeHtml(cue.trigger)}</span>

// AFTER:
<span class="standing-cue-item__trigger">${this._escapeHtml(cue.triggerType === 'clock' ? '⏱ clock' : '⚡ event')}</span>
```

### Step 4: Run test to verify it passes

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/ui/renderers/CueRenderer.test.js --verbose
```

Expected: PASS

### Step 5: Run all ALNScanner tests for regression check

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npm test
```

Expected: All pass (932+ baseline).

### Step 6: Commit (submodule first, then parent)

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add src/ui/renderers/CueRenderer.js tests/unit/ui/renderers/CueRenderer.test.js
git commit -m "fix: CueRenderer standing cues filter uses triggerType instead of trigger"

cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add ALNScanner
git commit -m "chore: update ALNScanner submodule with CueRenderer fix"
```

---

## Task 3: Fix environment_control.test.js Route Shape Assertion

**Root cause:** `getRoutingStatus()` (line 228-232 of `audioRoutingService.js`) normalizes routes to flat strings: `routes.video = 'hdmi'`. The test asserts `env.audio.routes.video.sink` (object format from the Phase 0 plan). The implementation's flat format is correct — the test assertion is stale.

**Files:**
- Modify: `backend/tests/integration/environment_control.test.js`

### Step 1: Fix the assertion

**File:** `backend/tests/integration/environment_control.test.js`

**Line 131:** Change from object path to flat string:

```javascript
// BEFORE (line 131):
expect(env.audio.routes.video.sink).toBe('hdmi');

// AFTER:
expect(env.audio.routes.video).toBe('hdmi');
```

### Step 2: Scan for other `.sink` assertions in the same file

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
grep -n 'routes.*\.sink' tests/integration/environment_control.test.js
```

Fix any other instances following the same pattern.

### Step 3: Run environment_control integration tests

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npx jest tests/integration/environment_control.test.js --config jest.integration.config.js --verbose
```

Expected: PASS (or reveal only the `addEventListener` failures already fixed by Task 1).

### Step 4: Commit

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add backend/tests/integration/environment_control.test.js
git commit -m "fix(tests): update route shape assertion to match flattened sync:full format"
```

---

## Task 4: Fix audio-routing-phase3.test.js Combine-Sink Naming

**Root cause:** Implementation uses `name: 'aln-combine'` for the virtual sink (line 525 of `audioRoutingService.js`). Test asserts `s.name === 'combine-bt'` (the roadmap's conceptual name).

**Files:**
- Modify: `backend/tests/integration/audio-routing-phase3.test.js`

### Step 1: Fix the name assertion

**File:** `backend/tests/integration/audio-routing-phase3.test.js`

**Line 182:** Change the name lookup:

```javascript
// BEFORE (line 182):
const combineSink = sinks.find(s => s.name === 'combine-bt');

// AFTER:
const combineSink = sinks.find(s => s.name === 'aln-combine');
```

### Step 2: Scan for other `combine-bt` assertions in the same file

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
grep -n 'combine-bt' tests/integration/audio-routing-phase3.test.js
```

Fix any other instances.

### Step 3: Run audio-routing-phase3 integration tests

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npx jest tests/integration/audio-routing-phase3.test.js --config jest.integration.config.js --verbose
```

Expected: PASS

### Step 4: Commit

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add backend/tests/integration/audio-routing-phase3.test.js
git commit -m "fix(tests): update combine-sink name to aln-combine matching implementation"
```

---

## Task 5: Wire `audio:combine:create` / `audio:combine:destroy` in commandExecutor

**Root cause:** `audioRoutingService` has `createCombineSink()` (line 415) and `destroyCombineSink()` (line 482). They are documented in backend CLAUDE.md and AsyncAPI. But `commandExecutor.js` has no case for either action — they fall through to "Unknown action".

**Files:**
- Modify: `backend/src/services/commandExecutor.js`
- Modify: `backend/tests/unit/services/commandExecutor.test.js`

### Step 1: Write failing tests

**File:** `backend/tests/unit/services/commandExecutor.test.js`

```javascript
describe('audio:combine:create', () => {
  it('should call audioRoutingService.createCombineSink()', async () => {
    const audioRoutingService = require('../../../src/services/audioRoutingService');
    jest.spyOn(audioRoutingService, 'createCombineSink').mockResolvedValue({ sink: 'aln-combine' });

    const result = await executeCommand({ action: 'audio:combine:create', payload: {}, source: 'gm' });

    expect(result.success).toBe(true);
    expect(audioRoutingService.createCombineSink).toHaveBeenCalled();
  });
});

describe('audio:combine:destroy', () => {
  it('should call audioRoutingService.destroyCombineSink()', async () => {
    const audioRoutingService = require('../../../src/services/audioRoutingService');
    jest.spyOn(audioRoutingService, 'destroyCombineSink').mockResolvedValue();

    const result = await executeCommand({ action: 'audio:combine:destroy', payload: {}, source: 'gm' });

    expect(result.success).toBe(true);
    expect(audioRoutingService.destroyCombineSink).toHaveBeenCalled();
  });
});
```

### Step 2: Run tests to verify they fail

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npx jest tests/unit/services/commandExecutor.test.js --verbose -t "audio:combine"
```

Expected: FAIL — "Unknown action".

### Step 3: Add cases to commandExecutor.js

**File:** `backend/src/services/commandExecutor.js`

Add after the `audio:route:set` case (around line 393), before the lighting cases:

```javascript
case 'audio:combine:create': {
  const data = await audioRoutingService.createCombineSink();
  result = { success: true, message: 'Combine-sink created', data };
  break;
}
case 'audio:combine:destroy': {
  await audioRoutingService.destroyCombineSink();
  result = { success: true, message: 'Combine-sink destroyed' };
  break;
}
```

### Step 4: Run tests to verify they pass

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npx jest tests/unit/services/commandExecutor.test.js --verbose -t "audio:combine"
```

Expected: PASS

### Step 5: Run full unit test suite for regression

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npm test
```

Expected: All 1042+ pass.

### Step 6: Commit

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add backend/src/services/commandExecutor.js backend/tests/unit/services/commandExecutor.test.js
git commit -m "feat: wire audio:combine:create/destroy gm:command actions in commandExecutor"
```

---

## Task 6: Add Spotify Event Forwarding to cueEngineWiring

**Root cause:** `cueEngineService.js` defines a `spotify:track:changed` normalizer (line 52) and the roadmap/CLAUDE.md says cueEngineWiring forwards Spotify events. But `cueEngineWiring.js` has zero Spotify listeners — the normalizer is dead code. Standing cues that trigger on `spotify:track:changed` silently never fire.

**Files:**
- Modify: `backend/src/services/cueEngineWiring.js`
- Modify: `backend/tests/unit/services/cueEngineWiring.test.js` (create if needed)

### Step 1: Write failing test

```javascript
describe('spotify event forwarding', () => {
  it('should forward spotify track:changed to cue engine as spotify:track:changed', () => {
    const mockSpotifyService = new (require('events').EventEmitter)();
    const cueEngine = require('../../../src/services/cueEngineService');
    const spy = jest.spyOn(cueEngine, 'handleGameEvent');

    // Re-wire with spotify service
    const { setupCueEngineForwarding } = require('../../../src/services/cueEngineWiring');
    setupCueEngineForwarding({
      gameClockService: new (require('events').EventEmitter)(),
      transactionService: new (require('events').EventEmitter)(),
      videoQueueService: new (require('events').EventEmitter)(),
      sessionService: new (require('events').EventEmitter)(),
      soundService: new (require('events').EventEmitter)(),
      cueEngineService: new (require('events').EventEmitter)(),
      spotifyService: mockSpotifyService,
    });

    mockSpotifyService.emit('track:changed', { title: 'Test', artist: 'Artist' });

    expect(spy).toHaveBeenCalledWith('spotify:track:changed', { title: 'Test', artist: 'Artist' });
  });
});
```

### Step 2: Run test to verify it fails

Expected: FAIL — `handleGameEvent` never called with `spotify:track:changed`.

### Step 3: Add Spotify forwarding to cueEngineWiring.js

**File:** `backend/src/services/cueEngineWiring.js`

After the `gameclock:started` forwarding (around line 107), add:

```javascript
// Spotify events (Phase 2) — enables standing cues that trigger on track changes
if (spotifyService) {
  addTrackedListener(spotifyService, 'track:changed', (data) => {
    cueEngine.handleGameEvent('spotify:track:changed', data);
  });
}
```

**Also update the function signature** to accept `spotifyService` if it doesn't already. Check the existing `setupCueEngineForwarding()` destructured params. The function should accept `{ ..., spotifyService }`.

**Also update callers:** Check `app.js` and `systemReset.js` to ensure they pass `spotifyService` when calling `setupCueEngineForwarding()`.

### Step 4: Run test to verify it passes

Expected: PASS

### Step 5: Run full unit test suite

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npm test
```

Expected: All pass.

### Step 6: Commit

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add backend/src/services/cueEngineWiring.js backend/tests/unit/services/cueEngineWiring.test.js
git commit -m "feat: add spotify:track:changed forwarding to cueEngineWiring"
```

---

## Task 7: Add Cascading Pause/Resume for Compound Cue Children

**Root cause:** `cueEngineService.pauseCue()` (line 810) and `resumeCue()` (line 827) only update the targeted cue's state. They don't cascade to child cues spawned via `cue:fire` in timelines. Cascading `stop` already works (via `spawnedBy` tracking).

**Files:**
- Modify: `backend/src/services/cueEngineService.js`
- Modify: `backend/tests/unit/services/cueEngineService.test.js`

### Step 1: Write failing tests

```javascript
describe('cascading pause/resume', () => {
  it('should pause child cues when parent is paused', async () => {
    // Setup: parent compound cue spawned a child via cue:fire
    // ... set up activeCues with parent and child, child.spawnedBy = parent.id ...

    await cueEngineService.pauseCue('parent-id');

    const child = cueEngineService.activeCues.get('child-id');
    expect(child.state).toBe('paused');
  });

  it('should resume child cues when parent is resumed', async () => {
    // ... set up paused parent and child ...

    await cueEngineService.resumeCue('parent-id');

    const child = cueEngineService.activeCues.get('child-id');
    expect(child.state).toBe('running');
  });
});
```

### Step 2: Run tests to verify they fail

Expected: FAIL — child cue state unchanged.

### Step 3: Add cascading logic

**File:** `backend/src/services/cueEngineService.js`

In `pauseCue()` (after line 818, after updating parent state), add:

```javascript
// Cascade pause to children (same pattern as stopCue)
for (const [childId, childCue] of this.activeCues) {
  if (childCue.spawnedBy === cueId && childCue.state === 'running') {
    childCue.state = 'paused';
    logger.info(`[CueEngine] Cascade-paused child cue: ${childId}`);
    this.emit('cue:status', { cueId: childId, state: 'paused' });
  }
}
```

In `resumeCue()` (after line 835, after updating parent state), add:

```javascript
// Cascade resume to children
for (const [childId, childCue] of this.activeCues) {
  if (childCue.spawnedBy === cueId && childCue.state === 'paused') {
    childCue.state = 'running';
    logger.info(`[CueEngine] Cascade-resumed child cue: ${childId}`);
    this.emit('cue:status', { cueId: childId, state: 'running' });
  }
}
```

### Step 4: Run tests to verify they pass

Expected: PASS

### Step 5: Run full unit test suite

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npm test
```

Expected: All pass.

### Step 6: Commit

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add backend/src/services/cueEngineService.js backend/tests/unit/services/cueEngineService.test.js
git commit -m "feat: cascade pause/resume to child compound cues"
```

---

## Task 8: Add Missing SpotifyService Events

**Root cause:** Roadmap defines `track:changed` and `connection:changed` events for spotifyService. The service has `playback:changed`, `playlist:changed`, `volume:changed` but not `track:changed` or `connection:changed`. The D-Bus monitoring for track metadata changes is not yet implemented.

**Scope:** This is a larger feature (D-Bus property monitoring). For now, add stub `track:changed` emission when playlist switches (since spotifyd doesn't support real-time track monitoring without polling). Add `connection:changed` to the existing `checkConnection()` method.

**Files:**
- Modify: `backend/src/services/spotifyService.js`
- Modify: `backend/tests/unit/services/spotifyService.test.js`

### Step 1: Write failing test for connection:changed

```javascript
it('should emit connection:changed when connection status changes', async () => {
  const handler = jest.fn();
  spotifyService.on('connection:changed', handler);

  spotifyService.connected = false;
  // Mock checkConnection to find spotifyd
  mockExecFileSuccess(''); // dbus-send succeeds
  await spotifyService.checkConnection();

  expect(handler).toHaveBeenCalledWith({ connected: true });
});
```

### Step 2: Run test — expect FAIL

### Step 3: Add `connection:changed` emission to `checkConnection()`

In `checkConnection()`, after updating `this.connected`, emit the event if the state changed:

```javascript
const wasConnected = this.connected;
// ... existing checkConnection logic ...
if (this.connected !== wasConnected) {
  this.emit('connection:changed', { connected: this.connected });
}
```

### Step 4: Run tests — expect PASS

### Step 5: Run full unit test suite and commit

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add backend/src/services/spotifyService.js backend/tests/unit/services/spotifyService.test.js
git commit -m "feat: emit connection:changed event from spotifyService"
```

---

## Task 9: Fix .env.example Missing Spotify Config

**Files:**
- Modify: `backend/.env.example`
- Modify: `backend/src/services/spotifyService.js` (remove hardcoded path)

### Step 1: Add Spotify variables to .env.example

```env
# Spotify (Phase 2 - spotifyd via D-Bus)
SPOTIFY_CACHE_PATH=                     # Path to spotifyd cache dir (default: ~/.cache/spotifyd)
```

### Step 2: Fix hardcoded developer path in spotifyService.js

**File:** `backend/src/services/spotifyService.js` line 30

```javascript
// BEFORE:
this.cachePath = process.env.SPOTIFY_CACHE_PATH || '/home/maxepunk/.cache/spotifyd';

// AFTER:
this.cachePath = process.env.SPOTIFY_CACHE_PATH || path.join(os.homedir(), '.cache', 'spotifyd');
```

Add `const os = require('os');` and `const path = require('path');` at the top if not already imported.

### Step 3: Run unit tests

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npm test
```

Expected: All pass.

### Step 4: Commit

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add backend/.env.example backend/src/services/spotifyService.js
git commit -m "fix: use os.homedir() for Spotify cache path default, add to .env.example"
```

---

## Task 10: Fix CLAUDE.md Spotify Forwarding Claim

**Root cause:** Root CLAUDE.md line 249 says "Phase 2 adds video progress/lifecycle forwarding and spotifyService forwarding" for cueEngineWiring.js. After Task 6 adds the actual forwarding, this documentation will be accurate. But if Task 6 is not yet done, this should note "pending" or be updated after.

**Files:**
- Modify: `CLAUDE.md` (root) — only after Task 6 is confirmed working
- Modify: `backend/CLAUDE.md` — verify environment control gm:command list includes `audio:combine:create/destroy`

### Step 1: Update root CLAUDE.md

After Tasks 5-6 are complete, verify the claims in CLAUDE.md are now accurate. If any remain inaccurate, fix them.

### Step 2: Commit

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add CLAUDE.md backend/CLAUDE.md
git commit -m "docs: update CLAUDE.md to reflect actual Phase 2-3 implementation state"
```

---

## Task 11: Fix Roadmap Status Contradiction

**Root cause:** Line 4 says "Phases 1-3 complete, Phase 4 pending" but Phase 2 section (line 1237) says "PENDING".

**Files:**
- Modify: `docs/plans/2026-02-13-environment-control-roadmap.md`

### Step 1: Update roadmap

Update the Phase 2 and Phase 3 sections to reflect their actual state:
- Phase 2 heading: Change `PENDING` to `COMPLETE` (after Tasks 1-8 are done)
- Phase 3 heading: Change to `COMPLETE`
- Verify Phase 1 status is accurate

If work is still in-progress, use `IN PROGRESS` instead of `COMPLETE` with notes on what remains.

### Step 2: Commit

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add docs/plans/2026-02-13-environment-control-roadmap.md
git commit -m "docs: update roadmap phase status to match actual implementation state"
```

---

## Verification: Full Test Suite After All Fixes

After completing all tasks, run the full test battery:

```bash
# Backend unit tests
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npm test
# Expected: 1042+ pass, 0 fail (baseline was 1006 pre-environment-control)

# Backend integration tests
npm run test:integration
# Expected: 256 pass, 0 fail (was 61 failing)

# ALNScanner unit tests
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npm test
# Expected: 932+ pass, 0 fail
```

---

## Summary of All Fixes

| Task | Fix | Category | Files Changed |
|------|-----|----------|---------------|
| 1 | MockDataManager → EventTarget class | Test infrastructure | `browser-mocks.js` |
| 2 | CueRenderer `trigger` → `triggerType` | UI bug | `CueRenderer.js` |
| 3 | Route shape `.sink` → flat string | Stale test | `environment_control.test.js` |
| 4 | Combine-sink `combine-bt` → `aln-combine` | Stale test | `audio-routing-phase3.test.js` |
| 5 | Wire `audio:combine:create/destroy` | Unwired feature | `commandExecutor.js` |
| 6 | Spotify event forwarding | Unwired feature | `cueEngineWiring.js` |
| 7 | Cascading pause/resume for children | Unwired feature | `cueEngineService.js` |
| 8 | `connection:changed` event | Unwired feature | `spotifyService.js` |
| 9 | `.env.example` + hardcoded path | Configuration | `.env.example`, `spotifyService.js` |
| 10 | CLAUDE.md accuracy | Documentation | `CLAUDE.md`, `backend/CLAUDE.md` |
| 11 | Roadmap status | Documentation | `roadmap.md` |
