# Phase 4: GM Visibility — Design Document

> Approved design from brainstorming session 2026-02-27.
> Replaces the original Phase 4 task list (4a–4k) in `2026-02-26-service-health-architecture.md`.

## Design Principles

1. **Unified event stream** — GM sees a single queue of held items regardless of source (cue or video)
2. **Clean cut migration** — No dual-emission; broadcasts.js translates to `held:*` names, old names stop
3. **Centralized health** — One HealthRenderer owns all health display; per-service renderers show disabled controls only
4. **Collapsed by default** — Both Health Dashboard and Held Items collapse when there's nothing to act on

---

## 1. Event Architecture Changes (Backend)

### broadcasts.js — New Mappings

| Internal Event | WebSocket Event | Notes |
|---|---|---|
| `cue:held` | `held:added` | Payload already has `{id, type:'cue', ...}` |
| `video:held` | `held:added` | Payload already has `{id, type:'video', ...}` |
| `cue:released` | `held:released` | Forward `{id, type:'cue'}` |
| `video:released` | `held:released` | Forward `{id, type:'video'}` |
| `cue:discarded` | `held:discarded` | Forward `{id, type:'cue'}` |
| `video:discarded` | `held:discarded` | Forward `{id, type:'video'}` |
| `video:recoverable` | `held:recoverable` | Indicates held videos can now be retried |

**Clean cut**: Remove the existing raw `video:held`, `video:released`, `video:discarded` broadcast listeners added in Phase 3. The `cue:held/released/discarded` listeners already exist — replace them with the unified `held:*` mappings.

### broadcasts.js — Existing (No Change)

`health:changed` → `service:health` (already wired in Phase 1).

### syncHelpers.js — No Change

`buildHeldItemsState()` already normalizes both cue and video held items into a unified array in `sync:full`. No changes needed.

### asyncapi.yaml

- Rename channels: `CueHeld` → `HeldAdded`, `CueReleased` → `HeldReleased`, `CueDiscarded` → `HeldDiscarded`
- Remove `VideoHeld`, `VideoReleased`, `VideoDiscarded` channels (merged into unified names)
- Add `HeldRecoverable` channel
- Update message schemas to document `type` field (`'cue'` | `'video'`)

---

## 2. Data Flow Through GM Scanner

### orchestratorClient.js — messageTypes Array

**Add:** `'held:added'`, `'held:released'`, `'held:discarded'`, `'held:recoverable'`

**Remove:** `'cue:held'`, `'cue:released'`, `'cue:discarded'` (replaced by unified names)

`'service:health'` is already in the array (Phase 1).

### networkedSession.js — Event Routing

Replace existing `cue:held/released/discarded` handlers with unified handlers:

```javascript
case 'held:added':
  this.dataManager.updateHeldItems({ type: 'added', item: data });
  break;
case 'held:released':
  this.dataManager.updateHeldItems({ type: 'released', id: data.id });
  break;
case 'held:discarded':
  this.dataManager.updateHeldItems({ type: 'discarded', id: data.id });
  break;
case 'held:recoverable':
  this.dataManager.updateHeldItems({ type: 'recoverable', items: data.items });
  break;
```

**Add new handler:**
```javascript
case 'service:health':
  this.dataManager.updateServiceHealth(data);
  break;
```

### unifiedDataManager.js

**Existing:** `updateHeldItems(event)` — already exists, dispatches `held-items:updated` CustomEvent. May need update for `'recoverable'` action type.

**New method:** `updateServiceHealth(data)`:
```javascript
updateServiceHealth(data) {
  if (!this.serviceHealth) this.serviceHealth = {};
  this.serviceHealth[data.serviceId] = {
    status: data.status,
    message: data.message,
    timestamp: data.timestamp || new Date().toISOString()
  };
  this._dispatchEvent('service-health:updated', { serviceHealth: this.serviceHealth });
}
```

Also handle `sync:full` → populate `this.serviceHealth` from `syncData.serviceHealth`.

### ScreenUpdateManager

Register handlers:
- `service-health:updated` → HealthRenderer
- `held-items:updated` → HeldItemsRenderer (already exists for CueRenderer — reroute)

---

## 3. HealthRenderer (New File)

**File:** `ALNScanner/src/ui/renderers/HealthRenderer.js`

**Behavior:**
- **All healthy**: Collapsed single line — "All Systems Operational (8/8)" with green indicator
- **Any unhealthy**: Expanded grid showing all services, unhealthy ones highlighted with status message and "Check Now" button
- **Check Now**: Sends `gm:command` → `{action: 'service:check', service: serviceId}` via orchestratorClient
- **No inline health in other renderers**: SpotifyRenderer, EnvironmentRenderer etc. show disabled controls when their service is down but do NOT show health/connection status

**DOM target:** New `#health-dashboard` container in `index.html`, positioned after Session Management, before Held Items.

**Services displayed** (8 total): `vlc`, `spotify`, `lighting`, `bluetooth`, `audio`, `sound`, `gameclock`, `cueengine`

**Collapsed state HTML pattern:**
```html
<div class="health-dashboard health-dashboard--ok">
  <div class="health-dashboard__summary">
    <span class="health-indicator health-indicator--ok"></span>
    All Systems Operational (8/8)
  </div>
</div>
```

**Expanded state**: Grid of service cards, each showing name, status badge, message, optional "Check Now" button.

---

## 4. HeldItemsRenderer (New File)

**File:** `ALNScanner/src/ui/renderers/HeldItemsRenderer.js`

**Behavior:**
- **Empty queue**: Collapsed — "No Held Items" with count badge showing 0
- **Items queued**: Expanded list, each item showing:
  - Type badge (cue/video)
  - Item description (cue name or video filename)
  - Reason it was held
  - Live duration counter (time since `heldAt`)
  - Release / Discard buttons
- **Bulk actions**: "Release All" / "Discard All" buttons when 2+ items
- **Release**: Sends `gm:command` → `{action: 'held:release', id: item.id}`
- **Discard**: Sends `gm:command` → `{action: 'held:discard', id: item.id}`

**DOM target:** New `#held-items-container` in `index.html`, positioned after Health Dashboard, before Video Queue.

**Duration counter**: Uses `setInterval` (1s) to update relative time display. Clears on unmount/empty.

---

## 5. Cleanup Scope

### Remove from SpotifyRenderer
- `_renderDisconnected()` method and its disconnected-state template
- Always render controls (disabled when spotify service is down via health state)
- Keep ducking indicator (Phase 3 addition)

### Remove from EnvironmentRenderer
- `#lighting-not-connected` show/hide logic (lines 60-64)
- Always render controls (disabled when lighting service is down)

### Remove from MonitoringDisplay
- Direct DOM writes for `systemStatus.vlc` (line 264 — stale field)
- Toast handler for `cue:conflict` if any remnants exist
- `_handleCueConflict` method if still present

### Delete SystemMonitor.js
- `ALNScanner/src/admin/SystemMonitor.js` — HTTP health polling, replaced by event-driven HealthRenderer
- Remove all imports/references from: `adminController.js`, `app.js`, test files

### index.html
- Remove `#system-status` section (lines 485-503) with `#orchestrator-status`, `#vlc-status`
- Add `#health-dashboard` section
- Add `#held-items-container` section (replaces or subsumes `#cue-held-container`)

---

## 6. Admin Panel Layout (Updated Order)

```
Session Management (with device count)
Health Dashboard          ← NEW (HealthRenderer)
Held Items                ← NEW (HeldItemsRenderer, replaces scattered held UI)
Video Queue
Show Control
Audio & Environment
Lighting
Scores
Game Activity
```

Device count (currently in MonitoringDisplay) moves to Session Management section.

---

## 7. domEventBindings.js Changes

### Add
- `admin.releaseHeld` → send `gm:command {action: 'held:release', id}`
- `admin.discardHeld` → send `gm:command {action: 'held:discard', id}`
- `admin.releaseAllHeld` → send `gm:command {action: 'held:release-all'}`
- `admin.discardAllHeld` → send `gm:command {action: 'held:discard-all'}`
- `admin.serviceCheck` → reroute to send `gm:command {action: 'service:check', service: serviceId}` (service-agnostic, reads `data-service` attribute)

### Remove
- `admin.lightingRetry` (subsumed by per-service "Check Now" in HealthRenderer)

### Update
- Existing `admin.releaseHeldCue` and `admin.discardHeldCue` → merge into the generic `admin.releaseHeld`/`admin.discardHeld` above (held items are no longer cue-specific)

### safeAdminAction wrapper
Wrap all held-item actions in a `safeAdminAction()` helper that handles the round-trip: disables button, sends command, re-enables on response or timeout.

---

## 8. Test Strategy

### Backend Unit Tests
- `broadcasts.test.js`: Test new `held:added`, `held:released`, `held:discarded`, `held:recoverable` mappings; verify old raw names no longer broadcast
- `syncHelpers.test.js`: Verify `buildHeldItemsState()` normalizes both cue and video items (already exists — may just need assertion updates for unified format)

### Backend Contract Tests
- Update `asyncapi.yaml` channel names → contract tests validate against them automatically

### Backend E2E Tests (specific fixes)
- `admin-state-reactivity.test.js` line 77: `systemStatus.vlc` → `serviceHealth.vlc.status`
- `07d-01-admin-panel-ui.test.js`: Update DOM selectors from `#orchestrator-status`/`#vlc-status` to new HealthRenderer DOM structure
- `assertions.js` `assertSyncFullStructure`: Already validates `serviceHealth` — no changes needed

### ALNScanner Unit Tests
- **New:** `HealthRenderer.test.js` — collapsed/expanded states, per-service rendering, "Check Now" button emission
- **New:** `HeldItemsRenderer.test.js` — empty/populated states, duration counter, release/discard button emission, bulk actions
- **Update:** `MonitoringDisplay.test.js` / `MonitoringDisplay-phase2.test.js` — remove `systemStatus.vlc` references, verify delegation to HealthRenderer/HeldItemsRenderer
- **Update:** `unifiedDataManager.test.js` — add `updateServiceHealth()` tests
- **Update:** `orchestratorClient.test.js` — update messageTypes array (add unified `held:*`, remove raw `cue:held/released/discarded`)
- **Update:** `networkedSession.test.js` — update event routing tests for unified names
- **Delete:** SystemMonitor test suites from `adminModule.test.js`, `AdminController.test.js`, `service-wiring.test.js`, `app.test.js`
- **Update:** `SpotifyRenderer.test.js` — remove disconnected template tests
- **Update:** `EnvironmentRenderer.test.js` — remove `#lighting-not-connected` tests

### ALNScanner E2E Tests
- `phase2-validation.spec.js`: Verify SystemMonitor deletion doesn't break module import checks (tests dynamic imports, not SystemMonitor directly)
- No new E2E specs needed — health/held rendering covered by unit tests

### What We're NOT Testing
- No integration tests for event-name translation (broadcasts.js unit test concern)
- No E2E tests for HealthRenderer visual states (unit tests with DOM assertions suffice)
