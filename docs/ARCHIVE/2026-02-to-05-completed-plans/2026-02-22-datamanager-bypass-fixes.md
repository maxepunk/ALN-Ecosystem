# DataManager Bypass Fixes + Spotify UI

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three bugs caused by DataManager bypass anti-patterns (cues disappearing, Spotify dead-end UI, session status crash), build a proper Spotify interface, and clean up legacy bypass handlers.

**Architecture:** All WebSocket state must flow through `UnifiedDataManager` (DM) before reaching renderers. The pattern is: `NetworkedSession → DM.update*() → CustomEvent → Renderer`. MonitoringDisplay's `_handleMessage()` should only handle ephemeral UI (toasts, direct-to-renderer cases with no DM state). Any handler that duplicates a NetworkedSession→DM path is legacy dead code.

**Tech Stack:** ES6 modules, Vite, Jest, Socket.io, Node.js EventEmitter

---

## Bugs Being Fixed

| Bug | Root Cause | Symptom |
|-----|-----------|---------|
| **Cues disappear** | `sync:full` cue data rendered directly, never loaded into DM. Cue events trigger re-render with empty `cueState.cues` Map. | All cue sections vanish after firing any cue |
| **Spotify dead-end** | No reconnect command exists. UI shows "Disconnected" with no action button. No DM spotify state. | GM can't recover Spotify |
| **Session crash** | `session-status-container` has two competing renderers. Legacy `UIManager.renderSessionStatus()` doesn't null-guard `startTime` for `setup` status sessions. | `TypeError: Cannot read properties of null (reading 'toLocaleTimeString')` |

---

## Phase 1: Core DataManager Fixes

### Task 1: Route cue engine sync:full through DataManager

The root cause of the cue disappearance bug. Currently `MonitoringDisplay.updateAllDisplays()` renders cue data directly from the raw sync:full payload, bypassing DM. When cue events arrive, DM dispatches `cue-state:updated` with an empty `cueState.cues` Map because `loadCues()` was never called.

**Files:**
- Modify: `ALNScanner/src/network/networkedSession.js` — sync:full handler (~line 201)
- Modify: `ALNScanner/src/admin/MonitoringDisplay.js` — `updateAllDisplays()` (~line 347-354)
- Modify: `ALNScanner/src/core/unifiedDataManager.js` — add `syncCueState()` method
- Test: `ALNScanner/tests/unit/core/unifiedDataManager.cue.test.js` (new)

**Step 1: Write failing test for DM cue state loading from sync:full**

```javascript
// tests/unit/core/unifiedDataManager.cue.test.js
import { UnifiedDataManager } from '../../../src/core/unifiedDataManager.js';

describe('UnifiedDataManager - Cue State from sync:full', () => {
  let dm;

  beforeEach(() => {
    dm = new UnifiedDataManager();
  });

  const mockCueEngine = {
    loaded: true,
    cues: [
      { id: 'tension-hit', label: 'Tension Hit', quickFire: true, icon: 'tension' },
      { id: 'clock-warning', label: '30 Min Warning', triggerType: 'clock', quickFire: false }
    ],
    activeCues: [
      { cueId: 'tension-hit', state: 'running', progress: 0.5, duration: 3 }
    ],
    disabledCues: ['clock-warning']
  };

  test('syncCueState loads definitions, active cues, and disabled cues', () => {
    dm.syncCueState(mockCueEngine);

    const state = dm.getCueState();
    expect(state.cues.size).toBe(2);
    expect(state.cues.get('tension-hit').quickFire).toBe(true);
    expect(state.activeCues.size).toBe(1);
    expect(state.activeCues.get('tension-hit').state).toBe('running');
    expect(state.disabledCues.has('clock-warning')).toBe(true);
  });

  test('syncCueState dispatches cue-state:updated event', (done) => {
    dm.addEventListener('cue-state:updated', (e) => {
      expect(e.detail.cues.size).toBe(2);
      done();
    });
    dm.syncCueState(mockCueEngine);
  });

  test('syncCueState with loaded:false clears cue state', () => {
    dm.syncCueState(mockCueEngine); // Load first
    dm.syncCueState({ loaded: false, cues: [], activeCues: [], disabledCues: [] });

    const state = dm.getCueState();
    expect(state.cues.size).toBe(0);
    expect(state.activeCues.size).toBe(0);
  });

  test('cue definitions persist after updateCueStatus', () => {
    dm.syncCueState(mockCueEngine);
    dm.updateCueStatus({ cueId: 'tension-hit', state: 'completed' });

    const state = dm.getCueState();
    // Definitions MUST still be there
    expect(state.cues.size).toBe(2);
    expect(state.cues.get('tension-hit').quickFire).toBe(true);
    // But active cues should reflect the completion
    expect(state.activeCues.has('tension-hit')).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd ALNScanner && npx jest tests/unit/core/unifiedDataManager.cue.test.js --no-coverage
```
Expected: FAIL — `syncCueState` is not a function

**Step 3: Replace `loadCues()` with `syncCueState()` in UnifiedDataManager**

In `ALNScanner/src/core/unifiedDataManager.js`, **delete** the existing `loadCues()` method (around line 961-969) and replace it with `syncCueState()`. The old `loadCues()` only loaded definitions — the new method is a superset that syncs definitions, active cues, and disabled cues atomically:

```javascript
  /**
   * Sync full cue state from sync:full payload.
   * Loads definitions, active cues, and disabled cues in one atomic update.
   * Replaces the old loadCues() which only handled definitions.
   * @param {Object} cueEngine - { loaded, cues[], activeCues[], disabledCues[] }
   */
  syncCueState(cueEngine) {
    // Clear and reload definitions
    this.cueState.cues.clear();
    if (cueEngine.loaded && Array.isArray(cueEngine.cues)) {
      cueEngine.cues.forEach(cue => this.cueState.cues.set(cue.id, cue));
    }

    // Sync active cues
    this.cueState.activeCues.clear();
    if (Array.isArray(cueEngine.activeCues)) {
      cueEngine.activeCues.forEach(ac => this.cueState.activeCues.set(ac.cueId, ac));
    }

    // Sync disabled cues
    this.cueState.disabledCues.clear();
    if (Array.isArray(cueEngine.disabledCues)) {
      cueEngine.disabledCues.forEach(id => this.cueState.disabledCues.add(id));
    }

    this._log(`Synced cue state: ${this.cueState.cues.size} definitions, ${this.cueState.activeCues.size} active, ${this.cueState.disabledCues.size} disabled`);
    this._dispatchCueUpdate();
  }
```

**IMPORTANT:** `loadCues()` has zero callers in the codebase and is now dead code. Delete it entirely — do NOT keep it alongside `syncCueState()`.

**Step 4: Run test to verify it passes**

```bash
cd ALNScanner && npx jest tests/unit/core/unifiedDataManager.cue.test.js --no-coverage
```
Expected: PASS

**Step 5: Route sync:full cue data through DM in NetworkedSession**

In `ALNScanner/src/network/networkedSession.js`, inside the `case 'sync:full':` handler (around line 239, before the `break`), add:

```javascript
          // Sync Cue Engine State (Phase 1 & 2)
          if (payload.cueEngine) {
            this.dataManager.syncCueState(payload.cueEngine);
          }
```

**Step 6: Remove direct cue AND session rendering from MonitoringDisplay.updateAllDisplays()**

In `ALNScanner/src/admin/MonitoringDisplay.js`:

**6a. Remove session bypass** (lines 333-334). The session render here duplicates what `_wireDataManagerEvents()` already wires: `session-state:updated` → SessionRenderer. Replace:

```javascript
    // 1. Session State
    // Always render session state, even if null (to show "Create Session" button)
    this.sessionRenderer.render(syncData.session || null);
```

with:

```javascript
    // 1. Session State
    // Handled by NetworkedSession → DM.updateSessionState() → 'session-state:updated' event → SessionRenderer
    // No direct rendering needed here.
```

**6b. Remove cue bypass** (lines 347-354). Replace the cue engine section with a comment:

```javascript
    // 4. Cue Engine (Phase 1 & 2)
    // Handled by NetworkedSession → DM.syncCueState() → 'cue-state:updated' event → CueRenderer
    // No direct rendering needed here.
```

**Step 7: Run full test suite to verify no regressions**

```bash
cd ALNScanner && npm test -- --no-coverage
```
Expected: All existing tests pass

**Step 8: Commit**

```bash
git add ALNScanner/src/core/unifiedDataManager.js ALNScanner/src/network/networkedSession.js ALNScanner/src/admin/MonitoringDisplay.js ALNScanner/tests/unit/core/unifiedDataManager.cue.test.js
git commit -m "fix: route cue engine state through DataManager (fixes cues disappearing after fire)"
```

---

### Task 2: Fix session status container crash

The `session-status-container` has TWO competing renderers:
1. `SessionRenderer` via MonitoringDisplay `_wireDataManagerEvents()` (listens to `session-state:updated`) — handles all states correctly including `setup`
2. `UIManager.renderSessionStatus()` via ScreenUpdateManager in `main.js` (listens to `session:updated`, `data:cleared`) — crashes on `setup` state (null `startTime`)

The fix: remove the ScreenUpdateManager registration. SessionRenderer already handles all session rendering correctly.

**Files:**
- Modify: `ALNScanner/src/main.js` — remove `session-status-container` ScreenUpdateManager registration
- Verify: `ALNScanner/src/ui/uiManager.js` — `renderSessionStatus()` can stay (used by standalone mode) but guard the null

**Step 1: Fix the null guard in UIManager.renderSessionStatus() (defense-in-depth)**

In `ALNScanner/src/ui/uiManager.js` line 412, change:

```javascript
          <span>Started: ${startTime.toLocaleTimeString()}</span>
```
to:
```javascript
          <span>Started: ${startTime ? startTime.toLocaleTimeString() : '—'}</span>
```

This guards against null even if this method is called from standalone mode or future code paths.

**Step 2: Remove the competing ScreenUpdateManager registration**

In `ALNScanner/src/main.js`, remove the entire `session-status-container` registration block (around lines 200-210):

```javascript
// DELETE THIS BLOCK:
// Session Status container (admin panel) - Phase 3: Session lifecycle display
screenUpdateManager.registerContainer('session-status-container', {
  'session:updated': (eventData, container) => {
    Debug.log('[main.js] Updating session-status-container (session updated)');
    UIManager.renderSessionStatus(container);
  },
  'data:cleared': (eventData, container) => {
    Debug.log('[main.js] Session reset - re-rendering session-status-container');
    UIManager.renderSessionStatus(container);
  }
});
```

SessionRenderer via MonitoringDisplay._wireDataManagerEvents() already renders this container on all session state changes.

**Step 3: Also remove `session:updated` from connectToDataSource event list**

In `main.js`, in the `connectToDataSource()` call, remove `'session:updated'` from the array (it's now unused — no screen or container handler references it).

**Step 4: Run tests**

```bash
cd ALNScanner && npm test -- --no-coverage
```

**Step 5: Commit**

```bash
git add ALNScanner/src/ui/uiManager.js ALNScanner/src/main.js
git commit -m "fix: remove competing session-status-container renderer (fixes null startTime crash)"
```

---

## Phase 2: Spotify DataManager Integration

### Task 3: Add Spotify state to DataManager

Currently Spotify has NO DataManager support — state is rendered directly from WebSocket events. This task adds proper state management so the SpotifyRenderer can work event-driven.

**Files:**
- Modify: `ALNScanner/src/core/unifiedDataManager.js` — add spotify state + methods
- Modify: `ALNScanner/src/network/networkedSession.js` — route spotify events through DM
- Modify: `ALNScanner/src/admin/MonitoringDisplay.js` — remove legacy `_renderNowPlaying`, wire DM event
- Test: `ALNScanner/tests/unit/core/unifiedDataManager.spotify.test.js` (new)

**Step 1: Write failing tests**

```javascript
// tests/unit/core/unifiedDataManager.spotify.test.js
import { UnifiedDataManager } from '../../../src/core/unifiedDataManager.js';

describe('UnifiedDataManager - Spotify State', () => {
  let dm;

  beforeEach(() => {
    dm = new UnifiedDataManager();
  });

  test('initial spotify state is disconnected', () => {
    const state = dm.getSpotifyState();
    expect(state.connected).toBe(false);
    expect(state.state).toBe('stopped');
  });

  test('updateSpotifyState updates and dispatches event', (done) => {
    dm.addEventListener('spotify-state:updated', (e) => {
      expect(e.detail.connected).toBe(true);
      expect(e.detail.state).toBe('playing');
      expect(e.detail.track.title).toBe('Bohemian Rhapsody');
      done();
    });

    dm.updateSpotifyState({
      connected: true,
      state: 'playing',
      volume: 80,
      pausedByGameClock: false,
      track: { title: 'Bohemian Rhapsody', artist: 'Queen' }
    });
  });

  test('updateSpotifyState merges partial updates', () => {
    dm.updateSpotifyState({ connected: true, state: 'playing', volume: 80 });
    dm.updateSpotifyState({ state: 'paused' });

    const state = dm.getSpotifyState();
    expect(state.connected).toBe(true); // Preserved
    expect(state.state).toBe('paused'); // Updated
    expect(state.volume).toBe(80);      // Preserved
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd ALNScanner && npx jest tests/unit/core/unifiedDataManager.spotify.test.js --no-coverage
```

**Step 3: Implement spotify state in UnifiedDataManager**

Add to constructor (after `this.cueState`):

```javascript
    // Phase 2: Spotify State
    this.spotifyState = {
      connected: false,
      state: 'stopped',
      volume: 100,
      pausedByGameClock: false,
      track: null
    };
```

Add methods (in a new section after cue state methods):

```javascript
  // ============================================================================
  // SPOTIFY STATE MANAGEMENT
  // ============================================================================

  /**
   * Get current Spotify state
   * @returns {Object} { connected, state, volume, pausedByGameClock, track }
   */
  getSpotifyState() {
    return { ...this.spotifyState };
  }

  /**
   * Update Spotify state (merges partial updates)
   * @param {Object} payload - Partial or full spotify state
   */
  updateSpotifyState(payload) {
    Object.assign(this.spotifyState, payload);
    this.dispatchEvent(new CustomEvent('spotify-state:updated', {
      detail: this.getSpotifyState()
    }));
  }
```

**Step 4: Run tests**

```bash
cd ALNScanner && npx jest tests/unit/core/unifiedDataManager.spotify.test.js --no-coverage
```

**Step 5: Route spotify events through DM in NetworkedSession**

In `ALNScanner/src/network/networkedSession.js`, inside the `case 'sync:full':` handler (after the cueEngine block added in Task 1):

```javascript
          // Sync Spotify State (Phase 2)
          if (payload.spotify) {
            this.dataManager.updateSpotifyState(payload.spotify);
          }
```

Add a new case for the `spotify:status` event (after the `cue:conflict` case around line 303):

```javascript
        // Phase 2: Spotify State Routing
        case 'spotify:status':
          this.dataManager.updateSpotifyState(payload);
          break;
```

**Step 6: Wire DM spotify event in MonitoringDisplay**

In `ALNScanner/src/admin/MonitoringDisplay.js`, add to `_wireDataManagerEvents()`:

```javascript
    // Spotify State
    this.dataManager.addEventListener('spotify-state:updated', (e) => this.spotifyRenderer.render(e.detail));
```

(The `spotifyRenderer` will be created in Task 5. For now this sets up the wiring.)

**Step 7: Remove legacy spotify handling from MonitoringDisplay**

In `_handleMessage()`, remove the `case 'spotify:status':` block (lines 165-167). It's now handled by NetworkedSession → DM → event → renderer.

In `updateAllDisplays()`, remove the spotify section (lines 364-367). It's now handled by the sync:full → DM → event → renderer path.

Remove the `_renderNowPlaying()` method entirely (lines 283-310). SpotifyRenderer replaces it.

**Step 8: Commit**

```bash
git add ALNScanner/src/core/unifiedDataManager.js ALNScanner/src/network/networkedSession.js ALNScanner/src/admin/MonitoringDisplay.js ALNScanner/tests/unit/core/unifiedDataManager.spotify.test.js
git commit -m "feat: add Spotify state management to DataManager"
```

---

### Task 4: Add spotify:reconnect backend command

The backend has `spotifyService.checkConnection()` but no way to trigger it from the admin UI.

**Files:**
- Modify: `backend/src/services/commandExecutor.js` — add `spotify:reconnect` case
- Modify: `backend/src/websocket/broadcasts.js` — wire `connection:changed` event
- Test: `backend/tests/unit/services/commandExecutor.spotify.test.js` (new or extend existing)

**Step 1: Write failing test**

```javascript
// In commandExecutor tests (new or extend existing file)
describe('spotify:reconnect command', () => {
  test('calls checkConnection and broadcasts result', async () => {
    const spotifyService = require('../../src/services/spotifyService');
    jest.spyOn(spotifyService, 'checkConnection').mockResolvedValue(true);
    jest.spyOn(spotifyService, 'getState').mockReturnValue({
      connected: true, state: 'stopped', volume: 100, pausedByGameClock: false
    });

    const { executeCommand } = require('../../src/services/commandExecutor');
    const result = await executeCommand({
      action: 'spotify:reconnect',
      payload: {},
      source: 'admin',
      deviceId: 'gm1'
    });

    expect(result.success).toBe(true);
    expect(spotifyService.checkConnection).toHaveBeenCalled();
    expect(result.broadcasts).toEqual([
      expect.objectContaining({ event: 'spotify:status', target: 'gm' })
    ]);
  });
});
```

**Step 2: Run test to verify it fails**

**Step 3: Implement in commandExecutor.js**

Add a new case in the switch statement (after `spotify:cache:verify`):

```javascript
      case 'spotify:reconnect': {
        const spotifyService = require('./spotifyService');
        const connected = await spotifyService.checkConnection();
        return {
          success: true,
          message: connected ? 'Spotify connected' : 'Spotify not available',
          data: { connected },
          source,
          broadcasts: [{ event: 'spotify:status', data: spotifyService.getState(), target: 'gm' }]
        };
      }
```

Also add `'spotify:reconnect': null` to the `ACTION_TO_METHOD` map at the top (the `null` indicates it's handled as a special case, not a simple method delegation).

**Step 4: Wire connection:changed in broadcasts.js**

In `backend/src/websocket/broadcasts.js`, find the spotify event wiring section (around line 720). Add after the existing `volume:changed` listener:

```javascript
    addTrackedListener(spotifyService, 'connection:changed', () => {
      emitToRoom(io, 'gm', 'spotify:status', spotifyService.getState());
      logger.debug('Broadcasted spotify:status (connection changed)');
    });
```

**Step 5: Run backend tests**

```bash
cd backend && npm test -- --no-coverage
```

**Step 6: Commit**

```bash
git add backend/src/services/commandExecutor.js backend/src/websocket/broadcasts.js backend/tests/unit/services/commandExecutor.spotify.test.js
git commit -m "feat: add spotify:reconnect command and wire connection:changed broadcast"
```

---

## Phase 3: Spotify UI

### Task 5: Create SpotifyRenderer

A proper renderer following the established pattern (CueRenderer, EnvironmentRenderer, SessionRenderer, VideoRenderer).

**Files:**
- Create: `ALNScanner/src/ui/renderers/SpotifyRenderer.js`
- Create: `ALNScanner/src/styles/components/spotify.css`
- Test: `ALNScanner/tests/unit/ui/renderers/SpotifyRenderer.test.js` (new)

**Step 1: Write failing tests**

```javascript
// tests/unit/ui/renderers/SpotifyRenderer.test.js
import { SpotifyRenderer } from '../../../../src/ui/renderers/SpotifyRenderer.js';

describe('SpotifyRenderer', () => {
  let container;
  let renderer;
  let onAction;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'now-playing-section';
    document.body.appendChild(container);
    onAction = jest.fn();
    renderer = new SpotifyRenderer({ container });
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  test('renders disconnected state with reconnect button', () => {
    renderer.render({ connected: false, state: 'stopped', volume: 100 });
    expect(container.querySelector('.spotify--disconnected')).not.toBeNull();
    expect(container.querySelector('[data-action="admin.spotifyReconnect"]')).not.toBeNull();
  });

  test('renders connected state with transport controls', () => {
    renderer.render({
      connected: true,
      state: 'playing',
      volume: 80,
      track: { title: 'Test Song', artist: 'Test Artist' }
    });
    expect(container.querySelector('.spotify--connected')).not.toBeNull();
    expect(container.querySelector('[data-action="admin.spotifyPause"]')).not.toBeNull();
    expect(container.querySelector('.spotify__track-title').textContent).toBe('Test Song');
  });

  test('renders paused state with play button', () => {
    renderer.render({ connected: true, state: 'paused', volume: 80, track: { title: 'Song', artist: 'Artist' } });
    expect(container.querySelector('[data-action="admin.spotifyPlay"]')).not.toBeNull();
    expect(container.querySelector('[data-action="admin.spotifyPause"]')).toBeNull();
  });

  test('renders volume slider', () => {
    renderer.render({ connected: true, state: 'playing', volume: 65 });
    const slider = container.querySelector('.spotify__volume-slider');
    expect(slider).not.toBeNull();
    expect(slider.value).toBe('65');
  });

  test('shows paused-by-clock indicator', () => {
    renderer.render({ connected: true, state: 'paused', pausedByGameClock: true, volume: 80 });
    expect(container.querySelector('.spotify__clock-paused')).not.toBeNull();
  });

  test('no track info shows "No track" placeholder', () => {
    renderer.render({ connected: true, state: 'stopped', volume: 100, track: null });
    expect(container.querySelector('.spotify__track-title').textContent).toContain('No track');
  });
});
```

**Step 2: Run test to verify it fails**

**Step 3: Implement SpotifyRenderer**

```javascript
// ALNScanner/src/ui/renderers/SpotifyRenderer.js

/**
 * SpotifyRenderer - DOM Rendering for Spotify Status & Controls
 * Follows same pattern as CueRenderer, EnvironmentRenderer, etc.
 */
export class SpotifyRenderer {
  constructor(elements = {}) {
    this.container = elements.container || document.getElementById('now-playing-section');
  }

  /**
   * Render Spotify state
   * @param {Object} state - { connected, state, volume, pausedByGameClock, track }
   */
  render(state) {
    if (!this.container) return;

    if (!state || !state.connected) {
      this._renderDisconnected();
      return;
    }

    this._renderConnected(state);
  }

  _renderDisconnected() {
    this.container.innerHTML = `
      <div class="spotify spotify--disconnected">
        <div class="spotify__status">
          <span class="spotify__status-icon">&#9679;</span>
          <span class="spotify__status-text">Spotify Disconnected</span>
        </div>
        <button class="btn btn-sm" data-action="admin.spotifyReconnect">
          Reconnect
        </button>
      </div>
    `;
  }

  _renderConnected(state) {
    const isPlaying = state.state === 'playing';
    const track = state.track || {};
    const title = track.title || 'No track';
    const artist = track.artist || '';
    const volume = state.volume ?? 100;

    this.container.innerHTML = `
      <div class="spotify spotify--connected ${isPlaying ? 'spotify--playing' : 'spotify--paused'}">
        ${state.pausedByGameClock ? '<div class="spotify__clock-paused">Paused by Game Clock</div>' : ''}
        <div class="spotify__track">
          <span class="spotify__track-title">${this._escape(title)}</span>
          ${artist ? `<span class="spotify__track-artist">${this._escape(artist)}</span>` : ''}
        </div>
        <div class="spotify__controls">
          <button class="btn btn-sm btn-icon" data-action="admin.spotifyPrevious" title="Previous">&#9664;&#9664;</button>
          ${isPlaying
            ? '<button class="btn btn-sm btn-icon" data-action="admin.spotifyPause" title="Pause">&#10074;&#10074;</button>'
            : '<button class="btn btn-sm btn-icon" data-action="admin.spotifyPlay" title="Play">&#9654;</button>'
          }
          <button class="btn btn-sm btn-icon" data-action="admin.spotifyNext" title="Next">&#9654;&#9654;</button>
          <button class="btn btn-sm btn-icon" data-action="admin.spotifyStop" title="Stop">&#9632;</button>
        </div>
        <div class="spotify__volume">
          <label class="spotify__volume-label">Vol</label>
          <input type="range" class="spotify__volume-slider"
            min="0" max="100" value="${volume}"
            data-action="admin.spotifySetVolume"
            title="Volume: ${volume}%">
          <span class="spotify__volume-value">${volume}%</span>
        </div>
      </div>
    `;
  }

  _escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export default SpotifyRenderer;
```

**Step 4: Create CSS**

```css
/* ALNScanner/src/styles/components/spotify.css */

.spotify {
  padding: 8px 12px;
}

.spotify--disconnected {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  opacity: 0.7;
}

.spotify__status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
}

.spotify__status-icon {
  color: var(--color-accent-danger, #dc3545);
  font-size: 0.6rem;
}

.spotify--connected .spotify__status-icon {
  color: var(--color-accent-success, #28a745);
}

.spotify__track {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
}

.spotify__track-title {
  font-weight: 600;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.spotify__track-artist {
  font-size: 0.8rem;
  opacity: 0.7;
}

.spotify__controls {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
}

.spotify__volume {
  display: flex;
  align-items: center;
  gap: 8px;
}

.spotify__volume-label {
  font-size: 0.75rem;
  opacity: 0.6;
  min-width: 24px;
}

.spotify__volume-slider {
  flex: 1;
  height: 4px;
  cursor: pointer;
  accent-color: var(--color-primary, #1db954);
}

.spotify__volume-value {
  font-size: 0.75rem;
  min-width: 32px;
  text-align: right;
  opacity: 0.7;
}

.spotify__clock-paused {
  font-size: 0.75rem;
  color: var(--color-accent-warning, #ffc107);
  margin-bottom: 4px;
}
```

**Step 5: Import CSS in main styles**

Add `@import './components/spotify.css';` to `ALNScanner/src/styles/main.css` (or wherever component CSS is imported — check existing `@import` pattern).

**Step 6: Run tests**

```bash
cd ALNScanner && npx jest tests/unit/ui/renderers/SpotifyRenderer.test.js --no-coverage
```

**Step 7: Commit**

```bash
git add ALNScanner/src/ui/renderers/SpotifyRenderer.js ALNScanner/src/styles/components/spotify.css ALNScanner/tests/unit/ui/renderers/SpotifyRenderer.test.js
git commit -m "feat: create SpotifyRenderer with reconnect, volume, and transport controls"
```

---

### Task 6: Wire SpotifyRenderer into MonitoringDisplay + domEventBindings

**Files:**
- Modify: `ALNScanner/src/admin/MonitoringDisplay.js` — import and instantiate SpotifyRenderer
- Modify: `ALNScanner/src/utils/domEventBindings.js` — add new data-action bindings
- Modify: `ALNScanner/src/admin/SpotifyController.js` — add `reconnect()` method

**Step 1: Add reconnect() to SpotifyController**

```javascript
  /**
   * Reconnect to Spotify (re-check D-Bus connection)
   * @param {number} [timeout=5000]
   * @returns {Promise<Object>}
   */
  async reconnect(timeout = 5000) {
    return sendCommand(this.connection, 'spotify:reconnect', {}, timeout);
  }
```

**Step 2: Import and instantiate SpotifyRenderer in MonitoringDisplay**

At the top of `MonitoringDisplay.js`, add:

```javascript
import { SpotifyRenderer } from '../ui/renderers/SpotifyRenderer.js';
```

In the constructor, add:

```javascript
    this.spotifyRenderer = new SpotifyRenderer();
```

In `_wireDataManagerEvents()`, add (the line from Task 3 Step 6):

```javascript
    // Spotify State
    this.dataManager.addEventListener('spotify-state:updated', (e) => this.spotifyRenderer.render(e.detail));
```

**Step 3: Add new data-action bindings in domEventBindings.js**

Add to the `handleAdminAction` switch statement:

```javascript
      case 'spotifyStop':
        adminController.getModule('spotifyController').stop();
        break;
      case 'spotifyReconnect':
        adminController.getModule('spotifyController').reconnect();
        break;
      case 'spotifySetVolume': {
        const volume = parseInt(actionElement.value, 10);
        if (!isNaN(volume)) {
          adminController.getModule('spotifyController').setVolume(volume);
        }
        break;
      }
```

**Step 4: Wire volume slider `input` event**

The volume slider uses `data-action="admin.spotifySetVolume"` but sliders fire `input` events, not `click` events. In `domEventBindings.js`, the `change` event listener (line 220) already handles `data-action` on inputs. However, for real-time volume feedback, also add an `input` listener:

```javascript
  // Handle input events for range sliders with data-action
  document.addEventListener('input', (event) => {
    const actionElement = event.target.closest('[data-action]');
    if (!actionElement || actionElement.type !== 'range') return;

    const action = actionElement.dataset.action;
    const [target, method] = action.split('.');

    try {
      if (target === 'admin') {
        handleAdminAction(method, actionElement);
      }
    } catch (error) {
      debug.log(`Action handler error: ${action} - ${error.message}`, true);
    }
  });
```

**Step 5: Update volume display on slider input (SpotifyRenderer enhancement)**

The volume value text (`spotify__volume-value`) should update in real-time as the slider moves. This can be handled by SpotifyRenderer storing a reference and using a lightweight DOM update instead of full re-render:

This is already handled — each `spotify:status` broadcast from the backend (after `setVolume` command) will trigger a full re-render via DM → event → renderer. For the local visual feedback between command and ack, the `input` event handler already updates the slider position natively. The volume text updates on the next render cycle.

**Step 6: Run full test suite**

```bash
cd ALNScanner && npm test -- --no-coverage
```

**Step 7: Commit**

```bash
git add ALNScanner/src/admin/MonitoringDisplay.js ALNScanner/src/admin/SpotifyController.js ALNScanner/src/utils/domEventBindings.js
git commit -m "feat: wire SpotifyRenderer into admin panel with reconnect and volume controls"
```

---

## Phase 4: Legacy Bypass Cleanup

### Task 7: Remove duplicate MonitoringDisplay handlers

These handlers in `MonitoringDisplay._handleMessage()` duplicate what `NetworkedSession` already routes through DataManager. They cause double-rendering and violate the DM-as-source-of-truth pattern.

**Files:**
- Modify: `ALNScanner/src/admin/MonitoringDisplay.js`

**Handlers to remove (already handled by NetworkedSession → DM):**

| Handler | DM Path (via NetworkedSession) | Safe to Remove? |
|---------|-------------------------------|-----------------|
| `transaction:new/deleted` (144-147) | `addTransactionFromBroadcast()` / `removeTransaction()` | Yes — ScreenUpdateManager handles UI via `admin-game-activity` container |
| `video:status` (153-155) | `updateVideoState()` → `video-state:updated` event | Yes — VideoRenderer handles via ScreenUpdateManager `video-control-panel` container |
| `audio:routing:fallback` (157-159) | `updateAudioState()` → `audio-state:updated` event | Yes — EnvironmentRenderer handles via `_wireDataManagerEvents()` |

**Step 1: Remove the three duplicate handler cases from `_handleMessage()`**

Remove these cases from the switch statement:

```javascript
      // REMOVE: Already handled by NetworkedSession → DataManager → events
      case 'transaction:new':
      case 'transaction:deleted':
        this._updateTransactionLog(payload, type);
        break;

      case 'video:status':
        this._handleVideoStatus(payload);
        break;

      case 'audio:routing:fallback':
        this._handleAudioFallback(payload);
        break;
```

**Step 2: Remove the now-dead handler methods**

Remove these methods from MonitoringDisplay:
- `_updateTransactionLog()` (lines 188-214)
- `_handleVideoStatus()` (lines 236-261)
- `_handleAudioFallback()` (lines 263-275)
- `_renderNowPlaying()` (already removed in Task 3)

**Step 3: Remove the duplicate transaction rendering from updateAllDisplays()**

Remove the `recentTransactions` block (lines 379-384). NetworkedSession's sync:full handler already calls `dataManager.addTransaction()` for each transaction, which triggers ScreenUpdateManager events.

**Step 4: Remove dead utility methods**

These methods in MonitoringDisplay have **zero callers** (confirmed via grep — no `this.escapeHtml`, `this.formatClockTime`, or `this.loadAvailableVideos` calls remain after the handler removals):

- `escapeHtml()` (line 451) — already had zero callers even before our changes. Each renderer has its own `_escapeHtml()`.
- `formatClockTime()` (line 458) — already had zero callers. SessionRenderer has its own `_formatClockTime()`.
- `loadAvailableVideos()` (line 313) — empty stub. Called only from `refreshAllDisplays()` (line 425). Remove both the method AND the call in `refreshAllDisplays()`.

After removing `loadAvailableVideos()` call, `refreshAllDisplays()` simplifies to:
```javascript
  refreshAllDisplays() {
    Debug.log('[MonitoringDisplay] refreshAllDisplays called');
    this.updateSystemDisplay();
    this._requestInitialState();
  }
```

**Step 5: Run full test suite to verify no regressions**

```bash
cd ALNScanner && npm test -- --no-coverage
```

Watch for any test failures — some tests may mock these methods directly. Update those tests to use the DM event path instead.

**Step 6: Commit**

```bash
git add ALNScanner/src/admin/MonitoringDisplay.js
git commit -m "refactor: remove duplicate handlers and dead utility methods from MonitoringDisplay"
```

---

### Task 8: Document remaining legacy bypasses

These bypasses remain in MonitoringDisplay but are lower priority. They require NEW DataManager methods that don't exist yet. Document for future Phase 4 refactor.

**Remaining legacy handlers (P2 — no DM methods exist):**

| Handler | What It Does | DM Method Needed |
|---------|-------------|-----------------|
| `display:mode` | Tracks IDLE_LOOP vs SCOREBOARD mode | `updateDisplayMode(payload)` |
| `device:connected/disconnected` | Maintains device list | `updateDeviceList(payload)` |
| `video:queue:update` | Renders video queue | `updateVideoQueue(payload)` |
| `gameclock:status` | Renders game clock | Already works via SessionRenderer — acceptable |

**Acceptable legacy handlers (should stay in MonitoringDisplay):**

| Handler | Why It Stays |
|---------|-------------|
| `cue:fired` → `showToast()` | Ephemeral toast notification, not state — MonitoringDisplay is the right place |
| `cue:error` → `showToast()` | Same — ephemeral UI |
| `cue:conflict` → `showToast()` | Same |
| `sound:status` → no-op | Correctly a no-op |

**Step 1: Add a documentation comment in MonitoringDisplay._handleMessage()**

At the top of the method, add:

```javascript
    // NOTE: State-bearing events (cue, spotify, environment, session) are handled by
    // NetworkedSession → DataManager → event → Renderer pipeline.
    // This handler only processes:
    //   1. Ephemeral notifications (toasts for cue:fired/error/conflict)
    //   2. Legacy handlers awaiting Phase 4 DM migration (display:mode, devices, video queue, gameclock)
    //   3. sync:full aggregate update
```

**Step 2: Commit**

```bash
git add ALNScanner/src/admin/MonitoringDisplay.js
git commit -m "docs: document remaining legacy MonitoringDisplay handlers for Phase 4 migration"
```

---

## Verification Checklist

After all tasks, verify:

1. **Cue bug fixed**: Create session → fire a quick fire cue → all cue sections remain visible
2. **Spotify UI works**: Spotify section shows reconnect button when disconnected, controls when connected
3. **Session crash fixed**: No `toLocaleTimeString` error on session creation
4. **No regressions**: Full test suite passes

```bash
cd ALNScanner && npm test -- --no-coverage
cd ../backend && npm test -- --no-coverage
```

## Files Modified Summary

| File | Changes |
|------|---------|
| `ALNScanner/src/core/unifiedDataManager.js` | Replace `loadCues()` with `syncCueState()`, add spotify state + methods |
| `ALNScanner/src/network/networkedSession.js` | Route cue/spotify from sync:full and events through DM |
| `ALNScanner/src/admin/MonitoringDisplay.js` | Remove direct renders (session + cue + spotify + transactions), wire SpotifyRenderer, remove dead handlers + dead utility methods (`escapeHtml`, `formatClockTime`, `loadAvailableVideos`) |
| `ALNScanner/src/ui/renderers/SpotifyRenderer.js` | NEW — Spotify UI renderer |
| `ALNScanner/src/styles/components/spotify.css` | NEW — Spotify styles |
| `ALNScanner/src/admin/SpotifyController.js` | Add `reconnect()` method |
| `ALNScanner/src/utils/domEventBindings.js` | Add spotifyStop, spotifyReconnect, spotifySetVolume bindings + input listener |
| `ALNScanner/src/ui/uiManager.js` | Null guard on `startTime` line 412 |
| `ALNScanner/src/main.js` | Remove competing `session-status-container` ScreenUpdateManager registration |
| `backend/src/services/commandExecutor.js` | Add `spotify:reconnect` command |
| `backend/src/websocket/broadcasts.js` | Wire `connection:changed` event |
