# Music Service Bounded-I/O Self-Healing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the backend's MPD client recover automatically when its mpd2 socket client wedges, instead of hanging every music command forever until a manual orchestrator restart.

**Architecture:** Bound every mpd2 round-trip with a hard timeout at one chokepoint (`_send`) plus the health-check ping. A timeout is treated as "the client is wedged": drop the shared client reference so the existing `checkConnection()` reconnect path rebuilds a fresh one, and rethrow so callers (cue engine, WebSocket, HTTP) fail fast instead of hanging. No new connection-lifecycle code; we reuse the reconnect that already exists.

**Tech Stack:** Node.js, `mpd2@1.0.7` (MPD client over Unix socket), Jest (unit tests, `resetMocks: true`), `serviceHealthRegistry` (health + 15s revalidation).

---

## Background (read before starting — you have zero context)

### What broke

On a clean Pi boot, every "play music" command from the GM Scanner silently did nothing. The commands reached the backend and were dispatched, but `await musicService.<method>()` **never returned and never threw** — they hung. Evidence from logs: 22 `[executeCommand] action=music:...` entry lines, **0** success lines, **0** failure lines.

### Root cause (confirmed by reading code + logs)

1. **Trigger:** Clean boot wipes `/tmp`, so MPD's cached DB (`/tmp/aln-mpd.db`) is gone and MPD does a full database rebuild at startup. The rebuild finished at the same second the mpd2 client connected and subscribed to idle events.

2. **The wedge:** `mpd2@1.0.7` matches responses to callers by a **single positional FIFO** shared by both commands and idle events (`node_modules/mpd2/lib/index.js` — `_resolve()` does `this._promiseQueue.shift().resolve(msg)`; there is NO request/response correlation). When MPD's update-complete idle notification raced the idle subscription, the wire-order diverged from the enqueue-order. From then on, every response resolved the *wrong* promise — a command's resolver gets consumed by the idle handler, and the command's own promise never settles. Permanent hang.

3. **Why it never self-heals:** The architecture already intends self-healing — `serviceHealthRegistry.startRevalidation(...)` (`src/app.js:290`) calls `musicService.checkConnection()` every 15s, which pings MPD and, on failure, drops + reconnects the client. But the ping (`src/services/musicService.js:191`, `await this._mpd.sendCommand('ping')`) is **just another command on the same wedged client — so it hangs too.** It never rejects, so the `catch` that would drop the client and report `down` never runs. Music stays frozen at "healthy" forever (verified: 0 `Health revalidation failed for music` warnings across 16 minutes; music health unchanged since connect).

4. **`mpd2` has no usable operational timeout:** `config.timeout`/`MPD_TIMEOUT` only arm a handler during the *connection handshake* — `finalize()` does `socket.removeListener('timeout', onTimeout)` before the client goes operational (`node_modules/mpd2/lib/index.js:240`). After connect, a hung round-trip is never detected by the library. We must bound operations ourselves.

5. **`system:reset` cannot clear it:** `src/services/systemReset.js:122` calls `musicService.reset()`, which only resets in-memory state and never touches `_mpd`. So today there is **zero** in-process recovery.

### Why this design (and not the alternatives)

- **Persisting the DB outside `/tmp`** only hides this one trigger and makes the bug rarer/harder to catch. Rejected.
- **Two MPD connections (split idle vs commands)** would duplicate the entire connection lifecycle (`init`/`checkConnection`/`cleanup`/the ProcessMonitor `exited` null-out) for two clients, and *still* needs operational timeouts for a stale-but-alive socket — so it's strictly additive on top of this fix, not a substitute. Rejected for now.
- **Bounded I/O + reuse-existing-reconnect** is the minimal change that makes the self-healing the architecture already promises actually work, and it generalizes to any future hang cause (not just this boot race).

### Blast radius this fixes (why we bound commands, not only the ping)

`commandExecutor` `music:*` actions are awaited sequentially by the cue engine — both simple cues (`src/services/cueEngineService.js:343`) and compound timelines (`:659`). Their `try/catch` only catches *rejections*; a hang never reaches it. So a wedged client stalls any cue containing a `music:*` step and, in a simple cue, blocks every command after it. Bounding the command methods makes those callers fail fast (cue emits `cue:error` and continues; WebSocket ack returns failure; the `GET /api/music/tracks` route errors instead of hanging). That is a distinct purpose from bounding the health ping (which restores auto-recovery), so both are warranted.

### Key files / line references (as of this plan)

- `src/services/musicService.js`
  - Constructor options: lines ~45–75
  - `checkConnection()` ping: line 191 (inside `try` at 190–204)
  - Transport methods: `play/pause/stop/next/previous` 213–217
  - `setVolume` 219–228, `setShuffle` 230–233, `setLoop` 235–238
  - `loadPlaylist` builds `cmds` and calls `await this._mpd.sendCommands(cmds)` at 276
  - `listAllTracks` `await this._mpd.sendCommand('listallinfo')` at 303
  - `pauseForGameClock` `await this._mpd.sendCommand('pause 1')` at 332
  - `resumeFromGameClock` `await this._mpd.sendCommand('play')` at 339
  - `_assertConnected()` 207–211
- Tests: `tests/unit/services/musicService.test.js` (mpd2 mocked via `jest.mock('mpd2')`; `MusicService` is a **named export**; tests build fresh `new MusicService(...)`).
- Coverage ratchet: `.coverage-thresholds.json` + `npm run coverage:ratchet` (a new source file needs a threshold entry).

### Conventions

- Winston logger (no `console.log`).
- Services export a singleton (`module.exports = new MusicService()`) AND the class (`module.exports.MusicService = MusicService`) — confirm the existing export style at the bottom of `musicService.js` before editing.
- Tests use **real** timers with a tiny injected timeout (no fake timers needed).
- DRY, YAGNI, TDD, commit after each green step.

---

## Task 1: `withTimeout` utility

A pure helper that races a promise against a timeout and always clears its timer. Built and tested in isolation first.

**Files:**
- Create: `backend/src/utils/withTimeout.js`
- Test: `backend/tests/unit/utils/withTimeout.test.js`

**Step 1: Write the failing test**

Create `backend/tests/unit/utils/withTimeout.test.js`:

```javascript
const { withTimeout, TimeoutError } = require('../../../src/utils/withTimeout');

describe('withTimeout', () => {
  it('resolves with the value when the promise settles before the timeout', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000, 'x')).resolves.toBe('ok');
  });

  it('propagates rejection when the promise rejects before the timeout', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000, 'x'))
      .rejects.toThrow('boom');
  });

  it('rejects with a TimeoutError when the promise never settles', async () => {
    const never = new Promise(() => {});
    const err = await withTimeout(never, 20, 'MPD command').catch(e => e);
    expect(err).toBeInstanceOf(TimeoutError);
    expect(err.message).toMatch(/MPD command timed out after 20ms/);
  });

  it('clears the timer when the promise wins (no lingering handle)', async () => {
    const spy = jest.spyOn(global, 'clearTimeout');
    await withTimeout(Promise.resolve(1), 1000, 'x');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

**Step 2: Run test to verify it fails**

Run (from `backend/`): `npx jest tests/unit/utils/withTimeout.test.js`
Expected: FAIL — `Cannot find module '../../../src/utils/withTimeout'`.

**Step 3: Write minimal implementation**

Create `backend/src/utils/withTimeout.js`:

```javascript
'use strict';

/**
 * Distinguishable error so callers can tell a timeout apart from the wrapped
 * operation's own rejection.
 */
class TimeoutError extends Error {
  constructor(label, ms) {
    super(`${label} timed out after ${ms}ms`);
    this.name = 'TimeoutError';
    this.code = 'ETIMEDOUT';
  }
}

/**
 * Race a promise against a timeout. If the promise settles first, its result
 * (or rejection) is returned. If the timeout fires first, rejects with a
 * TimeoutError. The timer is always cleared so it never keeps the event loop
 * alive. The losing promise (e.g. a wedged operation) is intentionally
 * abandoned — the caller decides what to do with the dead resource.
 *
 * @param {Promise} promise - the operation to bound
 * @param {number} ms - timeout in milliseconds
 * @param {string} [label='operation'] - included in the TimeoutError message
 * @returns {Promise}
 */
function withTimeout(promise, ms, label = 'operation') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

module.exports = { withTimeout, TimeoutError };
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/unit/utils/withTimeout.test.js`
Expected: PASS (4 tests).

**Step 5: Commit**

```bash
git add backend/src/utils/withTimeout.js backend/tests/unit/utils/withTimeout.test.js
git commit -m "feat(music): add withTimeout utility for bounding mpd2 round-trips"
```

---

## Task 2: `_send` chokepoint + injectable timeout + route command methods

Add a configurable per-operation timeout and a single `_send` wrapper that all command round-trips go through. On timeout, abandon the wedged client (drop the shared ref, report `down`) and rethrow.

**Files:**
- Modify: `backend/src/services/musicService.js` (constructor ~45–75; add `_send`; transports 213–217; `setVolume`/`setShuffle`/`setLoop` 219–238; `loadPlaylist` 276; `listAllTracks` 303; `pauseForGameClock` 332; `resumeFromGameClock` 339)
- Test: `backend/tests/unit/services/musicService.test.js`

**Step 1: Write the failing tests**

Append a new `describe` block to `backend/tests/unit/services/musicService.test.js` (keep the existing `jest.mock('mpd2')` and `beforeEach` at the top of the file):

```javascript
const { TimeoutError } = require('../../../src/utils/withTimeout');

describe('MusicService — bounded I/O (_send)', () => {
  it('passes a normal command through and resolves', async () => {
    const service = new MusicService({ opTimeoutMs: 50 });
    await service.init();
    service._mpd.sendCommand.mockResolvedValue('OK');
    await expect(service.play()).resolves.toBeDefined();
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('play');
  });

  it('rejects with TimeoutError and drops the client when a command hangs', async () => {
    const service = new MusicService({ opTimeoutMs: 20 });
    await service.init();
    const reportSpy = jest.spyOn(registry, 'report');
    const wedged = service._mpd;
    wedged.sendCommand.mockImplementation(() => new Promise(() => {})); // never settles

    await expect(service.play()).rejects.toBeInstanceOf(TimeoutError);

    expect(service._mpd).toBeNull();          // shared ref dropped
    expect(service.connected).toBe(false);
    expect(reportSpy).toHaveBeenCalledWith('music', 'down', expect.stringContaining('timed out'));
    expect(wedged.disconnect).toHaveBeenCalled(); // dead client cleaned up
  });

  it('does not tear down a client that was already replaced (same-reference guard)', async () => {
    const service = new MusicService({ opTimeoutMs: 20 });
    await service.init();
    const wedged = service._mpd;
    wedged.sendCommand.mockImplementation(() => new Promise(() => {}));

    const p = service.play();                 // captures `wedged`
    // Simulate checkConnection reconnecting a fresh client mid-flight:
    const fresh = { sendCommand: jest.fn().mockResolvedValue(''), disconnect: jest.fn() };
    service._mpd = fresh;

    await expect(p).rejects.toBeInstanceOf(TimeoutError);
    expect(service._mpd).toBe(fresh);         // fresh client preserved
    expect(fresh.disconnect).not.toHaveBeenCalled();
  });

  it('loadPlaylist times out cleanly when sendCommands hangs', async () => {
    const service = new MusicService({ opTimeoutMs: 20 });
    service._playlists = new Map([['p1', { id: 'p1', name: 'P1', tracks: ['a.mp3'] }]]);
    await service.init();
    service._mpd.sendCommands.mockImplementation(() => new Promise(() => {}));
    await expect(service.loadPlaylist('p1')).rejects.toBeInstanceOf(TimeoutError);
    expect(service._mpd).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest tests/unit/services/musicService.test.js -t "bounded I/O"`
Expected: FAIL — `opTimeoutMs` is ignored (no timeout), so the "hangs" tests never settle and Jest times them out (≈5s default). That failure confirms there is no bound yet.

**Step 3: Implement**

3a. At the top of `backend/src/services/musicService.js`, add the import (next to the other `require`s):

```javascript
const { withTimeout, TimeoutError } = require('../utils/withTimeout');
```

3b. In the constructor options (the `{ ... } = {}` destructure, ~lines 45–51), add a new option and store it. Add to the destructure list:

```javascript
    opTimeoutMs = 3000,
```

and inside the constructor body (near the other `this._...` assignments, ~line 62):

```javascript
    // Hard ceiling for any single mpd2 round-trip. mpd2@1.0.7 can wedge (its
    // response/idle FIFO desyncs and commands then never settle); a timeout is
    // the only reliable signal. Chosen < the GM Scanner's 5s command-ack
    // timeout so the backend fails before the client gives up.
    this._opTimeoutMs = opTimeoutMs;
```

3c. Add the `_send` method (place it just above the transport methods, before `play()` at ~line 213):

```javascript
  /**
   * Execute a single mpd2 round-trip under a hard timeout. mpd2@1.0.7 matches
   * responses to callers positionally (one FIFO shared by commands AND idle),
   * so a desynced client never rejects — it hangs forever. On timeout we
   * abandon the client: drop the shared ref (so checkConnection's reconnect
   * path rebuilds a fresh one) and rethrow so callers fail fast.
   *
   * @param {(client: object) => Promise} op - receives the captured mpd2 client
   */
  async _send(op) {
    this._assertConnected();
    const client = this._mpd; // capture for the same-reference guard
    try {
      return await withTimeout(op(client), this._opTimeoutMs, 'MPD command');
    } catch (err) {
      // Only tear down on a timeout, and only if nobody replaced the client
      // meanwhile (checkConnection's reconnect path also assigns this._mpd).
      if (err instanceof TimeoutError && this._mpd === client) {
        this._mpd = null;
        this._eventsWired = false;
        this.connected = false;
        require('./serviceHealthRegistry').report('music', 'down', 'MPD operation timed out');
        client.disconnect().catch(() => {}); // fire-and-forget cleanup of the dead client
      }
      throw err;
    }
  }
```

3d. Replace the transport methods (213–217). `_send` now does the connectivity assert, so drop the inline `this._assertConnected()`:

```javascript
  async play()     { return this._send(c => c.sendCommand('play')); }
  async pause()    { return this._send(c => c.sendCommand('pause 1')); }
  async stop()     { return this._send(c => c.sendCommand('stop')); }
  async next()     { return this._send(c => c.sendCommand('next')); }
  async previous() { return this._send(c => c.sendCommand('previous')); }
```

3e. `setVolume` (219–228) — keep validation first, then `_send`:

```javascript
  async setVolume(v) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(`Invalid volume: ${v}`);
    }
    if (v < 0 || v > 100) {
      throw new Error(`Volume out of range: ${v}`);
    }
    return this._send(c => c.sendCommand(`setvol ${Math.round(v)}`));
  }
```

3f. `setShuffle` (230–233) and `setLoop` (235–238):

```javascript
  async setShuffle(enabled) {
    return this._send(c => c.sendCommand(`random ${enabled ? 1 : 0}`));
  }

  async setLoop(enabled) {
    return this._send(c => c.sendCommand(`repeat ${enabled ? 1 : 0}`));
  }
```

3g. `loadPlaylist` — keep the early `this._assertConnected()` and all the playlist lookup/validation/`cmds` building unchanged. Replace ONLY the send line (276):

```javascript
    // was: await this._mpd.sendCommands(cmds);
    await this._send(c => c.sendCommands(cmds));
```

3h. `listAllTracks` (301–305) — replace the send line (303):

```javascript
    // was: const stdout = await this._mpd.sendCommand('listallinfo');
    const stdout = await this._send(c => c.sendCommand('listallinfo'));
```

3i. `pauseForGameClock` — keep the `if (this.state !== 'playing') return;` guard; the inline `this._assertConnected()` is now redundant (drop it), replace the send (332):

```javascript
  async pauseForGameClock() {
    if (this.state !== 'playing') return;
    await this._send(c => c.sendCommand('pause 1'));
    this._pausedByGameClock = true;
  }
```

3j. `resumeFromGameClock` — keep the `if (!this._pausedByGameClock) return;` guard; drop the redundant assert; replace the send (339):

```javascript
  async resumeFromGameClock() {
    if (!this._pausedByGameClock) return;
    await this._send(c => c.sendCommand('play'));
    this._pausedByGameClock = false;
  }
```

> NOTE: Do NOT route the idle handlers (`_handlePlayerEvent`, `_handleMixerEvent`) through `_send`. They only run when the idle loop is healthy (a wedge kills idle entirely, so they don't fire), they already guard on `this._stopped`/`!this._mpd`, and tearing the client down from inside an idle callback is unnecessary scope. Leaving them out is deliberate.

**Step 4: Run tests to verify they pass**

Run: `npx jest tests/unit/services/musicService.test.js`
Expected: PASS — the new "bounded I/O" block plus all pre-existing tests. If any pre-existing transport test asserted `_assertConnected` ordering, update it to expect a `play`/`pause` call through `_send` (behavior is unchanged for the connected path).

**Step 5: Commit**

```bash
git add backend/src/services/musicService.js backend/tests/unit/services/musicService.test.js
git commit -m "fix(music): bound mpd2 commands; abandon+reconnect a wedged client"
```

---

## Task 3: Bound the health-check ping (restore self-healing)

The ping in `checkConnection()` is the detector the 15s revalidation relies on. Wrapping it makes it reject on a wedge so the existing drop + reconnect path runs.

**Files:**
- Modify: `backend/src/services/musicService.js` (`checkConnection`, line ~191)
- Test: `backend/tests/unit/services/musicService.test.js`

**Step 1: Write the failing tests**

Append to `backend/tests/unit/services/musicService.test.js`:

```javascript
describe('MusicService — checkConnection recovery', () => {
  it('reports down and drops the client when ping hangs', async () => {
    const service = new MusicService({ opTimeoutMs: 20 });
    await service.init();
    const reportSpy = jest.spyOn(registry, 'report');
    service._mpd.sendCommand.mockImplementation(() => new Promise(() => {})); // ping hangs

    const ok = await service.checkConnection();

    expect(ok).toBe(false);
    expect(service._mpd).toBeNull();
    expect(reportSpy).toHaveBeenCalledWith('music', 'down', expect.stringContaining('ping'));
  });

  it('reconnects a fresh client on the next check after a drop', async () => {
    const service = new MusicService({ opTimeoutMs: 20 });
    await service.init();
    service._mpd = null;          // simulate post-drop state
    service.connected = false;

    const ok = await service.checkConnection(); // hits the !this._mpd reconnect branch

    expect(ok).toBe(true);
    expect(service._mpd).not.toBeNull();
    expect(service.connected).toBe(true);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest tests/unit/services/musicService.test.js -t "checkConnection recovery"`
Expected: the "ping hangs" test FAILS by hanging until Jest's per-test timeout (the unbounded ping never rejects). The "reconnects" test may already pass (reconnect branch exists) — that is fine; it guards against regression.

**Step 3: Implement**

In `checkConnection()`, wrap only the ping (line 191). Change:

```javascript
      await this._mpd.sendCommand('ping');
      return true;
```

to:

```javascript
      await withTimeout(this._mpd.sendCommand('ping'), this._opTimeoutMs, 'MPD ping');
      return true;
```

Leave the surrounding `catch` (198–204) unchanged — it already disconnects, nulls `_mpd`, sets `connected = false`, and reports `down`, after which the next `checkConnection()` hits the `!this._mpd` reconnect branch.

**Step 4: Run tests to verify they pass**

Run: `npx jest tests/unit/services/musicService.test.js`
Expected: PASS (all blocks).

**Step 5: Commit**

```bash
git add backend/src/services/musicService.js backend/tests/unit/services/musicService.test.js
git commit -m "fix(music): bound checkConnection ping so revalidation detects a wedged client"
```

---

## Task 4: Full verification + coverage ratchet

**Files:**
- Modify: `backend/.coverage-thresholds.json` (regenerated)

**Step 1: Run the music-related suites**

Run (from `backend/`):
```bash
npx jest tests/unit/services/musicService.test.js \
         tests/unit/services/commandExecutor-music.test.js \
         tests/unit/services/music-sync-full-callers.test.js \
         tests/unit/utils/withTimeout.test.js
```
Expected: all PASS. (`commandExecutor-music` exercises the `music:*` dispatch that awaits these methods — confirm no regression.)

**Step 2: Run the full unit + contract suite**

Run: `npm test`
Expected: PASS, with the unit count increased by the new tests (no pre-existing tests broken). If a pre-existing music test breaks, fix the test expectation only if the connected-path behavior is genuinely unchanged; otherwise reconsider the implementation.

**Step 3: Regenerate per-file coverage thresholds (new source file needs an entry)**

Run:
```bash
npm run coverage:ratchet
npm run coverage:check
```
Expected: `coverage:check` passes; `.coverage-thresholds.json` now includes `src/utils/withTimeout.js`.

**Step 4: Commit**

```bash
git add backend/.coverage-thresholds.json
git commit -m "test(music): refresh coverage thresholds for bounded-IO recovery"
```

---

## Task 5: Documentation

Record the bounded-I/O behavior and correct one stale doc claim found during investigation.

**Files:**
- Modify: `backend/CLAUDE.md` (the `musicService` row in the Service Singleton table and/or the "Music Service" paragraph under Compound Cue Architecture)

**Step 1: Update the Music Service description**

Find the Music Service paragraph (search `Controls MPD via the` in `backend/CLAUDE.md`). Add a sentence describing the new behavior, e.g.:

```markdown
All mpd2 round-trips go through `_send()`, bounded by `opTimeoutMs` (default 3000ms). mpd2@1.0.7 can wedge — its single positional response/idle FIFO desyncs and commands then never settle — so a timeout is treated as a dead client: `_send` (and the `checkConnection` ping) drop `_mpd` and report `down`, and the existing 15s revalidation reconnect rebuilds a fresh client. This is the only in-process recovery; `system:reset` does NOT rebuild the client (`musicService.reset()` is in-memory only).
```

**Step 2: Correct the position-polling claim**

Search `Position polling at 1s while playing` in `backend/CLAUDE.md`. The code has no such timer — position updates ride the idle `system-player` event (`_handlePlayerEvent`). Replace that clause with:

```markdown
Position/track/volume updates ride MPD idle events (`system-player`/`system-mixer`) via `_handlePlayerEvent`/`_handleMixerEvent` — there is no position-polling timer.
```

**Step 3: Verify the doc edits are consistent**

Run: `grep -n "Position polling at 1s" backend/CLAUDE.md`
Expected: no matches (the stale claim is gone).

**Step 4: Commit**

```bash
git add backend/CLAUDE.md
git commit -m "docs(music): document bounded mpd2 I/O recovery; fix stale position-polling note"
```

---

## Done criteria

- A hung mpd2 command rejects with `TimeoutError` within `opTimeoutMs` instead of hanging forever, and the wedged client is dropped + reported `down`.
- After a drop, the next `checkConnection()` (driven by the 15s revalidation) reconnects a fresh client automatically — no manual orchestrator restart.
- The same-reference guard prevents tearing down a client that was already replaced.
- Cue timelines and WebSocket/HTTP callers fail fast on a wedge rather than stalling.
- `npm test` green; `npm run coverage:check` green; docs updated.

## Out of scope (deliberately not doing)

- Persisting MPD's `db_file` outside `/tmp` (only hides one trigger).
- Splitting into two MPD connections (idle vs command) (large lifecycle duplication; still needs these timeouts anyway).
- Bounding the idle handlers (`_handlePlayerEvent`/`_handleMixerEvent`) — they don't fire on a wedged client.

## Manual post-merge validation (real Pi, optional but recommended)

To reproduce the original trigger and confirm recovery end-to-end:
1. `pm2 stop aln-orchestrator`
2. `rm -f /tmp/aln-mpd.db` (force a full rebuild on next MPD spawn)
3. `pm2 start aln-orchestrator`
4. From the GM Scanner, load the "All Tracks" playlist. If the boot race wedges the client, the command should now fail fast and music should start working within ~15s (after one revalidation reconnect) — versus the previous behavior of hanging until a manual restart.
