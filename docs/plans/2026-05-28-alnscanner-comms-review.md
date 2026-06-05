# GM Scanner (ALNScanner) — Communication Boundary Code Review

**Scope:** WebSocket (Socket.io) client to the backend orchestrator, HTTP REST, the Web NFC browser API, the service worker / PWA shell, and the `gm:command` actions that drive external services (VLC, MPD, Bluetooth, PipeWire, Home Assistant, sound, game clock, cue engine).

**Method:** 11 parallel review dimensions, every finding adversarially re-verified by an independent skeptic (refute-by-default). 4 findings were refuted and removed (SSR-1, SSR-4, WS-1, CC-8). **65 verified findings** remain and are synthesized below.

**Verified severity counts:** Critical 2 · High 4 · Medium 23 · Low 30 · Info 6.

---

## 1. Executive Summary

The communication layer is **architecturally sound but operationally fragile**. The hard parts are right: the AsyncAPI `{event, data, timestamp}` envelope is wrapped/unwrapped consistently, all 10 service-state domains route correctly into the StateStore from both `sync:full` and `service:state`, the offline transaction queue is genuinely persisted to `localStorage` and survives reloads, XSS escaping is applied in 7 of 8 renderers, and the JWT is handled defensively (never logged, sent in `handshake.auth`, validated with an expiry buffer). There is **no wire-protocol data-corruption defect** on the live path.

The damage is concentrated in **two systemic weaknesses, both fully consistent with the 0523game post-mortem** (GM_Station_1 reloaded/reconnected ~29× in one 3-hour session, all `reason=manual`, with 4× "device ID already in use" in a 28-second burst):

1. **Recovery is by full page reload, not in-page reconnect.** Auto-reconnect only fires on `'io server disconnect'` — never on the `'transport close'` / `'ping timeout'` reasons a backgrounded or Wi-Fi-blipped tab actually produces. The service worker is **never shipped to `dist/`** (Vite's `publicDir:'data'` omits the repo-root `sw.js`), so there is no offline shell, and the still-open WebSocket disqualifies the page from BFCache. The net effect: every operator app-switch becomes a full network reload + brand-new socket, and fast re-handshakes race the server's stale-socket teardown into `DEVICE_ID_COLLISION` rejections that **no code listens for**.

2. **Backend errors and lost scans are invisible to the operator.** The connected-path transaction submit is fire-and-forget with no ack tracking (a scan in the reconnect window is silently lost — lost scan = lost scoring), the offline queue is cleared even when a replay times out, and the backend `error` event (which the contract says clients *MUST* display) has no consumer. Environment/show-control commands rejected by the backend (e.g. a service is down) surface only to a hidden debug panel.

**Highest-leverage fixes, in order:**

- **Fix the reconnect/lifecycle cluster as one unit** (RL-1/AUTH-2 + RL-2 + SW-1/RL-4 + RL-3/AUTH-1 + RL-5): broaden auto-reconnect to all non-client-initiated disconnect reasons, add `visibilitychange`/`pagehide` handling to close the socket on background (freeing the deviceId and enabling BFCache), and ship the service worker. This eliminates the root churn mechanism and the device-ID collisions in one coordinated change.
- **Make transactions durable on the connected path** (TQ-1 + TQ-2 + TQ-3/TQ-4): always persist before emit, only clear queue entries on a *definitive* result, and stop treating `duplicate`/`rejected`/`queued`/timeout as "delivered." This closes the lost-scan window the churn creates.
- **Surface backend errors to the operator** (AC-2 + WS-3/CC-4): route `safeAdminAction` failures and the backend `error` event to a visible toast.

---

## 2. Findings by Severity (deduplicated across dimensions)

> Several findings are the same underlying defect seen from different angles. They are merged below; each merged entry lists all contributing finding IDs and all affected files. A full per-ID table is in the Appendix.

---

### CRITICAL

#### C-1. Auto-reconnect is effectively disabled; the offline queue is cleared on failed replay — together, transient drops cause silent scan loss
**Finding IDs:** RL-1 (auto-reconnect gate) + TQ-2 (queue clear-on-any-outcome). Both are CRITICAL on their own; presented together because the *combination* is what loses scoring during a live show.

**Affected files:**
- `ALNScanner/src/network/orchestratorClient.js:54` (`reconnection: false`)
- `ALNScanner/src/network/connectionManager.js:170-193` (only `'io server disconnect'` reconnects)
- `ALNScanner/tests/unit/network/connectionManager.test.js:269-283` (test *codifies* the no-reconnect behavior)
- `ALNScanner/src/network/networkedQueueManager.js:108-122, 159-165` (unconditional `tempQueue = []` after a flush, even on timeout/failure)

**What's wrong:**
- **RL-1:** The socket is created with `reconnection: false`, delegating reconnect to ConnectionManager — which only schedules a reconnect when `reason === 'io server disconnect'`. The common live-show reasons (`'transport close'` = Wi-Fi blip/roam, `'ping timeout'` = throttled/backgrounded tab) fall through and do nothing but flip the header to "Disconnected." The only recovery path is a full page reload. A unit test even asserts `'transport close'` does **not** reconnect.
- **TQ-2:** `syncQueue` replays the persisted batch, then **unconditionally** sets `this.tempQueue = []` and persists the empty queue — discarding any replay that *failed or timed out* (30s timeout). During churn, a replay can time out for purely transient reasons (the socket drops again mid-flush), yet the only durable copy of that scan is permanently deleted. The comment "Failed transactions are lost but logged" acknowledges this.

**Why it matters for a live show:** This is the direct mechanical chain behind the post-mortem's 29 reloads. A transport-level drop never self-heals (RL-1), forcing a reload; and if a flush is attempted on a flaky link, queued offline scans are dropped on the first failed attempt (TQ-2). A lost GM scan is lost scoring, with no trace.

**Recommended fix:**
- RL-1: Auto-reconnect on **all** non-client-initiated reasons (exclude only `'io client disconnect'` / `'client namespace disconnect'`); reconnect token-permitting for `'transport close'`, `'ping timeout'`, `'transport error'`, `'io server disconnect'`. Or re-enable Socket.io native reconnection and reserve ConnectionManager for token revalidation. Add tests asserting reconnect on `'transport close'`/`'ping timeout'`.
- TQ-2: Only remove entries with a *definitive non-transient* result (accepted OR confirmed duplicate). Keep timed-out / connection-error replays for the next reconnect; use the AsyncAPI `batchId` idempotency model (1h server-side cache) to make retries safe. Revise the test that currently certifies the buggy behavior.

---

### HIGH

#### H-1. The whole reconnect/lifecycle cluster: no transport-level reconnect, no page-lifecycle handling, and no service worker — backgrounding the tab forces a full reload + collision-prone re-handshake
**Finding IDs:** AUTH-2 (duplicate of RL-1's transport-reason gap, from the auth dimension) + RL-2 (no BFCache/lifecycle handling) + SW-1 ≈ RL-4 (service worker never emitted to `dist/`).

> This is the single most important cluster for live-show reliability. RL-1 (above, Critical) is the auto-reconnect gate; AUTH-2 is the same defect re-observed; RL-2 and SW-1/RL-4 are the two other legs of the tripod that turns an app-switch into a full reload.

**Affected files:**
- `ALNScanner/src/network/connectionManager.js:165-196`, `ALNScanner/src/network/orchestratorClient.js:52-62` (AUTH-2: transport-level drops never reconnect)
- `ALNScanner/src/ui/connectionWizard.js:455-462` (RL-2: only a `beforeunload`, which itself harms BFCache); no `visibilitychange`/`pagehide`/`freeze`/`resume` anywhere in `src/`
- `ALNScanner/vite.config.js:7` (`publicDir:'data'`), `ALNScanner/sw.js:1`, `ALNScanner/src/app/initializationSteps.js:103-105` (SW-1/RL-4: `sw.js` lives at submodule root, is neither a Rollup input nor inside `data/`, so `dist/sw.js` does not exist; `/gm-scanner/sw.js` 404s on every load)

**What's wrong:** Three mutually-reinforcing gaps produce the churn. (a) No service worker ships, so there is no cached app shell and nothing to serve a discarded tab. (b) The open WebSocket disqualifies the page from Chrome BFCache, and there is zero page-lifecycle handling, so a backgrounded tab that the OS discards must fully reload from the network on return — a brand-new socket (`reconnection: false`, so not a resume), losing all in-memory state. (c) Transport-level disconnects never auto-reconnect (RL-1/AUTH-2), so the reload *is* the only recovery. Verified directly: `ls dist/sw.js` → no such file; `dist/` contains the `data/` payload but no `sw.js`.

**Why it matters for a live show:** This is the confirmed root cause of GM_Station_1's ~29 `reason=manual` reloads. Each reload is a fresh connection that loses state and races the server's stale-socket teardown (see M-2 collisions).

**Recommended fix (coordinated):**
1. **Ship the SW.** Move/copy `sw.js` into the `publicDir` (e.g. `data/sw.js`) so it emits at `dist/sw.js` verbatim, OR adopt `vite-plugin-pwa` (strongly preferred — see M-13: the current `sw.js` content is stale). Verify `ls dist/sw.js` and `GET /gm-scanner/sw.js → 200`.
2. **Add page-lifecycle control.** On `visibilitychange→hidden` / `pagehide` / `freeze`, proactively `client.disconnect()` so the page becomes BFCache-eligible *and the server frees the deviceId*; on `visibilitychange→visible` / `pageshow` / `resume`, reconnect via `ConnectionManager.connect()` (which already revalidates token + health + triggers `sync:full`). Remove the `beforeunload` listener (or convert to `pagehide`).
3. **Broaden auto-reconnect** per C-1/RL-1.

Together these convert "full reload on every app-switch" into a cheap socket close/reopen, eliminating both the churn and the device-ID collisions.

#### H-2. Connected-path transaction submit is fire-and-forget — scans in the reconnect window are silently lost
**Finding IDs:** TQ-1.

**Affected files:** `ALNScanner/src/network/networkedQueueManager.js:53-60`, `ALNScanner/src/app/app.js:749-761`.

**What's wrong:** When `client.isConnected` is true, `queueTransaction` calls `client.send('transaction:submit', ...)` and returns immediately — no `transaction:result` correlation, no requeue, and **the transaction is not added to the persisted queue** on this branch (only the offline branch persists). `isConnected` flips to false only on the `disconnect` event, so during churn there is a window where `isConnected` is true but the emit is dropped on the wire or rejected server-side. Any scan in that window is silently and permanently lost — not queued, not retried, no UI error.

**Why it matters for a live show:** This is the highest-stakes failure mode: a lost GM scan = lost scoring with no trace, and the reconnect-churn bursts (H-1, plus the collision findings) are exactly when this window opens.

**Recommended fix:** Treat all submits uniformly — **always persist to the localStorage queue first**, emit, and only remove an entry after a matching `transaction:result` (or `transaction:new` carrying the deviceId) confirms acceptance. At minimum add a pending-ack timeout that re-queues unconfirmed connected submits. (This also subsumes the result-correlation logic that `replayTransaction` already has.)

---

### MEDIUM

#### M-1. Backend errors and rejected commands are never surfaced to the operator
**Finding IDs:** AC-2 (`safeAdminAction` swallows ack failures) + WS-3 ≈ CC-4 (backend `error` event forwarded but no consumer) + AUTH-7 (post-connection AUTH errors dropped). Compounds TQ replay (a validation failure arrives as `error`, so `replayTransaction` hangs 30s then drops — see M-7).

**Affected files:**
- `ALNScanner/src/utils/domEventBindings.js:21,60,126,198` (AC-2: failures go only to `debug.log`)
- `ALNScanner/src/network/orchestratorClient.js:256` (forwards `error`), `ALNScanner/src/network/networkedSession.js:196-321` (no `case 'error'`), `backend/contracts/asyncapi.yaml:1975-2010` (contract: "Clients MUST display error messages to users"), `backend/src/websocket/adminEvents.js:264` (WS-3/CC-4: backend emits `error` for `VALIDATION_ERROR`/`QUEUE_FULL`)
- `ALNScanner/src/network/networkedSession.js:194-321` (AUTH-7: no `case 'error'` for backend `AUTH_REQUIRED`)

**What's wrong:** Every environment/show-control/music/cue/Bluetooth/audio/lighting/scoreboard command is dispatched through `safeAdminAction`, which catches the rejected promise and writes only to the debug panel — no toast, no banner. The backend explicitly rejects these when their service dependency is down (`commandExecutor` `SERVICE_DEPENDENCIES` gating), so the operator presses "connect Bluetooth speaker" / "fire cue" / "activate scene" and the button silently does nothing. Separately, the backend `error` event (transaction validation failures, queue-full, post-connection auth errors) is forwarded but has **no consumer anywhere** (`grep type === 'error'` → zero hits), directly violating AsyncAPI Decision #10.

**Why it matters for a live show:** During a show the GM most needs to know when a command was rejected. Silent no-ops erode operator trust and can mask a real outage; an unsurfaced auth/validation error means the operator loses capability with no signal.

**Recommended fix:** Have `safeAdminAction` call `uiManager.showError`/`showToast(..., 'error')` in addition to `debug.log`. Add a `case 'error'` in `networkedSession._messageHandler` that surfaces `payload.message`/`code` to the operator and routes `AUTH_*` codes into the auth/reconnect flow. Add a test asserting a forwarded `error` reaches a user-visible sink. (Note: error surfacing is *inconsistent* today — session/score/video admin actions already call `uiManager.showError`; the newer controllers do not.)

#### M-2. DEVICE_ID_COLLISION / auth failures are retried as transient errors; collisions are silent and race the prior socket's teardown
**Finding IDs:** RL-3 ≈ AUTH-1 (handshake-failure reason never inspected; `socket:error` has no listener) + RL-5 (reconnect-identify race) + RL-7 (stale `lastStationNum` fallback can hand out an in-use ID). CC-8b is a related, *needs-confirmation* contributor (see M-3).

**Affected files:**
- `ALNScanner/src/network/connectionManager.js:84-135` (AUTH-1: catch handles every rejection identically — increment, backoff, no reason inspection)
- `ALNScanner/src/network/orchestratorClient.js:78-86,226-228` (RL-3: `connect_error → socket:error` CustomEvent with **no listener**; `grep socket:error` → only emit sites), `backend/src/websocket/socketServer.js:86-93` (backend emits `DEVICE_ID_COLLISION` / `AUTH_INVALID`)
- `ALNScanner/src/network/orchestratorClient.js:44-62`, `ALNScanner/src/network/connectionManager.js:186-192` (RL-5: `_cleanup()` then *immediately* opens a new `io()` with the same deviceId, no wait for server-confirmed teardown)
- `ALNScanner/src/ui/connectionWizard.js:185-233,346-351` (RL-7: first-time fallback uses guessable `lastStationNum` counter, not coordinated across devices)

**What's wrong:** The backend rejects a duplicate deviceId or expired token at the handshake with distinct `connect_error` reasons, but the client never inspects the reason — every rejection is retried with exponential backoff (1+2+4+8s) up to 5 times. So an expired token hammers the server with a known-bad credential for ~15s before re-prompting, and a `DEVICE_ID_COLLISION` is blindly retried on the **same** deviceId — which can never succeed until the server times out the stale socket. Because the new socket is opened immediately after `_cleanup()` (no await for the server FIN), a fast reload re-handshakes inside the server's disconnect-propagation window and is rejected as a collision. Nothing listens for `socket:error`, so the collision is entirely silent. This is the exact mechanism behind the post-mortem's "4× device ID already in use in a 28s burst."

**Why it matters for a live show:** The operator gets no actionable feedback, the backoff budget is wasted on un-winnable retries, and the sequence can end in a spurious password re-prompt mid-show.

**Recommended fix:** Inspect `error.message` in `OrchestratorClient.onError` / `ConnectionManager.connect`. On `AUTH_INVALID`/`AUTH_REQUIRED` → skip retries, dispatch `auth:required`, clear the stale token (L-5/AUTH-5). On `DEVICE_ID_COLLISION` → do **not** tight-loop retry the same deviceId; either wait past the server's socket-timeout window with jittered backoff, or have the backend implement deviceId **takeover** (kick the stale socket). Add a `socket:error` listener so collisions are never silent. Fix the underlying race per H-1 (close socket on background → server frees the deviceId before return). Replace the `lastStationNum` fallback with a collision-resistant suffix or a hard error when `/api/state` is unreachable. Add tests for `connect_error` handling.

#### M-3. ⚠ needs confirmation — `/api/state` device list omits `connectionStatus`, so station auto-numbering may never see existing stations
**Finding ID:** CC-8b (`verdict: needs-confirmation`).

**Affected files:** `ALNScanner/src/ui/connectionWizard.js:210-212`, `backend/src/websocket/syncHelpers.js:91-97`, `backend/src/routes/stateRoutes.js:32-45`.

**What's wrong (claimed):** Surfaced by LEAD while *refuting* CC-8. `connectionWizard` filters devices by `d.connectionStatus === 'connected'` to compute existing station numbers. But `/api/state` builds its device list via an inline `.map()` in `syncHelpers.buildSyncFullPayload` that emits `{deviceId, type, name, connectionTime, ipAddress}` and **never calls `DeviceConnection.toJSON()`** — so `connectionStatus` is absent from the response, the filter matches nothing, and auto-assignment may always pick the same number → contributes to the deviceId collisions in M-2. The OpenAPI `GameState.devices` item schema also omits `connectionStatus` (a *different* standalone `Device` schema includes it, which is what misled the original CC-8 premise).

**Why it needs confirmation:** This was a single-verifier discovery during refutation, not an independent review. **To confirm:** call `GET /api/state` against a running orchestrator with a connected GM and inspect whether any `devices[].connectionStatus` field is present.

**Recommended fix (if confirmed):** Add `connectionStatus` to the `syncHelpers` device map (and the OpenAPI `GameState.devices` schema), or change `connectionWizard` to not depend on it for station numbering.

#### M-4. NFC scan leaks: `stopScan()` is a no-op and re-arming spawns duplicate readers/listeners
**Finding IDs:** NFC-1 (`stopScan()` no-op — no AbortController) + NFC-2 (re-entry leaks a new `NDEFReader` + duplicate listeners).

**Affected files:** `ALNScanner/src/utils/nfcHandler.js:30-79,158-164`, `ALNScanner/src/app/app.js:379-380,595-625,797-802`.

**What's wrong:** Web NFC *does* support stopping a scan (`NDEFReader.scan({ signal })` + `AbortController`), but the code never uses one — the comment "Web NFC doesn't have explicit stop" is factually wrong. `stopScan()` only flips a boolean; the underlying reader and its `'reading'` listener keep running across screen changes. `_startNFCScanning()` runs on every team confirmation, each time doing `new NDEFReader()` and attaching fresh listeners with no teardown of the prior reader. Over a 2-3 hour show with many team switches this accumulates leaked readers/closures; at worst a single physical tap is processed by more than one live listener, **double-queuing a transaction** to the backend. A stray tap while off the scan screen can still fire `processNFCRead` and queue a `transaction:submit`.

**Why it matters for a live show:** Accumulating radio/listener leaks and the possibility of double-submitting a scan directly threaten scoring integrity.

**Recommended fix:** Create an `AbortController` in `startScan()`, pass `controller.signal` to `reader.scan({ signal })`, store it, and `abort()` it in `stopScan()` (then null the reader/controller). Make `startScan()`/`_startNFCScanning()` idempotent — abort any prior scan before re-arming. Ensure `cancelScan`/`finishTeam` actually abort before navigating away.

#### M-5. `group:completed` reads `bonus` but the contract/backend field is `bonusPoints` — the bonus amount is always blank
**Finding ID:** CC-1.

**Affected files:** `ALNScanner/src/app/app.js:157`, `backend/contracts/asyncapi.yaml:1846`, `backend/src/websocket/broadcasts.js:281`.

**What's wrong:** The handler destructures `bonus` from the event, but the AsyncAPI schema and backend emit `bonusPoints` (the backend even comments `// AsyncAPI: 'bonusPoints' not 'bonus'`). `bonus` is always `undefined`, so the group-completion toast renders with an empty bonus string.

**Why it matters for a live show:** A group completion in Black Market mode is a major scoring moment; the GM never sees the awarded amount.

**Recommended fix:** Destructure `bonusPoints` and use it in the toast. Add a contract test validating the `group:completed` payload the client expects against the AsyncAPI `GroupCompleted` schema.

#### M-6. `sync:full` contract documents only 7 of ~17 fields the client depends on for reconnect restore
**Finding ID:** CC-2.

**Affected files:** `backend/contracts/asyncapi.yaml:278`, `ALNScanner/src/network/networkedSession.js:205`, `backend/src/websocket/syncHelpers.js:135`.

**What's wrong:** The `SyncFull` schema documents only `session, scores, recentTransactions, videoStatus, devices, serviceHealth, heldItems`. The client reads and depends on many more for full reconnect restoration: `deviceScannedTokens, playerScans, music, environment.{bluetooth,audio,lighting}, gameClock, cueEngine, sound, displayStatus`. The backend *does* emit all of these, so it works in practice — but the source-of-truth contract is materially incomplete for the most reliability-critical event, and contract-validation tooling cannot catch drift on undocumented fields.

**Why it matters for a live show:** `sync:full` is the reconnect-resync mechanism; undocumented fields defeat the Contract-First guarantee exactly where reconnection state restore matters most.

**Recommended fix:** Add the missing fields to the `SyncFull` schema, then add a contract test asserting `buildSyncFullPayload()` output validates against it.

#### M-7. Backend `error` event has no consumer — validation failures and `QUEUE_FULL` are silently dropped, and replay hangs 30s then loses the transaction
**Finding ID:** CC-4 (merges with M-1 from the surfacing angle).

**Affected files:** `ALNScanner/src/network/orchestratorClient.js:256`, `ALNScanner/src/network/networkedSession.js:196`, `backend/src/websocket/adminEvents.js:264`, `ALNScanner/src/network/networkedQueueManager.js:171`.

**What's wrong:** A `transaction:submit` that fails schema validation produces an `error` event, **not** a `transaction:result`. The replay handler matches only `transaction:result`, so it waits its full 30s timeout and then discards the transaction as "lost but logged." Combined with TQ-2 (C-1), this is a real data-loss path on malformed/rejected scans.

**Recommended fix:** Add an `error` handler that surfaces backend errors (M-1) and, in `replayTransaction`, also resolve/reject on a matching `error` event so a rejected transaction fails fast instead of hanging 30s and being silently dropped.

#### M-8. Replay matcher keys only on `tokenId+teamId` and treats every non-`error` status as success
**Finding IDs:** TQ-3 (misclassification) + TQ-4 (contract status-enum drift) + TQ-6 (reconnect flush not reconciled against `sync:full`).

**Affected files:**
- `ALNScanner/src/network/networkedQueueManager.js:167-186` (TQ-3), `backend/src/services/transactionService.js:140`
- `backend/contracts/asyncapi.yaml:728-732`, `backend/src/websocket/adminEvents.js:175-180` (TQ-4: backend emits `queued`/`rejected`, not in the `[accepted, duplicate, error]` enum)
- `ALNScanner/src/network/networkedSession.js:170-178,205-228`, `ALNScanner/src/network/networkedQueueManager.js:73-81` (TQ-6: `syncQueue` replays the whole queue on every connect with no reconciliation against the freshly-restored `deviceScannedTokens`/`recentTransactions`)

**What's wrong:** `replayTransaction` matches a result by `tokenId+teamId` and resolves unless `status === 'error'`. But the backend also returns `duplicate`, `rejected` (no active session), and `queued` (offline) — all of which are silently treated as a successful replay and removed. So a **rejected** transaction is counted as delivered and discarded, and a **duplicate** (highly likely during churn, since the first emit may already have landed) masks a real double-submit. The match key is not unique per submission, so overlapping replays/broadcasts can resolve the wrong promise. The non-enum statuses (TQ-4) are the root enabler. Replays are never reconciled against the `sync:full` state restored in the same connect cycle (TQ-6), so the only safety net against double-counting is server-side dedup — which fails if the dedup window/session differs (e.g. across a reset).

**Why it matters for a live show:** Rejected scans silently vanish, duplicates hide double-submits, and re-replays rely entirely on implicit server-side dedup. All directly threaten scoring integrity during exactly the churn the post-mortem documents.

**Recommended fix:** Branch explicitly on status — `accepted` → remove; `duplicate` → remove but surface to the operator; `rejected`/`error` → permanent failure, **do not** discard silently (alert the operator); `queued`/timeout → keep for retry. Add a client-generated correlation id echoed in the result to eliminate `tokenId+teamId` aliasing. Reconcile the queue against `deviceScannedTokens` from `sync:full` before replaying, or rely on the contract's `batchId` idempotency; ensure `syncQueue` runs after `sync:full` has populated server state. Reconcile the contract enum (extend to include `queued`/`rejected`, or map `rejected→error`) and add a contract test.

#### M-9. `NetworkedStorage` emits `transaction:submit` without the AsyncAPI envelope (backend strictly rejects it) — latent landmine, and a test cements the broken shape
**Finding ID:** CC-5.

**Affected files:** `ALNScanner/src/core/storage/NetworkedStorage.js:91`, `backend/src/websocket/adminEvents.js:144`, `backend/contracts/asyncapi.yaml:647`, `ALNScanner/tests/.../NetworkedStorage.test.js:80-87`.

**What's wrong:** `NetworkedStorage.addTransaction` emits a raw data object (no `{event,data,timestamp}` wrapper). The backend strictly requires the envelope and replies `VALIDATION_ERROR`. This path is currently dead code (networked live scans go through `queueManager`; `addTransaction` is only reached in standalone mode via `LocalStorage`), so it does not break the show today — but the storage-strategy design clearly intends `NetworkedStorage` to be the networked path, and wiring it up would silently reject every transaction. A unit test actively locks in the broken unwrapped shape (phantom-mock).

**Recommended fix:** Either wrap these emits in the envelope (route through `orchestratorClient.send`) or delete the dead `NetworkedStorage` transaction/command emit methods. Update/remove the test so it stops certifying a contract violation.

#### M-10. `EnvironmentRenderer` expects `activeScene` as an object `{.id}`, but the backend sends a string — the active lighting scene never highlights; tests mask it
**Finding ID:** SR-1.

**Affected files:** `ALNScanner/src/ui/renderers/EnvironmentRenderer.js:96,104,123`, `backend/src/services/lightingService.js:355`, `ALNScanner/tests/unit/ui/renderers/EnvironmentRenderer.test.js:76`.

**What's wrong:** `lightingService.getState().activeScene` is a **string** (the HA `entity_id`, e.g. `"scene.party"`). The renderer reads `activeScene?.id` and compares `scene.id === activeScene.id` — always false against a string, so the active-scene tile **never** gets `scene-tile--active` in production. The unit test feeds the wrong (object) shape (`activeScene: { id: 'tension' }`), hiding the drift.

**Why it matters for a live show:** The GM has no visual confirmation of which lighting scene is live.

**Recommended fix:** Treat `activeScene` as a string id (`scene.id === activeScene`). Update the test to use the real string shape so it would have caught this; add a contract assertion that the lighting `service:state` shape matches what the renderer consumes.

#### M-11. Auth login POST has no timeout — a slow/half-open backend hangs the wizard on "Connecting…" forever
**Finding ID:** HTTP-1.

**Affected files:** `ALNScanner/src/ui/connectionWizard.js:321`.

**What's wrong:** The health-check fetch immediately above uses `AbortSignal.timeout(3000)`, but the `/api/admin/auth` POST has no `signal`/timeout. If the backend accepts the TCP connection but stalls (overloaded Pi, half-open socket after a Wi-Fi blip — exactly the post-mortem conditions), the `await` never settles; the UI is stuck on "Connecting…" with no error and no recovery except a full page reload (feeding the churn).

**Recommended fix:** Add `signal: AbortSignal.timeout(5000)` to the auth POST, and distinguish `AbortError`/timeout from generic failure so the operator sees "Server timed out, retry."

#### M-12. Forwarding-completeness test uses a divergent hand-maintained list — structurally cannot catch dropped events
**Finding ID:** WS-2.

**Affected files:** `ALNScanner/tests/unit/network/orchestratorClient.test.js:220-252`, `ALNScanner/src/network/orchestratorClient.js:240-262`.

**What's wrong:** The test "should forward all AsyncAPI message types" builds its **own** local `messageTypes` array (itself incomplete — omits `transaction:deleted`, `scores:reset`, `session:overtime`, `display:mode`, `player:scan`, and `scoreboard:page`) and asserts only `toHaveBeenCalledTimes(localArray.length)`. The assertion is self-referential, so it passes regardless of what the production array contains — false confidence that cannot detect a silently-dropped server event.

**Recommended fix:** Export the production `messageTypes` constant and assert it equals the set of server→client messages parsed from the AsyncAPI subscribe channel (or a checked-in snapshot). This turns contract drift / dropped events into a failing test.

#### M-13. Service worker is stale relative to the real build — re-enabling it as-is would pin a broken/outdated shell
**Finding ID:** SW-2.

**Affected files:** `ALNScanner/sw.js:7,8,11,62`, `ALNScanner/index.html:536,542`.

**What's wrong:** The precache list references files that do not exist in production: unhashed `./index.html` (the real entry assets are hashed `main-<hash>.js/.css`), `./data/tokens.json` (404s under `/gm-scanner/`), and `/socket.io-client/socket.io.min.js` (index.html actually loads `/socket.io/socket.io.js`). `cache.addAll()` is atomic, so any 404 makes the entire install reject — the SW would never activate even after the file is emitted. The fetch handler is cache-first with no cache-busting, so it would serve a stale `index.html` indefinitely after a deploy unless `CACHE_NAME` is manually bumped.

**Recommended fix:** Do **not** ship the current `sw.js`. Prefer `vite-plugin-pwa` (auto-generated precache from real hashed assets + self-update), or rewrite `sw.js` to drop the broken entries, precache the actual built assets (or use runtime-cache + navigation-fallback), make install non-atomic, and add a `skipWaiting`/`clients.claim` update flow. Validate by deploying twice and confirming clients pick up the new bundle without a manual cache-name bump. (Prerequisite for H-1's lifecycle fix.)

#### M-14. SW registration 404 shows a user-facing error toast on every load
**Finding ID:** SW-3.

**Affected files:** `ALNScanner/src/app/initializationSteps.js:120,124`, `ALNScanner/src/app/app.js:102`.

**What's wrong:** Because `/gm-scanner/sw.js` 404s (H-1), `register()` rejects with a generic error that falls into the else branch and calls `uiManager.showError('Service Worker registration failed…')` — a visible toast on every one of the ~28 loads in a session. This is noise that erodes operator trust and can mask real errors. Registration is also awaited unconditionally for both networked and standalone modes.

**Recommended fix:** Primary fix is H-1 (emit the file). Independently, downgrade a registration failure to `Debug.log`/`console.warn` — a missing SW should never alarm the operator mid-show. Consider whether to register the SW at all in networked mode given the BFCache tradeoff.

#### M-15. Inline `system:reset` handler doesn't filter `gm:command:ack` by action — wrong-ack race
**Finding ID:** AC-3.

**Affected files:** `ALNScanner/src/app/app.js:1108`, `ALNScanner/src/admin/utils/CommandSender.js:44`.

**What's wrong:** Unlike `CommandSender` (which ignores acks whose `action` doesn't match), the inline `system:reset` path uses `socket.once('gm:command:ack', ...)` with no action filter, resolving on the *first* ack to arrive. If another command's ack races in during the reset window, the `.once` handler fires on the wrong ack and self-removes; the genuine reset ack is never observed and the promise rejects on the 5s timeout — a false "System reset timeout" even though the reset succeeded server-side. It's also a duplicated, divergent copy of the CommandSender pattern.

**Recommended fix:** Route `system:reset` through `AdminOperations` + `CommandSender`, or at minimum add `if (response.data?.action !== 'system:reset') return;` before consuming the ack.

#### M-16. `AdminOperations` test locks in the invalid `system:restart`/`system:clear` action names via an always-success mock
**Finding ID:** AC-4 (phantom-mock; pairs with the low-severity AC-1/CC-6 contract violations in L-1).

**Affected files:** `ALNScanner/tests/unit/admin/AdminOperations.test.js:5,26`.

**What's wrong:** `sendCommand` is mocked to unconditionally resolve `{success:true}`, then the test asserts `restartSystem()` sends `'system:restart'` and `clearData()` sends `'system:clear'`. The test passes while production behavior is broken (backend returns "Unknown action"). The mock shape diverges from the real contract — false confidence that actively cements the contract-violating names. No test validates controller action strings against the AsyncAPI enum.

**Recommended fix:** Add a contract conformance test that loads the AsyncAPI `GmCommand` action enum and asserts every controller-emitted action is a member. Update/remove the `AdminOperations` tests when AC-1 is fixed.

---

### LOW

#### L-1. Dead admin actions `system:restart` / `system:clear` are not in the GmCommand enum (backend returns "Unknown action")
**Finding IDs:** AC-1 + CC-6 (same defect, two dimensions). Files: `ALNScanner/src/admin/AdminOperations.js:29,37`, `backend/contracts/asyncapi.yaml:1456`, `backend/src/services/commandExecutor.js:720`. Both methods have **zero callers** (real reset is the inline `system:reset` in app.js), so not live-breaking today, but latent contract violations that would silently fail if wired up. **Fix:** delete the methods (and their tests) or rename to the contract-defined `system:reset`; add the action-enum conformance test.

#### L-2. `audio:route:set` sends a raw PipeWire sink name instead of the documented `'hdmi'|'bluetooth'` alias
**Finding ID:** AC-5. Files: `ALNScanner/src/admin/AudioController.js:32`, `ALNScanner/src/ui/renderers/EnvironmentRenderer.js:214`, `backend/contracts/asyncapi.yaml:1429`. Backend `setStreamRoute` tolerates specific sink names, so it works — prose/behavior drift only (the contract payload is `type: object`, not a strict schema). **Fix:** update the contract prose to acknowledge specific sink names, or normalize the dropdown to the logical alias.

#### L-3. Admin password left in the DOM input and JS memory after authentication
**Finding ID:** AUTH-3. Files: `ALNScanner/src/ui/connectionWizard.js:284-373`. The password field is never cleared after a successful auth (modal is only hidden), so the shared admin secret is recoverable from devtools/DOM dumps for the session. Low on a trusted LAN, but gratuitous retention. **Fix:** clear `gmPassword.value` in a `finally` block; set `autocomplete='off'`.

#### L-4. Auth response token stored without validating it is present/well-formed
**Finding ID:** AUTH-4. Files: `ALNScanner/src/ui/connectionWizard.js:327-364`. `const { token } = await res.json()` is stored with no non-empty-string check; a 200-with-empty/HTML body stores the literal `'undefined'` and the wizard silently loops back with no actionable error. `expiresIn` (a required contract field) is never used. **Fix:** validate the parsed body before storing; wrap `.json()` in try/catch; consider using `expiresIn` for proactive re-auth.

#### L-5. Stale/expired token not cleared from localStorage when `auth:required` fires
**Finding ID:** AUTH-5. Files: `ALNScanner/src/network/connectionManager.js:128-132,178-184`, `ALNScanner/src/app/app.js:148-154`, `ALNScanner/src/services/StateValidationService.js:172-188`. The `auth:required` handler shows the wizard but does **not** remove `aln_auth_token`; `clearStaleState()` exists but is only called on the startup path. Mostly self-correcting, but a defense-in-depth gap. **Fix:** call `localStorage.removeItem('aln_auth_token')` (or reuse `clearStaleState()`) at the moment the token is known bad.

#### L-6. Post-connection backend `error` (e.g. `AUTH_REQUIRED` from `handleGmIdentify`) is forwarded but never handled
**Finding ID:** AUTH-7 (also folded into M-1). Files: `ALNScanner/src/network/orchestratorClient.js:240-274`, `ALNScanner/src/network/networkedSession.js:194-321`. Narrow (a correctly-authenticated GM rarely hits this), but an auth/permission error with zero operator signal is a resilience gap. **Fix:** add a `case 'error'` that surfaces the error and routes `AUTH_*` codes to `auth:required` + token clear.

#### L-7. `sync:request` is a live client→server event missing entirely from the AsyncAPI publish contract
**Finding ID:** CC-3. Files: `ALNScanner/src/admin/MonitoringDisplay.js:151`, `backend/src/server.js:75`, `backend/contracts/asyncapi.yaml:105`. `MonitoringDisplay` emits `sync:request` (raw, no envelope) and the backend handles it, but the publish channel `oneOf` lists only `TransactionSubmit` and `GmCommand`. A future strict-validation middleware could silently break admin refresh. **Fix:** add a `SyncRequest` message to the contract and decide whether it should require the envelope (align both ends).

#### L-8. Forwarded server→client events with no consumer: `cue:completed`, `offline:queue:processed`, `batch:ack`
**Finding ID:** CC-7 (overlaps WS-4 in L-28 and the uncertain TQ-5 in L-26). Files: `ALNScanner/src/network/orchestratorClient.js:254`, `ALNScanner/src/admin/MonitoringDisplay.js:175`. `cue:completed` is a missed UX feature; `offline:queue:processed`/`batch:ack` are orphan (the scanner uses WebSocket replay, not the batch endpoint). `batch:ack` is also defined in AsyncAPI but missing from the subscribe `oneOf` (internal contract inconsistency). **Fix:** add a `cue:completed` handler if completion feedback is wanted; remove the unused entries from `messageTypes`; reconcile the `BatchAck` subscribe listing.

#### L-9. Auth response JSON parsed/destructured without guarding for missing token or non-JSON body
**Finding ID:** HTTP-2 (closely related to L-4/AUTH-4). Files: `ALNScanner/src/ui/connectionWizard.js:333`. A 200-but-HTML body throws into the generic catch ("Connection failed" despite auth visually succeeding); a JSON body missing `token` stores a bad value and fails later with a confusing "invalid token." **Fix:** isolate `.json()` in its own try/catch and validate `token` is a non-empty string before persisting.

#### L-10. `tokens.json` fallback chain is backwards for the deployed build — the primary fetch always 404s in production
**Finding ID:** HTTP-3. Files: `ALNScanner/src/core/tokenManager.js:40`, `ALNScanner/vite.config.js:7`. `loadDatabase()` fetches `data/tokens.json` first, but `publicDir:'data'` copies the *contents* of `data/` into the dist root, so `dist/data/` does not exist — `data/tokens.json` 404s on every startup and only the fallback `tokens.json` succeeds. Costs a failed round-trip + console error on the critical startup path every (re)load (~29× in one session). Fragile: "fixing" the 404 by changing `publicDir` would break token loading hard (a failed token fetch is fatal by design). **Fix:** fetch `tokens.json` first (or derive from `import.meta.env.BASE_URL`); downgrade the first 404 to a debug log.

#### L-11. ⚠ needs confirmation — `tokens.json` `.json()` unguarded against a 200-but-HTML (SPA fallback) response
**Finding ID:** HTTP-4 (`verdict: uncertain`). Files: `ALNScanner/src/core/tokenManager.js:49`. If `tokens.json` is missing but the server returns the HTML shell with 200, `.json()` throws a `SyntaxError` caught by the outer catch — net effect is correct-ish (it fails, no demo data) but the surfaced error is an opaque JSON parse error rather than "token database not found." **To check:** whether the orchestrator serves the SPA shell (200) for unknown static paths under `/gm-scanner/`. **Fix:** check `content-type` or wrap the parse and rethrow a clear message; validate the parsed object is a non-empty token map.

#### L-12. Protocol-less URL normalization defaults to `http://` — mixed-content blocking on an HTTPS-served scanner
**Finding ID:** HTTP-5. Files: `ALNScanner/src/ui/connectionWizard.js:168,304`. Typing a bare IP (`10.0.0.5:3000`) builds `http://…`, which the browser blocks as mixed content on the HTTPS-served scanner, surfacing as a generic "Connection failed." Inconsistent with the discovery path, which correctly mirrors `window.location.protocol`. **Fix:** default the prepended scheme to match the page protocol at both call sites.

#### L-13. Discovery scan fires ~509 uncapped cross-origin fetches; runs unprompted on modal open
**Finding ID:** HTTP-6. Files: `ALNScanner/src/ui/connectionWizard.js:74`. 254 IPs × 2 ports + localhost concurrent fetches (each 500ms timeout, errors swallowed). No concurrency cap — can spike Pi memory/CPU and floods the console with CORS/network errors (logged by the browser regardless of `.catch`), obscuring real diagnostics. Auto-fires 100ms after the modal opens. **Fix:** batch into chunks of ~32; skip the auto-scan when a known orchestrator URL is already saved.

#### L-14. No `visibilitychange`/`pagehide` handling for the NFC scan
**Finding ID:** NFC-3 (part of the same "never cleaned up when hidden" pattern as H-1/RL-2). Files: `ALNScanner/src/utils/nfcHandler.js:158-164`, `ALNScanner/src/app/app.js:595-625`. An always-on `NDEFReader` keeps the radio active while backgrounded and is destroyed without graceful teardown on tab discard. **Fix:** add a `visibilitychange`/`pagehide` listener to abort the scan when hidden and re-arm on show (depends on NFC-1's AbortController).

#### L-15. `processNFCRead` can throw on `result.id` for any non-`error` source (defensive gap)
**Finding ID:** NFC-4. Files: `ALNScanner/src/app/app.js:639-659`. Only `source === 'error'` is guarded; `result.id.length` / `result.id.trim()` then run with no string/non-null check. Safe for the current NFC path, but `manualEntry`/`simulateScan`/future record types could deliver `id: null`, throwing a `TypeError` inside the async `'reading'` handler — which `nfcHandler` does **not** await, so it becomes an unhandled rejection with no user feedback. **Fix:** add a `typeof result.id === 'string' && result.id.trim() !== ''` guard; optionally await/catch `onRead`.

#### L-16. URL NDEF records are accepted as the raw tokenId with no extraction
**Finding ID:** NFC-5. Files: `ALNScanner/src/utils/nfcHandler.js:119-128`, `ALNScanner/src/core/tokenManager.js:207-227`. A URL-record tag returns the whole URL as `id`; `findToken` normalization only strips `:`/`-` and lowercases, so the URL never matches a token key and a junk "Unknown" transaction is queued to the backend. A unit test codifies the full-URL behavior. **Fix:** confirm production tag encoding; if URL records are used, extract the token segment; if never used, drop the url-record branch.

#### L-17. `readingerror` gives a transient hint but no durable fallback to Manual Entry
**Finding ID:** NFC-6. Files: `ALNScanner/src/app/app.js:608-624`, `ALNScanner/src/utils/nfcHandler.js:66-69`. Repeated read errors only show "Tap token again" with no escalation to Manual Entry (the start-failure path does surface it). The error log stringifies the raw `Event` object (`[object Event]`), losing detail. **Fix:** on repeated `readingerror`, surface the Manual Entry affordance and log a meaningful field.

#### L-18. Exponential backoff is off-by-one — first retry already waits 2s, base 1s is never used; no jitter
**Finding ID:** RL-6. Files: `ALNScanner/src/network/connectionManager.js:124-132,228-233`. `retryCount++` runs before `_calculateRetryDelay`, which uses `2^retryCount`, so the sequence is 2s/4s/8s/16s and the 1s base is unreachable. **Fix:** use `2^(retryCount-1)` (or compute before incrementing); add jitter to avoid thundering-herd reconnects across stations.

#### L-19. Device-ID first-time fallback uses a stale `lastStationNum` counter that can collide
**Finding ID:** RL-7 (contributes to M-2). Files: `ALNScanner/src/ui/connectionWizard.js:185-233,346-351`. On `/api/state` failure, first-time assignment falls back to a per-device `lastStationNum` counter not coordinated across stations, which can hand out an already-connected ID → immediate `DEVICE_ID_COLLISION` with no surfacing. **Fix:** block with a clear error when `/api/state` is unreachable, or use a collision-resistant suffix; reconcile against the server's connected-device list at connect time.

#### L-20. No test asserts `dist/sw.js` exists — the build gap is fully uncovered
**Finding ID:** SW-4. Files: `ALNScanner/tests/unit/app/initializationSteps.test.js:192,196,200`. Every test fully mocks `navigator.serviceWorker.register`; none verifies the real artifact, which is why the 404 shipped undetected. **Fix:** add a build-artifact assertion (`test -f dist/sw.js` after `npm run build`) and ideally an E2E check that `GET /gm-scanner/sw.js → 200`, turning the silent build gap into a hard CI failure.

#### L-21. StateStore is a never-reset singleton; shallow merge carries orphan keys across reconnect (gameclock shape drift)
**Finding ID:** SSR-2 (closely related to SR-3 in L-24). Files: `ALNScanner/src/core/stateStore.js:18-19`, `ALNScanner/src/main.js:62`, `ALNScanner/src/network/networkedSession.js:253,316-319`. `update()` is a pure shallow merge with no key removal, and the store is never cleared on disconnect/reconnect/session boundary. Concretely, `sync:full` gameclock = `{status, elapsed, expectedDuration}` while `service:state` gameclock = `{status, elapsed, startTime, totalPausedMs}` — after both fire, the domain accumulates disjoint fields and stale ones linger. Latent desync waiting on any backend key change. **Fix:** treat snapshot domains as full replacements (`this._state[domain] = { ...state }`) or clear domains on session-boundary/reconnect; align the two gameclock shapes to one contract shape.

#### L-22. StateStore `get()`/`getAll()` return only shallow copies — nested domain objects/arrays are shared mutable references
**Finding ID:** SSR-3. Files: `ALNScanner/src/core/stateStore.js:45-50`. Nested values (`video.queue`, `cueengine.cues`, `bluetooth.devices`, `health` object-of-objects) are returned by reference; a consumer mutating them would corrupt canonical state and defeat shallow-equality change detection. No confirmed mutating consumer today. **Fix:** document the shallow-copy contract, or `structuredClone()` for iterable/mutable domains; add a test asserting nested mutation doesn't leak.

#### L-23. `SessionRenderer` injects the backend-echoed session name into innerHTML without escaping
**Finding ID:** SR-2. Files: `ALNScanner/src/ui/renderers/SessionRenderer.js:181,204,222,247,267`. The only renderer that doesn't `escapeHtml()` a backend string into innerHTML (every other renderer does and has an XSS test). A name with `<`/`>`/`"` breaks the live session header (the command center) or injects markup. Real exploit risk bounded (operator types the name), but a genuine, inconsistent injection/UI-break gap. **Fix:** `escapeHtml(session?.name)` in the template; add an XSS unit test.

#### L-24. StateStore shallow-merge + guarded `sync:full` restore can leave stale service state rendered on reconnect
**Finding ID:** SR-3 (same root as SSR-2/L-21). Files: `ALNScanner/src/core/stateStore.js:18`, `ALNScanner/src/network/networkedSession.js:247,256`. The guarded restores (`if (payload.videoStatus) store.update('video', ...)`) mean a partial/degraded post-reconnect `sync:full` that omits a domain leaves the **stale** value rendered (e.g. video still "Playing"). Latent today because `buildSyncFullPayload` always includes these domains. **Fix:** reset domains before applying `sync:full`, or make the restore unconditional with explicit defaults; add a test (reconnect with a `sync:full` lacking `videoStatus` → VideoRenderer no longer shows "Playing").

#### L-25. `EnvironmentRenderer.renderBluetooth` relies on `discoveredDevices` that `bluetoothService.getState()` never provides
**Finding ID:** SR-4. Files: `ALNScanner/src/ui/renderers/EnvironmentRenderer.js:262,282`, `backend/src/services/bluetoothService.js`. The renderer defaults `discoveredDevices = []` (no crash), but `getState()` returns only `{available, scanning, pairedDevices, connectedDevices}` — so newly-discovered (un-paired) speakers found during a scan never render via `service:state`. **Fix:** confirm whether discovered devices should flow over `service:state`; if yes, add `discoveredDevices` to `getState()`/sync:full; if not, remove the dead merge path.

#### L-26. ⚠ needs confirmation — `offline:queue:processed`/`batch:ack` forwarded but never reconciled
**Finding ID:** TQ-5 (`verdict: uncertain`; overlaps CC-7/L-8). Files: `ALNScanner/src/network/orchestratorClient.js:254-255`, `ALNScanner/src/network/networkedSession.js:194-326`. `batch:ack` may legitimately not apply (the scanner doesn't use the HTTP batch endpoint), but `offline:queue:processed` (server-side queue drain) is silently dropped, so the GM has no signal when server-queued GM transactions are finally processed — a state-reconciliation gap. **To check:** whether server-side-queued GM transactions are reliably re-delivered via `transaction:new`. **Fix:** remove the unused events from `messageTypes` (and document reliance on `transaction:result` + `sync:full`), or add an `offline:queue:processed` handler; if TQ-1/TQ-2 migrate to a batched/acked model, wire `batch:ack` as the queue-clear trigger per the contract's idempotency design.

#### L-27. `scannedTokens` dedup state is in-memory only in networked mode — re-scan protection across reloads depends entirely on `sync:full`
**Finding ID:** TQ-7. Files: `ALNScanner/src/app/app.js:742`, `ALNScanner/src/core/storage/NetworkedStorage.js:31`, `ALNScanner/src/core/unifiedDataManager.js:856-871`. The `scannedTokens` Set is not persisted (unlike the offline tx queue), so after each reload it's empty until `sync:full` repopulates it; in that gap the local duplicate guard misses, relying on backend dedup. Worse, a reloaded-then-offline operator can re-scan and enqueue a token twice (the second comes back `duplicate`, then mishandled per M-8). **Fix:** persist `scannedTokens` alongside the offline queue (keyed by sessionId), or document that client-side dedup is best-effort; ensure offline-queued transactions persist their scannedTokens marker.

#### L-28. `cue:completed` forwarded but has no consumer (dead event)
**Finding ID:** WS-4 (overlaps CC-7/L-8). Files: `ALNScanner/src/network/orchestratorClient.js:259`, `ALNScanner/src/admin/MonitoringDisplay.js:198-207`. Harmless, but the cue-completion UI feedback the CueRenderer implies is dead. **Fix:** add a `cue:completed` handler (clear active-cue indicator) or remove it from the forwarding list.

#### L-29. `socket:connected` dispatched twice on first connect (and has zero listeners)
**Finding ID:** WS-5. Files: `ALNScanner/src/network/orchestratorClient.js:99,216-219`. Both the persistent `on('connect')` and the `once('connect')` in `connect()` dispatch `socket:connected`. Benign today (no listener), but a latent footgun: a future listener (e.g. to re-sync the offline queue on connect) would fire twice per connect — dangerous in the reconnect-churn context. **Fix:** dispatch from exactly one place.

#### L-30. ⚠ part-uncertain — see L-11 (HTTP-4) and L-26 (TQ-5)
*(The low-severity items carrying a non-confirmed verdict are L-11 / HTTP-4 and L-26 / TQ-5, both flagged inline above. No separate finding; listed here only as a cross-reference.)*

---

### INFO

#### I-1. Discovered-server URL interpolated into innerHTML without escaping (defense-in-depth)
**Finding ID:** AUTH-6. Files: `ALNScanner/src/ui/connectionWizard.js:130-146`. `data-arg="${server.url}"` is interpolated raw and later read and used as the server URL; a `"` in a value from a rogue LAN responder could break out of the attribute. Not a confirmed exploit on a trusted LAN. **Fix:** build with `createElement` + `textContent`/`setAttribute`, or run the URL through `escapeHtml` and validate against an `https?://host:port` pattern.

#### I-2. `displayDiscoveredServers` references a `server.ip` field that the producer never sets
**Finding ID:** HTTP-7. Files: `ALNScanner/src/ui/connectionWizard.js:142,206`. `assignStationName`'s `/api/state` parse is correctly defensive (good model for L-9/L-11 fixes). The `server.ip ||` branch is dead (producer supplies only `{url}`); a future caller omitting `url` would render `data-arg="undefined"`. Not currently triggerable. **Fix:** none required; if hardening, drop the dead branch and guard `selectServer` against a falsy url.

#### I-3. `GET /api/videos` is contracted/documented but never fetched — `VideoController.addToQueue` has no source for its video list
**Finding ID:** HTTP-8. Files: `ALNScanner/src/admin/VideoController.js:61`. VideoController is pure WebSocket (clean for HTTP), but nothing fetches `/api/videos` to populate a video picker, so manual video-add relies on the operator knowing exact filenames (or the UI is unwired). Doc/feature drift, not an error-handling defect. **Fix:** confirm whether the manual video-add UI should fetch `/api/videos`; if so, implement with `res.ok` + timeout + JSON-guard discipline; else update docs.

#### I-4. Renderer element-cache lookups use raw (unescaped) ids in `querySelector` while the same ids are escaped in innerHTML
**Finding ID:** SR-5. Files: `ALNScanner/src/ui/renderers/HealthRenderer.js:112`, `CueRenderer.js:121,215`, `EnvironmentRenderer.js:120`. If an id ever contains a quote/selector metacharacter, the escaped attribute and the raw selector disagree (silent cache miss → no differential update) or the selector throws. Current ids are well-formed. **Fix:** use `CSS.escape(id)` or a dataset-keyed Map captured at build time.

#### I-5. `sendCommand()` correlates acks only by action name — concurrent same-action commands can cross-resolve
**Finding ID:** WS-6. Files: `ALNScanner/src/network/orchestratorClient.js:132-168`, `ALNScanner/src/core/teamRegistry.js:337`. Two in-flight commands with the same action (e.g. rapid `session:addTeam` during churn) resolve in arrival order, so callers can receive each other's success/message. Low probability single-operator, but plausible in churn. The simplified `gm:command:ack` payload `{action, success, message}` has no correlation id. **Fix:** add a per-command `requestId` echoed in the ack (coordinated contract change); interim, serialize same-action commands client-side.

#### I-6. Envelope unwrap fallback (`envelope.data || envelope`) can silently mask malformed/contract-drifted events
**Finding ID:** WS-7. Files: `ALNScanner/src/network/orchestratorClient.js:144,267`. The fallback is defensible runtime safety, but it silently accepts events that violate the required `{event, data, timestamp}` envelope, turning contract drift into confusing undefined-field behavior rather than a clear error. **Fix:** when `envelope.data` is missing, `Debug.log`/warn that a non-conforming event was received (keep the fallback).

---

## 3. Cross-Cutting Themes

1. **Recovery-by-full-reload instead of in-page reconnect.** The defining systemic flaw. Auto-reconnect is gated to a reason that backgrounded/blipped tabs never produce (RL-1/AUTH-2), there's no page-lifecycle handling so the open socket blocks BFCache (RL-2/NFC-3), and the service worker never ships so there's no shell to serve a discarded tab (SW-1/RL-4). The result is ~29 full reloads/session, each a fresh socket that loses in-memory state and races the server's stale-socket teardown into silent `DEVICE_ID_COLLISION`s (RL-3/AUTH-1/RL-5/RL-7). Fixing these as one coordinated change is the highest-leverage work in this review.

2. **No operator-visible error surfacing.** Backend rejections and errors are systematically swallowed: `safeAdminAction` → debug panel only (AC-2); the contractually-`MUST-display` `error` event has no consumer (WS-3/CC-4/AUTH-7); collisions arrive on `socket:error` with no listener (RL-3); a stuck auth POST shows "Connecting…" forever (HTTP-1). During a live show the GM cannot tell a failed command from a no-op. Error handling is *inconsistent* — older session/score/video paths do call `showError`, the newer environment/show-control controllers do not.

3. **Lost-scan / double-count risk on the transaction boundary.** The connected path is fire-and-forget (TQ-1), the offline queue is cleared on any flush outcome (TQ-2), the replay matcher can't distinguish accepted/duplicate/rejected/queued (TQ-3/TQ-4), reconnect flush isn't reconciled against `sync:full` (TQ-6), and dedup state isn't persisted (TQ-7). Individually subtle; together, the exact churn the post-mortem documents is where scoring data is silently lost or double-submitted.

4. **The "phantom-mock" pattern cements contract drift.** Tests mock the *wrong* contract shape and then pass against it, hiding production bugs: the forwarding-completeness test uses a self-referential count (WS-2), `AdminOperations` asserts invalid action names via an always-success mock (AC-4), `EnvironmentRenderer` tests feed `activeScene` as an object when the backend sends a string (SR-1), `NetworkedStorage` tests assert the unwrapped (rejected) shape (CC-5). The fix is structural: contract conformance tests that load the AsyncAPI enums/schemas, and a build-artifact test that asserts `dist/sw.js` exists (SW-4).

5. **Contract underspecification defeats the Contract-First guarantee.** The contracts are the declared source of truth, but the most reliability-critical paths are under- or mis-specified: `sync:full` documents 7 of ~17 fields (CC-2), `sync:request` is entirely absent (CC-3), the `TransactionResult` enum omits `queued`/`rejected` that the backend actually emits (TQ-4), and dead/wrong action names live in the client (AC-1/CC-6). Where a field isn't in the contract, validation tooling can't catch drift — which is exactly how `bonus` vs `bonusPoints` (CC-1) and the `activeScene` shape (SR-1) slipped through. The contract-drift class spans CC-1, CC-2, CC-3, CC-5, CC-6, SR-1, TQ-4, and the low AC-5/CC-7.

---

## 4. Appendix

### A. All 65 verified findings

| ID | Sev | Dim | Title |
|----|-----|-----|-------|
| RL-1 | critical | reconnect-lifecycle | Auto-reconnect only on 'io server disconnect', never transport close/ping timeout |
| TQ-2 | critical | transaction-queue | syncQueue clears persisted queue even when replays fail/time out (data loss) |
| AUTH-2 | high | auth-security | Browser-side network drops never auto-reconnect (same defect as RL-1) |
| RL-2 | high | reconnect-lifecycle | No page-lifecycle handling; open WebSocket blocks BFCache → full reload on return |
| SW-1 | high | service-worker-pwa | sw.js never emitted to dist/ — deployed build has NO service worker |
| TQ-1 | high | transaction-queue | Connected-path submit is fire-and-forget; scans lost in reconnect window |
| AC-2 | medium | admin-commands | safeAdminAction swallows ack failures — no operator-visible feedback |
| AC-3 | medium | admin-commands | Inline system:reset handler doesn't filter gm:command:ack by action (race) |
| AC-4 | medium | admin-commands | AdminOperations test locks in invalid system:restart/clear via always-success mock |
| AUTH-1 | medium | auth-security | Handshake auth failure / device collision retried as transient (no reason inspection) |
| CC-1 | medium | contract-conformance | group:completed reads `bonus`, contract/backend emit `bonusPoints` — bonus lost |
| CC-2 | medium | contract-conformance | sync:full contract documents only 7 of ~17 client-depended fields |
| CC-4 | medium | contract-conformance | Backend `error` events have no consumer; validation/QUEUE_FULL silently dropped |
| CC-5 | medium | contract-conformance | NetworkedStorage emits transaction:submit without the envelope (backend rejects) |
| CC-8b | medium | http-api-usage | ⚠ /api/state device list may omit connectionStatus → station auto-numbering breaks |
| HTTP-1 | medium | http-api-usage | Auth login POST has no timeout — slow/half-open backend hangs the wizard forever |
| NFC-1 | medium | nfc | stopScan() is a no-op — NDEFReader scan + listeners never aborted (leak) |
| NFC-2 | medium | nfc | Re-entering scan screen leaks a new NDEFReader + duplicate listeners |
| RL-3 | medium | reconnect-lifecycle | DEVICE_ID_COLLISION → socket:error with NO consumer; silent, no backoff |
| RL-4 | medium | reconnect-lifecycle | Deployed build ships no service worker (same defect as SW-1) |
| RL-5 | medium | reconnect-lifecycle | Reconnect-identify race: new socket opened before prior teardown confirmed |
| SW-2 | medium | service-worker-pwa | sw.js cache manifest + cache-first stale — re-enabling as-is serves a broken shell |
| SW-3 | medium | service-worker-pwa | SW registration 404 surfaces a user-facing error toast on every load |
| SR-1 | medium | state-renderers | EnvironmentRenderer expects activeScene object, backend sends string — never highlights |
| TQ-3 | medium | transaction-queue | Replay matcher keys on tokenId+teamId, treats all non-error status as success |
| TQ-4 | medium | transaction-queue | Backend emits transaction:result statuses ('queued','rejected') not in enum |
| TQ-6 | medium | transaction-queue | Reconnect flush not reconciled against sync:full → potential duplicate replays |
| WS-2 | medium | websocket-core | Forwarding-completeness test uses a divergent self-referential list |
| WS-3 | medium | websocket-core | Server 'error' message forwarded but never consumed (contract: MUST display) |
| AC-1 | low | admin-commands | AdminOperations emits non-contract system:restart/clear (backend: Unknown action) |
| AC-5 | low | admin-commands | audio:route:set sends raw PipeWire sink name vs documented 'hdmi'\|'bluetooth' |
| AUTH-3 | low | auth-security | Admin password left in DOM input + JS memory after auth |
| AUTH-4 | low | auth-security | Auth response token stored without validating present/well-formed |
| AUTH-5 | low | auth-security | Stale/expired token not cleared from localStorage on auth:required |
| AUTH-7 | low | auth-security | Post-connection backend `error` (AUTH_REQUIRED) forwarded but never handled |
| CC-3 | low | contract-conformance | sync:request is a live client→server event missing from the publish contract |
| CC-6 | low | contract-conformance | Dead system:restart/clear not in GmCommand enum (same as AC-1) |
| CC-7 | low | contract-conformance | Forwarded-but-unconsumed: cue:completed, offline:queue:processed, batch:ack |
| HTTP-2 | low | http-api-usage | Auth response JSON parsed/destructured without guarding missing token/non-JSON |
| HTTP-3 | low | http-api-usage | tokens.json fallback chain backwards — primary fetch always 404s in production |
| HTTP-4 | low | http-api-usage | ⚠ tokens.json .json() unguarded against 200-but-HTML (SPA fallback) |
| HTTP-5 | low | http-api-usage | Protocol-less URL defaults to http:// — mixed-content blocking on HTTPS scanner |
| HTTP-6 | low | http-api-usage | Discovery scan issues ~509 uncapped cross-origin fetches; failures swallowed |
| NFC-3 | low | nfc | No visibilitychange/pagehide handling for NFC scan (BFCache eviction contributor) |
| NFC-4 | low | nfc | processNFCRead can throw on result.id when id is null/non-string |
| NFC-5 | low | nfc | URL NDEF records accepted as raw tokenId — yields unknown-token transactions |
| NFC-6 | low | nfc | readingerror gives transient hint but no durable fallback to Manual Entry |
| RL-6 | low | reconnect-lifecycle | Backoff off-by-one: first retry waits 2s, base 1s never used; no jitter |
| RL-7 | low | reconnect-lifecycle | Device-ID fallback uses stale lastStationNum counter — can collide |
| SW-4 | low | service-worker-pwa | No test asserts dist/sw.js exists — build gap fully uncovered |
| SSR-2 | low | session-state-routing | StateStore never-reset singleton; shallow merge carries orphan keys (gameclock drift) |
| SSR-3 | low | session-state-routing | get()/getAll() return shallow copies — nested objects shared mutable refs |
| SR-2 | low | state-renderers | SessionRenderer injects backend session name into innerHTML without escaping |
| SR-3 | low | state-renderers | Shallow-merge + guarded sync:full restore can leave stale service state rendered |
| SR-4 | low | state-renderers | EnvironmentRenderer relies on discoveredDevices backend getState() never provides |
| TQ-5 | low | transaction-queue | ⚠ offline:queue:processed / batch:ack forwarded but never reconciled |
| TQ-7 | low | transaction-queue | scannedTokens dedup is in-memory only — re-scan protection depends on sync:full |
| WS-4 | low | websocket-core | cue:completed forwarded but has no consumer (dead event) |
| WS-5 | low | websocket-core | socket:connected dispatched twice on first connect (zero listeners) |
| AUTH-6 | info | auth-security | Discovered-server URL interpolated into innerHTML without escaping |
| HTTP-7 | info | http-api-usage | displayDiscoveredServers references a server.ip field the producer never sets |
| HTTP-8 | info | http-api-usage | GET /api/videos contracted but never fetched — addToQueue has no list source |
| SR-5 | info | state-renderers | Renderer cache lookups use raw ids in querySelector while escaped in innerHTML |
| WS-6 | info | websocket-core | sendCommand() correlates acks only by action name — concurrent same-action cross-resolve |
| WS-7 | info | websocket-core | Envelope unwrap fallback can silently mask malformed/contract-drifted events |

*(Count: 2 critical + 4 high + 23 medium + 30 low + 6 info = 65.)*

### B. Refuted findings (verified and removed)

| ID | Why refuted |
|----|-------------|
| SSR-1 | Refuted during adversarial verification — domain routing was found complete and correct: all 10 service domains route from both `sync:full` and `service:state`, and field names match the real backend payload. The alleged routing defect did not hold. |
| SSR-4 | Refuted during adversarial verification — premise did not survive independent skeptic review of the session-state-routing path. |
| WS-1 | Refuted — the claimed silent-drop of `scoreboard:page` from the forwarding array did not hold up as stated. (The *test-quality* concern that motivated it survives separately as WS-2 / M-12.) |
| CC-8 | Refuted — its central premise ("backend `DeviceConnection.toJSON()` emits connectionStatus, so the client filter works") was factually wrong, which *inverted* the recommendation. The refutation itself surfaced the real, still-uncertain issue now tracked as **CC-8b / M-3** (the `/api/state` device map omits `connectionStatus`). |
