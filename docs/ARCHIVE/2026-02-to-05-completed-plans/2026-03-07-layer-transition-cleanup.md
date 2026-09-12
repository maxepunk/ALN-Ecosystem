# Layer Transition Cleanup — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the Layer 1→2→3 architectural transition by removing dead code, fixing the reset lifecycle, rationalizing score delivery, fixing sync:full data flow, and restoring D-Bus isolation.

**Architecture:** The ALN backend evolved through three event architecture layers. Layer 1 (stateService computing GameState, `state:updated`/`state:sync` events) was superseded by Layer 2 (SRP persistence via sessionService, `transaction:accepted` chain) and Layer 3 (unified `service:state` domains). This cleanup removes Layer 1 remnants, fixes ordering bugs in the reset lifecycle that emerged from incomplete transitions, eliminates a sync:full re-submission feedback loop, removes redundant score delivery paths, and fixes D-Bus sender isolation that systemReset breaks.

**Tech Stack:** Node.js EventEmitter services, Socket.io WebSocket, Jest tests, ES6 GM Scanner (Vite), vanilla JS scoreboard

---

## Dependency Graph

```
Phase 1 (Dead Code)          Phase 2 (Reset Lifecycle)     Phase 3 (Score Rationalization)
  Task 1: stateService ──────→ Task 4: sessionService ──→ Task 6: score:updated removal
  Task 2: dead handlers         Task 5: systemReset         Task 7: GM Scanner migration
  Task 3: test helper           Task 5b: service-reset.js   Task 8: Scoreboard migration

Phase 4 (sync:full)           Phase 5 (D-Bus)
  Task 9: re-submission fix   Task 11: systemReset owner
  Task 10: emission scope     Task 12: VLC crash-restart
```

Phases 1-2 MUST be done first (later phases depend on the reset lifecycle being correct). Phases 3-5 can be done in any order after Phase 2.

---

## Phase 1: Dead Code Removal

### Task 1: Remove stateService Dead Event Wiring

stateService has 9 event listeners that compute GameState and emit `state:updated` — but zero consumers exist for that event. The `setupTransactionListeners()` method, its `init()` call, and all listener registrations are dead code.

**Keep:** `getCurrentState()` method (still called by `app.js:248` for startup diagnostics — will be migrated in Task 2). Keep the class and singleton export so existing `require()` statements don't break during this phase.

**Files:**
- Modify: `backend/src/services/stateService.js`
- Modify: `backend/src/app.js:158` (remove `stateService.init()` call)
- Modify: `backend/tests/unit/services/stateService.test.js`
- Modify: `backend/tests/integration/server-lifecycle.test.js` (references `setupTransactionListeners`)

**Changes to `stateService.js`:**
- Remove `setupTransactionListeners()` method entirely (lines 46-245)
- Remove `init()` method (lines 38-40 — it only calls `setupTransactionListeners`)
- Remove `emitStateUpdate()` method (lines 253-278)
- Remove `updateState()` method (lines 311-343)
- Remove `setCurrentVideo()` method (lines 350-359)
- Remove `clearCurrentVideo()` method (lines 365-374)
- Remove `listenersInitialized` flag from constructor
- Remove `pendingStateUpdate`, `debounceTimer`, `debounceDelay` from constructor
- Simplify `reset()` — remove timer cleanup, listener flag reset, just clear `cachedOfflineStatus`
- Remove unused imports: `listenerRegistry`, `transactionService`, `videoQueueService`, `offlineQueueService`
- Keep: `getCurrentState()`, `cachedOfflineStatus`, constructor, `GameState` import, `sessionService` import, `persistenceService` import

**Changes to `app.js`:**
- Line 158: Remove `await stateService.init();`
- Lines 245-258: Replace `stateService.getCurrentState()` diagnostic with direct `sessionService.getCurrentSession()` check (remove stateService import if no longer needed here)

**Test updates:**
- `stateService.test.js`: Remove all tests for `setupTransactionListeners`, listener registration, `state:updated` emission, debouncing, video state updates. Keep tests for `getCurrentState()` and `reset()`.
- `server-lifecycle.test.js`: Remove assertions about `setupTransactionListeners` listener counts.

**Verify:** `cd backend && npm test` — all unit+contract tests pass.

**Commit:** `refactor: remove stateService dead event listeners (Layer 1 cleanup)`

---

### Task 2: Remove Dead Request-Response Handlers

Three dead event paths:
1. `state:request` (server.js:97) → `handleStateRequest` (adminEvents.js:280-308) → emits `state:sync` — no client sends `state:request`, no client listens for `state:sync`
2. Dead `state` variable in `gmAuth.js:124` — fetched but never used (sync:full is built separately)

**Files:**
- Modify: `backend/src/server.js:96-99` (remove `state:request` handler)
- Modify: `backend/src/websocket/adminEvents.js` (remove `handleStateRequest` function, remove `stateService` import, remove from exports)
- Modify: `backend/src/websocket/gmAuth.js:123-124` (remove dead `state` variable)

**Changes to `server.js`:**
- Remove lines 96-99 (the `state:request` socket.on handler)

**Changes to `adminEvents.js`:**
- Remove `const stateService = require(...)` import (line 11)
- Remove entire `handleStateRequest` function (lines 276-308ish)
- Remove `handleStateRequest` from module.exports if it's exported

**Changes to `gmAuth.js`:**
- Remove lines 123-124 (`const state = stateService.getCurrentState();`)
- Remove stateService import if no other usage remains in the file

**Verify:** `cd backend && npm test`

**Commit:** `refactor: remove dead state:request/state:sync handlers (Layer 1 cleanup)`

---

### Task 3: Update Test Helper — Remove stateService Re-Registration

The `service-reset.js` test helper re-registers stateService's dead listeners after every reset.

**Files:**
- Modify: `backend/tests/helpers/service-reset.js`

**Changes:**
- `resetAllServices()` function:
  - Remove lines 181-183 (`stateService.reset()` call) — stateService no longer needs reset (no listeners to clean up)
  - Remove lines 190-192 (`stateService.setupTransactionListeners()` call)
  - Remove stateService from `beforeCounts`/`afterCounts` diagnostic tracking
- `resetAllServicesForTesting()` function:
  - Remove stateService from diagnostic tracking (lines 259, 305)
- Remove stateService from SERVICE_EVENTS map (lines 40-44)
- Remove `const stateService = require(...)` import (line 14) IF no other usage remains
- Note: `resetAllServicesForTesting` uses `performSystemReset()` which will be updated in Task 5 — the stateService removal in systemReset happens there

**Verify:** `cd backend && npm test` — also `npm run test:integration` to verify integration tests still pass with the helper change.

**Commit:** `refactor: remove stateService from test helper reset cycle`

---

## Phase 2: Reset Lifecycle Fix

### Task 4: Make sessionService.reset() Tear-Down Only

Currently `sessionService.reset()` calls `setupScoreListeners()`, `setupPersistenceListeners()`, and `setupGameClockListeners()` — but `transactionService.reset()` runs AFTER and destroys the listeners registered on transactionService. The fix: make `reset()` purely tear-down. All cross-service wiring happens in the centralized post-reset phase (systemReset/test helper).

**Files:**
- Modify: `backend/src/services/sessionService.js` (reset method)
- Modify: `backend/tests/unit/services/session-lifecycle.test.js` (if it tests reset behavior)

**Changes to `sessionService.js` `reset()` method (lines 801-823):**

Replace:
```javascript
async reset() {
  gameClockService.reset();
  this.removeAllListeners();
  this.initState();
  await persistenceService.delete('session:current');
  await persistenceService.delete('gameState:current');
  this.setupScoreListeners();
  this.setupPersistenceListeners();
  this.setupGameClockListeners();
  logger.info('Session service reset');
}
```

With:
```javascript
async reset() {
  gameClockService.reset();
  this.removeAllListeners();
  this.initState();
  await persistenceService.delete('session:current');
  await persistenceService.delete('gameState:current');
  // Cross-service listeners (setupScoreListeners, setupPersistenceListeners,
  // setupGameClockListeners) are NOT registered here. They are registered
  // by the centralized post-reset wiring in systemReset.js and service-reset.js.
  // Registering here is unsafe: transactionService.reset() runs after this
  // and calls removeAllListeners(), destroying anything registered on it.
  logger.info('Session service reset');
}
```

**IMPORTANT:** `sessionService.init()` (lines 262-295) still calls all three setup methods. This is correct — at startup, all services are already constructed, and init runs once. Do NOT change init().

**Verify:** `cd backend && npm test` — some tests may now fail because they call `sessionService.reset()` and expect listeners to be present. These failures are EXPECTED and will be fixed by Task 5b.

**Commit:** `refactor: sessionService.reset() is now tear-down only`

---

### Task 5: Centralize Post-Reset Wiring in systemReset.js

After Task 4, `sessionService.reset()` no longer registers cross-service listeners. `systemReset.js` must register ALL of them in its post-reset phase.

**Files:**
- Modify: `backend/src/services/systemReset.js` (lines 163-170)
- Modify: `backend/tests/unit/services/systemReset.test.js`
- Modify: `backend/tests/integration/system-reset-regression.test.js`

**Changes to `systemReset.js`:**

1. Remove stateService from the services destructure (line 42) and from `setupBroadcastListeners` call (not needed if stateService no longer has listeners). Note: broadcasts.js may still register a listener on stateService for errors — check and keep if needed.

2. Replace the current post-reset wiring section (lines 162-170):

```javascript
// OLD:
stateService.setupTransactionListeners();
transactionService.registerSessionListener();
sessionService.setupPersistenceListeners();
```

With the complete centralized wiring:
```javascript
// Re-register ALL cross-service listeners.
// sessionService.reset() is tear-down only — it does NOT register these.
// ALL wiring happens here, AFTER all services have been reset.
transactionService.registerSessionListener();
sessionService.setupScoreListeners();
sessionService.setupPersistenceListeners();
sessionService.setupGameClockListeners();
```

3. Remove `stateService` from the services destructure at the top of the function. Remove `stateService.reset()` call. Remove `stateService.setupTransactionListeners()` call.

4. Verify that `setupBroadcastListeners()` call (line 135) still receives all needed services — remove stateService from the service bag if broadcasts.js no longer needs it.

**Verify:** `cd backend && npm test && npm run test:integration`

**Commit:** `fix: centralize cross-service listener wiring in systemReset (fixes setupScoreListeners gap)`

---

### Task 5b: Update service-reset.js Test Helper to Match

The test helper must mirror systemReset's centralized wiring.

**Files:**
- Modify: `backend/tests/helpers/service-reset.js`

**Changes to `resetAllServices()` function:**

Replace the post-reset wiring section (lines 188-201):

```javascript
// OLD:
if (typeof stateService.setupTransactionListeners === 'function') {
  stateService.setupTransactionListeners();
}
if (typeof transactionService.registerSessionListener === 'function') {
  transactionService.registerSessionListener();
}
if (typeof sessionService.setupPersistenceListeners === 'function') {
  sessionService.setupPersistenceListeners();
}
```

With:
```javascript
// Centralized post-reset wiring (mirrors systemReset.js)
if (typeof transactionService.registerSessionListener === 'function') {
  transactionService.registerSessionListener();
}
if (typeof sessionService.setupScoreListeners === 'function') {
  sessionService.setupScoreListeners();
}
if (typeof sessionService.setupPersistenceListeners === 'function') {
  sessionService.setupPersistenceListeners();
}
if (typeof sessionService.setupGameClockListeners === 'function') {
  sessionService.setupGameClockListeners();
}
```

Note: `resetAllServicesForTesting()` uses `performSystemReset()` directly, so it inherits the fix from Task 5. Only `resetAllServices()` needs manual wiring.

**Verify:** `cd backend && npm test && npm run test:integration`

**Commit:** `fix: test helper mirrors centralized wiring from systemReset`

---

## Phase 3: Score Delivery Rationalization

### Task 6: Remove `score:updated` Event

`score:updated` is emitted by broadcasts.js to the `gm` room on every transaction and admin adjustment. It's redundant with:
- `transaction:new.teamScore` (already carried, just unused by consumers)
- `score:adjusted` (already emitted for admin adjustments)

**CRITICAL:** Keep the `teamScoreStash` — `transaction:new` still needs the stashed teamScore from `transaction:accepted`. Only remove the `broadcastScoreUpdate()` call and helper.

**Emitters to remove:**
- `broadcasts.js:237` — `emitToRoom(io, 'gm', 'score:updated', ...)` via `broadcastScoreUpdate()`
- Called from `transaction:accepted` listener (line 250) and `score:adjusted` listener (line 256)

**Consumers to migrate (Tasks 7-8):**
- GM Scanner: `orchestratorClient.js:245`, `networkedSession.js:198`
- Scoreboard: `scoreboard.html:1439`

**Files:**
- Modify: `backend/src/websocket/broadcasts.js`
- Modify: `backend/tests/unit/websocket/broadcasts.test.js`
- Modify: `backend/tests/contract/websocket/score-events.test.js`
- Modify: `backend/tests/integration/transaction-flow.test.js` (if it asserts `score:updated`)
- Modify: `backend/tests/integration/multi-client-broadcasts.test.js` (if it asserts `score:updated`)
- Modify: `backend/tests/integration/admin-interventions.test.js` (if it asserts `score:updated`)

**Changes to `broadcasts.js`:**

1. Remove the `broadcastScoreUpdate()` helper function entirely (lines 222-242)

2. Simplify `transaction:accepted` listener (lines 245-251) — keep ONLY the stash:
```javascript
addTrackedListener(transactionService, 'transaction:accepted', (payload) => {
  // Stash teamScore for enriching the upcoming transaction:new broadcast
  if (payload.transaction?.id && payload.teamScore) {
    teamScoreStash.set(payload.transaction.id, payload.teamScore);
  }
});
```

3. Simplify `score:adjusted` listener (lines 254-265) — remove `broadcastScoreUpdate` call, keep only the `score:adjusted` session-room broadcast:
```javascript
addTrackedListener(transactionService, 'score:adjusted', (payload) => {
  const session = sessionService.getCurrentSession();
  if (session && payload.teamScore) {
    emitToRoom(io, `session:${session.id}`, 'score:adjusted', {
      teamScore: payload.teamScore
    });
  }
});
```

**Test updates:**
- Remove all assertions that `score:updated` is emitted
- Update assertions to verify `transaction:new.teamScore` contains score data
- Update assertions to verify `score:adjusted` is emitted for admin adjustments
- Check every test file in the emitter list above for `score:updated` references

**Verify:** `cd backend && npm test` — some consumer-side tests may fail until Tasks 7-8 complete.

**Commit:** `refactor: remove score:updated event (scores delivered via transaction:new.teamScore + score:adjusted)`

---

### Task 7: Migrate GM Scanner Score Consumption

The GM Scanner must now get scores from:
- `transaction:new.teamScore` — for normal transactions (already delivered, currently ignored)
- `score:adjusted` — for admin adjustments (not currently forwarded)

**Files:**
- Modify: `ALNScanner/src/network/orchestratorClient.js:240-262` (messageTypes array)
- Modify: `ALNScanner/src/network/networkedSession.js:198-200, 260-263` (event handlers)
- Modify: `ALNScanner/tests/unit/network/networkedSession.test.js`

**Changes to `orchestratorClient.js`:**
- Replace `'score:updated'` with `'score:adjusted'` in the `messageTypes` array (line 245)

**Changes to `networkedSession.js`:**

1. Replace `score:updated` handler (lines 198-200):
```javascript
// OLD:
case 'score:updated':
  this.dataManager.updateTeamScoreFromBackend(payload);
  break;
```
With `score:adjusted` handler:
```javascript
case 'score:adjusted':
  if (payload.teamScore) {
    this.dataManager.updateTeamScoreFromBackend(payload.teamScore);
  }
  break;
```
Note: `score:adjusted` payload wraps score in `.teamScore` (per broadcasts.js:261-263), unlike `score:updated` which sent the score directly.

2. Update `transaction:new` handler (lines 260-263) to also extract teamScore:
```javascript
case 'transaction:new':
  if (payload.transaction) {
    this.dataManager.addTransactionFromBroadcast(payload.transaction);
  }
  if (payload.teamScore) {
    this.dataManager.updateTeamScoreFromBackend(payload.teamScore);
  }
  break;
```

**Verify:** `cd ALNScanner && npm test`

**Commit:** `refactor: GM Scanner consumes transaction:new.teamScore + score:adjusted (replaces score:updated)`

---

### Task 8: Migrate Scoreboard Score Consumption

The scoreboard must now get transaction scores from `transaction:new.teamScore` instead of `score:updated`. It already handles `score:adjusted`.

**Files:**
- Modify: `backend/public/scoreboard.html`

**Changes:**

1. Remove the `score:updated` listener (lines 1438-1442):
```javascript
// REMOVE:
state.socket.on('score:updated', (eventData) => {
    const scoreData = eventData.data;
    if (scoreData) updateTeamScore(scoreData);
});
```

2. Update the `transaction:new` handler (around line 1460) to also extract teamScore:
```javascript
state.socket.on('transaction:new', (eventData) => {
    const data = eventData.data;
    const transaction = data?.transaction;
    if (transaction) {
        console.log('[Scoreboard] Transaction:', transaction.tokenId, transaction.teamId);
        handleNewTransaction(transaction);
    }
    // Live score update from transaction
    if (data?.teamScore) {
        updateTeamScore(data.teamScore);
    }
});
```

**Verify:** Manual test — start backend, open scoreboard, process a transaction, verify score updates live. Also verify admin score adjustments still update the scoreboard (via existing `score:adjusted` handler).

**Commit:** `refactor: scoreboard consumes transaction:new.teamScore (replaces score:updated)`

---

## Phase 4: sync:full Data Flow Fixes

### Task 9: Fix sync:full Transaction Re-Submission

When the GM Scanner receives `sync:full`, it calls `addTransaction()` for each transaction — which re-submits them to the backend as new scans. Should use bulk restore semantics.

**Files:**
- Modify: `ALNScanner/src/network/networkedSession.js:215-217`
- Modify: `ALNScanner/tests/unit/network/networkedSession.test.js`

**Changes to `networkedSession.js`:**

Replace lines 215-217:
```javascript
// OLD (BUG: re-submits every transaction to backend):
if (payload.recentTransactions) {
  payload.recentTransactions.forEach(tx => this.dataManager.addTransaction(tx));
}
```

With:
```javascript
// Bulk restore — does NOT re-submit to backend
if (payload.recentTransactions) {
  if (typeof this.dataManager.setTransactions === 'function') {
    this.dataManager.setTransactions(payload.recentTransactions);
  } else {
    // Fallback: add individually without re-submission
    payload.recentTransactions.forEach(tx => this.dataManager.addTransactionFromBroadcast(tx));
  }
}
```

Note: `setTransactions()` exists on UnifiedDataManager (`unifiedDataManager.js`) — verify it delegates correctly to the active strategy. `NetworkedStorage.setTransactions()` does a bulk replace without socket emission.

**Verify:** `cd ALNScanner && npm test`

**Commit:** `fix: sync:full uses bulk restore instead of re-submitting transactions`

---

### Task 10: Fix sync:full Emission Scope

`broadcasts.js` emits `sync:full` globally (to ALL sockets) on `scores:reset` and `offline:queue:processed`. Should be room-scoped to `gm`.

**Files:**
- Modify: `backend/src/websocket/broadcasts.js:338, 379`
- Modify: `backend/tests/unit/websocket/broadcasts.test.js`

**Changes:**

Line 338 (scores:reset handler):
```javascript
// OLD: emitWrapped(io, 'sync:full', syncFullPayload);
// NEW:
emitToRoom(io, 'gm', 'sync:full', syncFullPayload);
```

Line 379 (offline:queue:processed handler):
```javascript
// OLD: emitWrapped(io, 'sync:full', syncFullPayload);
// NEW:
emitToRoom(io, 'gm', 'sync:full', syncFullPayload);
```

**Verify:** `cd backend && npm test && npm run test:integration`

**Commit:** `fix: scope sync:full broadcasts to gm room (was global)`

---

## Phase 5: D-Bus Sender Isolation

### Task 11: Add `_resolveOwner()` to systemReset After Monitor Restart

After systemReset, VLC and Spotify D-Bus monitors restart with `_ownerBusName = null` — no sender filtering. Must re-resolve after monitor restart.

**Files:**
- Modify: `backend/src/services/systemReset.js:257-275`

**Changes:**

After VLC monitor restart (around line 262):
```javascript
if (vlcService) {
  try { await vlcService.checkConnection(); } catch (err) {
    logger.debug('VLC health re-check failed after reset:', err.message);
  }
  vlcService.startPlaybackMonitor();
  // Re-resolve D-Bus owner for sender filtering (prevents cross-contamination with Spotify)
  vlcService._resolveOwner().catch(err => {
    logger.debug('VLC owner re-resolution failed after reset:', err.message);
  });
}
```

After Spotify monitor restart (around line 273):
```javascript
if (spotifyService) {
  if (typeof spotifyService.checkConnection === 'function') {
    try { await spotifyService.checkConnection(); } catch (err) {
      logger.debug('Spotify health re-check failed after reset:', err.message);
    }
  }
  if (typeof spotifyService.startPlaybackMonitor === 'function') {
    spotifyService.startPlaybackMonitor();
  }
  // Re-resolve D-Bus owner for sender filtering (prevents cross-contamination with VLC)
  if (typeof spotifyService._resolveOwner === 'function') {
    spotifyService._resolveOwner().catch(err => {
      logger.debug('Spotify owner re-resolution failed after reset:', err.message);
    });
  }
}
```

**Verify:** `cd backend && npm test`

**Commit:** `fix: re-resolve D-Bus owners after systemReset monitor restart`

---

### Task 12: Add `_resolveOwner()` to VLC Crash-Restart Path

When VLC crashes and auto-restarts, `_ownerBusName` is cleared but never re-resolved. The new VLC instance gets a new unique bus name. Must re-resolve after restart.

**Files:**
- Modify: `backend/src/services/vlcMprisService.js:71-77`
- Modify: `backend/tests/unit/services/vlcMprisService.test.js`

**Changes to `vlcMprisService.js`:**

In the crash handler (lines 71-77), add owner re-resolution after VLC respawns:
```javascript
if (!this._vlcStopped) {
  logger.info('[VLC] Scheduling restart in 3s');
  this._vlcRestartTimer = setTimeout(async () => {
    this._vlcRestartTimer = null;
    this._spawnVlcProcess();
    // Wait for VLC to register on D-Bus, then re-resolve owner for sender filtering
    const ready = await this._waitForVlcReady();
    if (ready) {
      this._resolveOwner().catch(err => {
        logger.debug('[VLC] Owner re-resolution failed after crash restart:', err.message);
      });
    }
  }, 3000);
}
```

**Verify:** `cd backend && npm test`

**Commit:** `fix: re-resolve D-Bus owner after VLC crash-restart`

---

## Documentation Updates

### Task 13: Update CLAUDE.md and Memory

After all changes land:

**Files:**
- Modify: `CLAUDE.md` (root — remove `score:updated` deprecation note, update event documentation)
- Modify: `backend/CLAUDE.md` (remove `score:updated` references, update event flow, update stateService description)
- Modify: `ALNScanner/CLAUDE.md` (update score event documentation)

**Key updates:**
- Remove all references to `score:updated` as an event
- Remove `state:request`/`state:sync` from event documentation
- Update stateService description — no longer has event listeners, only `getCurrentState()` remains
- Document that scores arrive via `transaction:new.teamScore` (transactions) and `score:adjusted` (admin)
- Update systemReset documentation — centralized post-reset wiring
- Remove the "deprecated" label from any score-related docs — the transition is complete
- Update `service-reset.js` LISTENER_DIAGNOSTICS.md if it references stateService

**Verify:** Read through all CLAUDE.md files for stale references to removed events/functions.

**Commit:** `docs: update CLAUDE.md files for layer transition cleanup`

---

## Verification Checklist (Run After All Tasks)

```bash
# Unit + contract tests
cd backend && npm test

# Integration tests (sequential)
cd backend && npm run test:integration

# GM Scanner unit tests
cd ALNScanner && npm test

# E2E tests (requires running orchestrator)
cd backend && npm run dev:full
# In another terminal:
cd backend && npm run test:e2e
```

All test suites must pass. If any test references `score:updated`, `state:request`, `state:sync`, `handleStateRequest`, `setupTransactionListeners`, or `broadcastScoreUpdate` — it needs updating. Grep for these terms across all test files as a final check:

```bash
grep -r "score:updated\|state:request\|state:sync\|handleStateRequest\|setupTransactionListeners\|broadcastScoreUpdate" backend/tests/ ALNScanner/tests/
```

Any remaining matches are missed cleanup.

---

## What This Does NOT Change

- `sync:request` handler in server.js — this is LIVE (scoreboard uses it on reconnect)
- `score:adjusted` event — this STAYS (admin adjustments, consumed by both GM Scanner and scoreboard)
- `transaction:new` event — this STAYS (enriched with teamScore, now consumed for scoring)
- `sync:full` payload structure — unchanged (still includes scores, recentTransactions, etc.)
- `sessionService.init()` — still calls setup methods at startup (correct for first boot)
- `getCurrentState()` on stateService — still exists for backward compat (startup diagnostic only)
- Per-service findings (ProcessMonitor gave-up, combine-sink monitoring, A2DP enforcement, lighting auth_invalid, etc.) — separate concerns, not part of this cleanup
