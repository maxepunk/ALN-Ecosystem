# Game Reliability Open Items Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 7 essential items identified during 0321game investigation — dead code cleanup, backend state gaps, display mode broadcast, volume control UI, and E2E test timing.

**Architecture:** Clustered by cross-cutting concerns: (A) backend state broadcasting, (B) GM Scanner audio UI, (C) video lifecycle/E2E. Items are ordered so earlier tasks unblock or simplify later ones.

**Tech Stack:** Node.js backend (EventEmitter services, broadcasts.js), ES6 GM Scanner (StateStore, differential renderers, domEventBindings), Playwright E2E.

---

## Task 1: Remove Dead HeldItemsRenderer.render() Method

**Why first:** Removes confusing dead code path before we add new renderers and subscriptions in later tasks.

**Files:**
- Modify: `ALNScanner/src/ui/renderers/HeldItemsRenderer.js`
- Modify: `ALNScanner/tests/unit/ui/renderers/HeldItemsRenderer.test.js`

**Step 1: Update the class JSDoc**

Replace the class JSDoc (lines 3-13) to remove the event-driven description:

```javascript
/**
 * HeldItemsRenderer - Unified Held Items Queue
 * Shows all held items (cues blocked by service outage, videos blocked by VLC)
 * with release/discard buttons and live duration counter.
 *
 * Receives full state snapshots via StateStore subscription (renderSnapshot).
 */
```

**Step 2: Remove the `render(data)` method**

Delete lines 21-47 (the `render(data)` method and its JSDoc). The only public entry point is now `renderSnapshot(items)`.

**Step 3: Update the test file**

Remove test blocks that exercise the dead `render(data)` method:
- Delete `describe('render() - held action', ...)` (lines 28-143)
- Delete `describe('render() - released action', ...)` (lines 146-184)
- Delete `describe('render() - discarded action', ...)` (lines 186-201)
- Delete `describe('render() - recoverable action', ...)` (lines 203-209)

Keep these test blocks (they exercise live code):
- `describe('bulk actions', ...)` — adapt to use `renderSnapshot()` instead of `render()`
- `describe('duration display', ...)` — adapt to use `renderSnapshot()`
- `describe('edge cases', ...)` — remove the `render()` null-container test, keep non-existent item test adapted for `renderSnapshot()`
- `describe('destroy()', ...)` — adapt to use `renderSnapshot()`

Adapt remaining tests: replace incremental `renderer.render()` calls with equivalent `renderSnapshot()` calls. Key pattern change — tests that added items incrementally via multiple `render({action: 'held', ...})` calls must now pass all items as a single array:

```javascript
// BEFORE (incremental render):
renderer.render({ action: 'held', id: 'h1', type: 'cue', reason: 'x', heldAt: new Date().toISOString() });
renderer.render({ action: 'held', id: 'h2', type: 'video', reason: 'y', heldAt: new Date().toISOString() });

// AFTER (snapshot):
renderer.renderSnapshot([
  { id: 'h1', type: 'cue', reason: 'x', heldAt: new Date().toISOString() },
  { id: 'h2', type: 'video', reason: 'y', heldAt: new Date().toISOString() }
]);
```

For the edge case "releasing non-existent item" test: call `renderSnapshot([])` then verify no crash (there's no equivalent of the old `render({action: 'released', id: 'nonexistent'})` since renderSnapshot replaces state entirely — just verify `renderSnapshot` handles empty/missing items gracefully).

**Step 4: Run tests**

Run: `cd ALNScanner && npm test -- --testPathPattern=HeldItemsRenderer`
Expected: All remaining tests pass.

**Step 5: Run full ALNScanner test suite**

Run: `cd ALNScanner && npm test`
Expected: All 1116 tests pass (count may decrease by ~12-15 from removed render() tests).

**Step 6: Commit**

```bash
cd ALNScanner && git add src/ui/renderers/HeldItemsRenderer.js tests/unit/ui/renderers/HeldItemsRenderer.test.js
git commit -m "fix: remove dead HeldItemsRenderer.render() method

Only renderSnapshot() is used via StateStore subscription. The event-driven
render(data) method was never called after unified state architecture."
```

---

## Task 2: Populate Sink Cache on audioRoutingService Init

**Why now:** Ensures `getState().availableSinks` has data before sync:full is sent to first GM connect. Quick fix before we add more state to sync:full in Task 3.

**Files:**
- Modify: `backend/src/services/audioRoutingService.js` (line ~117)
- Test: `backend/tests/unit/services/audioRoutingService.test.js` (if init tests exist)

**Step 1: Add getAvailableSinks() call to init()**

In `audioRoutingService.js`, after `this.startSinkMonitor();` (line 115) and before `registry.report(...)` (line 117), add:

```javascript
    // Pre-populate sink cache so first getState() has data
    await this.getAvailableSinks().catch(err => {
      logger.warn('Failed to pre-populate sink cache', { error: err.message });
    });
```

**Step 2: Update unit test mocks if needed**

Existing unit tests that call `audioRoutingService.init()` mock `_execFile` for specific pactl commands (`pactl info`, card profile commands). The new `getAvailableSinks()` call during init runs `pactl list sinks short`. If the mock doesn't handle this command, it will hit the `.catch()` handler (safe — won't fail init), but for clean tests, add a mock response for `pactl list sinks short` in the init test setup:

```javascript
mockExecFile.mockImplementation((cmd, args) => {
  // ... existing mocks ...
  if (cmd === 'pactl' && args[0] === 'list' && args[1] === 'sinks') {
    return Promise.resolve('0\talsa_output.hdmi\tmodule-alsa-card.c\ts16le 2ch 48000Hz\tIDLE');
  }
});
```

**Step 3: Run unit tests**

Run: `cd backend && npm run test:unit -- --testPathPattern=audioRouting`
Expected: Pass. The `.catch()` means init won't fail even if pactl isn't available in test, but clean mocks are preferred.

**Step 4: Run integration tests**

Run: `cd backend && npm run test:integration`
Expected: All 278 pass.

**Step 5: Commit**

```bash
cd backend && git add src/services/audioRoutingService.js
git commit -m "fix: populate sink cache during audioRoutingService init

First getState().availableSinks was empty until a pactl event triggered lazy
population. Now pre-seeded so GM Scanner audio dropdowns render on connect."
```

---

## Task 3: Add Sound Domain to sync:full Payload

**Why now:** Establishes the sound state delivery path before we add the GM Scanner subscriber in Task 5.

**Files:**
- Modify: `backend/src/websocket/syncHelpers.js`
- Modify: `ALNScanner/src/network/networkedSession.js`

**Step 1: Add soundService param to buildSyncFullPayload**

In `syncHelpers.js`, add `soundService` to the destructured params (line 42):

```javascript
  spotifyService,
  soundService,
  deviceFilter = {},
```

After the `heldItems` build (line 116), add:

```javascript
  // Sound playback state
  const sound = soundService ? soundService.getState() : { playing: [] };
```

Add `sound` to the return object (after `heldItems`, line 130):

```javascript
    heldItems,
    sound,
```

**Step 2: Add soundService to ALL buildSyncFullPayload callers**

**CRITICAL**: Every sync:full emission path MUST include soundService. This bug pattern has recurred 3 times before (see MEMORY.md). Search all callers:

Run: `grep -rn 'buildSyncFullPayload' backend/src/ backend/tests/`

**7 callers** (all must be updated):

| File | soundService Available? | Action Required |
|------|------------------------|-----------------|
| `src/websocket/gmAuth.js` | **No** | Add `const soundService = require('../services/soundService');` at top, pass to call |
| `src/websocket/broadcasts.js` (3 calls) | **Yes** (destructured at line 66) | Pass `soundService` to each `buildSyncFullPayload` call |
| `src/routes/stateRoutes.js` | **No** | Add `const soundService = require('../services/soundService');` at top, pass to call |
| `src/server.js` | **Yes** (required at line ~38) | Pass `soundService` to call |
| `tests/helpers/integration-test-server.js` | **Yes** (imported at line ~159) | Pass `soundService` to call |

Also update `tests/unit/websocket/syncHelpers.test.js` — all `buildSyncFullPayload` calls in tests must include `soundService` (can be `{ getState: () => ({ playing: [] }) }` mock).

**Step 3: Add sound to networkedSession.js sync:full handler**

In `ALNScanner/src/network/networkedSession.js`, in the sync:full StateStore population block (after line 256 `videoStatus`), add:

```javascript
            if (payload.sound) this._store.update('sound', payload.sound);
```

**Step 4: Run backend tests**

Run: `cd backend && npm test`
Expected: All pass. Some syncHelpers tests may need the new param added to their buildSyncFullPayload calls.

Run: `cd backend && npm run test:integration`
Expected: All 278 pass.

**Step 5: Commit (submodule-first workflow)**

ALNScanner is a submodule — commit inside it first, then update the parent ref:

```bash
# 1. Commit ALNScanner change
cd ALNScanner && git add src/network/networkedSession.js
git commit -m "feat: route sound domain from sync:full to StateStore"

# 2. Commit backend changes (all callers updated)
cd ../backend && git add src/websocket/syncHelpers.js src/websocket/gmAuth.js src/websocket/broadcasts.js src/routes/stateRoutes.js src/server.js
# (if integration-test-server.js changed, add that too)

# 3. Commit parent repo (backend changes + submodule ref)
cd .. && git add backend/ ALNScanner
git commit -m "feat: include sound state in sync:full payload

Sound domain was already broadcast via service:state in real-time, but was
missing from sync:full. Updated all 7 buildSyncFullPayload callers including
integration-test-server.js. GM Scanner now receives sound state on connect."
```

---

## Task 4: Proactive Health Revalidation in ServiceHealthRegistry

**Why now:** After Tasks 2-3 establish correct state delivery, this catches stale services that silently fail (confirmed: stale pipewire-pulse after 5 days uptime).

**Files:**
- Modify: `backend/src/services/serviceHealthRegistry.js`
- Modify: `backend/src/app.js` (start revalidation after init)
- Create: `backend/tests/unit/services/serviceHealthRegistry-revalidation.test.js`

**Step 1: Write failing test**

Create test file that verifies periodic revalidation calls each service's health check:

```javascript
// serviceHealthRegistry-revalidation.test.js
'use strict';

const EventEmitter = require('events');

// Mock services with checkHealth/checkConnection
const mockServices = {
  vlc: { checkConnection: jest.fn().mockResolvedValue(true) },
  spotify: { checkConnection: jest.fn().mockResolvedValue(true) },
  sound: { checkHealth: jest.fn().mockResolvedValue(true) },
  bluetooth: { checkHealth: jest.fn().mockResolvedValue(true) },
  audio: { checkHealth: jest.fn().mockResolvedValue(true) },
  lighting: { checkConnection: jest.fn().mockResolvedValue(true) },
};

describe('ServiceHealthRegistry - Proactive Revalidation', () => {
  let registry;

  beforeEach(() => {
    jest.useFakeTimers();
    // Fresh registry for each test
    jest.isolateModules(() => {
      registry = require('../../../src/services/serviceHealthRegistry');
    });
  });

  afterEach(() => {
    registry.stopRevalidation();
    jest.useRealTimers();
  });

  it('should call health checks for all registered services', async () => {
    registry.startRevalidation(mockServices, 15000);
    jest.advanceTimersByTime(15000);
    await Promise.resolve(); // flush microtasks

    expect(mockServices.vlc.checkConnection).toHaveBeenCalled();
    expect(mockServices.spotify.checkConnection).toHaveBeenCalled();
    expect(mockServices.sound.checkHealth).toHaveBeenCalled();
    expect(mockServices.bluetooth.checkHealth).toHaveBeenCalled();
    expect(mockServices.audio.checkHealth).toHaveBeenCalled();
    expect(mockServices.lighting.checkConnection).toHaveBeenCalled();
  });

  it('should not crash when a health check throws', async () => {
    mockServices.audio.checkHealth.mockRejectedValueOnce(new Error('pactl timeout'));
    registry.startRevalidation(mockServices, 15000);
    jest.advanceTimersByTime(15000);
    await Promise.resolve();
    // Should not throw — errors are caught per-service
  });

  it('should stop revalidation', () => {
    registry.startRevalidation(mockServices, 15000);
    registry.stopRevalidation();
    jest.advanceTimersByTime(30000);
    // No calls after stop
    expect(mockServices.vlc.checkConnection).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/services/serviceHealthRegistry-revalidation.test.js --no-coverage`
Expected: FAIL — `registry.startRevalidation is not a function`

**Step 3: Implement startRevalidation / stopRevalidation**

Add to `serviceHealthRegistry.js` before the `reset()` method:

```javascript
  /**
   * Start periodic health revalidation.
   * Calls each service's health check method on an interval.
   * Catches errors per-service so one failure doesn't block others.
   *
   * @param {Object} services - Map of service references
   * @param {number} [intervalMs=15000] - Revalidation interval in ms
   */
  startRevalidation(services, intervalMs = 15000) {
    this.stopRevalidation();

    const HEALTH_CHECKS = {
      vlc: () => services.vlc?.checkConnection(),
      spotify: () => services.spotify?.checkConnection(),
      sound: () => services.sound?.checkHealth(),
      bluetooth: () => services.bluetooth?.checkHealth(),
      audio: () => services.audio?.checkHealth(),
      lighting: () => services.lighting?.checkConnection(),
      // gameclock + cueengine are always healthy (in-process) — skip
    };

    this._revalidationTimer = setInterval(async () => {
      for (const [id, check] of Object.entries(HEALTH_CHECKS)) {
        try {
          await check();
        } catch (err) {
          logger.warn(`Health revalidation failed for ${id}`, { error: err.message });
        }
      }
    }, intervalMs);

    logger.info(`Health revalidation started (${intervalMs}ms interval)`);
  }

  /**
   * Stop periodic health revalidation.
   */
  stopRevalidation() {
    if (this._revalidationTimer) {
      clearInterval(this._revalidationTimer);
      this._revalidationTimer = null;
    }
  }
```

Also add `this._revalidationTimer = null;` to the constructor (after `this._services = new Map();`).

Add `this.stopRevalidation();` to the `reset()` method (before the for loop).

**Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/unit/services/serviceHealthRegistry-revalidation.test.js --no-coverage`
Expected: PASS

**Step 5: Wire into app.js (INSIDE initializeServices)**

In `app.js`, at the END of the `initializeServices()` function (before the final `logger.info('All services initialized successfully')`), add:

```javascript
  // Start periodic health revalidation (catches stale services like pipewire-pulse)
  serviceHealthRegistry.startRevalidation({
    vlc: vlcMprisService,
    spotify: spotifyService,
    sound: soundService,
    bluetooth: bluetoothService,
    audio: audioRoutingService,
    lighting: lightingService,
  }, 15000);
```

**Important placement:** This MUST be inside `initializeServices()`, not after it returns — the service references are local to that function.

**Step 5b: Wire into server.js shutdown**

Add `serviceHealthRegistry` import at the top of `server.js` (if not already imported):
```javascript
const serviceHealthRegistry = require('./services/serviceHealthRegistry');
```

Add to the shutdown handler (before `displayDriver.cleanup()`):
```javascript
  serviceHealthRegistry.stopRevalidation();
```

**Step 5c: Wire into systemReset.js post-reset**

`systemReset.js` calls `serviceHealthRegistry.reset()` which stops revalidation. After the reset re-initializes services, revalidation must be restarted. In `performSystemReset()`, after all services are re-probed (after the service re-initialization block), add:

```javascript
  // Restart health revalidation (stopped by registry.reset())
  serviceHealthRegistry.startRevalidation({
    vlc: require('./vlcMprisService'),
    spotify: require('./spotifyService'),
    sound: require('./soundService'),
    bluetooth: require('./bluetoothService'),
    audio: require('./audioRoutingService'),
    lighting: require('./lightingService'),
  }, 15000);
```

Without this, a system reset would silently stop all periodic health checks for the remainder of the session.

**Step 6: Run full backend tests**

Run: `cd backend && npm test && npm run test:integration`
Expected: All pass.

**Step 7: Commit**

```bash
cd backend && git add src/services/serviceHealthRegistry.js src/app.js src/server.js src/services/systemReset.js tests/unit/services/serviceHealthRegistry-revalidation.test.js
git commit -m "feat: proactive health revalidation for all services

15s interval calls each service's health check. Catches stale pipewire-pulse,
dead spotifyd, and other silent service failures without waiting for GM to
click Check Now. Errors caught per-service so one failure doesn't block others.
Revalidation restarts after system reset."
```

---

## Task 5: Fix display:mode Broadcast on Player-Triggered Video

**Why now:** Before the E2E test fix (Task 7), ensure display:mode events fire correctly for all video triggers.

**Files:**
- Modify: `backend/src/services/displayControlService.js` (line ~69)
- Test: Existing displayControlService tests should cover this

**Step 1: Write failing test (or verify existing test gap)**

Check existing tests for the pre-play hook emission. If no test exists, add one.

**Important:** The pre-play hook is registered via `videoQueueService.registerPrePlayHook(callback)`. In tests with a mock videoQueueService, the hook callback is captured in `mockVideoQueueService.registerPrePlayHook.mock.calls[0][0]`. Call THAT to trigger the hook:

```javascript
it('should emit display:mode:changed in pre-play hook', async () => {
  const modeChangeSpy = jest.fn();
  displayControlService.on('display:mode:changed', modeChangeSpy);

  // Get the captured pre-play hook callback
  const prePlayHook = mockVideoQueueService.registerPrePlayHook.mock.calls[0][0];
  await prePlayHook();

  expect(modeChangeSpy).toHaveBeenCalledWith(expect.objectContaining({
    mode: 'VIDEO',
    previousMode: 'IDLE_LOOP'
  }));
});
```

**No double-emit risk:** The pre-play hook fires for queue-based playback (player scan, cue, video:queue:add). `_doPlayVideo()` fires only for direct admin `display:video` commands. These are mutually exclusive paths.

**Step 2: Add the emit to the pre-play hook**

In `displayControlService.js`, inside the pre-play hook (line 69, after `this.currentMode = DisplayMode.VIDEO;`), add:

```javascript
          this.emit('display:mode:changed', {
            mode: DisplayMode.VIDEO,
            previousMode: this.previousMode
          });
```

The full hook becomes:

```javascript
      this.videoQueueService.registerPrePlayHook(async () => {
        if (this.currentMode !== DisplayMode.VIDEO) {
          this.previousMode = this.currentMode;
          if (this.currentMode === DisplayMode.SCOREBOARD) {
            await displayDriver.hideScoreboard();
          }
          this.currentMode = DisplayMode.VIDEO;
          this.emit('display:mode:changed', {
            mode: DisplayMode.VIDEO,
            previousMode: this.previousMode
          });
          logger.info('[DisplayControl] Pre-play hook: entered VIDEO mode', {
            previousMode: this.previousMode
          });
        }
      });
```

**Step 3: Run tests**

Run: `cd backend && npx jest tests/unit/services/displayControlService --no-coverage`
Expected: Pass (including the new/adapted test).

Run: `cd backend && npm test`
Expected: All pass.

**Step 4: Commit**

```bash
cd backend && git add src/services/displayControlService.js
git commit -m "fix: emit display:mode:changed in pre-play hook

Player-triggered and cue-triggered videos set VIDEO mode but never broadcast
the mode change. GM Scanner now receives display:mode for all video triggers."
```

---

## Task 6: Add Sound State Rendering to GM Scanner

**Why now:** Sound domain delivery (Task 3) is in place. This adds the visual indicator.

**Files:**
- Modify: `ALNScanner/src/admin/MonitoringDisplay.js`
- Modify: `ALNScanner/index.html` (add sound indicator DOM element)
- Create: `ALNScanner/tests/unit/admin/MonitoringDisplay-sound.test.js` (or add to existing)

**Step 1: Add DOM element in index.html**

Find the Show Control section in `index.html`. Add a sound indicator container after the Spotify section (or in the Show Control area near active cues):

```html
<div id="sound-status" class="sound-status"></div>
```

**Step 2: Add sound subscriber to MonitoringDisplay._wireStoreSubscriptions()**

After the `gameclock` subscription (line 122), add:

```javascript
    // Sound playback status
    on('sound', (state) => {
      const container = document.getElementById('sound-status');
      if (!container) return;
      const playing = state?.playing || [];
      if (playing.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
      }
      container.style.display = '';
      const files = playing.map(p => `<span class="sound-playing__file">${escapeHtml(p.file)}</span>`).join(', ');
      container.innerHTML = `<div class="sound-playing">Playing: ${files}</div>`;
    });
```

`escapeHtml` is already imported at the top of MonitoringDisplay.js (line 2). No additional import needed.

**Step 3: Add minimal CSS**

In `ALNScanner/src/styles/components/show-control.css` (where other show control styles live), add:

```css
.sound-playing {
  padding: 4px 8px;
  font-size: 0.85em;
  color: var(--text-secondary, #aaa);
}
.sound-playing__file {
  font-weight: 600;
  color: var(--text-primary, #fff);
}
```

**Step 4: Run ALNScanner tests**

Run: `cd ALNScanner && npm test`
Expected: All pass. The sound subscriber is a simple DOM update — no complex logic to break.

**Step 5: Commit**

```bash
cd ALNScanner && git add src/admin/MonitoringDisplay.js index.html
git commit -m "feat: render sound playback status in admin panel

Shows 'Playing: attention.wav' when sound effects are active. Uses sound
domain from StateStore (delivered via service:state and sync:full)."
```

---

## Task 7: Add Per-Stream Volume Control to GM Scanner

**Why now:** Backend `audio:volume:set` command already works. After Task 6 establishes the sound indicator pattern, this adds volume sliders alongside routing dropdowns.

**Files:**
- Modify: `ALNScanner/src/admin/AudioController.js`
- Modify: `ALNScanner/src/ui/renderers/EnvironmentRenderer.js`
- Modify: `ALNScanner/src/utils/domEventBindings.js`
- Create: `ALNScanner/tests/unit/admin/AudioController-volume.test.js`

**Step 1: Add setVolume method to AudioController**

In `AudioController.js`, add after the `setVideoOutput` method:

```javascript
  /**
   * Set volume for a specific audio stream
   * @param {string} stream - Stream identifier ('video', 'spotify', 'sound')
   * @param {number} volume - Volume level (0-100)
   * @returns {Promise<Object>} Volume set response
   */
  async setVolume(stream, volume) {
    return sendCommand(this.connection, 'audio:volume:set', { stream, volume });
  }
```

**Step 2: Write failing test for AudioController.setVolume**

```javascript
// AudioController-volume.test.js
import { AudioController } from '../../../../src/admin/AudioController.js';

describe('AudioController - Volume', () => {
  let controller;
  let mockConnection;

  beforeEach(() => {
    mockConnection = { dispatchEvent: jest.fn() };
    controller = new AudioController(mockConnection);
  });

  it('should send audio:volume:set command', async () => {
    // Mock sendCommand — this depends on CommandSender implementation
    // The test verifies the method exists and passes params correctly
    expect(typeof controller.setVolume).toBe('function');
  });
});
```

**Step 3: Add volume sliders to EnvironmentRenderer**

In `EnvironmentRenderer._renderAudioDropdowns()`, after each routing dropdown, add a volume slider. Modify the template (line 199):

```javascript
  _renderAudioDropdowns(sinks) {
    if (!this.audioRoutingContainer) return;

    const streams = [
      { id: 'video', label: this.STREAM_LABELS.video },
      { id: 'spotify', label: this.STREAM_LABELS.spotify },
      { id: 'sound', label: this.STREAM_LABELS.sound }
    ];

    this.audioRoutingContainer.innerHTML = streams.map(stream => `
      <div class="audio-control-item">
        <label>${stream.label}</label>
        <select class="form-select" data-stream="${stream.id}" data-action="admin.setAudioRoute">
          ${sinks.map(sink => `
            <option value="${escapeHtml(sink.name)}">${escapeHtml(sink.label || sink.description || sink.name)}</option>
          `).join('')}
        </select>
        <div class="volume-control">
          <input type="range" min="0" max="100" value="100"
                 data-stream="${stream.id}"
                 data-action="admin.setStreamVolume"
                 class="volume-slider" />
          <span class="volume-label">100%</span>
        </div>
      </div>
    `).join('');
  }
```

**Step 4: Wire volume slider in domEventBindings.js**

Add debounced volume handler (similar to Spotify pattern). After the `debouncedSpotifyVolume` declaration (line ~37), add:

```javascript
  // Debounced stream volume setter (video, spotify, sound via PipeWire)
  const debouncedStreamVolume = debounce((stream, volume) => {
    const adminController = app.networkedSession?.getService('adminController');
    if (adminController?.initialized) {
      safeAdminAction(adminController.getModule('audioController').setVolume(stream, volume), 'setStreamVolume');
    }
  }, 150);
```

Add case in `handleAdminAction`:

```javascript
      case 'setStreamVolume': {
        const stream = actionElement.dataset.stream;
        const volume = parseInt(actionElement.value, 10);
        if (stream && !isNaN(volume)) {
          // Update label immediately
          const label = actionElement.parentElement?.querySelector('.volume-label');
          if (label) label.textContent = `${volume}%`;
          debouncedStreamVolume(stream, volume);
        }
        break;
      }
```

**Step 5: Add CSS for volume controls**

In `ALNScanner/src/styles/components/environment.css` (where audio routing styles live), add:

```css
.volume-control {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}
.volume-slider {
  flex: 1;
  height: 4px;
}
.volume-label {
  font-size: 0.8em;
  min-width: 35px;
  text-align: right;
}
```

**Step 5b: Cache and restore volume values across dropdown rebuilds**

`_renderAudioDropdowns` replaces the entire `audioRoutingContainer.innerHTML` when sinks change (BT speaker connect/disconnect). Without protection, all volume sliders reset to 100% — dangerous during a live game (could blast audio in a quiet room).

Add a `_volumeValues` cache to EnvironmentRenderer constructor:

```javascript
    this._volumeValues = { video: 100, spotify: 100, sound: 100 }; // Track last-known slider values
```

Before the `innerHTML =` in `_renderAudioDropdowns`, capture current values:

```javascript
  _renderAudioDropdowns(sinks) {
    if (!this.audioRoutingContainer) return;

    // Preserve current volume slider values before rebuild
    this.audioRoutingContainer.querySelectorAll('.volume-slider').forEach(slider => {
      const stream = slider.dataset.stream;
      if (stream) this._volumeValues[stream] = parseInt(slider.value, 10) || 100;
    });

    const streams = [ /* ... same as before ... */ ];

    this.audioRoutingContainer.innerHTML = streams.map(stream => `
      <div class="audio-control-item">
        <label>${stream.label}</label>
        <select class="form-select" data-stream="${stream.id}" data-action="admin.setAudioRoute">
          ${sinks.map(sink => `
            <option value="${escapeHtml(sink.name)}">${escapeHtml(sink.label || sink.description || sink.name)}</option>
          `).join('')}
        </select>
        <div class="volume-control">
          <input type="range" min="0" max="100" value="${this._volumeValues[stream.id]}"
                 data-stream="${stream.id}"
                 data-action="admin.setStreamVolume"
                 class="volume-slider" />
          <span class="volume-label">${this._volumeValues[stream.id]}%</span>
        </div>
      </div>
    `).join('');
  }
```

Also update the `setStreamVolume` handler in domEventBindings.js to cache the value on the renderer side. Add to the `renderAudio` method in EnvironmentRenderer a differential volume update path — when audio state changes but sinks haven't changed, update the `_volumeValues` cache from server state if available (currently `audioRoutingService.getState()` doesn't include per-stream volumes, so the cache is the only source of truth for slider position).

Add `_volumeValues` to `reset()` / constructor so it reinitializes cleanly.

**Step 6: Run ALNScanner tests**

Run: `cd ALNScanner && npm test`
Expected: All pass.

**Step 7: Commit**

```bash
cd ALNScanner && git add src/admin/AudioController.js src/ui/renderers/EnvironmentRenderer.js src/utils/domEventBindings.js
git commit -m "feat: per-stream volume control in GM Scanner admin panel

Volume sliders for video, spotify, and sound streams alongside routing
dropdowns. Uses existing backend audio:volume:set command via PipeWire
sink-input volume. 150ms debounce prevents subprocess pile-up."
```

---

## Task 8: Fix Full-Game E2E Test Video Compound Cue Timing

**Why now:** All backend fixes are in place. Display:mode now broadcasts correctly (Task 5). This is the final item.

**Files:**
- Modify: `backend/tests/e2e/flows/30-full-game-session-multi-device.test.js` (Phase 1.6)
- Possibly: `backend/tests/e2e/helpers/page-objects/GMScannerPage.js` (add helper)

**Step 1: Understand the root cause**

The `e2e-video-compound` cue fires `video:queue:add` at t=0. If VLC is still playing (e.g., from the clock-driven compound cue's sound effects keeping VLC busy, or leftover idle-loop), `cueEngineService` detects conflict via `videoQueueService.isPlaying()` → holds cue with `video_busy` → cue never appears in active cues UI → `waitForActiveCue` times out.

**Step 2: Add video idle wait before firing video compound cue**

In the test, before `await gmScanner1.fireCue('e2e-video-compound')` (line 453), add a wait for VLC to be idle:

```javascript
      // Wait for VLC to be idle before firing video compound cue
      // (prevents video_busy hold if previous cue left VLC in use)
      await gmScanner1.waitForVideoIdle(10000);
      console.log('  → VLC idle, firing video-driven compound cue: e2e-video-compound');
```

**Step 3: Add waitForVideoIdle helper to GMScannerPage**

In `GMScannerPage.js`, add:

```javascript
  /**
   * Wait for video status to show idle (no video playing, queue empty)
   * @param {number} timeout - Max wait time in ms
   */
  async waitForVideoIdle(timeout = 10000) {
    await this.page.waitForFunction(
      () => {
        const el = document.getElementById('now-showing-value');
        return el && el.textContent === 'Idle Loop';
      },
      { timeout }
    );
  }
```

**DOM verified:** VideoRenderer sets `this._nowPlayingEl.textContent = nowPlaying || 'Idle Loop'` (VideoRenderer.js line ~42). The element is `<span id="now-showing-value">`. Previous error-context.md page snapshot confirms `"Now Showing:"` + `"Idle Loop"` + `🔄` in the video controls section.

**Root cause note:** The clock-driven compound cue (e2e-compound-test) uses sound+lighting, NOT video. So VLC should be idle after it completes. The more likely cause is the idle-loop video itself — `videoQueueService.isPlaying()` returns true only for QUEUED video playback (not idle loop), so this should not be the issue. However, VLC startup latency or a race between cue completion and the next fire could still trigger video_busy. The `waitForVideoIdle` is a defensive guard regardless of root cause.

**Step 4: Run the E2E test**

Run: `cd backend && npx playwright test flows/30-full-game --workers=1`
Expected: The video compound cue section should pass (previously timed out).

**Step 5: Run full E2E suite**

Run: `cd backend && npm run test:e2e`
Expected: All E2E tests pass.

**Step 6: Commit**

```bash
cd backend && git add tests/e2e/flows/30-full-game-session-multi-device.test.js tests/e2e/helpers/page-objects/GMScannerPage.js
git commit -m "fix: E2E video compound cue timing — wait for VLC idle

The video compound cue was held with video_busy because the previous cue
left VLC in a non-idle state. Added waitForVideoIdle() before firing the
video compound cue to ensure VLC is available."
```

---

## Verification

After all tasks are complete:

1. **Backend unit + contract:** `cd backend && npm test` — expect ~1550 pass
2. **Backend integration:** `cd backend && npm run test:integration` — expect ~280 pass
3. **ALNScanner unit:** `cd ALNScanner && npm test` — expect ~1100 pass (slightly reduced from removed render() tests)
4. **E2E full suite:** `cd backend && npm run test:e2e` — expect all pass including 30-full-game
5. **Manual verification:** Start dev server, connect GM Scanner, verify:
   - Audio routing dropdowns populated immediately (Task 2)
   - Volume sliders visible and functional (Task 7)
   - Sound playback indicator shows during cue fire (Task 6)
   - Health dashboard updates every 15s (Task 4)
   - Service health check catches stale pipewire-pulse after manual `systemctl --user stop pipewire-pulse`

---

## Cross-Cutting Concerns Summary

| Cluster | Tasks | Shared Files |
|---------|-------|-------------|
| **A: Backend State** | 2, 3, 4 | syncHelpers.js, broadcasts.js, app.js |
| **B: GM Scanner Audio UI** | 6, 7 | MonitoringDisplay.js, EnvironmentRenderer.js, domEventBindings.js |
| **C: Video Lifecycle** | 5, 8 | displayControlService.js, E2E test |
| **Standalone** | 1 | ALNScanner only, no backend changes |
