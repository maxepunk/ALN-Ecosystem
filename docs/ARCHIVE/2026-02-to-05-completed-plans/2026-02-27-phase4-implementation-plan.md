# Phase 4: GM Visibility — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify held-item events into `held:*` namespace, build a centralized HealthRenderer and HeldItemsRenderer for the GM Scanner admin panel, and remove scattered health UI and the deprecated SystemMonitor module.

**Architecture:** Backend broadcasts.js translates internal `cue:held/video:held` to unified `held:added` (clean cut, no dual emission). GM Scanner receives unified events via orchestratorClient → networkedSession → UnifiedDataManager → new renderers. HealthRenderer and HeldItemsRenderer are new files in `ALNScanner/src/ui/renderers/`. SystemMonitor.js is deleted.

**Tech Stack:** Node.js (backend EventEmitter), ES6 modules (GM Scanner), Jest (both), Vite (GM Scanner build)

**Design Document:** `docs/plans/2026-02-27-phase4-gm-visibility-design.md`

---

## Task 1: Backend — Unify held event broadcasts

**Files:**
- Modify: `backend/src/websocket/broadcasts.js:740-770`
- Modify: `backend/tests/unit/websocket/phase2-broadcasts.test.js:188-284`
- Modify: `backend/contracts/asyncapi.yaml` (channels section)

### Step 1: Write failing tests for unified broadcast names

In `backend/tests/unit/websocket/phase2-broadcasts.test.js`, update the existing held-event tests. The current tests at lines 188-269 expect raw event names (`cue:held`, `video:held`, etc.). Change them to expect unified names.

Replace the test at line 188 (`'should broadcast cue:held on cue:held'`) with:

```javascript
it('should broadcast held:added on cue:held', () => {
  setupBroadcasts();

  const data = {
    id: 'held-cue-1',
    cueId: 'compound-2',
    type: 'cue',
    reason: 'video_busy',
    blockedBy: [],
    currentVideo: { tokenId: 'token-1' },
  };
  mockCueEngineService.emit('cue:held', data);

  expect(mockIo.to).toHaveBeenCalledWith('gm');
  expect(mockIo.emit).toHaveBeenCalledWith(
    'held:added',
    expect.objectContaining({
      event: 'held:added',
      data: expect.objectContaining({
        cueId: 'compound-2',
        type: 'cue',
        reason: 'video_busy',
      }),
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    })
  );
});
```

Replace the test at line 214 (`'should broadcast cue:released on cue:released'`) with:

```javascript
it('should broadcast held:released on cue:released', () => {
  setupBroadcasts();

  const data = { heldId: 'held-cue-1', cueId: 'compound-2', type: 'cue' };
  mockCueEngineService.emit('cue:released', data);

  expect(mockIo.to).toHaveBeenCalledWith('gm');
  expect(mockIo.emit).toHaveBeenCalledWith(
    'held:released',
    expect.objectContaining({
      event: 'held:released',
      data: expect.objectContaining({
        heldId: 'held-cue-1',
        type: 'cue',
      }),
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    })
  );
});
```

Replace the test at line 234 (`'should broadcast cue:discarded on cue:discarded'`) with:

```javascript
it('should broadcast held:discarded on cue:discarded', () => {
  setupBroadcasts();

  const data = { heldId: 'held-cue-1', cueId: 'compound-2', type: 'cue' };
  mockCueEngineService.emit('cue:discarded', data);

  expect(mockIo.to).toHaveBeenCalledWith('gm');
  expect(mockIo.emit).toHaveBeenCalledWith(
    'held:discarded',
    expect.objectContaining({
      event: 'held:discarded',
      data: expect.objectContaining({
        heldId: 'held-cue-1',
        type: 'cue',
      }),
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    })
  );
});
```

Replace the test at line 254 (`'should broadcast video:held from videoQueueService'`) with:

```javascript
it('should broadcast held:added on video:held', () => {
  setupBroadcasts();

  const data = { id: 'held-video-1', tokenId: 'token-5', type: 'video', reason: 'vlc_down' };
  mockVideoQueueService.emit('video:held', data);

  expect(mockIo.to).toHaveBeenCalledWith('gm');
  expect(mockIo.emit).toHaveBeenCalledWith(
    'held:added',
    expect.objectContaining({
      event: 'held:added',
      data: expect.objectContaining({ tokenId: 'token-5', type: 'video' }),
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    })
  );
});
```

Similarly update the `video:released` and `video:discarded` tests to expect `held:released` and `held:discarded`.

Add a new test for `video:recoverable`:

```javascript
it('should broadcast held:recoverable on video:recoverable', () => {
  setupBroadcasts();

  const data = { heldCount: 2 };
  mockVideoQueueService.emit('video:recoverable', data);

  expect(mockIo.to).toHaveBeenCalledWith('gm');
  expect(mockIo.emit).toHaveBeenCalledWith(
    'held:recoverable',
    expect.objectContaining({
      event: 'held:recoverable',
      data: expect.objectContaining({ heldCount: 2 }),
    })
  );
});
```

### Step 2: Run tests to verify they fail

Run: `cd backend && npx jest tests/unit/websocket/phase2-broadcasts.test.js --verbose`

Expected: FAIL — tests expect `held:added` but broadcasts.js still emits raw `cue:held` / `video:held`.

### Step 3: Implement unified broadcasts

In `backend/src/websocket/broadcasts.js`, replace lines 740-770 (the 6 cue+video held listeners) with unified mappings:

```javascript
    // ============================================================
    // HELD ITEM BROADCASTS (Phase 4 — unified held:* namespace)
    // ============================================================

    addTrackedListener(cueEngineService, 'cue:held', (data) => {
      emitToRoom(io, 'gm', 'held:added', data);
      logger.debug('Broadcasted held:added (cue)', { cueId: data.cueId, reason: data.reason });
    });

    addTrackedListener(cueEngineService, 'cue:released', (data) => {
      emitToRoom(io, 'gm', 'held:released', data);
      logger.debug('Broadcasted held:released (cue)', { heldId: data.heldId });
    });

    addTrackedListener(cueEngineService, 'cue:discarded', (data) => {
      emitToRoom(io, 'gm', 'held:discarded', data);
      logger.debug('Broadcasted held:discarded (cue)', { heldId: data.heldId });
    });
```

And replace lines 757-770 (the 3 video held listeners):

```javascript
  addTrackedListener(videoQueueService, 'video:held', (data) => {
    emitToRoom(io, 'gm', 'held:added', data);
    logger.debug('Broadcasted held:added (video)', { tokenId: data.tokenId });
  });

  addTrackedListener(videoQueueService, 'video:released', (data) => {
    emitToRoom(io, 'gm', 'held:released', data);
    logger.debug('Broadcasted held:released (video)', { heldId: data.heldId });
  });

  addTrackedListener(videoQueueService, 'video:discarded', (data) => {
    emitToRoom(io, 'gm', 'held:discarded', data);
    logger.debug('Broadcasted held:discarded (video)', { heldId: data.heldId });
  });

  // Wire video:recoverable (VLC came back, held videos can be retried)
  addTrackedListener(videoQueueService, 'video:recoverable', (data) => {
    emitToRoom(io, 'gm', 'held:recoverable', data);
    logger.debug('Broadcasted held:recoverable', { heldCount: data.heldCount });
  });
```

### Step 4: Run tests to verify they pass

Run: `cd backend && npx jest tests/unit/websocket/phase2-broadcasts.test.js --verbose`

Expected: PASS

### Step 5: Update asyncapi.yaml

In `backend/contracts/asyncapi.yaml`, rename channel definitions:
- `CueHeld` → `HeldAdded` (change `name:` from `cue:held` to `held:added`, update `const:` values)
- `CueReleased` → `HeldReleased` (change `name:` to `held:released`)
- `CueDiscarded` → `HeldDiscarded` (change `name:` to `held:discarded`)
- Remove `VideoHeld`, `VideoReleased`, `VideoDiscarded` channels (merged into unified)
- Add `HeldRecoverable` channel (`name: held:recoverable`)
- Add `type` field to schemas: `type: { type: string, enum: [cue, video] }`

### Step 6: Run full backend tests

Run: `cd backend && npm test`

Expected: All 1302+ tests pass (contract tests validate against asyncapi.yaml).

### Step 7: Commit

```bash
git add backend/src/websocket/broadcasts.js backend/tests/unit/websocket/phase2-broadcasts.test.js backend/contracts/asyncapi.yaml
git commit -m "feat(phase4): unify held event broadcasts to held:* namespace"
```

---

## Task 2: GM Scanner — Update orchestratorClient + networkedSession event routing

**Files:**
- Modify: `ALNScanner/src/network/orchestratorClient.js:270-273` (messageTypes array)
- Modify: `ALNScanner/src/network/networkedSession.js:311-319` (switch cases)

### Step 1: Write failing tests for new event names

In `ALNScanner/tests/unit/network/orchestratorClient.test.js`, find the test that validates the `messageTypes` array. Update it to expect `'held:added'`, `'held:released'`, `'held:discarded'`, `'held:recoverable'` and NOT expect `'cue:held'`, `'cue:released'`, `'cue:discarded'`.

In `ALNScanner/tests/unit/network/networkedSession.test.js`, find the tests for `cue:held/released/discarded` handlers. Replace them with tests for `held:added`, `held:released`, `held:discarded`, `held:recoverable`. Each test should verify that `dataManager.updateHeldItems()` is called with the correct payload.

Example test for `held:added`:

```javascript
it('should route held:added to dataManager.updateHeldItems', () => {
  const payload = { id: 'held-cue-1', type: 'cue', cueId: 'cue-1', reason: 'video_busy' };
  session._messageHandler({ detail: { type: 'held:added', payload } });
  expect(mockDataManager.updateHeldItems).toHaveBeenCalledWith(payload, 'held');
});
```

Add a test for `service:health`:

```javascript
it('should route service:health to dataManager.updateServiceHealth', () => {
  const payload = { serviceId: 'vlc', status: 'down', message: 'Connection refused' };
  session._messageHandler({ detail: { type: 'service:health', payload } });
  expect(mockDataManager.updateServiceHealth).toHaveBeenCalledWith(payload);
});
```

### Step 2: Run tests to verify they fail

Run: `cd ALNScanner && npx jest tests/unit/network/ --verbose`

Expected: FAIL — messageTypes still has old names, handlers don't exist yet.

### Step 3: Update orchestratorClient messageTypes

In `ALNScanner/src/network/orchestratorClient.js`, in the `messageTypes` array (lines 270-273), replace:

```javascript
  'cue:held',                  // Phase 3: Cue held (service down or video busy)
  'cue:released',              // Phase 3: Held cue released
  'cue:discarded',             // Phase 3: Held cue discarded
```

With:

```javascript
  'held:added',                // Phase 4: Held item added (cue or video)
  'held:released',             // Phase 4: Held item released
  'held:discarded',            // Phase 4: Held item discarded
  'held:recoverable',          // Phase 4: Held items recoverable (service came back)
```

Note: `'service:health'` should already be in the array from Phase 1. If not, add it.

### Step 4: Update networkedSession event routing

In `ALNScanner/src/network/networkedSession.js`, replace the three cases at lines 311-319:

```javascript
      case 'cue:held':
        this.dataManager.updateHeldItems(payload, 'held');
        break;
      case 'cue:released':
        this.dataManager.updateHeldItems(payload, 'released');
        break;
      case 'cue:discarded':
        this.dataManager.updateHeldItems(payload, 'discarded');
        break;
```

With:

```javascript
      // Phase 4: Unified held item events
      case 'held:added':
        this.dataManager.updateHeldItems(payload, 'held');
        break;
      case 'held:released':
        this.dataManager.updateHeldItems(payload, 'released');
        break;
      case 'held:discarded':
        this.dataManager.updateHeldItems(payload, 'discarded');
        break;
      case 'held:recoverable':
        this.dataManager.updateHeldItems(payload, 'recoverable');
        break;

      // Phase 4: Service health updates
      case 'service:health':
        this.dataManager.updateServiceHealth(payload);
        break;
```

### Step 5: Run tests to verify they pass

Run: `cd ALNScanner && npx jest tests/unit/network/ --verbose`

Expected: PASS (the `updateServiceHealth` test may fail if the method doesn't exist yet — that's Task 3).

### Step 6: Commit

```bash
cd ALNScanner && git add src/network/orchestratorClient.js src/network/networkedSession.js tests/unit/network/
git commit -m "feat(phase4): route unified held:* and service:health events"
```

---

## Task 3: GM Scanner — Add updateServiceHealth() to UnifiedDataManager

**Files:**
- Modify: `ALNScanner/src/core/unifiedDataManager.js:1047-1057`
- Test: `ALNScanner/tests/unit/core/unifiedDataManager.test.js` (find existing held-items tests)

### Step 1: Write failing tests

Add tests to `ALNScanner/tests/unit/core/unifiedDataManager.test.js`:

```javascript
describe('updateServiceHealth()', () => {
  it('should store service health state', () => {
    const data = { serviceId: 'vlc', status: 'down', message: 'Connection refused' };
    manager.updateServiceHealth(data);
    expect(manager.serviceHealth.vlc).toEqual({
      status: 'down',
      message: 'Connection refused',
      timestamp: expect.any(String)
    });
  });

  it('should dispatch service-health:updated event', (done) => {
    manager.addEventListener('service-health:updated', (e) => {
      expect(e.detail.serviceHealth.vlc.status).toBe('healthy');
      done();
    });
    manager.updateServiceHealth({ serviceId: 'vlc', status: 'healthy', message: 'OK' });
  });

  it('should accumulate multiple service states', () => {
    manager.updateServiceHealth({ serviceId: 'vlc', status: 'healthy', message: 'OK' });
    manager.updateServiceHealth({ serviceId: 'spotify', status: 'down', message: 'Not running' });
    expect(Object.keys(manager.serviceHealth)).toEqual(['vlc', 'spotify']);
  });
});
```

Also update the existing `updateHeldItems()` tests to match the current API signature `(payload, action)` if needed. Add a test for the `'recoverable'` action:

```javascript
it('should handle recoverable action', (done) => {
  manager.addEventListener('held-items:updated', (e) => {
    expect(e.detail.action).toBe('recoverable');
    done();
  });
  manager.updateHeldItems({ heldCount: 2 }, 'recoverable');
});
```

### Step 2: Run tests to verify they fail

Run: `cd ALNScanner && npx jest tests/unit/core/unifiedDataManager --verbose`

Expected: FAIL — `updateServiceHealth` is not a function.

### Step 3: Implement updateServiceHealth()

In `ALNScanner/src/core/unifiedDataManager.js`, add below the existing `updateHeldItems()` method (after line 1057):

```javascript
  /**
   * Handle service health updates (service:health events)
   * @param {Object} data - { serviceId, status, message, timestamp }
   */
  updateServiceHealth(data) {
    if (!this.serviceHealth) this.serviceHealth = {};
    this.serviceHealth[data.serviceId] = {
      status: data.status,
      message: data.message,
      timestamp: data.timestamp || new Date().toISOString()
    };
    this.dispatchEvent(new CustomEvent('service-health:updated', {
      detail: { serviceHealth: this.serviceHealth }
    }));
    this._log(`Service health: ${data.serviceId} → ${data.status}`);
  }
```

Also ensure `this.serviceHealth = {}` is initialized in the constructor (or wherever state is initialized).

Update the sync:full handling method to populate `this.serviceHealth` from `syncData.serviceHealth` if present. Find where sync:full data is processed (look for where `syncData` or `fullState` is applied) and add:

```javascript
if (syncData.serviceHealth) {
  this.serviceHealth = syncData.serviceHealth;
  this.dispatchEvent(new CustomEvent('service-health:updated', {
    detail: { serviceHealth: this.serviceHealth }
  }));
}
```

### Step 4: Run tests to verify they pass

Run: `cd ALNScanner && npx jest tests/unit/core/unifiedDataManager --verbose`

Expected: PASS

### Step 5: Commit

```bash
cd ALNScanner && git add src/core/unifiedDataManager.js tests/unit/core/
git commit -m "feat(phase4): add updateServiceHealth() to UnifiedDataManager"
```

---

## Task 4: Delete SystemMonitor and clean up references

**Files:**
- Delete: `ALNScanner/src/admin/SystemMonitor.js`
- Modify: `ALNScanner/src/app/adminController.js:20,57` (remove import and usage)
- Modify: `ALNScanner/tests/unit/utils/adminModule.test.js:4,312-372` (remove import and test suite)
- Modify: `ALNScanner/tests/unit/AdminController.test.js:28-29,70,119,150` (remove mock and assertions)
- Modify: `ALNScanner/tests/integration/service-wiring.test.js:43-44,93-94` (remove mock)
- Modify: `ALNScanner/tests/app/app.test.js:150-151` (remove mock)

### Step 1: Delete SystemMonitor.js

Delete the file: `ALNScanner/src/admin/SystemMonitor.js`

### Step 2: Remove import and usage from adminController.js

In `ALNScanner/src/app/adminController.js`:
- Remove line 20: `import { SystemMonitor } from '../admin/SystemMonitor.js';`
- Remove line 57: `systemMonitor: new SystemMonitor(this.client),`

### Step 3: Remove from test files

In `ALNScanner/tests/unit/utils/adminModule.test.js`:
- Remove line 4: `import { SystemMonitor } from '../../../src/admin/SystemMonitor.js';`
- Remove the entire `describe('SystemMonitor', ...)` block (lines 312-372)

In `ALNScanner/tests/unit/AdminController.test.js`:
- Remove the `jest.mock('../../src/admin/SystemMonitor.js', ...)` block (lines 28-35)
- Remove line 70: `import { SystemMonitor } from '../../src/admin/SystemMonitor.js';`
- Remove assertions that reference `SystemMonitor` (lines 119, 150)

In `ALNScanner/tests/integration/service-wiring.test.js`:
- Remove the `jest.mock('../../src/admin/SystemMonitor.js', ...)` block (lines 43-44)
- Remove inner mock at line 93-94 if present

In `ALNScanner/tests/app/app.test.js`:
- Remove the `jest.mock('../../src/admin/SystemMonitor.js', ...)` block (lines 150-151)

### Step 4: Run tests to verify nothing breaks

Run: `cd ALNScanner && npm test`

Expected: All tests pass. SystemMonitor tests are gone, no import errors.

### Step 5: Commit

```bash
cd ALNScanner && git add -A src/admin/SystemMonitor.js src/app/adminController.js tests/
git commit -m "feat(phase4): delete SystemMonitor, replaced by event-driven HealthRenderer"
```

---

## Task 5: Remove stale systemStatus.vlc from MonitoringDisplay

**Files:**
- Modify: `ALNScanner/src/admin/MonitoringDisplay.js:262-269` (remove systemStatus block)
- Modify: `ALNScanner/tests/unit/utils/adminModule.test.js:587-596` (remove/update VLC status test)

### Step 1: Write failing test

In the MonitoringDisplay test (`ALNScanner/tests/unit/utils/adminModule.test.js`), change the test at line 587 to verify that `updateAllDisplays` does NOT try to read `systemStatus.vlc`:

```javascript
it('should NOT reference systemStatus.vlc (replaced by HealthRenderer)', () => {
  const syncData = {
    serviceHealth: { vlc: { status: 'healthy', message: 'OK' } }
  };
  display.updateAllDisplays(syncData);
  // No error thrown — systemStatus handling removed
  const vlcElem = document.getElementById('vlc-status');
  // The element may still exist in DOM but shouldn't be updated by MonitoringDisplay
});
```

### Step 2: Remove stale code

In `ALNScanner/src/admin/MonitoringDisplay.js`, remove lines 262-269:

```javascript
    // 7. System Status
    this.updateSystemDisplay();
    if (syncData.systemStatus?.vlc) {
      const vlcElem = document.getElementById('vlc-status');
      if (vlcElem) {
        vlcElem.className = `status-dot status-dot--${syncData.systemStatus.vlc}`;
      }
    }
```

Also remove the `updateSystemDisplay()` method if it exists (find and delete it).

### Step 3: Also remove cue:held toast from MonitoringDisplay

In `MonitoringDisplay.js` `_handleMessage()` at lines 146-152, remove the `case 'cue:held':` toast handler. Held items are now rendered by HeldItemsRenderer, not as ephemeral toasts.

### Step 4: Run tests

Run: `cd ALNScanner && npm test`

Expected: PASS

### Step 5: Commit

```bash
cd ALNScanner && git add ALNScanner/src/admin/MonitoringDisplay.js ALNScanner/tests/unit/utils/adminModule.test.js
git commit -m "fix(phase4): remove stale systemStatus.vlc and cue:held toast from MonitoringDisplay"
```

---

## Task 6: Create HealthRenderer

**Files:**
- Create: `ALNScanner/src/ui/renderers/HealthRenderer.js`
- Create: `ALNScanner/tests/unit/ui/renderers/HealthRenderer.test.js`

### Step 1: Write failing tests

Create `ALNScanner/tests/unit/ui/renderers/HealthRenderer.test.js`:

```javascript
import { HealthRenderer } from '../../../../src/ui/renderers/HealthRenderer.js';

describe('HealthRenderer', () => {
  let container;
  let renderer;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'health-dashboard';
    document.body.appendChild(container);
    renderer = new HealthRenderer({ container });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('render()', () => {
    it('should show collapsed summary when all services healthy', () => {
      const health = {};
      ['vlc', 'spotify', 'lighting', 'bluetooth', 'audio', 'sound', 'gameclock', 'cueengine'].forEach(s => {
        health[s] = { status: 'healthy', message: 'OK' };
      });
      renderer.render({ serviceHealth: health });

      expect(container.querySelector('.health-dashboard--ok')).toBeTruthy();
      expect(container.textContent).toContain('8/8');
    });

    it('should show expanded grid when any service is down', () => {
      const health = {
        vlc: { status: 'down', message: 'Connection refused' },
        spotify: { status: 'healthy', message: 'OK' },
      };
      renderer.render({ serviceHealth: health });

      expect(container.querySelector('.health-dashboard--degraded')).toBeTruthy();
      expect(container.querySelector('.health-service--down')).toBeTruthy();
    });

    it('should include Check Now button for down services', () => {
      const health = {
        vlc: { status: 'down', message: 'Connection refused' },
      };
      renderer.render({ serviceHealth: health });

      const btn = container.querySelector('[data-action="admin.serviceCheck"]');
      expect(btn).toBeTruthy();
      expect(btn.dataset.serviceId).toBe('vlc');
    });

    it('should handle empty/null health gracefully', () => {
      renderer.render({ serviceHealth: null });
      expect(container.innerHTML).not.toBe('');
    });
  });
});
```

### Step 2: Run tests to verify they fail

Run: `cd ALNScanner && npx jest tests/unit/ui/renderers/HealthRenderer --verbose`

Expected: FAIL — module not found.

### Step 3: Implement HealthRenderer

Create `ALNScanner/src/ui/renderers/HealthRenderer.js`:

```javascript
/**
 * HealthRenderer - Centralized Service Health Dashboard
 * Phase 4: Replaces SystemMonitor + scattered health indicators
 *
 * Collapsed when all healthy, expanded grid when any service is down.
 */
export class HealthRenderer {
  constructor(elements = {}) {
    this.container = elements.container || document.getElementById('health-dashboard');
    this.SERVICE_NAMES = {
      vlc: 'VLC Player',
      spotify: 'Spotify',
      lighting: 'Lighting (HA)',
      bluetooth: 'Bluetooth',
      audio: 'Audio Routing',
      sound: 'Sound Effects',
      gameclock: 'Game Clock',
      cueengine: 'Cue Engine'
    };
  }

  /**
   * Render health dashboard
   * @param {Object} data - { serviceHealth: { serviceId: { status, message } } }
   */
  render(data) {
    if (!this.container) return;

    const health = data?.serviceHealth || {};
    const services = Object.keys(this.SERVICE_NAMES);
    const statuses = services.map(id => ({
      id,
      name: this.SERVICE_NAMES[id],
      status: health[id]?.status || 'unknown',
      message: health[id]?.message || ''
    }));

    const healthyCount = statuses.filter(s => s.status === 'healthy').length;
    const totalCount = services.length;
    const allHealthy = healthyCount === totalCount;

    if (allHealthy) {
      this._renderCollapsed(healthyCount, totalCount);
    } else {
      this._renderExpanded(statuses, healthyCount, totalCount);
    }
  }

  _renderCollapsed(healthy, total) {
    this.container.innerHTML = `
      <div class="health-dashboard health-dashboard--ok">
        <div class="health-dashboard__summary">
          <span class="health-indicator health-indicator--ok"></span>
          All Systems Operational (${healthy}/${total})
        </div>
      </div>
    `;
  }

  _renderExpanded(statuses, healthy, total) {
    const serviceCards = statuses.map(s => {
      const isDown = s.status !== 'healthy';
      return `
        <div class="health-service ${isDown ? 'health-service--down' : 'health-service--ok'}">
          <div class="health-service__name">${this._escapeHtml(s.name)}</div>
          <div class="health-service__status">${s.status}</div>
          ${s.message ? `<div class="health-service__message">${this._escapeHtml(s.message)}</div>` : ''}
          ${isDown ? `<button class="btn btn-sm" data-action="admin.serviceCheck" data-service-id="${s.id}">Check Now</button>` : ''}
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="health-dashboard health-dashboard--degraded">
        <div class="health-dashboard__summary">
          <span class="health-indicator health-indicator--degraded"></span>
          Systems: ${healthy}/${total} Operational
        </div>
        <div class="health-dashboard__grid">
          ${serviceCards}
        </div>
      </div>
    `;
  }

  _escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
```

### Step 4: Run tests to verify they pass

Run: `cd ALNScanner && npx jest tests/unit/ui/renderers/HealthRenderer --verbose`

Expected: PASS

### Step 5: Commit

```bash
cd ALNScanner && git add src/ui/renderers/HealthRenderer.js tests/unit/ui/renderers/HealthRenderer.test.js
git commit -m "feat(phase4): create HealthRenderer with collapsed/expanded states"
```

---

## Task 7: Create HeldItemsRenderer

**Files:**
- Create: `ALNScanner/src/ui/renderers/HeldItemsRenderer.js`
- Create: `ALNScanner/tests/unit/ui/renderers/HeldItemsRenderer.test.js`

### Step 1: Write failing tests

Create `ALNScanner/tests/unit/ui/renderers/HeldItemsRenderer.test.js`:

```javascript
import { HeldItemsRenderer } from '../../../../src/ui/renderers/HeldItemsRenderer.js';

describe('HeldItemsRenderer', () => {
  let container;
  let renderer;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'held-items-container';
    document.body.appendChild(container);
    renderer = new HeldItemsRenderer({ container });
  });

  afterEach(() => {
    renderer.destroy();
    document.body.innerHTML = '';
  });

  describe('render()', () => {
    it('should show collapsed empty state when no items', () => {
      renderer.render({ action: 'held', id: 'x' }); // add then remove
      renderer.render({ action: 'released', id: 'x' });
      // Actually, test empty initial state
    });

    it('should render held item with release/discard buttons', () => {
      renderer.render({
        action: 'held',
        id: 'held-cue-1',
        type: 'cue',
        cueId: 'cue-1',
        reason: 'video_busy',
        heldAt: new Date().toISOString()
      });

      expect(container.querySelector('[data-held-id="held-cue-1"]')).toBeTruthy();
      expect(container.querySelector('[data-action="admin.releaseHeld"]')).toBeTruthy();
      expect(container.querySelector('[data-action="admin.discardHeld"]')).toBeTruthy();
    });

    it('should remove item on released action', () => {
      renderer.render({
        action: 'held',
        id: 'held-cue-1',
        type: 'cue',
        reason: 'service_down',
        heldAt: new Date().toISOString()
      });

      renderer.render({ action: 'released', id: 'held-cue-1', heldId: 'held-cue-1' });

      expect(container.querySelector('[data-held-id="held-cue-1"]')).toBeFalsy();
    });

    it('should show type badge for cue vs video', () => {
      renderer.render({
        action: 'held', id: 'held-video-1', type: 'video',
        videoFile: 'test.mp4', reason: 'vlc_down',
        heldAt: new Date().toISOString()
      });

      expect(container.textContent).toContain('video');
    });

    it('should show bulk actions when 2+ items', () => {
      renderer.render({ action: 'held', id: 'h1', type: 'cue', reason: 'x', heldAt: new Date().toISOString() });
      renderer.render({ action: 'held', id: 'h2', type: 'video', reason: 'y', heldAt: new Date().toISOString() });

      expect(container.querySelector('[data-action="admin.releaseAllHeld"]')).toBeTruthy();
      expect(container.querySelector('[data-action="admin.discardAllHeld"]')).toBeTruthy();
    });
  });

  describe('destroy()', () => {
    it('should clear duration timer', () => {
      renderer.render({ action: 'held', id: 'h1', type: 'cue', reason: 'x', heldAt: new Date().toISOString() });
      renderer.destroy();
      // No error — timer cleared
    });
  });
});
```

### Step 2: Run tests to verify they fail

Run: `cd ALNScanner && npx jest tests/unit/ui/renderers/HeldItemsRenderer --verbose`

Expected: FAIL — module not found.

### Step 3: Implement HeldItemsRenderer

Create `ALNScanner/src/ui/renderers/HeldItemsRenderer.js`:

```javascript
/**
 * HeldItemsRenderer - Unified Held Items Queue
 * Phase 4: Replaces CueRenderer.renderHeldItem() with unified cue+video queue
 *
 * Shows all held items (cues blocked by service outage, videos blocked by VLC)
 * with release/discard buttons and live duration counter.
 */
export class HeldItemsRenderer {
  constructor(elements = {}) {
    this.container = elements.container || document.getElementById('held-items-container');
    this._items = new Map(); // id → held item data
    this._durationTimer = null;
  }

  /**
   * Handle held item event
   * @param {Object} data - { action, id, type, reason, cueId?, videoFile?, heldAt?, ... }
   */
  render(data) {
    if (!this.container) return;

    const { action } = data;

    switch (action) {
      case 'held':
        this._items.set(data.id, data);
        break;
      case 'released':
      case 'discarded': {
        const id = data.id || data.heldId;
        this._items.delete(id);
        break;
      }
      case 'recoverable':
        // Mark recoverable items — could add visual indicator
        break;
    }

    this._renderAll();
    this._manageDurationTimer();
  }

  _renderAll() {
    if (!this.container) return;

    if (this._items.size === 0) {
      this.container.innerHTML = `
        <div class="held-items held-items--empty">
          <span class="held-items__summary">No Held Items</span>
        </div>
      `;
      return;
    }

    const itemsHtml = Array.from(this._items.values()).map(item => {
      const typeBadge = item.type === 'video' ? 'video' : 'cue';
      const description = item.type === 'video'
        ? (item.videoFile || item.tokenId || 'Unknown video')
        : (item.cueId || 'Unknown cue');
      const duration = this._formatDuration(item.heldAt);

      return `
        <div class="held-item held-item--${typeBadge}" data-held-id="${this._escapeHtml(item.id)}">
          <span class="held-item__type">${typeBadge}</span>
          <div class="held-item__info">
            <span class="held-item__description">${this._escapeHtml(description)}</span>
            <span class="held-item__reason">${this._escapeHtml(item.reason || '')}</span>
          </div>
          <span class="held-item__duration" data-held-at="${item.heldAt || ''}">${duration}</span>
          <div class="held-item__actions">
            <button class="btn btn-sm btn-warning" data-action="admin.releaseHeld" data-held-id="${this._escapeHtml(item.id)}">Release</button>
            <button class="btn btn-sm btn-secondary" data-action="admin.discardHeld" data-held-id="${this._escapeHtml(item.id)}">Discard</button>
          </div>
        </div>
      `;
    }).join('');

    const bulkHtml = this._items.size >= 2 ? `
      <div class="held-items__bulk">
        <button class="btn btn-sm btn-warning" data-action="admin.releaseAllHeld">Release All</button>
        <button class="btn btn-sm btn-secondary" data-action="admin.discardAllHeld">Discard All</button>
      </div>
    ` : '';

    this.container.innerHTML = `
      <div class="held-items held-items--active">
        <div class="held-items__summary">Held Items (${this._items.size})</div>
        <div class="held-items__list">${itemsHtml}</div>
        ${bulkHtml}
      </div>
    `;
  }

  _formatDuration(heldAt) {
    if (!heldAt) return '';
    const seconds = Math.floor((Date.now() - new Date(heldAt).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  }

  _manageDurationTimer() {
    if (this._items.size > 0 && !this._durationTimer) {
      this._durationTimer = setInterval(() => this._updateDurations(), 1000);
    } else if (this._items.size === 0 && this._durationTimer) {
      clearInterval(this._durationTimer);
      this._durationTimer = null;
    }
  }

  _updateDurations() {
    if (!this.container) return;
    this.container.querySelectorAll('.held-item__duration').forEach(el => {
      const heldAt = el.dataset.heldAt;
      if (heldAt) el.textContent = this._formatDuration(heldAt);
    });
  }

  destroy() {
    if (this._durationTimer) {
      clearInterval(this._durationTimer);
      this._durationTimer = null;
    }
    this._items.clear();
  }

  _escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
```

### Step 4: Run tests to verify they pass

Run: `cd ALNScanner && npx jest tests/unit/ui/renderers/HeldItemsRenderer --verbose`

Expected: PASS

### Step 5: Commit

```bash
cd ALNScanner && git add src/ui/renderers/HeldItemsRenderer.js tests/unit/ui/renderers/HeldItemsRenderer.test.js
git commit -m "feat(phase4): create HeldItemsRenderer with unified queue and bulk actions"
```

---

## Task 8: Wire HealthRenderer + HeldItemsRenderer into MonitoringDisplay

**Files:**
- Modify: `ALNScanner/src/admin/MonitoringDisplay.js:21-26,44-80`
- Modify: `ALNScanner/index.html:421,485-503`

### Step 1: Write failing tests

In MonitoringDisplay tests, add tests that verify:
- HealthRenderer is created and wired to `service-health:updated`
- HeldItemsRenderer is created and wired to `held-items:updated` (replaces CueRenderer.renderHeldItem wiring)

### Step 2: Update index.html

In `ALNScanner/index.html`:

**Replace the System Status section (lines 485-503)** with the Health Dashboard:

```html
            <!-- Health Dashboard (Phase 4 — replaces System Status) -->
            <section class="admin-section" data-requires="networked" id="health-dashboard-section">
                <h3>Service Health</h3>
                <div id="health-dashboard">
                    <!-- Populated by HealthRenderer -->
                </div>
            </section>
```

**Add Held Items section after Health Dashboard, before Video Queue (before line 352).** Find the Video Queue section and insert before it:

```html
            <!-- Held Items (Phase 4 — replaces #cue-held-container) -->
            <section class="admin-section" data-requires="networked" id="held-items-section">
                <h3>Held Items</h3>
                <div id="held-items-container">
                    <!-- Populated by HeldItemsRenderer -->
                </div>
            </section>
```

**Remove the old `#cue-held-container`** at line 421:
```html
                <!-- Held Cue Banners (Phase 3 - populated by CueRenderer.renderHeldItem()) -->
                <div id="cue-held-container"></div>
```

**Move device count from System Status to Session Management.** In the session management section, add:
```html
<div class="status-item">
    <span>Devices:</span>
    <span id="device-count">0</span>
</div>
<div id="device-list" class="device-list"></div>
```

### Step 3: Update MonitoringDisplay

In `ALNScanner/src/admin/MonitoringDisplay.js`:

Add imports at top:
```javascript
import { HealthRenderer } from '../ui/renderers/HealthRenderer.js';
import { HeldItemsRenderer } from '../ui/renderers/HeldItemsRenderer.js';
```

In the constructor (lines 21-26), add:
```javascript
this.healthRenderer = new HealthRenderer();
this.heldItemsRenderer = new HeldItemsRenderer();
```

In `_wireDataManagerEvents()` (lines 44-80), replace the held-items line:

```javascript
// Before (line 53):
on('held-items:updated', (e) => this.cueRenderer.renderHeldItem(e.detail));

// After:
on('held-items:updated', (e) => this.heldItemsRenderer.render(e.detail));
```

Add service health wiring:
```javascript
on('service-health:updated', (e) => this.healthRenderer.render(e.detail));
```

### Step 4: Run tests

Run: `cd ALNScanner && npm test`

Expected: PASS

### Step 5: Commit

```bash
cd ALNScanner && git add src/admin/MonitoringDisplay.js index.html tests/
git commit -m "feat(phase4): wire HealthRenderer and HeldItemsRenderer into MonitoringDisplay"
```

---

## Task 9: Clean up scattered health UI

**Files:**
- Modify: `ALNScanner/src/ui/renderers/SpotifyRenderer.js:17-19,25-37`
- Modify: `ALNScanner/src/ui/renderers/EnvironmentRenderer.js:60-64`
- Modify: `ALNScanner/index.html:479-482` (lighting-not-connected)
- Modify: `ALNScanner/tests/unit/ui/renderers/SpotifyRenderer.test.js`
- Modify: `ALNScanner/tests/unit/ui/renderers/EnvironmentRenderer.test.js`

### Step 1: Update tests

In `SpotifyRenderer.test.js`, remove or update tests that expect `_renderDisconnected()` to show a "Spotify Disconnected" message with Check Now button. Instead, test that disconnected state shows disabled controls:

```javascript
it('should render disabled controls when disconnected', () => {
  renderer.render({ connected: false });
  const buttons = container.querySelectorAll('button');
  buttons.forEach(btn => {
    expect(btn.disabled).toBe(true);
  });
});
```

In `EnvironmentRenderer.test.js`, remove or update tests that check `#lighting-not-connected` visibility.

### Step 2: Run tests to verify they fail

Run: `cd ALNScanner && npx jest tests/unit/ui/renderers/ --verbose`

Expected: FAIL — SpotifyRenderer still renders disconnected template.

### Step 3: Update SpotifyRenderer

In `ALNScanner/src/ui/renderers/SpotifyRenderer.js`:

Replace the render method's disconnected check (lines 17-19):

```javascript
// Before:
if (!state || !state.connected) {
  this._renderDisconnected();
  return;
}

// After:
if (!state || !state.connected) {
  this._renderConnected({ ...state, state: 'stopped', _disabled: true });
  return;
}
```

In `_renderConnected()`, add disabled attribute when `_disabled` is set:

```javascript
const disabled = state._disabled ? ' disabled' : '';
```

Apply `${disabled}` to all button elements.

Remove the `_renderDisconnected()` method entirely.

### Step 4: Update EnvironmentRenderer

In `ALNScanner/src/ui/renderers/EnvironmentRenderer.js`, in `renderLighting()` (around lines 60-64):

Remove the `#lighting-not-connected` show/hide logic. Instead, when not connected, show the scene grid with disabled buttons:

```javascript
if (!connected) {
  if (this.sceneGrid) {
    this.sceneGrid.style.display = 'grid';
    this.sceneGrid.innerHTML = '<p class="empty-state">Lighting unavailable</p>';
  }
  return;
}
```

### Step 5: Run tests

Run: `cd ALNScanner && npx jest tests/unit/ui/renderers/ --verbose`

Expected: PASS

### Step 6: Commit

```bash
cd ALNScanner && git add src/ui/renderers/SpotifyRenderer.js src/ui/renderers/EnvironmentRenderer.js index.html tests/
git commit -m "feat(phase4): remove scattered health UI from SpotifyRenderer and EnvironmentRenderer"
```

---

## Task 10: Update domEventBindings for unified held actions

**Files:**
- Modify: `ALNScanner/src/utils/domEventBindings.js:96-108,125-128,164-166`

### Step 1: Write failing test

(domEventBindings is tested via integration — the existing test pattern is click-based delegation. Verify by running the full suite after changes.)

### Step 2: Update held item action handlers

In `ALNScanner/src/utils/domEventBindings.js`, replace the `releaseHeldCue` and `discardHeldCue` cases (lines 96-108) with generic held-item handlers:

```javascript
      case 'releaseHeld': {
        const heldId = actionElement.dataset.heldId;
        if (heldId) {
          safeAdminAction(adminController.getModule('cueController').releaseHeld(heldId), 'releaseHeld');
        }
        break;
      }
      case 'discardHeld': {
        const heldId = actionElement.dataset.heldId;
        if (heldId) {
          safeAdminAction(adminController.getModule('cueController').discardHeld(heldId), 'discardHeld');
        }
        break;
      }
      case 'releaseAllHeld':
        safeAdminAction(adminController.getModule('cueController').releaseAllHeld(), 'releaseAllHeld');
        break;
      case 'discardAllHeld':
        safeAdminAction(adminController.getModule('cueController').discardAllHeld(), 'discardAllHeld');
        break;
```

**Note:** `releaseAllHeld()` and `discardAllHeld()` need to be added to `CueController.js` (Step 3).

Update `serviceCheck` case (lines 125-128) to be service-agnostic:

```javascript
      case 'serviceCheck': {
        const serviceId = actionElement.dataset.serviceId;
        safeAdminAction(adminController.getModule('cueController').checkService(serviceId), 'serviceCheck');
        break;
      }
```

**Wait** — `checkService` is currently on `SpotifyController`. We should move it to CueController or keep it on SpotifyController. Per the design, let's keep routing through the existing `checkService` on SpotifyController (it already works for any service). Just fix the attribute name:

```javascript
      case 'serviceCheck': {
        const serviceId = actionElement.dataset.serviceId;
        safeAdminAction(adminController.getModule('spotifyController').checkService(serviceId), 'serviceCheck');
        break;
      }
```

This is identical to the current code (line 125-128) but the `data-service-id` attribute is already read correctly. No change needed here — the HealthRenderer generates `data-service-id` attributes that match.

Remove `lightingRetry` (line 164-166):

```javascript
      // DELETE:
      case 'lightingRetry':
        safeAdminAction(adminController.getModule('lightingController').refreshScenes(), 'lightingRetry');
        break;
```

### Step 3: Add bulk held methods to CueController

In `ALNScanner/src/admin/CueController.js`, add after `discardHeld()`:

```javascript
  async releaseAllHeld(timeout = 5000) {
    return sendCommand(this.connection, 'held:release-all', {}, timeout);
  }

  async discardAllHeld(timeout = 5000) {
    return sendCommand(this.connection, 'held:discard-all', {}, timeout);
  }
```

### Step 4: Run tests

Run: `cd ALNScanner && npm test`

Expected: PASS

### Step 5: Commit

```bash
cd ALNScanner && git add src/utils/domEventBindings.js src/admin/CueController.js
git commit -m "feat(phase4): unify held-item action handlers and add bulk release/discard"
```

---

## Task 11: Backend E2E test fixes

**Files:**
- Modify: `backend/tests/e2e/flows/admin-state-reactivity.test.js:77`
- Modify: `backend/tests/e2e/flows/07d-01-admin-panel-ui.test.js` (DOM selectors)

### Step 1: Fix admin-state-reactivity.test.js

At line 77, replace:

```javascript
if (stateResp?.systemStatus?.vlc !== 'connected') {
```

With:

```javascript
if (stateResp?.serviceHealth?.vlc?.status !== 'healthy') {
```

### Step 2: Fix 07d-01-admin-panel-ui.test.js

Find references to `#orchestrator-status` and `#vlc-status` selectors. Replace with the new Health Dashboard selectors. The exact fix depends on what the test checks — if it's checking DOM element existence, update to check for `#health-dashboard` instead.

### Step 3: Run E2E tests (skip if orchestrator not running)

Run: `cd backend && npm run test:e2e` (only if orchestrator is running)

If orchestrator not running, verify unit tests: `cd backend && npm test`

### Step 4: Commit

```bash
cd backend && git add tests/e2e/
git commit -m "fix(phase4): update E2E tests for serviceHealth and health dashboard selectors"
```

---

## Task 12: Full verification and plan status update

**Files:**
- Modify: `docs/plans/2026-02-26-service-health-architecture.md` (status table)

### Step 1: Run all backend tests

Run: `cd backend && npm test`

Expected: All tests pass.

### Step 2: Run backend integration tests

Run: `cd backend && npm run test:integration`

Expected: All tests pass.

### Step 3: Run ALNScanner tests

Run: `cd ALNScanner && npm test`

Expected: All tests pass.

### Step 4: Verify ALNScanner build

Run: `cd ALNScanner && npm run build`

Expected: Build succeeds.

### Step 5: Update plan status

In `docs/plans/2026-02-26-service-health-architecture.md`, update the Implementation Status table:

```markdown
| Phase 4 | **COMPLETE** | 12/12 | GM visibility — unified held:*, HealthRenderer, HeldItemsRenderer |
```

Add a Phase 4 Deviations section if any deviations occurred during implementation.

### Step 6: Commit

```bash
git add docs/plans/2026-02-26-service-health-architecture.md
git commit -m "docs: mark Phase 4 complete in service health architecture plan"
```

---

## Task Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Backend: Unify held event broadcasts | None |
| 2 | GM Scanner: Update orchestratorClient + networkedSession | Task 1 |
| 3 | GM Scanner: Add updateServiceHealth() to UDM | Task 2 |
| 4 | Delete SystemMonitor + clean up references | None |
| 5 | Remove stale systemStatus.vlc from MonitoringDisplay | Task 4 |
| 6 | Create HealthRenderer | Task 3 |
| 7 | Create HeldItemsRenderer | Task 3 |
| 8 | Wire renderers into MonitoringDisplay + index.html | Tasks 5, 6, 7 |
| 9 | Clean up scattered health UI | Task 8 |
| 10 | Update domEventBindings for unified held actions | Task 8 |
| 11 | Backend E2E test fixes | Task 1 |
| 12 | Full verification and plan status update | All tasks |

**Parallel opportunities:**
- Tasks 1, 4, 11 can start immediately (no deps)
- Tasks 6, 7 can run in parallel (both depend on Task 3)
- Tasks 9, 10 can run in parallel (both depend on Task 8)
