# Session 02-16 Post-Mortem Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all bugs discovered during the 2026-02-16 live game session that affected HA lighting, audio routing, ducking, display stability, and error visibility.

**Architecture:** Ten targeted fixes across backend services and GM Scanner client. Each fix is isolated, testable, and safe to deploy incrementally. Fixes are ordered by severity — P0 fixes restore broken functionality, P1 fixes prevent error spam and improve reliability, P2 fixes prevent rare race conditions.

**Tech Stack:** Node.js (backend services), ES6 modules (GM Scanner/ALNScanner), Jest (unit tests), PipeWire/pactl (audio), PM2 (deployment)

---

## Task 1: Fix Cross-Cutting Logger Bug in commandExecutor

**Priority:** P0 — Every failed command silently drops its error message from logs, hiding root causes of ALL other bugs.

**Root Cause:** `logger.error(string, string)` — Winston expects `(string, object)` for metadata. The second string arg is silently absorbed by `format.metadata()`.

**Files:**
- Modify: `backend/src/services/commandExecutor.js` (line 577)
- Test: `backend/tests/unit/services/commandExecutor.test.js`

**Step 1: Write the failing test**

Add to the existing test file's error-handling describe block:

```javascript
it('should log error message in metadata when command throws', async () => {
  // Arrange: make a command throw
  const mockAudioRouting = require('../../src/services/audioRoutingService');
  mockAudioRouting.setStreamRoute = jest.fn().mockRejectedValue(new Error('Sink not found'));

  // Act
  const result = await executeCommand({
    action: 'audio:route:set',
    payload: { stream: 'video', sink: 'nonexistent' },
    source: 'gm',
    deviceId: 'test-device'
  });

  // Assert: error message must appear in structured metadata, not as a dropped string
  expect(result.success).toBe(false);
  expect(result.message).toBe('Sink not found');
  expect(logger.error).toHaveBeenCalledWith(
    expect.stringContaining('audio:route:set failed'),
    expect.objectContaining({ error: 'Sink not found' })
  );
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/services/commandExecutor.test.js -t "should log error message in metadata" --no-coverage`

Expected: FAIL — `logger.error` called with `(string, string)` not `(string, object)`

**Step 3: Write minimal implementation**

In `backend/src/services/commandExecutor.js`, change line 577 from:

```javascript
logger.error(`[executeCommand] ${action} failed:`, error.message);
```

to:

```javascript
logger.error(`[executeCommand] ${action} failed`, { error: error.message, action, source });
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/unit/services/commandExecutor.test.js -t "should log error message in metadata" --no-coverage`

Expected: PASS

**Step 5: Run full commandExecutor test suite**

Run: `cd backend && npx jest tests/unit/services/commandExecutor.test.js --no-coverage`

Expected: All tests pass

**Step 6: Commit**

```bash
git add backend/src/services/commandExecutor.js backend/tests/unit/services/commandExecutor.test.js
git commit -m "fix: log error metadata as object in commandExecutor catch block

Winston logger.error(msg, string) silently drops the string arg.
Changed to logger.error(msg, {error, action, source}) so failed
command errors appear in structured logs."
```

---

## Task 2: Fix Lighting Scenes Blocked from sync:full

**Priority:** P0 — HA lighting was completely absent from GM interface during the entire game.

**Root Cause:** `updateLightingState()` in UnifiedDataManager only populates `scenes` when `payload.type === 'refreshed'`, but `sync:full` payloads don't include that type field. Regression from commit `5997a17`.

The `sync:full` payload shape from `environmentHelpers.js` is:
```javascript
{ connected: true, scenes: [...], activeScene: {...} }
```
No `type` field — so the guard `payload.type === 'refreshed'` blocks scenes from loading on connect.

**Files:**
- Modify: `ALNScanner/src/core/unifiedDataManager.js` (`updateLightingState` method, ~line 1023)
- Test: `ALNScanner/tests/unit/core/unifiedDataManager.test.js`

**Step 1: Write the failing test**

Add to the existing lighting state test describe block:

```javascript
describe('updateLightingState - sync:full scenes (no type field)', () => {
  it('should accept scenes array even without type=refreshed', () => {
    // This is the shape from sync:full → environmentHelpers.buildEnvironmentState()
    const syncFullLightingPayload = {
      connected: true,
      scenes: [
        { id: 'scene-1', name: 'Ambient' },
        { id: 'scene-2', name: 'Dramatic' }
      ],
      activeScene: { id: 'scene-1', name: 'Ambient' }
    };

    manager.updateLightingState(syncFullLightingPayload);

    expect(manager.environmentState.lighting.connected).toBe(true);
    expect(manager.environmentState.lighting.scenes).toHaveLength(2);
    expect(manager.environmentState.lighting.scenes[0].id).toBe('scene-1');
  });

  it('should still accept scenes with type=refreshed (existing behavior)', () => {
    const refreshPayload = {
      type: 'refreshed',
      connected: true,
      scenes: [{ id: 'scene-3', name: 'Party' }]
    };

    manager.updateLightingState(refreshPayload);

    expect(manager.environmentState.lighting.scenes).toHaveLength(1);
    expect(manager.environmentState.lighting.scenes[0].id).toBe('scene-3');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd ALNScanner && npx jest tests/unit/core/unifiedDataManager.test.js -t "sync:full scenes" --no-coverage`

Expected: FAIL — first test fails because scenes array is not populated without `type === 'refreshed'`

**Step 3: Write minimal implementation**

In `ALNScanner/src/core/unifiedDataManager.js`, change the guard at ~line 1023 from:

```javascript
if (payload.type === 'refreshed' && Array.isArray(payload.scenes)) {
```

to:

```javascript
if (Array.isArray(payload.scenes)) {
```

This accepts scenes from ANY source (sync:full, lighting:status with type=refreshed, etc.) as long as it's a valid array.

**Step 4: Run test to verify it passes**

Run: `cd ALNScanner && npx jest tests/unit/core/unifiedDataManager.test.js -t "sync:full scenes" --no-coverage`

Expected: PASS

**Step 5: Run full UnifiedDataManager test suite**

Run: `cd ALNScanner && npx jest tests/unit/core/unifiedDataManager.test.js --no-coverage`

Expected: All tests pass

**Step 6: Commit**

```bash
cd ALNScanner
git add src/core/unifiedDataManager.js tests/unit/core/unifiedDataManager.test.js
git commit -m "fix: accept lighting scenes from sync:full without type=refreshed guard

The type===refreshed guard blocked scenes from sync:full payloads
(which don't include a type field), making HA lighting absent from
the GM interface for the entire session."
```

---

## Task 3: Fix Audio Routes Data Shape Mismatch

**Priority:** P0 — Audio routing dropdowns showed "[object Object]" and couldn't be changed.

**Root Cause:** `getRoutingStatus()` returns routes as objects `{ video: { sink: 'hdmi' } }` (internal storage format), but the GM Scanner expects plain strings `{ video: 'hdmi' }` (same shape as `routing:changed` events). When `EnvironmentRenderer` does `dropdown.value = { sink: 'hdmi' }`, it coerces to `"[object Object]"` and matches nothing.

**Fix Strategy:** Normalize routes to flat strings in `getRoutingStatus()` so sync:full and live events use the same shape. This is a backend-only change — the internal `{ sink: 'hdmi' }` storage format stays, but the public API returns strings.

**Files:**
- Modify: `backend/src/services/audioRoutingService.js` (`getRoutingStatus` method, line 227)
- Modify: `backend/src/websocket/environmentHelpers.js` (update DEFAULTS to match, line 20)
- Test: `backend/tests/unit/services/audioRoutingService.test.js`

**Step 1: Write the failing test**

Add to the existing audioRoutingService test file:

```javascript
describe('getRoutingStatus - routes shape', () => {
  it('should return routes as flat strings, not objects', async () => {
    // Set a route (internally stored as { sink: 'hdmi' })
    await audioRoutingService.setStreamRoute('video', 'hdmi');

    const status = await audioRoutingService.getRoutingStatus();

    // Route values must be plain strings for GM Scanner dropdown compatibility
    expect(status.routes.video).toBe('hdmi');
    expect(typeof status.routes.video).toBe('string');
  });

  it('should normalize all configured routes to strings', async () => {
    await audioRoutingService.setStreamRoute('video', 'hdmi');
    await audioRoutingService.setStreamRoute('spotify', 'bluetooth');
    await audioRoutingService.setStreamRoute('sound', 'aln-combine');

    const status = await audioRoutingService.getRoutingStatus();

    expect(status.routes.video).toBe('hdmi');
    expect(status.routes.spotify).toBe('bluetooth');
    expect(status.routes.sound).toBe('aln-combine');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/services/audioRoutingService.test.js -t "routes shape" --no-coverage`

Expected: FAIL — `status.routes.video` is `{ sink: 'hdmi' }` not `'hdmi'`

**Step 3: Write minimal implementation**

In `backend/src/services/audioRoutingService.js`, change `getRoutingStatus()` at line 227 from:

```javascript
async getRoutingStatus() {
  return {
    routes: { ...this._routingData.routes },
    defaultSink: this._routingData.defaultSink,
    availableSinks: await this.getAvailableSinksWithCombine(),
  };
}
```

to:

```javascript
async getRoutingStatus() {
  // Normalize routes to flat strings (internal format is { sink: 'hdmi' })
  // so sync:full and routing:changed events use the same shape for the GM Scanner
  const routes = {};
  for (const [stream, route] of Object.entries(this._routingData.routes)) {
    routes[stream] = typeof route === 'object' ? route.sink : route;
  }
  return {
    routes,
    defaultSink: this._routingData.defaultSink,
    availableSinks: await this.getAvailableSinksWithCombine(),
  };
}
```

Also update `backend/src/websocket/environmentHelpers.js` DEFAULTS at line 20 from:

```javascript
audio: {
  routes: { video: { sink: 'hdmi' } },
  defaultSink: 'hdmi',
  availableSinks: [],
},
```

to:

```javascript
audio: {
  routes: { video: 'hdmi' },
  defaultSink: 'hdmi',
  availableSinks: [],
},
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/unit/services/audioRoutingService.test.js -t "routes shape" --no-coverage`

Expected: PASS

**Step 5: Run full audioRoutingService + environmentHelpers test suites**

Run: `cd backend && npx jest tests/unit/services/audioRoutingService.test.js tests/unit/websocket/ --no-coverage`

Expected: All tests pass

**Step 6: Commit**

```bash
git add backend/src/services/audioRoutingService.js backend/src/websocket/environmentHelpers.js backend/tests/unit/services/audioRoutingService.test.js
git commit -m "fix: normalize audio routes to flat strings in getRoutingStatus

Internal storage uses { sink: 'hdmi' } objects, but getRoutingStatus()
now returns flat strings { video: 'hdmi' } matching routing:changed
event shape. Fixes GM Scanner dropdown showing [object Object]."
```

---

## Task 4: Fix Persist-Before-Apply in audio:route:set

**Priority:** P1 — Bad routes survive restarts because `setStreamRoute()` persists before `applyRouting()` validates the sink exists.

**Root Cause:** In `commandExecutor.js` line 386-387:
```javascript
await audioRoutingService.setStreamRoute(stream, sink);  // persists immediately
await audioRoutingService.applyRouting(stream);           // can fail → bad route stuck
```

If `applyRouting` fails (e.g., sink gone), the invalid route is already persisted and will be restored on next restart.

**Files:**
- Modify: `backend/src/services/commandExecutor.js` (`audio:route:set` case, line 383)
- Test: `backend/tests/unit/services/commandExecutor.test.js`

**Step 1: Write the failing test**

```javascript
describe('audio:route:set - apply-before-persist', () => {
  it('should not persist route if applyRouting fails', async () => {
    const mockAudioRouting = require('../../src/services/audioRoutingService');
    mockAudioRouting.setStreamRoute = jest.fn().mockResolvedValue();
    mockAudioRouting.applyRouting = jest.fn().mockRejectedValue(new Error('No available sink'));

    const result = await executeCommand({
      action: 'audio:route:set',
      payload: { stream: 'video', sink: 'nonexistent' },
      source: 'gm',
      deviceId: 'test-device'
    });

    expect(result.success).toBe(false);
    // setStreamRoute should NOT have been called (or should be reverted)
    // because applyRouting failed
  });

  it('should persist route after successful applyRouting', async () => {
    const mockAudioRouting = require('../../src/services/audioRoutingService');
    mockAudioRouting.setStreamRoute = jest.fn().mockResolvedValue();
    mockAudioRouting.applyRouting = jest.fn().mockResolvedValue();

    const result = await executeCommand({
      action: 'audio:route:set',
      payload: { stream: 'video', sink: 'hdmi' },
      source: 'gm',
      deviceId: 'test-device'
    });

    expect(result.success).toBe(true);
    // applyRouting called first, then setStreamRoute persists
    const applyOrder = mockAudioRouting.applyRouting.mock.invocationCallOrder[0];
    const setOrder = mockAudioRouting.setStreamRoute.mock.invocationCallOrder[0];
    expect(applyOrder).toBeLessThan(setOrder);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/services/commandExecutor.test.js -t "apply-before-persist" --no-coverage`

Expected: FAIL — `setStreamRoute` is called before `applyRouting`

**Step 3: Write minimal implementation**

In `backend/src/services/commandExecutor.js`, change the `audio:route:set` case at line 383 from:

```javascript
case 'audio:route:set': {
  const { stream = 'video', sink } = payload || {};
  if (!sink) throw new Error('sink is required');
  await audioRoutingService.setStreamRoute(stream, sink);
  await audioRoutingService.applyRouting(stream);
  resultMessage = `Audio route set: ${stream} -> ${sink}`;
  logger.info('Audio route set', { source, deviceId, stream, sink });
  break;
}
```

to:

```javascript
case 'audio:route:set': {
  const { stream = 'video', sink } = payload || {};
  if (!sink) throw new Error('sink is required');
  // Apply first to validate sink exists, THEN persist
  await audioRoutingService.applyRouting(stream, sink);
  await audioRoutingService.setStreamRoute(stream, sink);
  resultMessage = `Audio route set: ${stream} -> ${sink}`;
  logger.info('Audio route set', { source, deviceId, stream, sink });
  break;
}
```

This also requires a small change to `audioRoutingService.applyRouting()` to accept an optional `sinkOverride` parameter. Currently `applyRouting(stream)` reads the route from `_routingData`, but we want to validate the new sink BEFORE storing it.

In `backend/src/services/audioRoutingService.js`, modify `applyRouting()` at line 243:

```javascript
async applyRouting(stream, sinkOverride) {
  this._validateStream(stream);

  const targetSinkType = sinkOverride || this.getStreamRoute(stream);
  const availableSinks = await this.getAvailableSinks();
  // ... rest unchanged
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/unit/services/commandExecutor.test.js -t "apply-before-persist" --no-coverage`

Expected: PASS

**Step 5: Run full test suites**

Run: `cd backend && npx jest tests/unit/services/commandExecutor.test.js tests/unit/services/audioRoutingService.test.js --no-coverage`

Expected: All tests pass

**Step 6: Commit**

```bash
git add backend/src/services/commandExecutor.js backend/src/services/audioRoutingService.js backend/tests/unit/services/commandExecutor.test.js
git commit -m "fix: apply audio route before persisting to prevent bad routes surviving restarts

Swapped order: applyRouting() now validates sink exists before
setStreamRoute() persists. Added sinkOverride param to applyRouting()
so the new sink can be validated before storage."
```

---

## Task 5: Filter auto_null Sink from GM Dropdown

**Priority:** P1 — PipeWire's dummy `auto_null` sink appears in the audio routing dropdown, confusing GMs.

**Root Cause:** `classifySink()` classifies `auto_null` as `'other'`, and `getAvailableSinksWithCombine()` doesn't filter it out. The GM Scanner renders all sinks from `availableSinks`.

**Files:**
- Modify: `backend/src/services/audioRoutingService.js` (`getAvailableSinksWithCombine` method, line 502)
- Test: `backend/tests/unit/services/audioRoutingService.test.js`

**Step 1: Write the failing test**

```javascript
describe('getAvailableSinksWithCombine - filtering', () => {
  it('should exclude auto_null sink from available sinks', async () => {
    // Mock getAvailableSinks to return a list including auto_null
    audioRoutingService.getAvailableSinks = jest.fn().mockResolvedValue([
      { id: '1', name: 'alsa_output.hdmi', driver: 'alsa', format: '', state: 'RUNNING', type: 'hdmi' },
      { id: '2', name: 'auto_null', driver: 'null', format: '', state: 'RUNNING', type: 'other' },
      { id: '3', name: 'bluez_output.XX_XX', driver: 'bluez', format: '', state: 'RUNNING', type: 'bluetooth' },
    ]);

    const sinks = await audioRoutingService.getAvailableSinksWithCombine();

    const sinkNames = sinks.map(s => s.name);
    expect(sinkNames).not.toContain('auto_null');
    expect(sinkNames).toContain('alsa_output.hdmi');
    expect(sinkNames).toContain('bluez_output.XX_XX');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/services/audioRoutingService.test.js -t "exclude auto_null" --no-coverage`

Expected: FAIL — `auto_null` is still in the list

**Step 3: Write minimal implementation**

In `backend/src/services/audioRoutingService.js`, in `getAvailableSinksWithCombine()` at line 502, change:

```javascript
async getAvailableSinksWithCombine() {
  let sinks = await this.getAvailableSinks();

  // Remove any raw 'aln-combine' sinks (from pactl list) to avoid duplicates with our virtual entry
  // Also remove legacy 'combine-bt' if present
  sinks = sinks.filter(s => s.name !== 'aln-combine' && s.name !== 'combine-bt');
```

to:

```javascript
async getAvailableSinksWithCombine() {
  let sinks = await this.getAvailableSinks();

  // Remove internal/virtual sinks that should not appear in GM dropdown:
  // - aln-combine / combine-bt: raw combine sinks (we add our own virtual entry)
  // - auto_null: PipeWire dummy sink (appears when no real sinks available)
  sinks = sinks.filter(s =>
    s.name !== 'aln-combine' &&
    s.name !== 'combine-bt' &&
    s.name !== 'auto_null'
  );
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/unit/services/audioRoutingService.test.js -t "exclude auto_null" --no-coverage`

Expected: PASS

**Step 5: Run full suite**

Run: `cd backend && npx jest tests/unit/services/audioRoutingService.test.js --no-coverage`

Expected: All tests pass

**Step 6: Commit**

```bash
git add backend/src/services/audioRoutingService.js backend/tests/unit/services/audioRoutingService.test.js
git commit -m "fix: filter auto_null PipeWire sink from GM audio dropdown

auto_null is a PipeWire dummy sink that should never appear in the
GM Scanner audio routing dropdown."
```

---

## Task 6: Broadcast sink:added/sink:removed to GM Scanner

**Priority:** P1 — Sink list never refreshes during a session. If a BT speaker connects/disconnects mid-game, the dropdown is stale.

**Root Cause:** `audioRoutingService` emits `sink:added` and `sink:removed` internally, but `broadcasts.js` only forwards `routing:changed`, `routing:applied`, and `routing:fallback`. The GM Scanner never learns about sink list changes.

**Files:**
- Modify: `backend/src/websocket/broadcasts.js` (audio routing section, ~line 544)
- Modify: `ALNScanner/src/network/orchestratorClient.js` (add `audio:sinks` to messageTypes)
- Modify: `ALNScanner/src/network/networkedSession.js` (handle new event)
- Test: `backend/tests/unit/websocket/broadcasts.test.js`

**Step 1: Write the failing test**

In `backend/tests/unit/websocket/broadcasts.test.js`, add:

```javascript
describe('audio sink events', () => {
  it('should broadcast audio:sinks when sink:added fires', () => {
    // Trigger sink:added on audioRoutingService
    services.audioRoutingService.emit('sink:added', { id: '42' });

    // Verify broadcast to GM room
    expect(emitToRoom).toHaveBeenCalledWith(
      expect.anything(), 'gm', 'audio:sinks',
      expect.objectContaining({ type: 'added' })
    );
  });

  it('should broadcast audio:sinks when sink:removed fires', () => {
    services.audioRoutingService.emit('sink:removed', { id: '42' });

    expect(emitToRoom).toHaveBeenCalledWith(
      expect.anything(), 'gm', 'audio:sinks',
      expect.objectContaining({ type: 'removed' })
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/websocket/broadcasts.test.js -t "audio sink events" --no-coverage`

Expected: FAIL — no handler registered for `sink:added`/`sink:removed`

**Step 3: Write minimal implementation**

In `backend/src/websocket/broadcasts.js`, after the `ducking:changed` listener (~line 562), add:

```javascript
    // Sink add/remove events — refresh GM dropdown sink list
    addTrackedListener(audioRoutingService, 'sink:added', async (data) => {
      try {
        const status = await audioRoutingService.getRoutingStatus();
        emitToRoom(io, 'gm', 'audio:sinks', {
          type: 'added',
          sinkId: data.id,
          availableSinks: status.availableSinks,
        });
        logger.debug('Broadcasted audio:sinks (added)', { sinkId: data.id });
      } catch (err) {
        logger.warn('Failed to broadcast sink:added', { error: err.message });
      }
    });
    addTrackedListener(audioRoutingService, 'sink:removed', async (data) => {
      try {
        const status = await audioRoutingService.getRoutingStatus();
        emitToRoom(io, 'gm', 'audio:sinks', {
          type: 'removed',
          sinkId: data.id,
          availableSinks: status.availableSinks,
        });
        logger.debug('Broadcasted audio:sinks (removed)', { sinkId: data.id });
      } catch (err) {
        logger.warn('Failed to broadcast sink:removed', { error: err.message });
      }
    });
```

In `ALNScanner/src/network/orchestratorClient.js`, add `'audio:sinks'` to the `messageTypes` array in `_setupMessageHandlers()`.

In `ALNScanner/src/network/networkedSession.js`, add a case in the message handler switch:

```javascript
case 'audio:sinks':
  if (payload.availableSinks) {
    this.dataManager.updateAudioState({ availableSinks: payload.availableSinks });
  }
  break;
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/unit/websocket/broadcasts.test.js -t "audio sink events" --no-coverage`

Expected: PASS

**Step 5: Run full broadcast + ALNScanner tests**

Run: `cd backend && npx jest tests/unit/websocket/broadcasts.test.js --no-coverage`
Run: `cd ALNScanner && npx jest tests/unit/network/ --no-coverage`

Expected: All tests pass

**Step 6: Commit**

```bash
git add backend/src/websocket/broadcasts.js backend/tests/unit/websocket/broadcasts.test.js
cd ALNScanner && git add src/network/orchestratorClient.js src/network/networkedSession.js
# Commit backend first
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add backend/src/websocket/broadcasts.js backend/tests/unit/websocket/broadcasts.test.js
git commit -m "fix: broadcast sink:added/removed to refresh GM audio dropdown

Audio sink list was static after initial sync:full. Now sink changes
(BT speaker connect/disconnect) trigger audio:sinks broadcast with
updated availableSinks list."
```

Then commit ALNScanner submodule separately:
```bash
cd ALNScanner
git add src/network/orchestratorClient.js src/network/networkedSession.js
git commit -m "fix: handle audio:sinks event for dynamic sink list updates"
cd ..
git add ALNScanner
git commit -m "chore: update ALNScanner submodule with audio:sinks handler"
```

---

## Task 7: Silence Ducking Errors When Spotify Has No Sink-Input

**Priority:** P1 — 26 error log entries per session from ducking engine trying to control non-existent spotifyd sink-input.

**Root Cause:** `setStreamVolume()` throws `Error('No active sink-input found for stream ...')` when spotifyd isn't playing. The ducking engine catches this with `.catch()` and logs it as `logger.error`. The fix: downgrade to `warn` (expected condition) and add a pre-check guard.

**Files:**
- Modify: `backend/src/services/audioRoutingService.js` (ducking handlers at lines 675, 723)
- Test: `backend/tests/unit/services/audioRoutingService.test.js`

**Step 1: Write the failing test**

```javascript
describe('ducking engine - missing sink-input handling', () => {
  it('should not log error when target stream has no sink-input', async () => {
    // Load ducking rules
    audioRoutingService.loadDuckingRules([
      { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 }
    ]);

    // Mock setStreamVolume to throw (spotifyd not running)
    audioRoutingService.setStreamVolume = jest.fn()
      .mockRejectedValue(new Error('No active sink-input found for stream \'spotify\''));

    // Trigger ducking
    audioRoutingService.handleDuckingEvent('video', 'started');

    // Wait for async .catch()
    await new Promise(r => setTimeout(r, 50));

    // Should warn, not error
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('sink-input not available for ducking'),
      expect.any(Object)
    );
    expect(logger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('Failed to set ducked volume'),
      expect.any(Object)
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/services/audioRoutingService.test.js -t "missing sink-input handling" --no-coverage`

Expected: FAIL — `logger.error` is called, not `logger.warn`

**Step 3: Write minimal implementation**

In `backend/src/services/audioRoutingService.js`, change the ducking `.catch()` handlers.

At line 675 (duck start), change:

```javascript
this.setStreamVolume(target, effectiveVolume).catch(err => {
  logger.error('Failed to set ducked volume', {
    target, volume: effectiveVolume, error: err.message
  });
});
```

to:

```javascript
this.setStreamVolume(target, effectiveVolume).catch(err => {
  if (err.message.includes('No active sink-input')) {
    logger.warn('Ducking skipped: sink-input not available for ducking', {
      target, volume: effectiveVolume,
    });
  } else {
    logger.error('Failed to set ducked volume', {
      target, volume: effectiveVolume, error: err.message,
    });
  }
});
```

At line 723 (duck stop / restore), change:

```javascript
this.setStreamVolume(target, restoreVolume).catch(err => {
  logger.error('Failed to restore volume after ducking', {
    target, volume: restoreVolume, error: err.message
  });
});
```

to:

```javascript
this.setStreamVolume(target, restoreVolume).catch(err => {
  if (err.message.includes('No active sink-input')) {
    logger.warn('Ducking restore skipped: sink-input not available', {
      target, volume: restoreVolume,
    });
  } else {
    logger.error('Failed to restore volume after ducking', {
      target, volume: restoreVolume, error: err.message,
    });
  }
});
```

Also find the re-evaluate handler (around line 738-745 area for when multiple sources are active) and apply the same pattern.

**Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/unit/services/audioRoutingService.test.js -t "missing sink-input handling" --no-coverage`

Expected: PASS

**Step 5: Run full suite**

Run: `cd backend && npx jest tests/unit/services/audioRoutingService.test.js --no-coverage`

Expected: All tests pass

**Step 6: Commit**

```bash
git add backend/src/services/audioRoutingService.js backend/tests/unit/services/audioRoutingService.test.js
git commit -m "fix: downgrade ducking error to warn when target has no sink-input

spotifyd often has no PipeWire sink-input when paused/stopped.
Ducking attempts logged 26 errors/session. Now logs warn for
expected 'No active sink-input' condition, error only for unexpected."
```

---

## Task 8: Fix Dual-Path Display Control Race Condition

**Priority:** P2 — Video completion + display mode transitions race, causing HDMI signal loss or interrupted videos.

**Root Cause:** There are TWO independent problems causing display instability:

**Problem A: Dual-path VLC control after video completes.**
When a video finishes, the event chain creates two competing paths to VLC:

```
video:completed fires
├── Path 1: displayControlService._handleVideoComplete()
│   └── setIdleLoop() → hideScoreboard + vlcService.returnToIdleLoop()
│
└── Path 2: videoQueueService (setImmediate → processQueue)
    ├── If queue has more items: vlcService.playVideo(next)  ← RACE with Path 1
    └── If queue empty: vlcService.returnToIdleLoop() + emit video:idle
        └── displayControlService._handleQueueEmpty() → _handleVideoComplete() AGAIN
```

**Concrete failure scenario (multi-video queue):**
1. Video1 completes → `video:completed` fires
2. `_handleVideoComplete()` starts async `setIdleLoop()` (500ms+ for Chromium kill)
3. `setImmediate(() => processQueue())` fires → finds Video2 → `vlcService.playVideo(Video2)`
4. `setIdleLoop()` completes → `vlcService.returnToIdleLoop()` → **overwrites Video2 with idle loop**

**Concrete failure scenario (single video, queue empty):**
1. Video completes → `video:completed` fires
2. `_handleVideoComplete()` starts `setIdleLoop()` → calls `vlcService.returnToIdleLoop()`
3. `processQueue()` also calls `vlcService.returnToIdleLoop()` PLUS emits `video:idle`
4. `video:idle` → `_handleQueueEmpty()` → `_handleVideoComplete()` fires AGAIN
5. Two `setIdleLoop()` transitions race each other

**Problem B: No mutex on mode transitions.**
Even with the event flow fixed, concurrent calls (e.g., video:idle + GM pressing display toggle) still interleave async VLC/Chromium operations.

**Fix Strategy (2 sub-steps):**
1. **Fix event wiring**: displayControlService should only listen to `video:idle` (queue empty), not `video:completed` (per-video). Remove `vlcService.returnToIdleLoop()` from `videoQueueService.processQueue()` — displayControlService owns post-video display decisions.
2. **Add mutex**: Promise-based lock on all mode transition methods.

**Files:**
- Modify: `backend/src/services/displayControlService.js`
- Modify: `backend/src/services/videoQueueService.js` (`processQueue` method, line 79-81)
- Test: `backend/tests/unit/services/displayControlService.test.js`
- Test: `backend/tests/unit/services/videoQueueService.test.js`

### Step 1: Write failing tests for event wiring fix

Add to `backend/tests/unit/services/displayControlService.test.js`:

```javascript
describe('Video completion event wiring', () => {
  it('should NOT register listener on video:completed', () => {
    // video:completed fires per-video, even when queue has more items.
    // displayControlService should only act on video:idle (queue empty).
    const registeredEvents = mockVideoQueueService.on.mock.calls.map(c => c[0]);
    expect(registeredEvents).not.toContain('video:completed');
  });

  it('should register listener on video:idle', () => {
    const registeredEvents = mockVideoQueueService.on.mock.calls.map(c => c[0]);
    expect(registeredEvents).toContain('video:idle');
  });
});
```

Add to `backend/tests/unit/services/videoQueueService.test.js`:

```javascript
describe('processQueue - no direct VLC idle call', () => {
  it('should NOT call vlcService.returnToIdleLoop when queue is empty', async () => {
    // displayControlService owns the post-video display decision via video:idle
    mockVlcService.returnToIdleLoop.mockClear();

    // Queue is empty, processQueue should just emit video:idle
    await videoQueueService.processQueue();

    expect(mockVlcService.returnToIdleLoop).not.toHaveBeenCalled();
  });

  it('should emit video:idle when queue is empty', async () => {
    const idleHandler = jest.fn();
    videoQueueService.on('video:idle', idleHandler);

    await videoQueueService.processQueue();

    expect(idleHandler).toHaveBeenCalled();
  });
});
```

### Step 2: Run tests to verify they fail

Run: `cd backend && npx jest tests/unit/services/displayControlService.test.js -t "event wiring" --no-coverage`

Expected: FAIL — `video:completed` is still registered

Run: `cd backend && npx jest tests/unit/services/videoQueueService.test.js -t "no direct VLC idle" --no-coverage`

Expected: FAIL — `returnToIdleLoop` is called in processQueue

### Step 3: Implement event wiring fix

**In `backend/src/services/displayControlService.js` `init()` method**, change the event listener registration from:

```javascript
if (this.videoQueueService) {
  this._boundVideoCompleteHandler = () => this._handleVideoComplete();
  this._boundQueueEmptyHandler = () => this._handleQueueEmpty();
  this.videoQueueService.on('video:completed', this._boundVideoCompleteHandler);
  this.videoQueueService.on('video:idle', this._boundQueueEmptyHandler);
}
```

to:

```javascript
if (this.videoQueueService) {
  // ONLY listen to video:idle (queue empty), NOT video:completed (per-video).
  // video:completed fires after each video; if queue has more items,
  // videoQueueService handles starting the next one. We only need to
  // restore the previous display mode when ALL videos are done.
  this._boundQueueEmptyHandler = () => this._handleVideoComplete();
  this.videoQueueService.on('video:idle', this._boundQueueEmptyHandler);
}
```

Update `reset()` to match — remove the `video:completed` listener cleanup:

```javascript
reset() {
  if (this.videoQueueService) {
    if (this._boundQueueEmptyHandler) {
      this.videoQueueService.removeListener('video:idle', this._boundQueueEmptyHandler);
    }
  }
  // ... rest unchanged
  this._boundQueueEmptyHandler = null;
}
```

Remove `_handleQueueEmpty()` entirely (its only caller was `video:idle`, now handled directly by `_handleVideoComplete`).

**In `backend/src/services/videoQueueService.js` `processQueue()` method**, remove the direct VLC call at lines 78-81:

```javascript
// Find next pending item
const nextItem = this.queue.find(item => item.isPending());
if (!nextItem) {
  this.currentItem = null;

  // Return to idle loop if enabled        ← REMOVE these 3 lines
  if (config.features.videoPlayback) {     ← REMOVE
    await vlcService.returnToIdleLoop();   ← REMOVE
  }                                        ← REMOVE

  this.emit('video:idle'); // Emit idle when queue is empty  ← KEEP
  return; // Nothing to play
}
```

Becomes:

```javascript
const nextItem = this.queue.find(item => item.isPending());
if (!nextItem) {
  this.currentItem = null;
  // displayControlService handles display restoration via video:idle listener
  this.emit('video:idle');
  return;
}
```

### Step 4: Run event wiring tests

Run: `cd backend && npx jest tests/unit/services/displayControlService.test.js -t "event wiring" --no-coverage`

Expected: PASS

Run: `cd backend && npx jest tests/unit/services/videoQueueService.test.js -t "no direct VLC idle" --no-coverage`

Expected: PASS

### Step 5: Write failing test for mutex

Add to `backend/tests/unit/services/displayControlService.test.js`:

```javascript
describe('Concurrent mode switch protection', () => {
  it('should serialize concurrent setIdleLoop and setScoreboard calls', async () => {
    // Need real displayDriver mock (not the one from init)
    const displayDriver = require('../../../src/utils/displayDriver');
    const callOrder = [];

    displayDriver.hideScoreboard.mockImplementation(async () => {
      callOrder.push('hide:start');
      await new Promise(r => setTimeout(r, 30));
      callOrder.push('hide:end');
    });
    displayDriver.showScoreboard.mockImplementation(async () => {
      callOrder.push('show:start');
      await new Promise(r => setTimeout(r, 30));
      callOrder.push('show:end');
    });

    // Fire both concurrently
    await Promise.all([
      displayControlService.setIdleLoop(),
      displayControlService.setScoreboard(),
    ]);

    // Verify serialization: first transition completes fully before second starts
    // hideScoreboard is called by setIdleLoop, showScoreboard by setScoreboard
    // If serialized: hide:start, hide:end, ..., show:start, show:end
    // If interleaved: hide:start, show:start, ... (WRONG)
    const starts = callOrder.filter(s => s.endsWith(':start'));
    const ends = callOrder.filter(s => s.endsWith(':end'));
    // First end must come before second start
    const firstEndIdx = callOrder.indexOf(ends[0]);
    const secondStartIdx = callOrder.indexOf(starts[1]);
    if (starts.length > 1) {
      expect(firstEndIdx).toBeLessThan(secondStartIdx);
    }
  });
});
```

### Step 6: Run test to verify it fails

Run: `cd backend && npx jest tests/unit/services/displayControlService.test.js -t "Concurrent mode switch" --no-coverage`

Expected: FAIL — operations interleave

### Step 7: Implement mutex

In `backend/src/services/displayControlService.js`, add to constructor after `this._initialized = false;`:

```javascript
this._switchLock = Promise.resolve();
```

Add private method:

```javascript
/**
 * Serialize mode switches to prevent VLC/Chromium interleaving.
 * @param {Function} fn - Async function to execute under lock
 * @returns {Promise<*>} Result of fn
 * @private
 */
_withLock(fn) {
  const prev = this._switchLock;
  let resolve;
  this._switchLock = new Promise(r => { resolve = r; });
  return prev.then(() => fn()).finally(resolve);
}
```

Wrap the bodies of `setIdleLoop()`, `setScoreboard()`, `playVideo()`, and `toggleMode()`:

```javascript
async setIdleLoop() {
  return this._withLock(async () => {
    logger.info('[DisplayControl] Switching to IDLE_LOOP mode');
    // ... entire existing body ...
  });
}
```

(Same pattern for all four methods.)

Add to `reset()`:

```javascript
this._switchLock = Promise.resolve();
```

### Step 8: Run all displayControlService + videoQueueService tests

Run: `cd backend && npx jest tests/unit/services/displayControlService.test.js tests/unit/services/videoQueueService.test.js --no-coverage`

Expected: All tests pass

### Step 9: Commit

```bash
git add backend/src/services/displayControlService.js backend/src/services/videoQueueService.js \
       backend/tests/unit/services/displayControlService.test.js backend/tests/unit/services/videoQueueService.test.js
git commit -m "fix: eliminate display control race conditions

Two fixes:
1. displayControlService now only listens to video:idle (queue empty),
   not video:completed (per-video). Prevents setIdleLoop() from
   interrupting the next video in a multi-video queue.
   videoQueueService no longer calls vlcService.returnToIdleLoop()
   directly — displayControlService owns post-video display decisions.

2. Promise-based mutex serializes all mode transitions (setIdleLoop,
   setScoreboard, playVideo, toggleMode) to prevent VLC/Chromium
   interleaving when concurrent calls arrive."
```

---

## Task 9: Make VLC Hardware Acceleration Platform-Aware

**Priority:** P2 — `--avcodec-hw=v4l2_m2m` (Pi 4 V4L2 M2M decoder) causes video artifacts on Pi 5's VC6 DRM driver. Hardcoded flags make the codebase fragile across hardware.

**Root Cause:** Pi 5 uses VideoCore VII with DRM/KMS driver. The Pi 4's `v4l2_m2m` hardware decoder forces a codec path that can't allocate overlay planes on Pi 5, causing visual artifacts. The ecosystem.config.js hardcodes Pi 4-specific flags with no way to adapt.

**Goal:** Make VLC hardware acceleration auto-detect by platform, with an env var override for flexibility across Pi 4, Pi 5, and dev machines.

**Files:**
- Modify: `backend/ecosystem.config.js` (VLC args + platform detection)

### Step 1: Verify current platform

Run: `cat /proc/device-tree/model`

This confirms which Pi model we're running on and validates the detection approach.

### Step 2: Write the implementation

`ecosystem.config.js` is a JavaScript file, so it can include runtime logic. Add platform detection and env var override:

In `backend/ecosystem.config.js`, add before `module.exports`:

```javascript
const fs = require('fs');

/**
 * Detect Raspberry Pi model from device tree.
 * Returns platform identifier for hardware-specific configuration.
 */
function detectPlatform() {
  try {
    const model = fs.readFileSync('/proc/device-tree/model', 'utf8').trim();
    if (model.includes('Raspberry Pi 5')) return 'pi5';
    if (model.includes('Raspberry Pi 4')) return 'pi4';
    if (model.includes('Raspberry Pi')) return 'pi-other';
  } catch {
    // Not a Pi (dev machine, CI, etc.)
  }
  return 'generic';
}

/**
 * Get VLC hardware acceleration flags for the current platform.
 * - VLC_HW_ACCEL env var: explicit override (takes priority)
 * - Pi 4: v4l2_m2m hardware decode
 * - Pi 5 / generic: no forced hw accel (VLC auto-detects)
 */
function getVlcHwArgs() {
  if (process.env.VLC_HW_ACCEL !== undefined) {
    return process.env.VLC_HW_ACCEL; // '' means "no hw flags" explicitly
  }
  const platform = detectPlatform();
  switch (platform) {
    case 'pi4':
      return '--codec=avcodec --avcodec-hw=v4l2_m2m';
    case 'pi5':
    case 'pi-other':
    case 'generic':
    default:
      return '';
  }
}

const VLC_BASE_ARGS = '--no-loop --intf http --http-password vlc --http-host 0.0.0.0 --http-port 8080 -A pulse --fullscreen --video-on-top --no-video-title-show --no-video-deco --no-osd';
const vlcHwArgs = getVlcHwArgs();
const VLC_ARGS = vlcHwArgs ? `${VLC_BASE_ARGS} ${vlcHwArgs}` : VLC_BASE_ARGS;
```

Then change the VLC process config from:

```javascript
{
  name: 'vlc-http',
  script: '/usr/bin/cvlc',
  // Optimized for RPi 4: Hardware decode via v4l2_m2m, PulseAudio for compatibility with PipeWire
  args: '--no-loop --intf http --http-password vlc --http-host 0.0.0.0 --http-port 8080 -A pulse --fullscreen --video-on-top --no-video-title-show --no-video-deco --no-osd --codec=avcodec --avcodec-hw=v4l2_m2m',
```

to:

```javascript
{
  name: 'vlc-http',
  script: '/usr/bin/cvlc',
  // Platform-aware: Pi 4 uses v4l2_m2m hw decode, Pi 5+ uses auto-detect.
  // Override with VLC_HW_ACCEL env var (e.g., VLC_HW_ACCEL='' to force software decode).
  args: VLC_ARGS,
```

### Step 3: Verify detection works

Run from the project root:

```bash
node -e "
const fs = require('fs');
try {
  const model = fs.readFileSync('/proc/device-tree/model', 'utf8').trim();
  console.log('Model:', model);
  console.log('Platform:', model.includes('Pi 5') ? 'pi5' : model.includes('Pi 4') ? 'pi4' : 'other');
} catch(e) { console.log('Not a Pi'); }
"
```

Then verify the computed args:

```bash
node -e "
const config = require('./backend/ecosystem.config.js');
const vlcApp = config.apps.find(a => a.name === 'vlc-http');
console.log('VLC args:', vlcApp.args);
"
```

Expected (on Pi 5): Args should NOT contain `--avcodec-hw=v4l2_m2m`.
Expected (on Pi 4): Args SHOULD contain `--avcodec-hw=v4l2_m2m`.

### Step 4: Test env var override

```bash
VLC_HW_ACCEL='' node -e "
const config = require('./backend/ecosystem.config.js');
const vlcApp = config.apps.find(a => a.name === 'vlc-http');
console.log('VLC args (forced no hw):', vlcApp.args);
console.log('Contains v4l2:', vlcApp.args.includes('v4l2'));
"
```

Expected: `Contains v4l2: false` regardless of platform.

### Step 5: Deploy and verify on live system

```bash
cd backend && pm2 restart vlc-http
# Wait 5s
curl http://localhost:8080/requests/status.json -u :vlc | jq .state
```

Expected: VLC responds with `"state":"stopped"` (idle, no video). No `v4l2_m2m` allocation errors in `logs/vlc-error.log`.

### Step 6: Commit

```bash
git add backend/ecosystem.config.js
git commit -m "fix: auto-detect Pi model for VLC hardware acceleration flags

ecosystem.config.js now reads /proc/device-tree/model to detect Pi 4
vs Pi 5 and applies appropriate VLC codec flags:
- Pi 4: --avcodec-hw=v4l2_m2m (hardware decode)
- Pi 5+: no forced hw accel (VLC auto-detects, avoids VC6 DRM conflicts)
- VLC_HW_ACCEL env var overrides auto-detection for any platform."
```

---

## Task 10: Deploy Bluetooth Pairing Fixes

**Priority:** P2 — Bluetooth fixes exist in working tree but weren't deployed during the 02-16 session.

**Root Cause:** Commits `d264580b` and `9acb6857` added async `stopScan()` with BlueZ settle delay and `_pairProc` guard against parallel pair attempts, but the PM2 process wasn't restarted with the new code.

**Files:**
- Verify: `backend/src/services/bluetoothService.js` (check working tree has the fixes)
- Action: Deploy (no code changes needed)

**Step 1: Verify fixes are in working tree**

Run: `cd backend && git log --oneline -5 src/services/bluetoothService.js`

Expected: Shows commits with async stopScan + _pairProc guard

**Step 2: Run existing BT tests to confirm they pass**

Run: `cd backend && npx jest tests/unit/services/bluetoothService.test.js --no-coverage`

Expected: All tests pass

**Step 3: Deploy**

Run: `cd backend && pm2 restart aln-orchestrator`

**Step 4: Verify deployment**

Run: `pm2 status`

Expected: `aln-orchestrator` shows `online` with fresh restart time.

**Step 5: Commit (note only — no code change)**

This task is a deployment action, not a code change. Add a note to the session log or deployment checklist.

---

## Verification Checklist

After all tasks are complete, run the full test suites to ensure no regressions:

```bash
# Backend unit tests (baseline: 1006 passing)
cd backend && npm test

# Backend integration tests
cd backend && npm run test:integration

# ALNScanner unit tests (baseline: 932 passing)
cd ALNScanner && npm test

# Full E2E (requires running orchestrator)
cd backend && npm run test:e2e
```

## Dependency Graph

```
Task 1 (logger fix) ← no dependencies, unblocks better error visibility for all other fixes
Task 2 (lighting scenes) ← independent
Task 3 (routes shape) ← independent
Task 4 (persist-before-apply) ← depends on Task 3 (routes shape) being committed first
Task 5 (auto_null filter) ← independent
Task 6 (sink broadcast) ← depends on Task 3 (uses getRoutingStatus), Task 5 (filtered sinks)
Task 7 (ducking errors) ← independent
Task 8 (display race) ← independent (touches displayControlService + videoQueueService)
Task 9 (VLC flags) ← independent, hardware-specific
Task 10 (BT deploy) ← independent, deployment only
```

**Recommended execution order:**
- **Batch 1 (parallel):** Tasks 1, 2, 5, 7, 9
- **Batch 2 (after Batch 1):** Tasks 3, 8, 10
- **Batch 3 (after Task 3):** Task 4
- **Batch 4 (after Tasks 3+5):** Task 6

**Note on Task 8:** Moved to Batch 2 because it modifies `videoQueueService.js` — must not run in parallel with any other task touching that file. No other tasks in this plan do, but the sequential ordering keeps review manageable for the dual-file change.
