# Spotify TransferPlayback + Device Sync Fixes

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix two issues: (1) Spotify reconnect does nothing because spotifyService only knows MPRIS (not the native `rs.spotifyd.Controls` D-Bus interface with `TransferPlayback`), and (2) disconnected devices reappear in sync:full payloads because two emission paths don't filter to connected-only.

**Architecture:** spotifyd exposes two sequential D-Bus interfaces. On startup, the native `rs.spotifyd.Controls` interface registers with `TransferPlayback` (activates Spotify Connect). After activation, the MPRIS interface registers for media controls (Play/Pause/Stop/Next/etc). Our fix adds two-tier D-Bus discovery, an `activate()` method for TransferPlayback, and reactive recovery in `_dbusCall()`. The device fix adds `connectedOnly: true` filtering to two `buildSyncFullPayload()` call sites that currently send all devices including disconnected ones.

**Tech Stack:** Node.js, D-Bus (dbus-send CLI), Jest, child_process

---

## Part A: Device sync:full Filtering Fix

### Task 1: Add connectedOnly filter to scores:reset sync:full

**Files:**
- Modify: `backend/src/websocket/broadcasts.js` (line 323)
- Test: `backend/tests/unit/websocket/broadcasts.test.js`

**Step 1: Write the failing test**

Add a test that verifies the `scores:reset` handler passes `deviceFilter: { connectedOnly: true }` to `buildSyncFullPayload()`.

Find the existing `scores:reset` test section in `broadcasts.test.js`. If no test exists for the sync:full payload shape after scores:reset, add one. The test should spy on `buildSyncFullPayload` (or verify the emitted payload only contains connected devices).

Since `buildSyncFullPayload` is called internally, the simplest approach is to verify end behavior: set up a session with both connected and disconnected devices, trigger scores:reset, and assert the sync:full payload only contains connected devices.

However, the most practical test is to verify the call argument. Find how other tests verify `buildSyncFullPayload` args, or add a targeted unit test:

```javascript
it('should filter to connected devices only in sync:full after scores:reset', async () => {
  // The scores:reset handler should pass deviceFilter: { connectedOnly: true }
  // to buildSyncFullPayload, matching the pattern used in gmAuth.js
  // Verify by checking the emitted sync:full payload excludes disconnected devices
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/websocket/broadcasts.test.js --no-coverage -t "scores:reset" 2>&1 | tail -20`

Expected: FAIL (currently no connectedOnly filter, so disconnected devices appear)

**Step 3: Add connectedOnly filter to scores:reset**

In `backend/src/websocket/broadcasts.js`, find the `buildSyncFullPayload` call at line 323 (inside the `scores:reset` handler). Add the `deviceFilter` option:

```javascript
// BEFORE (line 323):
const syncFullPayload = await buildSyncFullPayload({
  sessionService,
  transactionService,
  videoQueueService,
  offlineQueueService,
  bluetoothService,
  audioRoutingService,
  lightingService,
  gameClockService,
  cueEngineService,
  spotifyService,
});

// AFTER:
const syncFullPayload = await buildSyncFullPayload({
  sessionService,
  transactionService,
  videoQueueService,
  offlineQueueService,
  bluetoothService,
  audioRoutingService,
  lightingService,
  gameClockService,
  cueEngineService,
  spotifyService,
  deviceFilter: { connectedOnly: true },
});
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/unit/websocket/broadcasts.test.js --no-coverage -t "scores:reset" 2>&1 | tail -20`

Expected: PASS

**Step 5: Do the same for offline:queue:processed**

Find the second `buildSyncFullPayload` call at line 502 (inside the `offline:queue:processed` handler). Add the same `deviceFilter: { connectedOnly: true }` option. Pattern is identical to Step 3.

```javascript
// BEFORE (line 502):
const syncFullPayload = await buildSyncFullPayload({
  sessionService,
  transactionService,
  videoQueueService,
  offlineQueueService,
  bluetoothService,
  audioRoutingService,
  lightingService,
  gameClockService,
  cueEngineService,
  spotifyService,
});

// AFTER:
const syncFullPayload = await buildSyncFullPayload({
  sessionService,
  transactionService,
  videoQueueService,
  offlineQueueService,
  bluetoothService,
  audioRoutingService,
  lightingService,
  gameClockService,
  cueEngineService,
  spotifyService,
  deviceFilter: { connectedOnly: true },
});
```

**Step 6: Run full broadcast tests**

Run: `cd backend && npx jest tests/unit/websocket/broadcasts.test.js --no-coverage 2>&1 | tail -20`

Expected: All tests PASS

**Step 7: Commit**

```bash
cd backend && git add src/websocket/broadcasts.js tests/unit/websocket/broadcasts.test.js
git commit -m "fix: filter disconnected devices from sync:full in scores:reset and offline:queue:processed"
```

---

## Part B: Spotify Two-Tier D-Bus Discovery

### Task 2: Add shared `_findDbusDest(pattern)` helper

**Files:**
- Modify: `backend/src/services/spotifyService.js`
- Test: `backend/tests/unit/services/spotifyService.test.js`

**Context:** spotifyd registers two D-Bus names:
- Native: `rs.spotifyd.instance{PID}` — has `TransferPlayback`, `VolumeUp`, `VolumeDown`
- MPRIS: `org.mpris.MediaPlayer2.spotifyd.instance{PID}` — has Play/Pause/Stop/Next/Previous/OpenUri/Volume

Currently `_discoverDbusDest()` only finds the MPRIS name. We need a shared helper that can find either.

**Step 1: Write the failing test for `_findDbusDest`**

In `backend/tests/unit/services/spotifyService.test.js`, add a new `describe('_findDbusDest')` block:

```javascript
describe('_findDbusDest', () => {
  it('should find D-Bus name matching pattern', async () => {
    spotifyService._dbusDest = null;
    const listNamesOutput = `array [\n  string "org.freedesktop.DBus"\n  string "rs.spotifyd.instance12345"\n  string "org.mpris.MediaPlayer2.spotifyd.instance12345"\n]`;
    execFile.mockImplementation((cmd, args, opts, cb) => {
      cb(null, listNamesOutput, '');
    });

    const result = await spotifyService._findDbusDest('rs\\.spotifyd\\.');
    expect(result).toBe('rs.spotifyd.instance12345');
  });

  it('should return null when no match found', async () => {
    const listNamesOutput = `array [\n  string "org.freedesktop.DBus"\n]`;
    execFile.mockImplementation((cmd, args, opts, cb) => {
      cb(null, listNamesOutput, '');
    });

    const result = await spotifyService._findDbusDest('rs\\.spotifyd\\.');
    expect(result).toBeNull();
  });

  it('should return null on D-Bus error', async () => {
    mockExecFileError('Connection refused');

    const result = await spotifyService._findDbusDest('rs\\.spotifyd\\.');
    expect(result).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/services/spotifyService.test.js --no-coverage -t "_findDbusDest" 2>&1 | tail -20`

Expected: FAIL — `_findDbusDest` is not a function

**Step 3: Implement `_findDbusDest(pattern)`**

In `backend/src/services/spotifyService.js`, add this method to the `SpotifyService` class (after constructor, before `_discoverDbusDest`):

```javascript
/**
 * Find a D-Bus destination name matching the given regex pattern.
 * Shared helper used by both MPRIS and native spotifyd discovery.
 * @param {string} pattern - Regex pattern to match against D-Bus names
 * @returns {Promise<string|null>} Matching D-Bus name or null
 */
async _findDbusDest(pattern) {
  try {
    const { stdout } = await execFileAsync('dbus-send', [
      '--session', '--type=method_call', '--print-reply',
      '--dest=org.freedesktop.DBus', '/org/freedesktop/DBus',
      'org.freedesktop.DBus.ListNames'
    ], { timeout: 3000 });
    const re = new RegExp(`"(${pattern}[^"]*)"`);
    const match = stdout.match(re);
    return match ? match[1] : null;
  } catch (err) {
    logger.debug(`[Spotify] D-Bus discovery failed for pattern ${pattern}:`, err.message);
    return null;
  }
}
```

**Step 4: Refactor `_discoverDbusDest` to use `_findDbusDest`**

Replace the existing `_discoverDbusDest` method body to delegate:

```javascript
async _discoverDbusDest() {
  if (this._dbusDest) return this._dbusDest;
  const dest = await this._findDbusDest('org\\.mpris\\.MediaPlayer2\\.spotifyd');
  if (dest) {
    this._dbusDest = dest;
    logger.debug(`[Spotify] Discovered MPRIS dest: ${this._dbusDest}`);
  }
  return this._dbusDest;
}
```

**Step 5: Run tests to verify they pass**

Run: `cd backend && npx jest tests/unit/services/spotifyService.test.js --no-coverage 2>&1 | tail -20`

Expected: ALL tests PASS (new `_findDbusDest` tests + existing `_discoverDbusDest` tests unchanged)

**Step 6: Commit**

```bash
cd backend && git add src/services/spotifyService.js tests/unit/services/spotifyService.test.js
git commit -m "refactor: extract _findDbusDest shared helper from _discoverDbusDest"
```

---

### Task 3: Add `_discoverSpotifydDest()` for native interface

**Files:**
- Modify: `backend/src/services/spotifyService.js`
- Test: `backend/tests/unit/services/spotifyService.test.js`

**Context:** The native `rs.spotifyd.instance{PID}` interface provides `TransferPlayback` which is needed to activate Spotify Connect (make this device the active player). This interface appears immediately when spotifyd starts, before MPRIS registers.

**Step 1: Write the failing tests**

Add to `backend/tests/unit/services/spotifyService.test.js`:

```javascript
describe('_discoverSpotifydDest', () => {
  it('should find native spotifyd D-Bus name', async () => {
    spotifyService._spotifydDest = null;
    const listNamesOutput = `array [\n  string "org.freedesktop.DBus"\n  string "rs.spotifyd.instance12345"\n]`;
    execFile.mockImplementation((cmd, args, opts, cb) => {
      cb(null, listNamesOutput, '');
    });

    const result = await spotifyService._discoverSpotifydDest();
    expect(result).toBe('rs.spotifyd.instance12345');
  });

  it('should cache the discovered destination', async () => {
    spotifyService._spotifydDest = null;
    const listNamesOutput = `array [\n  string "rs.spotifyd.instance99"\n]`;
    execFile.mockImplementation((cmd, args, opts, cb) => {
      cb(null, listNamesOutput, '');
    });

    await spotifyService._discoverSpotifydDest();
    execFile.mockClear();

    const result = await spotifyService._discoverSpotifydDest();
    expect(result).toBe('rs.spotifyd.instance99');
    expect(execFile).not.toHaveBeenCalled(); // Used cache
  });

  it('should return null when spotifyd not on D-Bus', async () => {
    spotifyService._spotifydDest = null;
    const listNamesOutput = `array [\n  string "org.freedesktop.DBus"\n]`;
    execFile.mockImplementation((cmd, args, opts, cb) => {
      cb(null, listNamesOutput, '');
    });

    const result = await spotifyService._discoverSpotifydDest();
    expect(result).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/services/spotifyService.test.js --no-coverage -t "_discoverSpotifydDest" 2>&1 | tail -20`

Expected: FAIL — `_discoverSpotifydDest` is not a function

**Step 3: Implement `_discoverSpotifydDest()`**

In `backend/src/services/spotifyService.js`:

1. Add `this._spotifydDest = null;` to the constructor (after `this._dbusDest = null;`)

2. Add the new constant after the existing `PLAYER_IFACE` line:

```javascript
const SPOTIFYD_IFACE = 'rs.spotifyd.Controls';
```

3. Add the method after `_discoverDbusDest()`:

```javascript
/**
 * Discover native spotifyd D-Bus destination (rs.spotifyd.instance{PID}).
 * This interface provides TransferPlayback for Spotify Connect activation.
 * @returns {Promise<string|null>}
 */
async _discoverSpotifydDest() {
  if (this._spotifydDest) return this._spotifydDest;
  const dest = await this._findDbusDest('rs\\.spotifyd\\.');
  if (dest) {
    this._spotifydDest = dest;
    logger.debug(`[Spotify] Discovered native dest: ${this._spotifydDest}`);
  }
  return this._spotifydDest;
}
```

**Step 4: Clear `_spotifydDest` in `reset()`**

In the `reset()` method, add `this._spotifydDest = null;` after `this._dbusDest = null;`:

```javascript
reset() {
  this.connected = false;
  this.state = 'stopped';
  this.volume = 100;
  this._pausedByGameClock = false;
  this._dbusDest = null;
  this._spotifydDest = null; // Re-discover on next call (PID may change after restart)
}
```

**Step 5: Run tests to verify they pass**

Run: `cd backend && npx jest tests/unit/services/spotifyService.test.js --no-coverage 2>&1 | tail -20`

Expected: ALL tests PASS

**Step 6: Commit**

```bash
cd backend && git add src/services/spotifyService.js tests/unit/services/spotifyService.test.js
git commit -m "feat: add _discoverSpotifydDest for native spotifyd D-Bus interface"
```

---

### Task 4: Add `activate()` method

**Files:**
- Modify: `backend/src/services/spotifyService.js`
- Test: `backend/tests/unit/services/spotifyService.test.js`

**Context:** `activate()` calls `TransferPlayback` on the native interface to make this device the active Spotify Connect player, then waits briefly for MPRIS to register, and checks connection status. This is the method that actually "reconnects" Spotify.

**Step 1: Write the failing tests**

Add to `backend/tests/unit/services/spotifyService.test.js`:

```javascript
describe('activate', () => {
  it('should call TransferPlayback via native D-Bus interface', async () => {
    spotifyService._spotifydDest = 'rs.spotifyd.instance123';
    // First call: TransferPlayback, second call: checkConnection (Properties.Get)
    let callCount = 0;
    execFile.mockImplementation((cmd, args, opts, cb) => {
      callCount++;
      if (callCount === 1) {
        // Verify TransferPlayback call uses native dest
        expect(args).toContain('--dest=rs.spotifyd.instance123');
        expect(args).toContain('rs.spotifyd.Controls.TransferPlayback');
        cb(null, '', '');
      } else {
        // checkConnection call
        cb(null, 'variant       string "Playing"', '');
      }
    });

    const result = await spotifyService.activate();
    expect(result).toBe(true);
    expect(spotifyService.connected).toBe(true);
  });

  it('should discover native dest if not cached', async () => {
    spotifyService._spotifydDest = null;
    const listNamesOutput = `array [\n  string "rs.spotifyd.instance456"\n]`;
    let callCount = 0;
    execFile.mockImplementation((cmd, args, opts, cb) => {
      callCount++;
      if (callCount === 1) {
        // Discovery call
        cb(null, listNamesOutput, '');
      } else if (callCount === 2) {
        // TransferPlayback call
        cb(null, '', '');
      } else {
        // checkConnection call
        cb(null, 'variant       string "Paused"', '');
      }
    });

    const result = await spotifyService.activate();
    expect(result).toBe(true);
    expect(spotifyService._spotifydDest).toBe('rs.spotifyd.instance456');
  });

  it('should return false when spotifyd not found', async () => {
    spotifyService._spotifydDest = null;
    const listNamesOutput = `array [\n  string "org.freedesktop.DBus"\n]`;
    execFile.mockImplementation((cmd, args, opts, cb) => {
      cb(null, listNamesOutput, '');
    });

    const result = await spotifyService.activate();
    expect(result).toBe(false);
    expect(spotifyService.connected).toBe(false);
  });

  it('should return false when TransferPlayback fails', async () => {
    spotifyService._spotifydDest = 'rs.spotifyd.instance123';
    execFile.mockImplementation((cmd, args, opts, cb) => {
      cb(new Error('D-Bus method call failed'), '', '');
    });

    const result = await spotifyService.activate();
    expect(result).toBe(false);
  });

  it('should emit connection:changed on successful activation', async () => {
    const handler = jest.fn();
    spotifyService.on('connection:changed', handler);
    spotifyService._spotifydDest = 'rs.spotifyd.instance123';
    spotifyService.connected = false;

    let callCount = 0;
    execFile.mockImplementation((cmd, args, opts, cb) => {
      callCount++;
      if (callCount === 1) cb(null, '', ''); // TransferPlayback
      else cb(null, 'variant       string "Playing"', ''); // checkConnection
    });

    await spotifyService.activate();
    expect(handler).toHaveBeenCalledWith({ connected: true });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/services/spotifyService.test.js --no-coverage -t "activate" 2>&1 | tail -20`

Expected: FAIL — `activate` is not a function

**Step 3: Implement `activate()`**

Add to `SpotifyService` class in `backend/src/services/spotifyService.js`, after `_discoverSpotifydDest()`:

```javascript
/**
 * Activate Spotify Connect on this device via TransferPlayback.
 * Calls the native rs.spotifyd.Controls interface, then waits for MPRIS
 * to register and verifies connection.
 * @returns {Promise<boolean>} true if activation succeeded and MPRIS is available
 */
async activate() {
  try {
    const dest = await this._discoverSpotifydDest();
    if (!dest) {
      logger.warn('[Spotify] Cannot activate — spotifyd not found on D-Bus');
      this._setConnected(false);
      return false;
    }

    logger.info('[Spotify] Activating via TransferPlayback');
    await execFileAsync('dbus-send', [
      '--session', '--type=method_call', '--print-reply',
      '--dest=' + dest, '/',
      `${SPOTIFYD_IFACE}.TransferPlayback`
    ], { timeout: 5000 });

    // Wait for MPRIS interface to register after activation
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Clear cached MPRIS dest (may have changed after activation)
    this._dbusDest = null;

    // Verify MPRIS is now available
    return await this.checkConnection();
  } catch (err) {
    logger.error('[Spotify] Activation failed:', err.message);
    this._setConnected(false);
    return false;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest tests/unit/services/spotifyService.test.js --no-coverage 2>&1 | tail -20`

Expected: ALL tests PASS

**Step 5: Commit**

```bash
cd backend && git add src/services/spotifyService.js tests/unit/services/spotifyService.test.js
git commit -m "feat: add activate() method for Spotify Connect via TransferPlayback"
```

---

### Task 5: Add `init()` lifecycle method

**Files:**
- Modify: `backend/src/services/spotifyService.js`
- Modify: `backend/src/app.js` (line 172)
- Test: `backend/tests/unit/services/spotifyService.test.js`

**Context:** `init()` replaces the passive `checkConnection()` call at startup. It tries `activate()` first (aggressive startup), then falls back to `checkConnection()` if activation fails. This follows the pattern used by other services: `bluetoothService.init()`, `audioRoutingService.init()`, `lightingService.init()`.

**Step 1: Write the failing tests**

Add to `backend/tests/unit/services/spotifyService.test.js`:

```javascript
describe('init', () => {
  it('should attempt activate first', async () => {
    spotifyService._spotifydDest = 'rs.spotifyd.instance123';
    let callCount = 0;
    execFile.mockImplementation((cmd, args, opts, cb) => {
      callCount++;
      if (callCount === 1) cb(null, '', ''); // TransferPlayback
      else cb(null, 'variant       string "Playing"', ''); // checkConnection
    });

    await spotifyService.init();
    expect(spotifyService.connected).toBe(true);
  });

  it('should fall back to checkConnection when activate fails', async () => {
    spotifyService._spotifydDest = null;
    spotifyService._dbusDest = 'org.mpris.MediaPlayer2.spotifyd.instance99';
    let callCount = 0;
    execFile.mockImplementation((cmd, args, opts, cb) => {
      callCount++;
      if (callCount === 1) {
        // Discovery for native dest — not found
        cb(null, `array [\n  string "org.freedesktop.DBus"\n]`, '');
      } else {
        // checkConnection — MPRIS available
        cb(null, 'variant       string "Paused"', '');
      }
    });

    await spotifyService.init();
    expect(spotifyService.connected).toBe(true);
  });

  it('should not throw when both activate and checkConnection fail', async () => {
    spotifyService._spotifydDest = null;
    spotifyService._dbusDest = null;
    mockExecFileError('Connection refused');

    await spotifyService.init(); // Should not throw
    expect(spotifyService.connected).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/services/spotifyService.test.js --no-coverage -t "init" 2>&1 | tail -20`

Expected: FAIL — `init` is not a function

**Step 3: Implement `init()`**

Add to `SpotifyService` class in `backend/src/services/spotifyService.js`, after `activate()`:

```javascript
/**
 * Initialize Spotify service at server startup.
 * Attempts activation first (TransferPlayback), falls back to passive check.
 * Non-blocking: logs warnings on failure, never throws.
 */
async init() {
  logger.info('[Spotify] Initializing');
  const activated = await this.activate();
  if (activated) {
    logger.info('[Spotify] Initialized via TransferPlayback activation');
    return;
  }
  // Activation failed (no native interface), try passive MPRIS check
  const connected = await this.checkConnection();
  if (connected) {
    logger.info('[Spotify] Initialized via existing MPRIS connection');
  } else {
    logger.warn('[Spotify] Not available at startup (will retry on reconnect command)');
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest tests/unit/services/spotifyService.test.js --no-coverage 2>&1 | tail -20`

Expected: ALL tests PASS

**Step 5: Update app.js to use `init()` instead of `checkConnection()`**

In `backend/src/app.js`, find line 172:

```javascript
// BEFORE:
spotifyService.checkConnection().catch(err =>
  logger.warn('Spotify connection check failed (non-blocking)', { error: err.message })
);

// AFTER:
spotifyService.init().catch(err =>
  logger.warn('Spotify init failed (non-blocking)', { error: err.message })
);
```

**Step 6: Run full test suite to verify no regressions**

Run: `cd backend && npm test 2>&1 | tail -20`

Expected: ALL tests PASS

**Step 7: Commit**

```bash
cd backend && git add src/services/spotifyService.js src/app.js tests/unit/services/spotifyService.test.js
git commit -m "feat: add init() lifecycle method, use at startup instead of checkConnection"
```

---

### Task 6: Add reactive recovery in `_dbusCall()`

**Files:**
- Modify: `backend/src/services/spotifyService.js`
- Test: `backend/tests/unit/services/spotifyService.test.js`

**Context:** When a media control command fails (e.g., MPRIS dest went stale because spotifyd restarted), `_dbusCall()` should automatically attempt recovery: clear caches, activate, and retry the original call once. This eliminates the need for idle polling — failures are detected at point of use and recovered reactively.

**Step 1: Write the failing tests**

Add to `backend/tests/unit/services/spotifyService.test.js`:

```javascript
describe('reactive recovery in _dbusCall', () => {
  it('should retry after recovery when first call fails', async () => {
    // First call fails (stale dest), recovery succeeds, retry succeeds
    spotifyService._spotifydDest = 'rs.spotifyd.instance123';
    let callCount = 0;
    execFile.mockImplementation((cmd, args, opts, cb) => {
      callCount++;
      if (callCount === 1) {
        // Original call — fails (stale MPRIS dest)
        cb(new Error('org.freedesktop.DBus.Error.ServiceUnknown'), '', '');
      } else if (callCount === 2) {
        // Recovery: _discoverSpotifydDest → ListNames
        cb(null, `array [\n  string "rs.spotifyd.instance999"\n]`, '');
      } else if (callCount === 3) {
        // Recovery: activate → TransferPlayback
        cb(null, '', '');
      } else if (callCount === 4) {
        // Recovery: checkConnection (after activate wait)
        cb(null, 'variant       string "Playing"', '');
      } else if (callCount === 5) {
        // Retry: _discoverDbusDest → ListNames (for new MPRIS dest)
        cb(null, `array [\n  string "org.mpris.MediaPlayer2.spotifyd.instance999"\n]`, '');
      } else if (callCount === 6) {
        // Retry: actual Play command
        cb(null, '', '');
      }
    });

    // Should not throw — recovery + retry succeeds
    await spotifyService.play();
    expect(spotifyService.state).toBe('playing');
  });

  it('should throw if recovery also fails', async () => {
    spotifyService._spotifydDest = 'rs.spotifyd.instance123';
    mockExecFileError('org.freedesktop.DBus.Error.ServiceUnknown');

    await expect(spotifyService.play()).rejects.toThrow();
  });

  it('should not recurse infinitely on repeated failures', async () => {
    spotifyService._spotifydDest = 'rs.spotifyd.instance123';
    let callCount = 0;
    execFile.mockImplementation((cmd, args, opts, cb) => {
      callCount++;
      cb(new Error('D-Bus error'), '', '');
    });

    await expect(spotifyService.play()).rejects.toThrow();
    // Should not have made hundreds of calls (bounded recovery)
    expect(callCount).toBeLessThan(20);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/services/spotifyService.test.js --no-coverage -t "reactive recovery" 2>&1 | tail -20`

Expected: FAIL — first call throws immediately with no recovery attempt

**Step 3: Implement reactive recovery**

Add `this._recovering = false;` to the constructor (after `this._spotifydDest = null;`).

Replace the `_dbusCall` method in `backend/src/services/spotifyService.js`:

```javascript
async _dbusCall(method, args = []) {
  const dest = await this._discoverDbusDest();
  if (!dest) throw new Error('spotifyd not found on D-Bus');
  const cmdArgs = [
    '--session', '--type=method_call', '--print-reply',
    '--dest=' + dest, DBUS_PATH,
    method, ...args
  ];
  try {
    return await execFileAsync('dbus-send', cmdArgs, { timeout: 5000 });
  } catch (err) {
    // Reactive recovery: if not already recovering, try to re-activate
    if (!this._recovering) {
      this._recovering = true;
      logger.warn(`[Spotify] D-Bus call failed, attempting recovery: ${err.message}`);
      // Clear caches so discovery starts fresh
      this._dbusDest = null;
      this._spotifydDest = null;
      try {
        const activated = await this.activate();
        if (activated) {
          logger.info('[Spotify] Recovery succeeded, retrying command');
          // Retry original call (activate cleared _dbusDest, will re-discover)
          const retryDest = await this._discoverDbusDest();
          if (!retryDest) throw new Error('spotifyd MPRIS not available after recovery');
          const retryCmdArgs = [
            '--session', '--type=method_call', '--print-reply',
            '--dest=' + retryDest, DBUS_PATH,
            method, ...args
          ];
          return await execFileAsync('dbus-send', retryCmdArgs, { timeout: 5000 });
        }
      } finally {
        this._recovering = false;
      }
    }
    throw err;
  }
}
```

Clear `_recovering` in `reset()`:

```javascript
reset() {
  this.connected = false;
  this.state = 'stopped';
  this.volume = 100;
  this._pausedByGameClock = false;
  this._dbusDest = null;
  this._spotifydDest = null;
  this._recovering = false;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest tests/unit/services/spotifyService.test.js --no-coverage 2>&1 | tail -20`

Expected: ALL tests PASS

**Step 5: Commit**

```bash
cd backend && git add src/services/spotifyService.js tests/unit/services/spotifyService.test.js
git commit -m "feat: add reactive recovery in _dbusCall — auto-reactivate on failure"
```

---

### Task 7: Update `spotify:reconnect` command to use `activate()`

**Files:**
- Modify: `backend/src/services/commandExecutor.js` (line 521-532)
- Test: `backend/tests/unit/services/commandExecutor.test.js`

**Context:** The `spotify:reconnect` gm:command currently calls `checkConnection()` which is passive (read-only). It should call `activate()` which actually attempts TransferPlayback to make this device active.

**Step 1: Write/update failing test**

Find the existing `spotify:reconnect` test in `backend/tests/unit/services/commandExecutor.test.js`. Update it to verify `activate()` is called instead of `checkConnection()`:

```javascript
it('should call activate on spotify:reconnect', async () => {
  const spotifyService = require('../../../src/services/spotifyService');
  spotifyService.activate = jest.fn().mockResolvedValue(true);

  const result = await executeCommand({
    action: 'spotify:reconnect',
    payload: {},
    source: 'test',
    deviceId: 'dev1'
  });

  expect(spotifyService.activate).toHaveBeenCalled();
  expect(result.success).toBe(true);
  expect(result.data.connected).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/services/commandExecutor.test.js --no-coverage -t "spotify:reconnect" 2>&1 | tail -20`

Expected: FAIL — currently calls `checkConnection`, not `activate`

**Step 3: Update commandExecutor**

In `backend/src/services/commandExecutor.js`, replace the `spotify:reconnect` case (lines 521-532):

```javascript
// BEFORE:
case 'spotify:reconnect': {
  const spotifyService = require('./spotifyService');
  const connected = await spotifyService.checkConnection();
  // No broadcasts needed — checkConnection() calls _setConnected() which emits
  // 'connection:changed', picked up by broadcasts.js EventEmitter listener
  return {
    success: true,
    message: connected ? 'Spotify connected' : 'Spotify not available',
    data: { connected },
    source
  };
}

// AFTER:
case 'spotify:reconnect': {
  const spotifyService = require('./spotifyService');
  const connected = await spotifyService.activate();
  // No broadcasts needed — activate() calls _setConnected() which emits
  // 'connection:changed', picked up by broadcasts.js EventEmitter listener
  return {
    success: true,
    message: connected ? 'Spotify connected' : 'Spotify not available',
    data: { connected },
    source
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest tests/unit/services/commandExecutor.test.js --no-coverage -t "spotify:reconnect" 2>&1 | tail -20`

Expected: PASS

**Step 5: Commit**

```bash
cd backend && git add src/services/commandExecutor.js tests/unit/services/commandExecutor.test.js
git commit -m "fix: spotify:reconnect now calls activate() instead of passive checkConnection()"
```

---

### Task 8: Update systemReset.js and run full verification

**Files:**
- Modify: `backend/src/services/systemReset.js` (lines 116-118)
- Test: Full suite run

**Context:** `systemReset.js` calls `spotifyService.reset()` which already clears `_dbusDest`. We need to verify `_spotifydDest` and `_recovering` are also cleared (done in Task 3 and Task 6). No code change needed in systemReset.js itself — the `reset()` method already handles everything. This task is for final verification.

**Step 1: Verify reset() clears all new fields**

Read `backend/src/services/spotifyService.js` and confirm `reset()` clears:
- `this._dbusDest = null;` (existing)
- `this._spotifydDest = null;` (added in Task 3)
- `this._recovering = false;` (added in Task 6)

**Step 2: Add a test for reset clearing new fields**

In `backend/tests/unit/services/spotifyService.test.js`, find the existing `'should clear cached destination on reset'` test and extend it:

```javascript
it('should clear all cached state on reset', () => {
  spotifyService._dbusDest = 'org.mpris.MediaPlayer2.spotifyd.instance99';
  spotifyService._spotifydDest = 'rs.spotifyd.instance99';
  spotifyService._recovering = true;
  spotifyService.connected = true;
  spotifyService.state = 'playing';

  spotifyService.reset();

  expect(spotifyService._dbusDest).toBeNull();
  expect(spotifyService._spotifydDest).toBeNull();
  expect(spotifyService._recovering).toBe(false);
  expect(spotifyService.connected).toBe(false);
  expect(spotifyService.state).toBe('stopped');
});
```

**Step 3: Run spotifyService tests**

Run: `cd backend && npx jest tests/unit/services/spotifyService.test.js --no-coverage 2>&1 | tail -20`

Expected: ALL tests PASS

**Step 4: Run full unit + contract test suite**

Run: `cd backend && npm test 2>&1 | tail -30`

Expected: ALL tests PASS (current baseline: 1059+)

**Step 5: Run integration tests**

Run: `cd backend && npm run test:integration 2>&1 | tail -30`

Expected: ALL tests PASS (baseline: 256)

**Step 6: Commit**

```bash
cd backend && git add tests/unit/services/spotifyService.test.js
git commit -m "test: verify reset clears all new spotify state fields"
```

---

## Summary of All Changes

| File | Change |
|------|--------|
| `backend/src/websocket/broadcasts.js` | Add `deviceFilter: { connectedOnly: true }` to scores:reset and offline:queue:processed sync:full calls |
| `backend/src/services/spotifyService.js` | Add `_findDbusDest()`, `_discoverSpotifydDest()`, `activate()`, `init()`, reactive recovery in `_dbusCall()`, new fields `_spotifydDest`/`_recovering` |
| `backend/src/app.js` | Change `checkConnection()` to `init()` at startup |
| `backend/src/services/commandExecutor.js` | Change `checkConnection()` to `activate()` in spotify:reconnect |
| `backend/tests/unit/services/spotifyService.test.js` | Tests for all new methods |
| `backend/tests/unit/websocket/broadcasts.test.js` | Test for connectedOnly filter in scores:reset |
| `backend/tests/unit/services/commandExecutor.test.js` | Update spotify:reconnect test |

**Future work (separate plan):** Offline music fallback using spotdl + local MPRIS player or Mopidy for internet-free playback.
