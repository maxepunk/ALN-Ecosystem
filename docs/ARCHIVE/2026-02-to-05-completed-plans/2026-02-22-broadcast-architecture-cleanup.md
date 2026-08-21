# Broadcast Architecture Cleanup — Eliminate commandExecutor broadcasts[]

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate ALL `broadcasts[]` from `commandExecutor.js` by making services emit their own domain events (EventEmitter) and having `broadcasts.js` forward them to WebSocket clients — the established Path B pattern used by every other service.

**Architecture:** `commandExecutor.js` currently has a dual broadcast architecture. Path A returns `broadcasts[]` to the caller (adminEvents.js), which processes them in a loop. Path B uses service EventEmitters → broadcasts.js listeners. Path A exists because some services don't emit events for all state changes, so commandExecutor compensates. This plan fills all Path B gaps, then removes Path A entirely.

**Tech Stack:** Node.js EventEmitter, Socket.io, Jest

**Why this matters:** commandExecutor is called by BOTH adminEvents.js (WebSocket) and cueEngineService (automated cues). The cue engine caller **ignores broadcasts[] entirely** — proving broadcasts aren't commandExecutor's job. Every `target:'gm'` broadcast is dead code (adminEvents.js only handles `target:'all'` and `target:'socket'`). The `target:'all'` and `target:'socket'` entries compensate for missing service-layer emissions, violating SRP.

---

## Inventory of broadcasts[] to eliminate

| Action(s) | Event | Target | Status | Fix |
|-----------|-------|--------|--------|-----|
| `spotify:play/pause/stop/next/previous` | `spotify:status` | `gm` | **Dead** — adminEvents.js drops `target:'gm'` | Remove; play/pause/stop already emit via EventEmitter; add emissions to next/previous |
| `spotify:playlist` | `spotify:status` | `gm` | **Dead** — same | Remove; add `playlist:changed` listener to broadcasts.js |
| `spotify:volume` | `spotify:status` | `gm` | **Dead** — same | Remove; volume:changed already handled |
| `cue:stop` | `cue:status` | `gm` | **Dead** — same | Remove; cueEngineService.stopCue() already emits `cue:status` |
| `cue:pause` | `cue:status` | `gm` | **Dead** — same | Remove; cueEngineService.pauseCue() already emits `cue:status` |
| `cue:resume` | `cue:status` | `gm` | **Dead** — same | Remove; cueEngineService.resumeCue() already emits `cue:status` |
| `cue:conflict:resolve` | `cue:status` | `gm` | **Dead** — same | Remove; override path emits via `_startCompoundCue`; add cancel emission |
| `display:idle-loop/scoreboard/toggle` | `display:mode` | `all` | **Redundant** — displayControlService ALREADY emits `display:mode:changed` but broadcasts.js has no listener | Add listener to broadcasts.js |
| `display:status` | `display:status` | `socket` | **Broken** — ack has no data field, `display:status` not in orchestratorClient messageTypes | Fix ack to include `result.data`; remove broadcast |
| `video:skip` | `video:skipped` | `all` | **Dead** — GM Scanner has no handler for `video:skipped`; skipCurrent() triggers `video:completed` which broadcasts.js already handles | Remove |

---

## Pre-work: Understand existing test baselines

Before starting, run the test suite to establish baseline:

```bash
cd backend && npm test
```

Expected: 1050+ unit tests passing, 0 failures.

---

### Task 1: spotifyService — add playback:changed emission to next() and previous()

**Problem:** `spotifyService.next()` and `previous()` are one-liners with no event emission. When commandExecutor calls them, no EventEmitter event fires, so broadcasts.js can't forward state changes. `play()`, `pause()`, and `stop()` all emit `playback:changed` — next/previous should too.

**Files:**
- Modify: `backend/src/services/spotifyService.js` (lines 92-93)
- Modify: `backend/tests/unit/services/spotifyService.test.js`

**Step 1: Write the failing tests**

Add to `backend/tests/unit/services/spotifyService.test.js`, inside the existing `describe('events', ...)` block (after the `playback:changed on play` test at line 265):

```javascript
    it('should emit playback:changed on next', async () => {
      const handler = jest.fn();
      spotifyService.on('playback:changed', handler);
      mockExecFileSuccess('');
      await spotifyService.next();
      expect(handler).toHaveBeenCalledWith({ state: 'playing' });
    });

    it('should emit playback:changed on previous', async () => {
      const handler = jest.fn();
      spotifyService.on('playback:changed', handler);
      mockExecFileSuccess('');
      await spotifyService.previous();
      expect(handler).toHaveBeenCalledWith({ state: 'playing' });
    });
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest tests/unit/services/spotifyService.test.js --verbose 2>&1 | tail -20`

Expected: 2 new tests FAIL (handler not called — next/previous don't emit events).

**Step 3: Implement the fix**

In `backend/src/services/spotifyService.js`, replace the one-liner methods (lines 92-93):

```javascript
  // BEFORE:
  async next() { await this._dbusCall(`${PLAYER_IFACE}.Next`); }
  async previous() { await this._dbusCall(`${PLAYER_IFACE}.Previous`); }

  // AFTER:
  async next() {
    await this._dbusCall(`${PLAYER_IFACE}.Next`);
    this.state = 'playing';
    this.emit('playback:changed', { state: 'playing' });
  }

  async previous() {
    await this._dbusCall(`${PLAYER_IFACE}.Previous`);
    this.state = 'playing';
    this.emit('playback:changed', { state: 'playing' });
  }
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest tests/unit/services/spotifyService.test.js --verbose 2>&1 | tail -20`

Expected: All tests PASS including the 2 new ones.

**Step 5: Commit**

```bash
git add backend/src/services/spotifyService.js backend/tests/unit/services/spotifyService.test.js
git commit -m "feat: spotifyService next/previous emit playback:changed

Fills EventEmitter gap — next() and previous() now emit playback:changed
like play/pause/stop do. This enables broadcasts.js to forward state
changes without commandExecutor broadcast workarounds.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: cueEngineService — add cue:status emission for conflict cancel path

**Problem:** `resolveConflict()` with `decision='cancel'` only logs — it doesn't emit `cue:status`. The override path works because `_startCompoundCue()` emits `cue:started`. commandExecutor compensated with a `broadcasts[]` entry for the cancel case, but that was `target:'gm'` (dead code).

**Files:**
- Modify: `backend/src/services/cueEngineService.js` (`resolveConflict` method, line 886-887)
- Modify: `backend/tests/unit/services/cueEngineService.test.js`

**Step 1: Write the failing test**

Add a new `describe` block to `backend/tests/unit/services/cueEngineService.test.js`. Find the existing `resolveConflict` tests or the end of the compound cue tests. Add:

```javascript
  describe('resolveConflict cancel emission', () => {
    it('should emit cue:status with state cancelled when conflict is cancelled', async () => {
      // Setup: load a compound cue with video, create a conflict
      cueEngineService.loadCues([{
        id: 'video-cue',
        label: 'Video Cue',
        timeline: [
          { at: 0, action: 'video:queue:add', payload: { videoFile: 'test.mp4' } }
        ]
      }]);

      // Mock videoQueueService to report video playing (trigger conflict)
      const videoQueueService = require('../../../src/services/videoQueueService');
      videoQueueService.isPlaying = jest.fn().mockReturnValue(true);
      videoQueueService.getCurrentVideo = jest.fn().mockReturnValue({ tokenId: 'existing' });

      // Fire the cue — will create a pending conflict
      await cueEngineService.fireCue('video-cue');

      // Listen for cue:status emission
      const handler = jest.fn();
      cueEngineService.on('cue:status', handler);

      // Resolve with cancel
      await cueEngineService.resolveConflict('video-cue', 'cancel');

      expect(handler).toHaveBeenCalledWith({
        cueId: 'video-cue',
        state: 'cancelled'
      });
    });
  });
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/services/cueEngineService.test.js -t "cancel emission" --verbose 2>&1 | tail -20`

Expected: FAIL — handler not called (cancel path doesn't emit).

**Step 3: Implement the fix**

In `backend/src/services/cueEngineService.js`, in the `resolveConflict` method, add emission after the cancel log (line 887):

```javascript
    // BEFORE:
    } else if (decision === 'cancel') {
      logger.info(`[CueEngine] Conflict resolved (cancel): ${cueId}`);

    // AFTER:
    } else if (decision === 'cancel') {
      logger.info(`[CueEngine] Conflict resolved (cancel): ${cueId}`);
      this.emit('cue:status', { cueId, state: 'cancelled' });
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest tests/unit/services/cueEngineService.test.js -t "cancel emission" --verbose 2>&1 | tail -20`

Expected: PASS.

**Step 5: Commit**

```bash
git add backend/src/services/cueEngineService.js backend/tests/unit/services/cueEngineService.test.js
git commit -m "feat: cueEngineService emits cue:status on conflict cancel

resolveConflict('cancel') now emits cue:status with state:'cancelled'
like the override path does via _startCompoundCue. Fills the last
EventEmitter gap for cue lifecycle commands.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: broadcasts.js — add playlist:changed and display:mode:changed listeners

**Problem:** broadcasts.js has Spotify listeners for `playback:changed`, `volume:changed`, and `connection:changed` — but NOT `playlist:changed`. Also, displayControlService ALREADY emits `display:mode:changed` on every mode switch (lines 131, 178, 234), but broadcasts.js has no listener, so commandExecutor compensated with `target:'all'` broadcasts for `display:mode`.

**Files:**
- Modify: `backend/src/websocket/broadcasts.js` (Spotify section ~line 736, after `connection:changed` listener; and new Display section)
- Modify: `backend/tests/unit/websocket/broadcasts.test.js` (add new test cases)

**Step 1: Write the failing tests**

Add to `backend/tests/unit/websocket/broadcasts.test.js`, as a new describe block. Follow the existing pattern — the test file already has mock services as EventEmitters. You'll need to add `mockSpotifyService` and `mockDisplayControlService` to `beforeEach`:

```javascript
  describe('Spotify playlist:changed listener', () => {
    let mockSpotifyService;

    beforeEach(() => {
      mockSpotifyService = new EventEmitter();
      mockSpotifyService.getState = jest.fn().mockReturnValue({
        connected: true, state: 'playing', volume: 80, pausedByGameClock: false
      });

      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,
        stateService: mockStateService,
        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService,
        spotifyService: mockSpotifyService,
      });
    });

    it('should broadcast spotify:status on playlist:changed', () => {
      mockIo.sockets.adapter.rooms.set('gm', new Set(['socket1']));

      mockSpotifyService.emit('playlist:changed', { uri: 'spotify:playlist:act2' });

      // emitToRoom emits via io.to(room).emit(wrappedEvent)
      expect(mockIo.to).toHaveBeenCalledWith('gm');
      // The chained .emit should be called with 'spotify:status'
      expect(mockIo.emit).toHaveBeenCalledWith(
        'spotify:status',
        expect.objectContaining({
          event: 'spotify:status',
          data: expect.objectContaining({ connected: true, state: 'playing' })
        })
      );
    });
  });

  describe('Display mode:changed listener', () => {
    let mockDisplayControlService;

    beforeEach(() => {
      mockDisplayControlService = new EventEmitter();

      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,
        stateService: mockStateService,
        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService,
        displayControlService: mockDisplayControlService,
      });
    });

    it('should broadcast display:mode on display:mode:changed', () => {
      mockDisplayControlService.emit('display:mode:changed', {
        mode: 'SCOREBOARD',
        previousMode: 'IDLE_LOOP'
      });

      // Should emit display:mode to all clients (not room-scoped)
      expect(mockIo.emit).toHaveBeenCalledWith(
        'display:mode',
        expect.objectContaining({
          event: 'display:mode',
          data: expect.objectContaining({ mode: 'SCOREBOARD' })
        })
      );
    });
  });
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest tests/unit/websocket/broadcasts.test.js --verbose 2>&1 | tail -30`

Expected: 2 new tests FAIL — no listeners registered for these events.

**Step 3: Implement the fix**

In `backend/src/websocket/broadcasts.js`, add the `displayControlService` to the destructured services (line 59):

```javascript
  // BEFORE (line 58-60):
  const { sessionService, stateService, videoQueueService, offlineQueueService, transactionService,
    bluetoothService, audioRoutingService, lightingService, gameClockService, cueEngineService, soundService,
    spotifyService } = services;

  // AFTER:
  const { sessionService, stateService, videoQueueService, offlineQueueService, transactionService,
    bluetoothService, audioRoutingService, lightingService, gameClockService, cueEngineService, soundService,
    spotifyService, displayControlService } = services;
```

Add the `playlist:changed` listener right after the existing `connection:changed` listener (after line 735):

```javascript
    addTrackedListener(spotifyService, 'playlist:changed', () => {
      emitToRoom(io, 'gm', 'spotify:status', spotifyService.getState());
      logger.debug('Broadcasted spotify:status (playlist changed)');
    });
```

Add a new display section after the Spotify section (after line ~740):

```javascript
  // Display mode events
  if (displayControlService) {
    addTrackedListener(displayControlService, 'display:mode:changed', (data) => {
      emitWrapped(io, 'display:mode', data);
      logger.debug('Broadcasted display:mode', { mode: data.mode });
    });
  }
```

**IMPORTANT payload shape note:** displayControlService emits `{mode, previousMode}`. The GM Scanner's `MonitoringDisplay._handleDisplayMode()` reads `payload.mode` — this matches. The old broadcast had `{mode, changedBy}` but `changedBy` was never used by any handler, so dropping it is safe.

**Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest tests/unit/websocket/broadcasts.test.js --verbose 2>&1 | tail -30`

Expected: All tests PASS including the 2 new ones.

**Step 5: Also need to wire displayControlService in app.js setupBroadcastListeners call**

Check where `setupBroadcastListeners` is called and ensure `displayControlService` is passed. Search for the call site:

```bash
cd backend && grep -n "setupBroadcastListeners" src/
```

In each call site, add `displayControlService` to the services object if not already present. The service is already `require`'d at the top of `adminEvents.js` and likely `app.js`.

**Step 6: Commit**

```bash
git add backend/src/websocket/broadcasts.js backend/tests/unit/websocket/broadcasts.test.js
# Also add any files where you added displayControlService to the services object
git commit -m "feat: broadcasts.js handles playlist:changed and display:mode:changed

Adds missing EventEmitter listeners:
- spotifyService playlist:changed → spotify:status broadcast
- displayControlService display:mode:changed → display:mode broadcast

displayControlService was ALREADY emitting display:mode:changed on every
mode switch — broadcasts.js just never had a listener for it.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: adminEvents.js — include result.data in gm:command:ack

**Problem:** The ack payload is `{action, success, message}` — it never includes `result.data`. This means `display:status` can't return display state through the ack, forcing a `target:'socket'` broadcast workaround (which is broken anyway — `display:status` isn't in orchestratorClient's messageTypes). Including `data` in the ack fixes this cleanly.

**Files:**
- Modify: `backend/src/websocket/adminEvents.js` (line 116-120)
- Modify: `backend/tests/unit/websocket/adminEvents-envControl.test.js` (or add a new test)

**Step 1: Write the failing test**

Find the `getAck()` helper in `backend/tests/unit/websocket/adminEvents-envControl.test.js` (line 141-146). Add a test that verifies ack includes data:

```javascript
    it('should include result.data in ack when present', async () => {
      // display:status returns data in result
      const displayControlService = require('../../../src/services/displayControlService');
      displayControlService.getStatus = jest.fn().mockReturnValue({
        currentMode: 'IDLE_LOOP',
        previousMode: 'IDLE_LOOP',
        pendingVideo: null,
        timestamp: new Date().toISOString()
      });

      const data = makeCommandData('display:status', {});

      await handleGmCommand(mockSocket, data, mockIo);

      const ack = getAck();
      expect(ack).not.toBeNull();
      expect(ack.success).toBe(true);
      expect(ack.data).toBeDefined();
      expect(ack.data.displayStatus).toBeDefined();
      expect(ack.data.displayStatus.currentMode).toBe('IDLE_LOOP');
    });
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/websocket/adminEvents-envControl.test.js -t "result.data in ack" --verbose 2>&1 | tail -20`

Expected: FAIL — `ack.data` is undefined (not included in ack payload).

**Step 3: Implement the fix**

In `backend/src/websocket/adminEvents.js`, modify the ack emission (lines 116-120):

```javascript
    // BEFORE:
    emitWrapped(socket, 'gm:command:ack', {
      action: action,
      success: result.success,
      message: result.message
    });

    // AFTER:
    const ackPayload = {
      action: action,
      success: result.success,
      message: result.message
    };
    if (result.data !== undefined && result.data !== null) {
      ackPayload.data = result.data;
    }
    emitWrapped(socket, 'gm:command:ack', ackPayload);
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest tests/unit/websocket/adminEvents-envControl.test.js --verbose 2>&1 | tail -20`

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add backend/src/websocket/adminEvents.js backend/tests/unit/websocket/adminEvents-envControl.test.js
git commit -m "feat: gm:command:ack includes result.data when present

Commands that return data (display:status, sound:play, etc.) now include
it in the ack payload. This enables the GM Scanner to receive command
results through the normal ack flow instead of needing separate broadcast
workarounds.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Remove ALL broadcasts[] from commandExecutor.js

**Problem:** With Tasks 1-4 complete, every broadcast has a proper EventEmitter path. The `broadcasts[]` array in commandExecutor is entirely dead/redundant. Remove it.

**Files:**
- Modify: `backend/src/services/commandExecutor.js` (multiple locations)
- Modify: `backend/tests/unit/services/commandExecutor.test.js` (remove broadcast assertions)

**Step 1: Update tests FIRST — remove broadcast assertions**

In `backend/tests/unit/services/commandExecutor.test.js`:

**a) Spotify tests (lines 554-555):** Remove broadcast assertions from spotify:play test:

```javascript
    // BEFORE:
    it('should execute spotify:play', async () => {
      const result = await executeCommand({ action: 'spotify:play', payload: {}, source: 'gm' });
      expect(result.success).toBe(true);
      expect(spotifyService.play).toHaveBeenCalled();
      expect(result.broadcasts).toBeDefined();
      expect(result.broadcasts[0].event).toBe('spotify:status');
    });

    // AFTER:
    it('should execute spotify:play', async () => {
      const result = await executeCommand({ action: 'spotify:play', payload: {}, source: 'gm' });
      expect(result.success).toBe(true);
      expect(spotifyService.play).toHaveBeenCalled();
    });
```

**b) Cue lifecycle tests (lines 726-727, 752, 777):** Remove broadcast assertions:

```javascript
    // BEFORE (cue:stop):
    it('should execute cue:stop', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');
      const result = await executeCommand({
        action: 'cue:stop',
        payload: { cueId: 'opening' },
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(cueEngineService.stopCue).toHaveBeenCalledWith('opening');
      expect(result.broadcasts[0].event).toBe('cue:status');
      expect(result.broadcasts[0].data.state).toBe('stopped');
    });

    // AFTER (cue:stop):
    it('should execute cue:stop', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');
      const result = await executeCommand({
        action: 'cue:stop',
        payload: { cueId: 'opening' },
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(cueEngineService.stopCue).toHaveBeenCalledWith('opening');
    });
```

Do the same for cue:pause (remove `expect(result.broadcasts[0].data.state).toBe('paused')`) and cue:resume (remove `expect(result.broadcasts[0].data.state).toBe('running')`).

**c) spotify:reconnect test (line 645):** Keep `expect(result.broadcasts).toBeUndefined()` — actually change it to verify broadcasts property doesn't exist at all since we're removing the field entirely. This assertion already passes, so leave it.

Actually, after removing the broadcasts field from the return, `result.broadcasts` WILL be undefined, so this assertion still passes naturally. Leave it.

**Step 2: Run the updated tests to verify they pass (with old production code)**

Run: `cd backend && npx jest tests/unit/services/commandExecutor.test.js --verbose 2>&1 | tail -30`

Expected: All tests PASS — we only removed assertions, not added new ones.

**Step 3: Remove broadcasts[] from commandExecutor.js**

Make these changes in `backend/src/services/commandExecutor.js`:

**a) Remove the `broadcasts` variable declaration (line 53):**
```javascript
    // DELETE this line:
    const broadcasts = []; // Array of {event, data, target} for caller to emit
```

**b) Remove `video:skip` broadcast (lines 156-160):**
```javascript
    // BEFORE:
      case 'video:skip':
        videoQueueService.skipCurrent();
        // Broadcast video:skipped event
        broadcasts.push({
          event: 'video:skipped',
          data: { gmStation: deviceId },
          target: 'all'
        });
        resultMessage = 'Video skipped successfully';

    // AFTER:
      case 'video:skip':
        videoQueueService.skipCurrent();
        resultMessage = 'Video skipped successfully';
```

**c) Remove display command broadcasts. Simplify the `handleDisplayCommand` helper (lines 202-211):**
```javascript
    // BEFORE:
        async function handleDisplayCommand(serviceMethod, modeName, logMessage) {
          const result = await serviceMethod();
          if (!result.success) throw new Error(result.error || `Failed: ${logMessage}`);
          const mode = result.mode || modeName;
          const eventData = { mode, changedBy: deviceId };
          broadcasts.push({ event: 'display:mode', data: eventData, target: 'all' });
          resultData = eventData;
          resultMessage = logMessage;
          logger.info(logMessage, { source, deviceId, mode });
        }

    // AFTER:
        async function handleDisplayCommand(serviceMethod, modeName, logMessage) {
          const result = await serviceMethod();
          if (!result.success) throw new Error(result.error || `Failed: ${logMessage}`);
          const mode = result.mode || modeName;
          resultData = { mode };
          resultMessage = logMessage;
          logger.info(logMessage, { source, deviceId, mode });
        }
```

**d) Remove display:toggle broadcast (lines 232-234):**
```javascript
    // BEFORE:
        } else if (action === 'display:toggle') {
          const toggleResult = await displayControlService.toggleMode();
          if (!toggleResult.success) {
            throw new Error(toggleResult.error || 'Failed to toggle display mode');
          }
          const eventData = { mode: toggleResult.mode, changedBy: deviceId };
          broadcasts.push({ event: 'display:mode', data: eventData, target: 'all' });
          resultData = eventData;
          resultMessage = `Display toggled to ${toggleResult.mode.toLowerCase()}`;

    // AFTER:
        } else if (action === 'display:toggle') {
          const toggleResult = await displayControlService.toggleMode();
          if (!toggleResult.success) {
            throw new Error(toggleResult.error || 'Failed to toggle display mode');
          }
          resultData = { mode: toggleResult.mode };
          resultMessage = `Display toggled to ${toggleResult.mode.toLowerCase()}`;
```

**e) Remove display:status broadcast (lines 245-249):**
```javascript
    // BEFORE:
      case 'display:status': {
        const displayStatus = displayControlService.getStatus();
        // Caller should emit this directly to requesting socket only
        broadcasts.push({
          event: 'display:status',
          data: displayStatus,
          target: 'socket'
        });
        resultData = { displayStatus };

    // AFTER:
      case 'display:status': {
        const displayStatus = displayControlService.getStatus();
        resultData = { displayStatus };
```

**f) Remove broadcasts from cue lifecycle returns (lines 481-518).** Each `cue:stop/pause/resume/conflict:resolve` case does an early `return` with broadcasts. Remove the broadcasts field:

```javascript
    // BEFORE (cue:stop):
      case 'cue:stop': {
        const cueEngineService = require('./cueEngineService');
        const { cueId } = payload;
        if (!cueId) return { success: false, message: 'cueId required', source };
        await cueEngineService.stopCue(cueId);
        return {
          success: true, message: `Cue stopped: ${cueId}`, source,
          broadcasts: [{ event: 'cue:status', data: { cueId, state: 'stopped' }, target: 'gm' }]
        };
      }

    // AFTER (cue:stop):
      case 'cue:stop': {
        const cueEngineService = require('./cueEngineService');
        const { cueId } = payload;
        if (!cueId) return { success: false, message: 'cueId required', source };
        await cueEngineService.stopCue(cueId);
        return { success: true, message: `Cue stopped: ${cueId}`, source };
      }
```

Do the same for `cue:pause`, `cue:resume`, and `cue:conflict:resolve`.

**g) Remove broadcasts from spotify command returns (lines 531-556):**

```javascript
    // BEFORE (spotify transport):
      case 'spotify:play':
      case 'spotify:pause':
      case 'spotify:stop':
      case 'spotify:next':
      case 'spotify:previous': {
        const spotifyService = require('./spotifyService');
        const method = SPOTIFY_TRANSPORT[action];
        await spotifyService[method]();
        return {
          success: true, message: `Spotify: ${method}`, source,
          broadcasts: [{ event: 'spotify:status', data: spotifyService.getState(), target: 'gm' }]
        };
      }

    // AFTER:
      case 'spotify:play':
      case 'spotify:pause':
      case 'spotify:stop':
      case 'spotify:next':
      case 'spotify:previous': {
        const spotifyService = require('./spotifyService');
        const method = SPOTIFY_TRANSPORT[action];
        await spotifyService[method]();
        return { success: true, message: `Spotify: ${method}`, source };
      }
```

Do the same for `spotify:playlist` and `spotify:volume`.

**h) Remove broadcasts from the default return (lines 597-603):**
```javascript
    // BEFORE:
    return {
      success: true,
      message: resultMessage,
      data: resultData,
      source,
      broadcasts
    };

    // AFTER:
    return {
      success: true,
      message: resultMessage,
      data: resultData,
      source
    };
```

**i) Update the JSDoc return type (line 45):**
```javascript
    // BEFORE:
    * @returns {Promise<{success: boolean, message: string, data?: any, source: string, broadcasts?: Array}>}

    // AFTER:
    * @returns {Promise<{success: boolean, message: string, data?: any, source: string}>}
```

**Step 4: Run tests to verify everything passes**

Run: `cd backend && npx jest tests/unit/services/commandExecutor.test.js --verbose 2>&1 | tail -30`

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add backend/src/services/commandExecutor.js backend/tests/unit/services/commandExecutor.test.js
git commit -m "refactor: remove all broadcasts[] from commandExecutor

commandExecutor no longer returns broadcasts[]. All state changes are
now communicated via service EventEmitter → broadcasts.js listeners
(the established Path B pattern).

Removed broadcasts:
- video:skipped (target:all) — dead code, nobody listens
- display:mode (target:all) — replaced by display:mode:changed listener
- display:status (target:socket) — replaced by ack.data
- cue:status (target:gm) — cueEngineService already emits via EventEmitter
- spotify:status (target:gm) — spotifyService already emits via EventEmitter

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Remove broadcast processing loop from adminEvents.js

**Problem:** `adminEvents.js` has a loop (lines 101-113) that iterates over `result.broadcasts` and emits them. With broadcasts removed from commandExecutor, this loop is dead code.

**Files:**
- Modify: `backend/src/websocket/adminEvents.js` (lines 101-113)

**Step 1: Verify no tests depend on the broadcast loop**

Run: `cd backend && grep -rn "broadcasts" tests/unit/websocket/adminEvents*.test.js`

If any tests reference broadcasts, update them. Otherwise proceed.

**Step 2: Remove the broadcast processing loop**

In `backend/src/websocket/adminEvents.js`, delete lines 101-113:

```javascript
    // DELETE this entire block:
    // Handle broadcasts (if any)
    if (result.broadcasts && result.broadcasts.length > 0) {
      for (const broadcast of result.broadcasts) {
        if (broadcast.target === 'all') {
          // Broadcast to sender and all other clients
          emitWrapped(socket, broadcast.event, broadcast.data);
          emitWrapped(socket.broadcast, broadcast.event, broadcast.data);
        } else if (broadcast.target === 'socket') {
          // Send only to requesting socket
          emitWrapped(socket, broadcast.event, broadcast.data);
        }
      }
    }
```

**Step 3: Run tests**

Run: `cd backend && npx jest tests/unit/websocket/ --verbose 2>&1 | tail -30`

Expected: All tests PASS.

**Step 4: Commit**

```bash
git add backend/src/websocket/adminEvents.js
git commit -m "refactor: remove broadcast processing loop from adminEvents

commandExecutor no longer returns broadcasts[], so the loop that
processed them is dead code. All broadcasts now flow through the
EventEmitter → broadcasts.js path exclusively.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Full test suite verification + CLAUDE.md update

**Step 1: Run the full unit test suite**

Run: `cd backend && npm test 2>&1 | tail -30`

Expected: All ~1050 tests pass.

**Step 2: Run integration tests**

Run: `cd backend && npm run test:integration 2>&1 | tail -30`

Expected: All ~256 integration tests pass.

**Step 3: Update backend CLAUDE.md**

In `backend/CLAUDE.md`, update the `commandExecutor` description in the Admin Commands section:

```markdown
**Command Execution:** `commandExecutor.js` contains the shared `executeCommand()` function used by both WebSocket handler (`adminEvents.js`) and cue engine (`cueEngineService.js`). Returns `{success, message, data?, source}`. All WebSocket broadcasting is handled by service EventEmitter events forwarded through `broadcasts.js` — commandExecutor is purely command dispatch logic.
```

Remove the sentence: *The `broadcasts[]` array separates socket emission concerns from command logic.*

Also update the JSDoc-style return type reference if it appears elsewhere.

**Step 4: Commit**

```bash
git add backend/CLAUDE.md
git commit -m "docs: update CLAUDE.md to reflect broadcasts[] removal

commandExecutor return signature no longer includes broadcasts[].
All broadcasting flows through EventEmitter → broadcasts.js.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Verification Checklist

After all tasks complete, verify:

- [ ] `cd backend && npm test` — all unit tests pass
- [ ] `cd backend && npm run test:integration` — all integration tests pass
- [ ] `grep -rn "broadcasts" backend/src/services/commandExecutor.js` — no matches
- [ ] `grep -rn "result\.broadcasts" backend/src/websocket/adminEvents.js` — no matches
- [ ] `grep -rn "target.*gm\|target.*all\|target.*socket" backend/src/services/commandExecutor.js` — no matches
- [ ] `spotifyService.next()` emits `playback:changed`
- [ ] `spotifyService.previous()` emits `playback:changed`
- [ ] `cueEngineService.resolveConflict(id, 'cancel')` emits `cue:status`
- [ ] `broadcasts.js` has listener for `playlist:changed`
- [ ] `broadcasts.js` has listener for `display:mode:changed`
- [ ] `gm:command:ack` includes `data` when `result.data` is present
