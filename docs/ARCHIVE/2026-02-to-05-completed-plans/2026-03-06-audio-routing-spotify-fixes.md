# Audio Routing & Spotify State Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three interconnected bugs: BT sinks not appearing in GM dropdown after connection, HDMI card profiles never activated, and Spotify/VLC D-Bus monitor cross-contamination.

**Architecture:** All three bugs are in the backend orchestrator's service layer. Bug 1 is a missing field in `audioRoutingService.getState()`. Bug 2 is missing HDMI card probing/activation in `audioRoutingService.init()`. Bug 3 is missing sender filtering in `mprisPlayerBase._handleMprisSignal()`. Each fix is isolated to 1-2 files plus tests.

**Tech Stack:** Node.js, PipeWire/PulseAudio (pactl CLI), D-Bus (dbus-send/dbus-monitor), Jest

---

## Bug Summary

| Bug | Symptom | Root Cause | Fix Location |
|-----|---------|------------|--------------|
| 1 | New BT sinks don't appear in GM dropdown until restart | `getState()` omits `availableSinks`; `service:state` push has no sink list | `audioRoutingService.js` |
| 2 | HDMI never shows if projector is off at boot | No code activates HDMI card profiles; `_parsePactlEvent` ignores `card` events | `audioRoutingService.js` |
| 3 | Spotify shows paused when VLC stops | Both MPRIS monitors process all signals without sender filtering | `mprisPlayerBase.js`, `spotifyService.js` |

---

### Task 1: Include `availableSinks` in audio `getState()`

When `sink:added` fires, `broadcasts.js` calls `pushServiceState('audio', audioRoutingService)` which calls `getState()`. But `getState()` returns `{ routes, defaultSink, combineSinkActive, ducking }` — no `availableSinks`. The GM scanner's StateStore shallow-merges this, so the stale sink list from the initial `sync:full` is never updated.

**Files:**
- Modify: `backend/src/services/audioRoutingService.js` — `getState()` method (line ~284), `startSinkMonitor` handler (line ~1059)
- Test: `backend/tests/unit/services/audioRoutingService.test.js`

**Step 1: Write the failing test**

In `audioRoutingService.test.js`, add a `getState()` describe block. The test file uses callback-based `execFile` mocking via `jest.mock('child_process')` — use the existing `mockExecFileSuccess()` helper or `execFile.mockImplementation()`:

```javascript
describe('getState()', () => {
  it('should include availableSinks from cache', async () => {
    // Pre-populate the sink cache by calling getAvailableSinks
    mockExecFileSuccess(
      '1\tsome_hdmi_sink\tPipeWire\ts16le 2ch 48000Hz\tRUNNING\n' +
      '2\tbluez_output.AA_BB_CC_DD_EE_FF.1\tPipeWire\ts16le 2ch 44100Hz\tRUNNING'
    );
    await audioRoutingService.getAvailableSinks();

    const state = audioRoutingService.getState();

    expect(state.availableSinks).toBeDefined();
    expect(state.availableSinks).toHaveLength(2);
    expect(state.availableSinks[0].type).toBe('hdmi');
    expect(state.availableSinks[1].type).toBe('bluetooth');
  });

  it('should filter internal sinks and add combine virtual entry', async () => {
    mockExecFileSuccess(
      '1\tbluez_output.AA_BB.1\tPipeWire\ts16le 2ch 44100Hz\tRUNNING\n' +
      '2\taln-combine\tPipeWire\t\tRUNNING\n' +
      '3\tauto_null\tPipeWire\t\tSUSPENDED'
    );
    await audioRoutingService.getAvailableSinks();

    // Simulate combine-sink active
    audioRoutingService._combineSinkActive = true;

    const state = audioRoutingService.getState();

    // aln-combine and auto_null filtered out, virtual combine added
    expect(state.availableSinks).toHaveLength(2);
    expect(state.availableSinks[0].type).toBe('bluetooth');
    expect(state.availableSinks[1].name).toBe('aln-combine');
    expect(state.availableSinks[1].virtual).toBe(true);
    expect(state.availableSinks[1].label).toBe('All Bluetooth Speakers');
  });

  it('should return empty availableSinks when cache is empty', () => {
    const state = audioRoutingService.getState();
    expect(state.availableSinks).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/services/audioRoutingService.test.js -t "should include availableSinks" --no-coverage`
Expected: FAIL — `state.availableSinks` is `undefined`

**Step 3: Implement — extract shared sink filtering, update `getState()`**

In `audioRoutingService.js`:

1. Extract the sink filtering logic from `getAvailableSinksWithCombine()` into a shared helper `_buildAvailableSinksSnapshot()`:

```javascript
/**
 * Build the GM-facing available sinks list from the current cache.
 * Filters internal sinks and adds virtual combine entry if active.
 * Used by both getState() (sync) and getAvailableSinksWithCombine() (async).
 * @param {Array} rawSinks - Raw sink list (from cache or fresh fetch)
 * @returns {Array} Filtered sink list for GM consumption
 * @private
 */
_buildAvailableSinksSnapshot(rawSinks) {
  let sinks = rawSinks.filter(s =>
    s.name !== 'aln-combine' &&
    s.name !== 'combine-bt' &&
    s.name !== 'auto_null'
  );

  if (this._combineSinkActive) {
    sinks = [...sinks, {
      id: 'virtual-combine',
      name: 'aln-combine',
      driver: 'module-null-sink',
      format: '',
      state: 'RUNNING',
      type: 'combine',
      virtual: true,
      label: 'All Bluetooth Speakers',
    }];
  }

  return sinks;
}
```

2. Update `getAvailableSinksWithCombine()` to use the helper:

```javascript
async getAvailableSinksWithCombine() {
  const sinks = await this.getAvailableSinks();
  return this._buildAvailableSinksSnapshot(sinks);
}
```

3. Update `getState()` to include `availableSinks` from cache:

```javascript
getState() {
  const routes = {};
  for (const [stream, route] of Object.entries(this._routingData.routes)) {
    routes[stream] = typeof route === 'object' ? route.sink : route;
  }
  return {
    routes,
    defaultSink: this._routingData.defaultSink,
    combineSinkActive: this._combineSinkActive,
    ducking: { ...this._activeDuckingSources },
    availableSinks: this._buildAvailableSinksSnapshot(this._sinkCache || []),
  };
}
```

**Step 4: Ensure sink cache is fresh before emitting events**

In `startSinkMonitor()`, refetch sinks before emitting so `getState()` returns fresh data when broadcast listeners fire:

```javascript
this._sinkMonitor.on('line', (line) => {
  const event = this._parsePactlEvent(line);
  if (!event) return;

  if (event.action === 'new' && event.type === 'sink') {
    this._invalidateSinkCache();
    // Re-fetch sinks so getState() has fresh data when listeners fire
    this.getAvailableSinks().then(() => {
      this.emit('sink:added', { id: event.id });
      this._onSinkAdded(event.id);
      this._debouncedBtSinkChanged();
    }).catch(err => {
      logger.warn('Failed to refresh sinks after sink:added', { error: err.message });
      // Still emit event with stale/empty cache
      this.emit('sink:added', { id: event.id });
      this._debouncedBtSinkChanged();
    });
  } else if (event.action === 'remove' && event.type === 'sink') {
    this._invalidateSinkCache();
    this.getAvailableSinks().then(() => {
      this.emit('sink:removed', { id: event.id });
      this._debouncedBtSinkChanged();
    }).catch(err => {
      logger.warn('Failed to refresh sinks after sink:removed', { error: err.message });
      this.emit('sink:removed', { id: event.id });
      this._debouncedBtSinkChanged();
    });
  }
});
```

**Step 5: Update existing `startSinkMonitor` tests for async event emission**

Step 4 changes `sink:added`/`sink:removed` from synchronous to asynchronous emission (events now fire inside `.then()` after `getAvailableSinks()` resolves). Existing tests that assert synchronous event emission will break:

- `'should emit sink:added on new sink event'` (line ~641)
- `'should emit sink:removed on remove sink event'` (line ~658)

These tests currently do:
```javascript
mockProc.stdout.emit('data', Buffer.from("Event 'new' on sink #89\n"));
expect(handler).toHaveBeenCalledWith(...); // synchronous assertion — now fails
```

Fix: make them async, mock `execFile` for the `getAvailableSinks` call, then await the microtask:
```javascript
it('should emit sink:added on new sink event', async () => {
  const mockProc = createMockSpawnProc();
  spawn.mockReturnValue(mockProc);

  // Mock the getAvailableSinks call that now runs before emit
  mockExecFileSuccess('89\tbluez_output.AA_BB.1\tPipeWire\ts16le 2ch 44100Hz\tIDLE');

  const handler = jest.fn();
  audioRoutingService.on('sink:added', handler);

  audioRoutingService.startSinkMonitor();
  mockProc.stdout.emit('data', Buffer.from("Event 'new' on sink #89\n"));

  // Wait for async getAvailableSinks().then() to complete
  await new Promise(resolve => setTimeout(resolve, 50));

  expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: '89' }));
});
```

Apply the same pattern to the `sink:removed` test. The existing async tests (`'should auto-apply routing...'` at line ~691) already use `await new Promise(resolve => setTimeout(resolve, 50))` and should continue to work.

**Step 6: Run tests to verify they pass**

Run: `cd backend && npx jest tests/unit/services/audioRoutingService.test.js --no-coverage`
Expected: ALL PASS

**Step 7: Commit**

```bash
git add backend/src/services/audioRoutingService.js backend/tests/unit/services/audioRoutingService.test.js
git commit -m "fix(audio): include availableSinks in getState() for service:state pushes

sink:added/removed events triggered service:state broadcasts, but getState()
omitted availableSinks. GM dropdown only updated on sync:full (reconnect).
Now getState() includes filtered sink list from cache, and sink events
re-fetch before emitting so cache is fresh for broadcast listeners."
```

---

### Task 2: Activate HDMI card profiles on init + monitor card events

Both HDMI cards have `api.acp.auto-profile = "false"`, so PipeWire never auto-activates them. If the projector is off at boot, profile stays `off` and no HDMI sink is created. No code in `audioRoutingService` ever calls `pactl set-card-profile`. Additionally, `_parsePactlEvent()` regex doesn't match `card` events, so HDMI hotplug card changes are silently dropped.

**Files:**
- Modify: `backend/src/services/audioRoutingService.js` — `init()`, `_parsePactlEvent()`, new `_activateHdmiCards()` and `_onCardChanged()`
- Test: `backend/tests/unit/services/audioRoutingService.test.js`

**Step 1: Write the failing tests**

The test file mocks `child_process.execFile` (callback-based) via `jest.mock('child_process')`, and `persistenceService` is mocked separately via `jest.mock(...)`. The existing `init()` tests use a `mockExecFileForInit()` helper that switches on `cmd`. Follow this pattern:

```javascript
describe('HDMI card activation', () => {
  it('should activate HDMI cards with off profile on init', async () => {
    persistenceService.load.mockResolvedValue(null);

    // Route execFile calls based on command + args
    execFile.mockImplementation((cmd, args, opts, cb) => {
      if (cmd === 'pgrep' || cmd === 'pkill') {
        cb(new Error('no matches'), '', '');
        return;
      }
      // _activateHdmiCards: list cards short
      if (cmd === 'pactl' && args[0] === 'list' && args[1] === 'cards') {
        cb(null,
          '59\talsa_card.platform-107c701400.hdmi\talsa\n' +
          '60\talsa_card.platform-107c706400.hdmi\talsa\n' +
          '80\tbluez_card.AA_BB_CC_DD_EE_FF\tmodule-bluez5-device.c',
          '');
        return;
      }
      // _activateHdmiCards: set-card-profile
      if (cmd === 'pactl' && args[0] === 'set-card-profile') {
        cb(null, '', '');
        return;
      }
      cb(null, '', '');
    });
    const mockProc = createMockSpawnProc();
    spawn.mockReturnValue(mockProc);

    await audioRoutingService.init();

    // Verify set-card-profile was called for both HDMI cards
    const setCalls = execFile.mock.calls.filter(
      c => c[0] === 'pactl' && c[1]?.[0] === 'set-card-profile'
    );
    expect(setCalls).toHaveLength(2);
    expect(setCalls[0][1]).toEqual(['set-card-profile', 'alsa_card.platform-107c701400.hdmi', 'pro-audio']);
    expect(setCalls[1][1]).toEqual(['set-card-profile', 'alsa_card.platform-107c706400.hdmi', 'pro-audio']);
  });

  it('should handle HDMI card activation failure gracefully', async () => {
    persistenceService.load.mockResolvedValue(null);

    execFile.mockImplementation((cmd, args, opts, cb) => {
      if (cmd === 'pgrep' || cmd === 'pkill') {
        cb(new Error('no matches'), '', '');
        return;
      }
      if (cmd === 'pactl' && args[0] === 'list' && args[1] === 'cards') {
        cb(null, '59\talsa_card.platform-107c701400.hdmi\talsa', '');
        return;
      }
      if (cmd === 'pactl' && args[0] === 'set-card-profile') {
        cb(new Error('Sink not available'), '', '');
        return;
      }
      cb(null, '', '');
    });
    const mockProc = createMockSpawnProc();
    spawn.mockReturnValue(mockProc);

    // Should not throw
    await expect(audioRoutingService.init()).resolves.not.toThrow();
  });
});
```

Also add a `_parsePactlEvent` test in the existing `_parsePactlEvent()` describe block:

```javascript
it('should parse card events', () => {
  expect(audioRoutingService._parsePactlEvent("Event 'change' on card #59")).toEqual({
    action: 'change', type: 'card', id: '59',
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest tests/unit/services/audioRoutingService.test.js -t "HDMI card activation" --no-coverage`
Expected: FAIL

**Step 3: Implement HDMI card activation**

Add to `audioRoutingService.js`:

```javascript
/**
 * Probe PipeWire cards and activate any HDMI cards with profile 'off'.
 * Called from init() to handle boot-without-projector scenario.
 * Errors are non-fatal — gracefully degraded (no HDMI sink available).
 * @private
 */
async _activateHdmiCards() {
  try {
    const stdout = await this._execFile('pactl', ['list', 'cards', 'short']);
    if (!stdout.trim()) return;

    for (const line of stdout.trim().split('\n')) {
      const parts = line.split('\t');
      if (parts.length < 2) continue;
      const cardName = parts[1];

      if (cardName.includes('hdmi')) {
        try {
          await this._execFile('pactl', ['set-card-profile', cardName, 'pro-audio']);
          logger.info('Activated HDMI card profile', { cardName });
        } catch (err) {
          logger.debug('Could not activate HDMI card profile (may not be connected)', {
            cardName, error: err.message,
          });
        }
      }
    }
  } catch (err) {
    logger.warn('Failed to probe HDMI cards', { error: err.message });
  }
}
```

Update `init()` to call it after killing stale monitors:

```javascript
async init() {
  await this._killStaleMonitors();

  // Activate HDMI card profiles (handles boot-without-projector)
  await this._activateHdmiCards();

  // Load persisted routing config
  // ... rest of existing init code
}
```

**Step 4: Add `card` to `_parsePactlEvent` regex and handle card changes**

Update the regex:

```javascript
_parsePactlEvent(line) {
  const match = line.match(/^Event '(\w+)' on (sink|source|sink-input|source-output|card) #(\d+)$/);
  if (!match) return null;
  return { action: match[1], type: match[2], id: match[3] };
}
```

Add card event handling in `startSinkMonitor()` (add to the existing `line` handler, after the sink remove block):

```javascript
// Card events — re-activate HDMI if card profile changed (e.g., projector hotplug)
if (event.action === 'change' && event.type === 'card') {
  this._activateHdmiCards().catch(err => {
    logger.debug('Card change HDMI activation check failed', { error: err.message });
  });
}
```

**Step 5: Run tests to verify they pass**

Run: `cd backend && npx jest tests/unit/services/audioRoutingService.test.js --no-coverage`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add backend/src/services/audioRoutingService.js backend/tests/unit/services/audioRoutingService.test.js
git commit -m "fix(audio): activate HDMI card profiles on init and card hotplug

Pi boots with HDMI card profile 'off' when projector is not on.
audioRoutingService now probes PipeWire cards on init and activates
HDMI profiles. Also adds 'card' to pactl subscribe event regex so
projector hotplug triggers re-activation."
```

---

### Task 3: Filter MPRIS D-Bus signals by sender to prevent cross-contamination

Both VLC and Spotify MPRIS monitors use the same dbus-monitor match rule (`path='/org/mpris/MediaPlayer2'`). Both receive ALL MPRIS PropertiesChanged signals from ALL players. Neither filters by sender. When VLC stops, Spotify's monitor processes the signal and sets `spotifyService.state = 'stopped'`.

`DbusSignalParser` already extracts `sender` (unique bus name like `:1.27`) from signal headers (line 83-84 of `dbusSignalParser.js`). The fix: resolve each service's well-known D-Bus name to its unique bus name, then filter in `_handleMprisSignal`.

**Files:**
- Modify: `backend/src/services/mprisPlayerBase.js` — add `_resolveOwner()`, filter in `_handleMprisSignal()`
- Modify: `backend/src/services/spotifyService.js` — call `_resolveOwner()` after discovery
- Test: `backend/tests/unit/services/mprisPlayerBase.test.js`
- Test: `backend/tests/unit/services/spotifyService.test.js`

**Step 1: Write the failing test for sender filtering**

The test file uses `jest.useFakeTimers()` (in `beforeEach`) and a `createTestPlayer()` helper that creates a concrete subclass with `_processStateChange` that handles `PlaybackStatus` and `Volume`. The debounce is set to 50ms. Add these tests inside the top-level `describe('MprisPlayerBase')` block:

```javascript
describe('MPRIS signal sender filtering', () => {
  it('should ignore signals from unknown senders when owner is resolved', () => {
    const player = createTestPlayer();
    player._ownerBusName = ':1.50';

    player._handleMprisSignal({
      changedInterface: 'org.mpris.MediaPlayer2.Player',
      sender: ':1.99',
      properties: { PlaybackStatus: 'Playing' },
      raw: '',
    });

    jest.advanceTimersByTime(100);

    // State should NOT change (signal was from wrong sender)
    expect(player.state).toBe('stopped'); // default initial state, unchanged
  });

  it('should process signals from matching sender', () => {
    const player = createTestPlayer();
    player._ownerBusName = ':1.50';

    player._handleMprisSignal({
      changedInterface: 'org.mpris.MediaPlayer2.Player',
      sender: ':1.50',
      properties: { PlaybackStatus: 'Playing' },
      raw: '',
    });

    jest.advanceTimersByTime(100);

    expect(player.state).toBe('playing');
  });

  it('should process all signals when owner is not resolved (null)', () => {
    const player = createTestPlayer();
    // _ownerBusName defaults to null after constructor change

    player._handleMprisSignal({
      changedInterface: 'org.mpris.MediaPlayer2.Player',
      sender: ':1.99',
      properties: { PlaybackStatus: 'Playing' },
      raw: '',
    });

    jest.advanceTimersByTime(100);

    expect(player.state).toBe('playing');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/services/mprisPlayerBase.test.js -t "sender filtering" --no-coverage`
Expected: FAIL — `_ownerBusName` does not exist / signal not filtered

**Step 3: Implement sender filtering in MprisPlayerBase**

In `mprisPlayerBase.js`:

1. Add `_ownerBusName` to constructor:

```javascript
constructor({ destination, label, healthServiceId, signalDebounceMs = 300 }) {
  super();
  // ... existing fields ...
  this._ownerBusName = null; // Unique D-Bus name for sender filtering
}
```

2. Add `_resolveOwner()` method:

```javascript
/**
 * Resolve our well-known D-Bus destination to its unique bus name.
 * Used for sender filtering in _handleMprisSignal to prevent
 * cross-contamination between MPRIS players (e.g., VLC vs Spotify).
 * Non-fatal: if resolution fails, _ownerBusName stays null and
 * all signals are processed (fallback to pre-filter behavior).
 */
async _resolveOwner() {
  const dest = this._getDestination();
  if (!dest) {
    this._ownerBusName = null;
    return;
  }
  try {
    const { stdout } = await execFileAsync('dbus-send', [
      '--session', '--type=method_call', '--print-reply',
      '--dest=org.freedesktop.DBus', '/org/freedesktop/DBus',
      'org.freedesktop.DBus.GetNameOwner', `string:${dest}`
    ], { timeout: 2000 });
    const match = stdout.match(/string "([^"]+)"/);
    this._ownerBusName = match ? match[1] : null;
    if (this._ownerBusName) {
      logger.debug(`[${this._label}] Resolved D-Bus owner`, {
        destination: dest, owner: this._ownerBusName,
      });
    }
  } catch {
    this._ownerBusName = null;
  }
}
```

3. Add sender filter to `_handleMprisSignal()`:

```javascript
_handleMprisSignal(signal) {
  if (signal.changedInterface !== 'org.mpris.MediaPlayer2.Player') return;

  // Filter by sender to prevent cross-contamination between MPRIS players.
  // If _ownerBusName is null (not yet resolved), process all signals (safe fallback).
  if (this._ownerBusName && signal.sender && signal.sender !== this._ownerBusName) return;

  // ... existing debounce logic unchanged ...
}
```

4. Add `_ownerBusName = null` to `reset()`:

```javascript
reset() {
  this.stopPlaybackMonitor();
  registry.report(this._healthServiceId, 'down', 'Reset');
  this.state = 'stopped';
  this.volume = 100;
  this.track = null;
  this._ownerBusName = null;
}
```

**Step 4: Call `_resolveOwner()` from VLC init**

VLC has a static destination (`org.mpris.MediaPlayer2.vlc`). In `vlcMprisService.js` `init()` (line ~176), the current flow is:

```javascript
async init() {
  this._vlcStopped = false;
  this._spawnVlcProcess();
  const ready = await this._waitForVlcReady();
  // ... logging ...
  this.startPlaybackMonitor();
}
```

Add `_resolveOwner()` after `startPlaybackMonitor()`:

```javascript
  this.startPlaybackMonitor();

  // Resolve unique bus name for D-Bus signal sender filtering
  await this._resolveOwner();
```

If VLC wasn't ready (`ready === false`), `_resolveOwner()` will fail silently and `_ownerBusName` stays `null` — all signals are processed (safe fallback). The owner will be re-resolved next time `checkConnection()` succeeds (see health check interval).

**Step 5: Call `_resolveOwner()` from Spotify after discovery**

In `spotifyService.js`, update `_discoverDbusDest()` to resolve owner after successful discovery:

```javascript
async _discoverDbusDest() {
  const dest = await this._discoverDest('_dbusDest', '_dbusCacheTime', 'org\\.mpris\\.MediaPlayer2\\.spotifyd', 'MPRIS');
  // Resolve unique bus name for signal filtering
  if (dest) await this._resolveOwner();
  return dest;
}
```

Also clear `_ownerBusName` in the recovery path where caches are cleared. In `_dbusCall` recovery block (line ~125 of `spotifyService.js`), add after clearing caches (`this._spotifydCacheTime = 0;`):

```javascript
this._ownerBusName = null; // Force re-resolution after recovery
```

Note: `reset()` already clears `_ownerBusName` via `super.reset()` after the base class change. The recovery clear is belt-and-suspenders — the subsequent `_discoverDbusDest()` call in the retry path will call `_resolveOwner()` anyway, but the explicit clear ensures stale owner data is never used.

**Step 6: Run tests to verify they pass**

Run: `cd backend && npx jest tests/unit/services/mprisPlayerBase.test.js tests/unit/services/spotifyService.test.js tests/unit/services/vlcMprisService.test.js --no-coverage`
Expected: ALL PASS

**Step 7: Commit**

```bash
git add backend/src/services/mprisPlayerBase.js backend/src/services/spotifyService.js backend/src/services/vlcMprisService.js backend/tests/unit/services/mprisPlayerBase.test.js backend/tests/unit/services/spotifyService.test.js
git commit -m "fix(mpris): filter D-Bus signals by sender to prevent cross-contamination

Both VLC and Spotify MPRIS monitors received ALL signals from ALL players.
VLC stopping would contaminate Spotify state (and vice versa). Now each
service resolves its D-Bus destination to a unique bus name and filters
signals by sender. Falls back to processing all signals if resolution fails."
```

---

### Task 4: Integration verification

**Step 1: Run full unit test suite**

```bash
cd backend && npm test
```

Expected: All ~1468 tests pass. Watch for regressions in:
- `audioRoutingService.test.js` — `startSinkMonitor` tests that assert synchronous `sink:added`/`sink:removed` must be updated for async emission (see Task 1 Step 5). Also `getState.test.js` uses `toHaveProperty` so the new `availableSinks` field won't break existing assertions.
- `mprisPlayerBase.test.js` — new `_ownerBusName` field in constructor; existing `reset()` test may need updated assertion
- `spotifyService.test.js` — `_discoverDbusDest` now calls `_resolveOwner`; mock `execFile` for the `GetNameOwner` call or it will fail silently (non-fatal, but may cause spurious error logs in test output)

**Step 2: Run integration tests**

```bash
cd backend && npx jest --config jest.integration.config.js
```

Watch for failures in `external-state-propagation.test.js` which tests `service:state` delivery.

**Step 3: Live verification on running system**

```bash
# 1. Verify HDMI activation
pactl list cards short | grep hdmi
# Expected: Both HDMI cards listed

pactl list sinks short | grep -i hdmi
# Expected: At least one HDMI sink (if projector is on)

# 2. Verify BT sink appears in service:state
# Connect a BT speaker, then check logs:
pm2 logs aln-orchestrator --lines 20 --nostream | grep -i 'sink:added'
# Then check GM scanner dropdown updates without reconnect

# 3. Verify Spotify sender filtering
pm2 logs aln-orchestrator --lines 20 --nostream | grep -i 'Resolved D-Bus owner'
# Expected: Both VLC and Spotify owner resolutions logged

# 4. Verify no cross-contamination
# Play Spotify, then trigger a VLC video — Spotify state should stay 'playing'
```

**Step 4: Commit any test fixes**

If integration tests need adjustments (e.g., `getState()` shape assertions), fix and commit.

---

## Key Files Reference

| File | Role |
|------|------|
| `backend/src/services/audioRoutingService.js` | Sink discovery, routing, HDMI activation |
| `backend/src/services/mprisPlayerBase.js` | Shared MPRIS D-Bus monitor base class |
| `backend/src/services/spotifyService.js` | Spotify D-Bus destination discovery |
| `backend/src/services/vlcMprisService.js` | VLC MPRIS service (static destination) |
| `backend/src/utils/dbusSignalParser.js` | Already extracts `sender` — no changes needed |
| `backend/src/websocket/broadcasts.js` | `pushServiceState` calls `getState()` — no changes needed |
| `ALNScanner/src/core/stateStore.js` | Shallow merges `service:state` — no changes needed |
| `ALNScanner/src/ui/renderers/EnvironmentRenderer.js` | Reads `availableSinks` from audio state — no changes needed |
