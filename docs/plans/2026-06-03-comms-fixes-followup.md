# Comms-Layer Fixes Follow-Up Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to implement this plan task-by-task. Every task is RED → GREEN → COMMIT.

**Goal:** Land the 11 confirmed fixes from the adversarial review of linked PRs ALN‑Ecosystem#16 ↔ ALNScanner#9 — closing two real reconnect/queue race conditions and a cluster of correctness/contract/quality gaps — without regressing the existing green suites.

**Architecture:** Two repos. The GM scanner (`ALNScanner/`, a git submodule on branch `fix/alnscanner-comms`) holds 9 fixes (reconnect state machine, durable queue, BFCache lifecycle, renderer escaping, test/doc cleanup). The backend (`backend/`, direct in the parent repo, same branch name) holds 3 fixes (sync:request reconcile parity, AsyncAPI error enum, dead-code deletion). These extend the **already-open** PRs, so work happens on the existing `fix/alnscanner-comms` branch in each repo; the parent's submodule gitlink is re-bumped at the end.

**Tech Stack:** ES6 modules + Vite 7 + Jest/jsdom (ALNScanner); Node.js + Socket.io + Jest + AJV-against-AsyncAPI/OpenAPI contracts (backend); Playwright E2E (parent, not exercised by these unit/contract/integration fixes).

---

## Scope & origin

Every item below was (a) raised by an 8-dimension adversarial review, (b) re-verified against live code by a dedicated investigator (several with executable reproductions), and (c) given an exact fix + fail-first test. Two judgment calls were resolved by the author:
- **NC‑2** → implement the **min-uptime gate** (Option B).
- **AUDIO‑ROUTING‑SELECTORS** → **apply the escape wrap** (Option A).

| # | ID | Repo | Severity | One-liner |
|---|----|------|----------|-----------|
| 1 | NC‑3 | ALNScanner | low | Clear stale `_lastErrorReason` on successful connect (interlocks with NC‑1) |
| 2 | NC‑1 | ALNScanner | **high** | Health-check failure during auto-reconnect must reschedule, not give up |
| 3 | NC‑2 | ALNScanner | low | Min-uptime gate so a flapping endpoint escalates backoff |
| 4 | NQ‑1 | ALNScanner | **high** | Don't wholesale-clobber a transaction enqueued mid-flush |
| 5 | NQ‑2 | ALNScanner | low | Per-attempt `activeHandlers` key + correct the false comment |
| 6 | BFCACHE | ALNScanner | low | Null-safe service lookup in lifecycle handlers (no thrown getter) |
| 7 | AUDIO‑ROUTING | ALNScanner | low | Wrap 3 audio `querySelector`s with `escapeCssAttrValue` |
| 8 | DUPLICATE‑SW | ALNScanner | low | Consolidate two build-artifact SW tests into one (one vite build) |
| 9 | CLAUDE‑MD | ALNScanner | nit | Correct the Chrome floor (89 → 107) |
| 10 | CD‑1 | backend | low | `sync:request` sync:full must include `deviceScannedTokens` (gmAuth parity) |
| 11 | QUEUE_FULL | backend | low | Add `QUEUE_FULL` + `INVALID_DATA` to the AsyncAPI error-code enum |
| 12 | ORPHAN | backend | nit | Delete dead `backend/src/docs/openapi.js` (opportunistic, out-of-PR-scope) |

## Execution order & dependencies

- **Phase 1 (ALNScanner submodule):** Tasks 1–9. **Tasks 1→2→3 are ordered and edit the same two methods** of `connectionManager.js` — do them in that order, re-running the full `connectionManager.test.js` after each. Tasks 4–9 are independent of each other and of 1–3.
- **Phase 2 (backend / parent):** Tasks 10–12. Independent of Phase 1 and of each other.
- **Phase 3 (integrate):** Task 13 — rebuild ALNScanner `dist/`, bump the parent's submodule gitlink, run the pre-merge checks.

**Branch:** work on `fix/alnscanner-comms` in each repo (confirm with `git -C <repo> branch --show-current`). Optionally isolate in a worktree per superpowers:using-git-worktrees, but since these address feedback on open PRs, extending the PR branches in place is the natural flow. **All commits should carry the standard `Co-Authored-By` trailer.**

**Submodule commit rule:** ALNScanner edits are committed *inside* `ALNScanner/`; the parent records the new gitlink in Phase 3 (see SUBMODULE_MANAGEMENT.md).

## Verification baselines (capture BEFORE starting)

Run these once and note the numbers so "no regression" is measurable. Do not hardcode counts into assertions.

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npm test 2>&1 | tail -5
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npm test 2>&1 | tail -5
```

Expected starting point (per project memory; confirm locally): ALNScanner ~1155 unit; backend ~1739 unit+contract (this branch). Integration is run per-file below with `--config jest.integration.config.js`.

---

# Phase 1 — ALNScanner submodule (GM scanner)

> All paths in Phase 1 are under `/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner/`. Run jest from that directory.

## Connection-manager cluster (Tasks 1–3) — read first

Tasks 1–3 converge `src/network/connectionManager.js` `_doConnect()` and `_setupReconnectionHandler()` to this **final target state**. Implement incrementally (one failing test each), but this is where you're headed:

```js
// _doConnect() — final shape after Tasks 1+2+3
async _doConnect() {
  if (!this.isTokenValid()) {
    this._clearStaleToken();
    this.dispatchEvent(new CustomEvent('auth:required', { detail: { reason: 'invalid_token' } }));
    throw new Error('Invalid or expired token');
  }

  this._clearRetryTimer();
  this.state = 'connecting';
  this.dispatchEvent(new CustomEvent('connecting'));
  this._setupErrorHandler();

  try {
    // NC-1: health check INSIDE try → a failed check flows through retryCount++/_scheduleRetry()
    const healthy = await this.checkHealth();
    if (!healthy) {
      throw new Error('Orchestrator unreachable');
    }

    await this.client.connect(this.token, {
      deviceId: this.config.deviceId,
      deviceType: this.config.deviceType
    });

    this.state = 'connected';
    this._connectedAt = Date.now();   // NC-2: uptime start (NOTE: retryCount is NO LONGER reset here)
    this._lastErrorReason = null;     // NC-3: drop any stale reason so a later reason-less reject isn't misread
    this.dispatchEvent(new CustomEvent('connected'));
    this._setupReconnectionHandler();

  } catch (error) {
    this.state = 'disconnected';
    const reason = this._lastErrorReason;
    this._lastErrorReason = null; // consume

    if (reason === 'AUTH_INVALID' || reason === 'AUTH_REQUIRED') {
      this.token = null;
      try { localStorage.removeItem('aln_auth_token'); } catch { /* unavailable */ }
      this.dispatchEvent(new CustomEvent('auth:required', { detail: { reason: 'auth_failed' } }));
      throw error;
    }

    this.retryCount++;
    if (this.retryCount < this.maxRetries) {
      this._scheduleRetry();
    } else {
      if (!this.isTokenValid()) { this._clearStaleToken(); }
      this.dispatchEvent(new CustomEvent('auth:required', { detail: { reason: 'max_retries' } }));
    }
    throw error;
  }
}
```

```js
// _setupReconnectionHandler() disconnect branch — final shape after Task 3 (NC-2).
// (Only the reconnect-scheduling tail changes; CLIENT_INITIATED early-return and token guard unchanged.)
      // Reset backoff ONLY if the just-dropped session was stable long enough; a
      // flapping connect-then-drop must keep escalating toward the 30s cap (NC-2).
      const MIN_STABLE_MS = 10000;
      if (this._connectedAt && (Date.now() - this._connectedAt) >= MIN_STABLE_MS) {
        this.retryCount = 0;
      }
      this._connectedAt = 0;

      this._clearRetryTimer();
      this.retryTimer = setTimeout(() => {
        this.connect().catch(() => { /* retry logic handles failures */ });
      }, this._calculateRetryDelay());
```

Also add the field to the constructor (near the `retryCount` init, ~L34):
```js
    this._connectedAt = 0; // ms timestamp of last successful connect (NC-2 min-uptime gate)
```

**Regression watch for the whole cluster:** the existing M1 first-connect-capture test (~L497), the AUTH_INVALID no-retry test (~L458), the M2 reconnect-stacking tests (~L313–348), and "should check health before connecting" (~L150) must all stay green. If any existing test asserts `retryCount === 0` immediately after a *post-retry* success, NC‑2 will surface it — fix the assertion to reflect "reset on stable drop," not "reset on connect."

---

### Task 1: NC‑3 — clear `_lastErrorReason` on successful connect

**Files:**
- Modify: `src/network/connectionManager.js` (success block of `_doConnect()`, ~L147‑153)
- Test: `tests/unit/network/connectionManager.test.js` (in `describe('connect_error handling')`)

**Step 1 — Write the failing test** (append inside `describe('connect_error handling', ...)`):
```js
    it('does not mis-apply a stale AUTH_* reason from an earlier session to a later transient reject (NC-3)', async () => {
      // beforeEach already established a successful connect. Grab the registered socket:error handler.
      const errorHandler = mockClient.addEventListener.mock.calls
        .find(c => c[0] === 'socket:error')[1];

      // A late connect_error during the healthy session writes _lastErrorReason.
      errorHandler({ detail: { reason: 'AUTH_INVALID', error: new Error('x') } });

      const authHandler = jest.fn();
      connectionManager.addEventListener('auth:required', authHandler);

      // A SUBSEQUENT reconnect rejects transiently with NO fresh socket:error
      // (mirrors OrchestratorClient's 'Connection timeout' reject path).
      mockClient.connect.mockRejectedValueOnce(new Error('Connection timeout'));
      connectionManager.token = createValidToken();

      await expect(connectionManager.connect()).rejects.toThrow('Connection timeout');

      expect(authHandler).not.toHaveBeenCalledWith(expect.objectContaining({
        detail: { reason: 'auth_failed' }
      }));
      expect(connectionManager.token).not.toBeNull();      // token preserved
      expect(connectionManager.retryTimer).not.toBeNull();  // retry scheduled
      expect(connectionManager.retryCount).toBe(1);
    });
```

**Step 2 — Run to verify it FAILS:**
```bash
npx jest tests/unit/network/connectionManager.test.js -t 'stale AUTH' 2>&1 | tail -20
```
Expected: FAIL — the stale `AUTH_INVALID` is read in the catch → token nulled, `auth:required{reason:'auth_failed'}` dispatched, `retryTimer` null.

**Step 3 — Implement:** in the `_doConnect()` success block, add the clear right after `this.retryCount = 0;` (Task 2 later replaces that line; for now keep it):
```js
      this.state = 'connected';
      this.retryCount = 0;
      this._lastErrorReason = null; // NC-3: don't let a stale connect_error reason leak into a later reject
      this.dispatchEvent(new CustomEvent('connected'));
```

**Step 4 — Run to verify it PASSES** + full file:
```bash
npx jest tests/unit/network/connectionManager.test.js -t 'stale AUTH' 2>&1 | tail -10
npx jest tests/unit/network/connectionManager.test.js 2>&1 | tail -10
```
Expected: new test PASS; all existing tests still PASS.

**Step 5 — Commit:**
```bash
git add src/network/connectionManager.js tests/unit/network/connectionManager.test.js
git commit -m "fix(gm-scanner): clear stale _lastErrorReason on connect so a later transient reject isn't mis-handled as auth failure (NC-3)"
```

---

### Task 2: NC‑1 — health-check failure during auto-reconnect must reschedule

**Files:**
- Modify: `src/network/connectionManager.js` (`_doConnect()`: move the health check inside the `try`, ~L121‑145)
- Test: `tests/unit/network/connectionManager.test.js` (in `describe('reconnection handling')`)

**Step 1 — Write the failing test** (append inside `describe('reconnection handling', ...)`; unlike its siblings, do NOT mock `connect()` — let the real `_doConnect()`/`checkHealth()` run):
```js
    it('reschedules a retry when checkHealth() fails on an auto-reconnect (NC-1)', async () => {
      jest.useFakeTimers();
      try {
        connectionManager.token = createValidToken();
        const healthSpy = jest.spyOn(connectionManager, 'checkHealth').mockResolvedValue(false);

        // A transport drop arms the first auto-reconnect timer.
        const disconnectHandler = mockClient.addEventListener.mock.calls
          .find(c => c[0] === 'socket:disconnected')[1];
        disconnectHandler({ detail: { reason: 'transport close' } });
        expect(connectionManager.retryTimer).not.toBeNull();

        // Fire the reconnect: connect() -> _doConnect() -> checkHealth() === false.
        await jest.advanceTimersByTimeAsync(60000);

        expect(healthSpy).toHaveBeenCalled();
        expect(connectionManager.retryCount).toBeGreaterThanOrEqual(1); // catch ran
        expect(connectionManager.retryTimer).not.toBeNull();            // loop self-perpetuates
      } finally {
        connectionManager._clearRetryTimer();
        jest.useRealTimers();
      }
    });
```

**Step 2 — Run to verify it FAILS:**
```bash
npx jest tests/unit/network/connectionManager.test.js -t 'reschedules a retry when checkHealth' 2>&1 | tail -20
```
Expected: FAIL on `expect(connectionManager.retryTimer).not.toBeNull()` — the throw bypassed `_scheduleRetry()` and the timer stayed null.

**Step 3 — Implement:** move the health check and its throw from *before* the `try` to *inside* it (top of the `try`), keeping `_clearRetryTimer()` / `state='connecting'` / `dispatch('connecting')` / `_setupErrorHandler()` in their current order. See the "final shape" listing above. Concretely: delete the pre-`try` health block (`const healthy = await this.checkHealth(); if (!healthy) throw …`) and insert it as the first statements inside `try {`.

**Step 4 — Run to verify it PASSES** + full file (watch "should check health before connecting" ~L150 still green):
```bash
npx jest tests/unit/network/connectionManager.test.js -t 'reschedules a retry when checkHealth' 2>&1 | tail -10
npx jest tests/unit/network/connectionManager.test.js 2>&1 | tail -10
```
Expected: new test PASS; all existing PASS (the initial-connect path still rejects with 'Orchestrator unreachable' and never calls `client.connect`).

**Step 5 — Commit:**
```bash
git add src/network/connectionManager.js tests/unit/network/connectionManager.test.js
git commit -m "fix(gm-scanner): route reconnect health-check failure through retry backoff so a sustained outage self-heals (NC-1)"
```

---

### Task 3: NC‑2 — min-uptime gate so a flapping endpoint escalates backoff

**Files:**
- Modify: `src/network/connectionManager.js` (constructor field; `_doConnect()` success block; `_setupReconnectionHandler()` disconnect branch)
- Test: `tests/unit/network/connectionManager.test.js`

**Step 1 — Write the failing test** (append inside `describe('reconnection handling', ...)`):
```js
    it('escalates backoff for a flapping endpoint and resets only after a stable session (NC-2)', async () => {
      jest.useFakeTimers();
      try {
        connectionManager.token = createValidToken();
        jest.spyOn(connectionManager, 'checkHealth').mockResolvedValue(true);
        const disconnectHandler = mockClient.addEventListener.mock.calls
          .find(c => c[0] === 'socket:disconnected')[1];

        // Seed an elevated backoff (as if prior retries climbed).
        connectionManager.retryCount = 3;

        // FLAP: a sub-MIN_STABLE_MS session that drops must NOT reset retryCount.
        connectionManager._connectedAt = Date.now(); // "just connected"
        disconnectHandler({ detail: { reason: 'transport close' } });
        expect(connectionManager.retryCount).toBe(3); // not reset by a brief session

        connectionManager._clearRetryTimer();

        // STABLE: a session that lasted >= MIN_STABLE_MS resets backoff on drop.
        connectionManager._connectedAt = Date.now() - 15000; // 15s uptime
        disconnectHandler({ detail: { reason: 'transport close' } });
        expect(connectionManager.retryCount).toBe(0);
      } finally {
        connectionManager._clearRetryTimer();
        jest.useRealTimers();
      }
    });
```
> Note: `jest.useFakeTimers()` mocks `Date.now()`. Setting `_connectedAt = Date.now() - 15000` makes the delta ≥ MIN_STABLE_MS deterministically regardless of the frozen clock.

**Step 2 — Run to verify it FAILS:**
```bash
npx jest tests/unit/network/connectionManager.test.js -t 'escalates backoff for a flapping' 2>&1 | tail -20
```
Expected: FAIL — currently `retryCount` is reset to 0 on every successful connect (and there's no `_connectedAt` field), so the flap assertion `toBe(3)` fails.

**Step 3 — Implement:**
1. Constructor (~L34): add `this._connectedAt = 0;`.
2. `_doConnect()` success block: **replace** `this.retryCount = 0;` with `this._connectedAt = Date.now();` (keep the NC‑3 `this._lastErrorReason = null;` line).
3. `_setupReconnectionHandler()` disconnect branch: insert the MIN_STABLE_MS gate immediately before `this._clearRetryTimer(); this.retryTimer = setTimeout(...)` — see the "final shape" listing above.

**Step 4 — Run to verify it PASSES** + full file (watch M2 reconnect-stacking ~L313 and any post-retry-success assertions):
```bash
npx jest tests/unit/network/connectionManager.test.js -t 'escalates backoff for a flapping' 2>&1 | tail -10
npx jest tests/unit/network/connectionManager.test.js 2>&1 | tail -10
```
Expected: new test PASS; all existing PASS.

**Step 5 — Commit:**
```bash
git add src/network/connectionManager.js tests/unit/network/connectionManager.test.js
git commit -m "fix(gm-scanner): gate backoff reset on min stable uptime so a flapping endpoint escalates instead of hammering at 1s (NC-2)"
```

---

### Task 4: NQ‑1 — preserve a transaction enqueued mid-flush

**Files:**
- Modify: `src/network/networkedQueueManager.js` (`syncQueue()` tail, ~L217‑219)
- Test: `tests/unit/network/networkedQueueManager.test.js` (in `describe('syncQueue')`)

**Step 1 — Write the failing test** (append inside `describe('syncQueue', ...)`; this suite uses real timers + a `setTimeout(r,0)` microtask flush):
```js
    it('keeps an entry enqueued mid-flush (during a replay await) — does not wholesale-clobber the live queue (NQ-1)', async () => {
      queueManager.tempQueue = [{ tokenId: 'offline1', teamId: '001', clientTxId: 'off-1' }];

      let midScanId;
      jest.spyOn(queueManager, 'replayTransaction').mockImplementation(async (tx) => {
        if (tx.clientTxId === 'off-1') {
          // A live GM scan lands WHILE we await the offline entry's replay. From now
          // replays resolve 'queued' so the mid-flush entry's own _submitDurable does
          // NOT remove it — syncQueue's surgical removal must preserve it.
          queueManager.replayTransaction.mockResolvedValue({ status: 'queued' });
          midScanId = queueManager.queueTransaction({ tokenId: 'midScan', teamId: '002' });
          return { status: 'accepted', clientTxId: 'off-1' };
        }
        return { status: 'queued' };
      });

      await queueManager.syncQueue();
      await new Promise(resolve => setTimeout(resolve, 0)); // flush _submitDurable microtasks

      expect(queueManager.tempQueue.some(t => t.clientTxId === 'off-1')).toBe(false);   // processed → gone
      expect(queueManager.tempQueue.some(t => t.clientTxId === midScanId)).toBe(true);  // survives (was dropped pre-fix)
    });
```

**Step 2 — Run to verify it FAILS:**
```bash
npx jest tests/unit/network/networkedQueueManager.test.js -t 'mid-flush' 2>&1 | tail -20
```
Expected: FAIL — the mid-flush entry is absent (wholesale `this.tempQueue = survivors` dropped it).

**Step 3 — Implement:** replace the `this.tempQueue = survivors; this.saveQueue();` block at the end of `syncQueue()` with an identity-keyed surgical removal:
```js
      // Remove ONLY the batch entries that reached a definitive result from the LIVE
      // queue — never wholesale-reassign. A queueTransaction() that landed mid-flush
      // (during a replay await) pushed a new entry into this.tempQueue that is in
      // neither `batch` nor `survivors`; reassigning would silently drop it (NQ-1).
      // Identity-keyed (Set of object refs): survivors hold the SAME references as
      // batch, so this also works for legacy entries that lack a clientTxId.
      const survivorSet = new Set(survivors);
      const done = new Set(batch.filter(t => !survivorSet.has(t)));
      this.tempQueue = this.tempQueue.filter(t => !done.has(t));
      this.saveQueue();
```

**Step 4 — Run to verify it PASSES** + full file (watch "should keep a transient-failed entry…" ~L327, whose seed txs lack `clientTxId` — identity keying handles them; a clientTxId key would not):
```bash
npx jest tests/unit/network/networkedQueueManager.test.js -t 'mid-flush' 2>&1 | tail -10
npx jest tests/unit/network/networkedQueueManager.test.js 2>&1 | tail -10
```
Expected: new test PASS; all existing PASS.

**Step 5 — Commit:**
```bash
git add src/network/networkedQueueManager.js tests/unit/network/networkedQueueManager.test.js
git commit -m "fix(gm-scanner): surgically remove processed entries from the live queue so a scan enqueued mid-flush isn't lost (NQ-1)"
```

---

### Task 5: NQ‑2 — per-attempt `activeHandlers` key + correct the comment

**Files:**
- Modify: `src/network/networkedQueueManager.js` (module-level counter; `replayTransaction()` `handlerKey` ~L247‑250; `queueTransaction()` comment ~L56‑60)
- Test: `tests/unit/network/networkedQueueManager.test.js` (in `describe('replayTransaction')`)

**Step 1 — Write the failing test** (append inside `describe('replayTransaction', ...)`):
```js
    it('keeps two replays of the SAME clientTxId independent in activeHandlers (reconnect re-send, NQ-2)', async () => {
      const handlers = [];
      mockClient.addEventListener.mockImplementation((type, h) => {
        if (type === 'message:received') handlers.push(h);
      });

      const tx = { tokenId: 'tk', teamId: '001', clientTxId: 'X' };
      const pA = queueManager.replayTransaction(tx);
      const pB = queueManager.replayTransaction(tx);

      // Pre-fix: the clientTxId key collides — call B overwrites call A → size 1.
      expect(queueManager.activeHandlers.size).toBe(2);

      // A single definitive result resolves BOTH (both match by clientTxId); each cleans up its OWN entry.
      handlers.forEach(h => h({ detail: { type: 'transaction:result', payload: { clientTxId: 'X', status: 'accepted' } } }));
      await Promise.all([pA, pB]);

      expect(queueManager.activeHandlers.size).toBe(0);
    });
```

**Step 2 — Run to verify it FAILS:**
```bash
npx jest tests/unit/network/networkedQueueManager.test.js -t 'same clientTxId independent' 2>&1 | tail -20
```
Expected: FAIL — `Expected: 2, Received: 1` (call B overwrote call A under the identical key).

**Step 3 — Implement:**
1. Add a module-level counter above the class declaration (after the top doc-comment, before `export class NetworkedQueueManager`):
```js
let _attemptSeq = 0; // monotonic per-attempt nonce for activeHandlers keys (NQ-2)
```
2. In `replayTransaction()`, replace the `handlerKey` definition with a per-attempt key (wire matching stays by clientTxId in the handler body):
```js
      // Key by a per-ATTEMPT id, not by clientTxId. The same entry can be replayed
      // twice for one clientTxId across a reconnect (a connected _submitDurable that
      // never got a definitive result stays queued and is re-replayed by syncQueue).
      // A clientTxId key would let attempt #2 overwrite attempt #1 in activeHandlers,
      // so attempt #1's 30s timeout would de-register attempt #2's still-live listener
      // and drop its result (NQ-2). The wire result is still MATCHED by clientTxId.
      const matchId = transaction.clientTxId || `${transaction.tokenId}-${transaction.teamId}`;
      const handlerKey = `${matchId}#${++_attemptSeq}`;
```
3. Replace the false comment in `queueTransaction()` (~L56‑60) with:
```js
      // Connected: submit now and remove only on a definitive result. If the socket
      // drops before that result arrives, this entry stays in tempQueue and is
      // re-replayed by syncQueue() on reconnect — so the SAME clientTxId can be in
      // flight twice. That is safe: each replay attempt gets a unique activeHandlers
      // key (NQ-2), and backend GM dedup + reconcileWithServerState prevent double-scoring.
```

**Step 4 — Run to verify it PASSES** + full file (watch "tracks concurrent same-token replays under distinct handler keys" ~L656 — two *different* clientTxIds → still size 2 — and "cleanup after success" → size 0) + build smoke:
```bash
npx jest tests/unit/network/networkedQueueManager.test.js -t 'same clientTxId independent' 2>&1 | tail -10
npx jest tests/unit/network/networkedQueueManager.test.js 2>&1 | tail -10
npm run build 2>&1 | tail -5
```
Expected: new test PASS; all existing PASS; build succeeds (module-level `let` is plain ES6).

**Step 5 — Commit:**
```bash
git add src/network/networkedQueueManager.js tests/unit/network/networkedQueueManager.test.js
git commit -m "fix(gm-scanner): key replay activeHandlers per-attempt so a reconnect re-send can't drop the other attempt's result (NQ-2)"
```

---

### Task 6: BFCACHE — null-safe service lookup in lifecycle handlers

**Files:**
- Modify: `src/ui/connectionWizard.js` (`setupCleanupHandlers` — `closeSocket` ~L524, `reopenSocket` ~L533)
- Test: `tests/unit/ui/connectionWizard.test.js` (in `describe('setupCleanupHandlers() — page lifecycle (RL-2)')`)
- **Required mock update:** the same test file's existing `lifecycleApp` mock (~L498‑505)

**Step 1 — Write the failing tests** (append after the existing "pauses NFC on background" test):
```js
  it('does not throw when networkedSession exists but services is not yet initialized (init/destroy window)', () => {
    const sessionLike = {
      services: null,
      getService: jest.fn(() => { throw new Error('Session not initialized'); })
    };
    const initWindowApp = {
      pauseNFCForBackground: jest.fn(),
      resumeNFCForForeground: jest.fn(),
      networkedSession: sessionLike
    };
    setupCleanupHandlers(initWindowApp);

    setVisibility('hidden');
    expect(() => document.dispatchEvent(new Event('visibilitychange'))).not.toThrow();
    setVisibility('visible');
    expect(() => document.dispatchEvent(new Event('visibilitychange'))).not.toThrow();

    expect(initWindowApp.pauseNFCForBackground).toHaveBeenCalledTimes(1);
    expect(initWindowApp.resumeNFCForForeground).toHaveBeenCalledTimes(1);
  });

  it('does not throw on pagehide during the init/destroy window (services null)', () => {
    const pagehideApp = {
      pauseNFCForBackground: jest.fn(),
      resumeNFCForForeground: jest.fn(),
      networkedSession: {
        services: null,
        getService: jest.fn(() => { throw new Error('Session not initialized'); })
      }
    };
    setupCleanupHandlers(pagehideApp);
    expect(() => window.dispatchEvent(new Event('pagehide'))).not.toThrow();
    expect(pagehideApp.pauseNFCForBackground).toHaveBeenCalledTimes(1);
  });
```

**Step 2 — Run to verify it FAILS:**
```bash
npx jest tests/unit/ui/connectionWizard.test.js -t 'init/destroy window' 2>&1 | tail -20
```
Expected: FAIL — `getService()` throws synchronously, propagating out of the DOM listener (optional chaining does not catch a thrown getter).

**Step 3 — Implement (two parts):**
1. In `setupCleanupHandlers`, change both lookups from the throwing getter to the null-safe property path:
```js
    // closeSocket:
    const cm = app.networkedSession?.services?.connectionManager; // null-safe; getService() THROWS when services is null
    // reopenSocket:
    const cm = app.networkedSession?.services?.connectionManager;
```
2. **Required:** update the existing `lifecycleApp` mock (~L498‑505) so the happy-path tests still resolve a `cm`. It currently exposes only `getService`; the fix reads `services.connectionManager`. Change it to expose the service object:
```js
    // BEFORE: getService: jest.fn(() => cm)  (or similar)
    // AFTER: expose the services bag so services?.connectionManager resolves to cm
    networkedSession: { services: { client: mockClient, connectionManager: cm } },
```
(Keep `getService` too if other assertions reference it; the lifecycle handlers no longer call it.)

**Step 4 — Run to verify it PASSES** + full file + full scanner suite (the lifecycle "closes the socket via ConnectionManager.disconnect" / "reconnects via ConnectionManager" tests depend on the mock update):
```bash
npx jest tests/unit/ui/connectionWizard.test.js -t 'page lifecycle' 2>&1 | tail -15
npm test 2>&1 | tail -10
```
Expected: new tests PASS; existing RL‑2 tests PASS.

**Step 5 — Commit:**
```bash
git add src/ui/connectionWizard.js tests/unit/ui/connectionWizard.test.js
git commit -m "fix(gm-scanner): read connectionManager via null-safe path in lifecycle handlers (getService() throws during init/destroy window) (BFCACHE)"
```

---

### Task 7: AUDIO‑ROUTING — wrap 3 `querySelector`s with `escapeCssAttrValue`

**Files:**
- Modify: `src/ui/renderers/EnvironmentRenderer.js` (3 `querySelector` sites: ~L163, L182, L245; `escapeCssAttrValue` already imported at L2)
- Test: `tests/unit/ui/renderers/EnvironmentRenderer.test.js`

> Scope guard: only the three **`querySelector`** call-sites change. Do NOT touch the build-side `innerHTML` interpolations at ~L215/L222 (`data-stream="${stream.id}"`) — those need an HTML escaper, not a CSS one.

**Step 1 — Write the failing tests** (append a new `describe` block):
```js
  describe('Audio Routing - selector escaping (defensive consistency)', () => {
    const sinks = [
      { name: 'hdmi', label: 'HDMI' },
      { name: 'bluetooth', label: 'BT' },
    ];

    it('does not throw and still applies legitimate routes when a route key contains a CSS metachar', () => {
      renderer.renderAudio({ availableSinks: sinks, routes: { video: 'hdmi' } });
      expect(document.querySelector('select[data-stream="video"]')).toBeTruthy();

      expect(() =>
        renderer.renderAudio({
          availableSinks: sinks,
          routes: { 'a"b': 'hdmi', video: 'bluetooth' }, // bad key iterated before the real one
        })
      ).not.toThrow();

      expect(document.querySelector('select[data-stream="video"]').value).toBe('bluetooth');
    });

    it('does not throw when a volumes key contains a CSS metachar', () => {
      renderer.renderAudio({ availableSinks: sinks, routes: {}, volumes: {} });
      expect(() =>
        renderer.renderAudio({ availableSinks: sinks, routes: {}, volumes: { 'a"b': 50, video: 30 } })
      ).not.toThrow();
      expect(document.querySelector('input[data-stream="video"]').value).toBe('30');
    });
  });
```
> Match the exact `renderAudio` argument shape used elsewhere in this test file (read existing audio tests first; adjust keys if the renderer expects a different envelope).

**Step 2 — Run to verify it FAILS:**
```bash
npx jest tests/unit/ui/renderers/EnvironmentRenderer.test.js -t 'selector escaping' 2>&1 | tail -20
```
Expected: FAIL — the unescaped selector `select[data-stream="a"b"]` is a jsdom `SyntaxError`, aborting the loop so `video` is never updated (or the render throws).

**Step 3 — Implement:** wrap the interpolated `stream` in all three `querySelector`s:
```js
// ~L163 and ~L182:
const dropdown = this.audioRoutingContainer?.querySelector(`select[data-stream="${escapeCssAttrValue(stream)}"]`);
// ~L245:
const slider = this.audioRoutingContainer.querySelector(`input[data-stream="${escapeCssAttrValue(stream)}"]`);
```

**Step 4 — Run to verify it PASSES** + full file:
```bash
npx jest tests/unit/ui/renderers/EnvironmentRenderer.test.js 2>&1 | tail -10
```
Expected: new tests PASS; all existing PASS (no-op for the alphanumeric `video/music/sound` enum).

**Step 5 — Commit:**
```bash
git add src/ui/renderers/EnvironmentRenderer.js tests/unit/ui/renderers/EnvironmentRenderer.test.js
git commit -m "refactor(gm-scanner): escape stream key in audio-routing querySelectors for consistency with sibling cache-lookups (AUDIO-ROUTING)"
```

---

### Task 8: DUPLICATE‑SW — consolidate two build-artifact SW tests into one

**Files:**
- Delete: `tests/build-artifacts/swArtifact.test.js`
- Modify: `tests/build-artifacts/sw-artifact.test.js` (switch `beforeAll` build command to the production base; absorb the header note)

> No fail-first test — this is test maintenance. `sw-artifact.test.js` is the superset (existence + SW‑2 + bypass + network-first); `swArtifact.test.js`'s only unique trait is building with the production base (`build:backend`).

**Step 1 — Delete the redundant file:**
```bash
git rm tests/build-artifacts/swArtifact.test.js
```

**Step 2 — In `sw-artifact.test.js`, switch the build command** so the surviving file covers the production (`/gm-scanner/`) base that the deleted file uniquely exercised:
```js
// beforeAll:
// BEFORE: execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
// AFTER:
execSync('npm run build:backend', { cwd: ROOT, stdio: 'inherit' }); // production base VITE_BASE_PATH=/gm-scanner/
```
And update the header comment to note it builds with the production base because the deployed scanner registers `/gm-scanner/sw.js`.

**Step 3 — Run and verify exactly one build + all SW assertions:**
```bash
npm run test:build 2>&1 | tee /tmp/sw-build.log
grep -c 'building for production' /tmp/sw-build.log   # EXPECT: 1 (was 2)
```
Expected: one vite build; all four SW assertions PASS.

**Step 4 — Confirm no dangling reference to the deleted filename:**
```bash
grep -rn "swArtifact" . --include="*.js" --include="*.json" --include="*.md" | grep -v node_modules
```
Expected: no functional reference (a CLAUDE.md mention of the directory glob is fine; a path reference to the specific file is not).

**Step 5 — Commit:**
```bash
git add tests/build-artifacts/
git commit -m "test(gm-scanner): consolidate duplicate SW build-artifact tests into one (single vite build, production base) (DUPLICATE-SW)"
```

---

### Task 9: CLAUDE‑MD — correct the Chrome floor

**Files:**
- Modify: `CLAUDE.md` (the "Chrome/Edge 89+" line, ~L29)

**Step 1 — Confirm the real floor (evidence):**
```bash
node -e "console.log('vite', require('vite/package.json').version)"      # ~7.2.2
grep -n 'build.target' vite.config.js                                    # (no override → Vite default applies)
grep -n structuredClone src/core/stateStore.js                           # ~L82,L85 (Chrome 98 feature)
```

**Step 2 — Edit the doc line:**
```
- Android Chrome/Edge 107+ (Vite 7 default build target `baseline-widely-available` = chrome107; Web NFC needs 89+, `structuredClone` 98+ — 107 is the binding floor). No explicit `build.target` set in vite.config.js.
```

**Step 3 — Verify:**
```bash
grep -n 'Chrome/Edge' CLAUDE.md      # EXPECT: 107+ with the rationale
grep -n '89+ required for NFC' CLAUDE.md  # EXPECT: no match
```

**Step 4 — Commit:**
```bash
git add CLAUDE.md
git commit -m "docs(gm-scanner): correct browser floor to Chrome/Edge 107+ (Vite 7 default target; structuredClone) (CLAUDE-MD)"
```

### Phase 1 checkpoint

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npm test 2>&1 | tail -10            # all unit suites green, +~7 new tests
npm run coverage:check 2>&1 | tail -10
npm run build 2>&1 | tail -5        # production build succeeds
npm run test:build 2>&1 | tail -10  # single SW build, green
```

---

# Phase 2 — Backend / parent repo

> All paths in Phase 2 are under `/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend/`. Run from `backend/`. Integration tests need `--config jest.integration.config.js`.

### Task 10: CD‑1 — `sync:request` sync:full must include `deviceScannedTokens`

**Files:**
- Modify: `backend/src/server.js` (`sync:request` handler, ~L75‑95)
- Test: `backend/tests/integration/reconnection.test.js` (in `describe('Device Scanned Tokens Restoration')`)

**Step 1 — Write the failing test** (append in the device-scanned-tokens describe; use the file's `connectAndIdentify` + envelope-wrapped submit conventions):
```js
    it('should include deviceScannedTokens in sync:full produced by sync:request (CD-1)', async () => {
      await sessionService.createSession({ name: 'CD-1 sync:request Test', teams: ['Team Alpha'] });
      await sessionService.startGame();

      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');

      const submitTransaction = (socket, data) => new Promise((resolve) => {
        socket.once('transaction:result', resolve);
        socket.emit('transaction:submit', { event: 'transaction:submit', data, timestamp: new Date().toISOString() });
      });
      await submitTransaction(gm1, { tokenId: 'jaw001', teamId: 'Team Alpha', mode: 'blackmarket' });

      const syncPromise = waitForEvent(gm1, 'sync:full', 3000);
      gm1.emit('sync:request');
      const syncEvent = await syncPromise;

      expect(syncEvent.data).toHaveProperty('deviceScannedTokens');
      expect(Array.isArray(syncEvent.data.deviceScannedTokens)).toBe(true);
      expect(syncEvent.data.deviceScannedTokens).toContain('jaw001');
    });
```
> Confirm `jaw001` exists in the production token set (`/api/tokens`); if not, substitute any valid GM-scannable token id used elsewhere in this suite.

**Step 2 — Run to verify it FAILS:**
```bash
npx jest --config jest.integration.config.js tests/integration/reconnection.test.js -t 'CD-1' 2>&1 | tail -20
```
Expected: FAIL — `deviceScannedTokens` is undefined on the sync:request payload.

**Step 3 — Implement:** in the `sync:request` handler, after building `syncPayload`, derive and spread the device-specific scanned tokens exactly as `gmAuth.js` does:
```js
      const session = sessionService.getCurrentSession();
      const deviceScannedTokens = session
        ? Array.from(session.getDeviceScannedTokens(socket.deviceId))
        : [];

      emitWrapped(socket, 'sync:full', {
        ...syncPayload,
        deviceScannedTokens,
      });
```
> Reuse the already-imported `sessionService`; no AsyncAPI change (sync:full already carries this field via gmAuth). Match the existing `buildSyncFullPayload({...})` argument object in this handler — do not drop any service it already passes.

**Step 4 — Run to verify it PASSES** + full reconnection suite + the sync:request contract test (sanity):
```bash
npx jest --config jest.integration.config.js tests/integration/reconnection.test.js -t 'CD-1' 2>&1 | tail -10
npx jest --config jest.integration.config.js tests/integration/reconnection.test.js 2>&1 | tail -10
npm run test:contract -- sync-request.test.js 2>&1 | tail -10
```
Expected: new test PASS; reconnection suite PASS; contract PASS.

**Step 5 — Commit:**
```bash
git add src/server.js tests/integration/reconnection.test.js
git commit -m "fix(backend): include deviceScannedTokens in sync:request sync:full (gmAuth parity) so the scanner reconciles before flush (CD-1)"
```

---

### Task 11: QUEUE_FULL — add `QUEUE_FULL` + `INVALID_DATA` to the AsyncAPI error enum

**Files:**
- Modify: `backend/contracts/asyncapi.yaml` (Error message `data.code` enum, ~L2098‑2112)
- Test: `backend/tests/contract/websocket/error-events.test.js` (in `describe('error event')`)

**Step 1 — Write the failing tests** (append, matching the file's Pattern-B `sessionService.emit('error', ...)` style):
```js
    it('should match AsyncAPI schema with QUEUE_FULL code', async () => {
      const eventPromise = waitForEvent(socket, 'error');
      const testError = new Error('Offline queue is full');
      testError.code = 'QUEUE_FULL'; // emitted by adminEvents.js
      sessionService.emit('error', testError);
      const event = await eventPromise;

      expect(event).toHaveProperty('event', 'error');
      expect(event.data.code).toBe('QUEUE_FULL');
      validateWebSocketEvent(event, 'error');
    });

    it('should match AsyncAPI schema with INVALID_DATA code', async () => {
      const eventPromise = waitForEvent(socket, 'error');
      const testError = new Error('Invalid identification data');
      testError.code = 'INVALID_DATA'; // emitted by gmAuth.js handleGmIdentify
      sessionService.emit('error', testError);
      const event = await eventPromise;

      expect(event.data.code).toBe('INVALID_DATA');
      validateWebSocketEvent(event, 'error');
    });
```

**Step 2 — Run to verify it FAILS:**
```bash
npx jest tests/contract/websocket/error-events.test.js --runInBand 2>&1 | tail -20
```
Expected: FAIL — `validateWebSocketEvent` throws "must be equal to one of the allowed values (/data/code)". (Confirm in isolation if desired:
```bash
node -e "const {validateWebSocketEvent}=require('./tests/helpers/contract-validator'); try{validateWebSocketEvent({event:'error',data:{code:'QUEUE_FULL',message:'m'},timestamp:new Date().toISOString()},'error');console.log('VALID')}catch(e){console.log('REJECTED')}"
```
→ `REJECTED` before the fix.)

**Step 3 — Implement:** add the two values to the `code` enum (keep 2-space list indentation):
```yaml
                enum:
                  - AUTH_REQUIRED
                  - AUTH_INVALID
                  - INVALID_DATA            # gmAuth.js handleGmIdentify validation failure
                  - DEVICE_ID_COLLISION
                  - PERMISSION_DENIED
                  - VALIDATION_ERROR
                  - SESSION_NOT_FOUND
                  - TOKEN_NOT_FOUND
                  - DUPLICATE_TRANSACTION
                  - INVALID_REQUEST
                  - QUEUE_FULL              # adminEvents.js offline queue full
                  - VLC_ERROR
                  - INTERNAL_ERROR
```

**Step 4 — Run to verify it PASSES** + full error-events file:
```bash
npx jest tests/contract/websocket/error-events.test.js --runInBand 2>&1 | tail -10
```
Expected: new tests PASS; the existing 3 enum tests still PASS.

**Step 5 — Commit:**
```bash
git add contracts/asyncapi.yaml tests/contract/websocket/error-events.test.js
git commit -m "fix(contract): add QUEUE_FULL + INVALID_DATA to AsyncAPI error-code enum to match emitted codes (QUEUE_FULL)"
```

---

### Task 12: ORPHAN — delete dead `backend/src/docs/openapi.js`

> **Out-of-PR-scope opportunistic cleanup** (not part of #16's diff). Keep it a separate commit so it can be split out if desired. No new test — verification is grep + suite-by-absence.

**Step 1 — Prove it's unreferenced (expect no output):**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
grep -rn "docs/openapi" . --include="*.js" | grep -v "src/docs/openapi.js:"
grep -rn "swagger\|/api-docs\|require.*src/docs" src/
```
Expected: both empty. If anything resolves it, STOP and fix the enum in place instead of deleting.

**Step 2 — Delete:**
```bash
git rm src/docs/openapi.js
rmdir src/docs 2>/dev/null || true
```

**Step 3 — Verify suites still load/pass (no MODULE_NOT_FOUND):**
```bash
npm test 2>&1 | tail -15
```
Expected: unit + contract suites pass at the same baseline.

**Step 4 — Commit:**
```bash
git add -A src/docs
git commit -m "chore(backend): delete orphaned src/docs/openapi.js (dead, drifting OpenAPI duplicate; served contract is contracts/openapi.yaml) (ORPHAN)"
```

### Phase 2 checkpoint

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npm test -- --coverage 2>&1 | tail -10        # unit + contract
npm run coverage:check 2>&1 | tail -10
npm run test:integration -- reconnection.test.js 2>&1 | tail -10
```
> Coverage note: `vlcMprisService.js` / `displayDriver.js` branch thresholds are known to fail on the Pi (CI-calibrated; unchanged on this branch) — not a regression from these tasks.

---

# Phase 3 — Integrate

### Task 13: rebuild dist, bump submodule gitlink, pre-merge verification

**Step 1 — Rebuild the GM-scanner dist** (the E2E symlink `backend/public/gm-scanner → ALNScanner/dist` must reflect the source changes before any E2E run):
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npm run build 2>&1 | tail -5
```

**Step 2 — Push the submodule branch, then bump the parent's gitlink:**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git log --oneline -1                     # confirm Phase-1 commits are the tip of fix/alnscanner-comms
git push origin fix/alnscanner-comms     # only when ready to update PR #9

cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add ALNScanner                        # stage the new gitlink
git commit -m "chore(submodule): bump ALNScanner to comms-fixes follow-up (NC-1/2/3, NQ-1/2, BFCache, escaping, test/doc cleanup)"
```
> Per the PR merge ordering: ALNScanner#9 merges first → its `main` advances → re-bump this gitlink to merged `main` → merge #16. This task only re-points the open PRs; final gitlink to `main` happens at merge time.

**Step 3 — Pre-merge verification (highest applicable level):**
```bash
# ALNScanner
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npm test && npm run coverage:check

# Backend non-E2E
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npm test -- --coverage && npm run coverage:check
npm run test:integration

# Optional (only if you want E2E reassurance — none of these fixes have E2E coverage,
# but they touch the reconnect/queue paths the L3 suite exercises):
# npm run test:e2e   # ~30 min on the Pi, workers=1; requires the dist rebuild from Step 1
```
Expected: all green. E2E is optional for *this* plan (unit/contract/integration cover every fix), but run it before merge if touching the reconnect path makes you want the belt-and-suspenders pass.

---

## Done criteria

- [ ] All 12 tasks committed; each new test was seen RED before GREEN.
- [ ] ALNScanner full unit suite + coverage:check green; production build + single SW build green.
- [ ] Backend unit + contract + `reconnection.test.js` integration green; coverage:check green (modulo the known Pi-only vlc/displayDriver branch thresholds).
- [ ] `dist/` rebuilt; submodule gitlink bumped on the parent branch.
- [ ] NC‑1 and NQ‑1 (the two high-severity races) each have a test that fails on the pre-fix code and passes after — the durability/resilience guarantees the original PR promised are now actually enforced.

---

## Notes for the executor

- **Read before you write.** Every test must match the conventions of the file it's added to (mock setup, timer style, helper names). The snippets above are accurate to the investigated code but anchor on `~Lxxx` — confirm the exact insertion point.
- **The connection-manager cluster (Tasks 1–3) shares two methods.** Do them in order; the "final shape" block is the target. After Task 3, the success block contains `_connectedAt` + `_lastErrorReason = null` and **no** `retryCount = 0` (that moved to the gated disconnect branch).
- **BFCACHE requires a test-mock update** (the existing `lifecycleApp` mock) in the same commit, or the existing RL‑2 tests regress.
- **Don't claim green without the command output.** Per superpowers:verification-before-completion, paste the passing run, not an assertion that it passes.
