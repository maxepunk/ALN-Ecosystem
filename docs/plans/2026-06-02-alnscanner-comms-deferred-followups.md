# ALNScanner Comms-Fixes — Deferred Follow-ups

> Companion to `2026-05-28-alnscanner-comms-fixes-plan.md`. These are items
> surfaced by the per-sub-phase code reviews that were **deliberately deferred
> past plan completion**, judged item-by-item against the plan's intent AND the
> live-game functional impact (not just "does a later plan task own it").

**Triage rule applied:** an item is deferrable past the plan only if (a) no
remaining plan task owns it, AND (b) deferring it does not degrade the live-game
experience or undermine the plan's objectives (eliminate reconnect-churn,
lost-scan failure modes, contract/test drift, and surface operator errors).

## Resolved during execution (NOT deferred — listed for the record)
Items that a functional re-examination promoted from "defer" to "fix now":
- **B — `_scanningActive` not cleared on `finishTeam`** → FIXED (`a97c5b9`). Lost-scan-adjacent: NFC was left armed with no team selected → taps silently rejected. Not cosmetic.
- **R9 — SW served stale token data across deploys** → FIXED (`f755c6f`). R7 made the cache live; `tokenManager` fetches a same-origin non-hashed `tokens.json` that cache-first + a static cache name would serve stale forever. Switched the SW to network-first. **This also subsumes deferred item E** (a mid-session SW takeover can't serve stale content under network-first).
- **A — conformance test flat `readdirSync`** → FIXED (`77131a6`). Recursive scan so a future `src/admin/` subdir controller can't slip a non-contract action past the safety net. (Test hardening; no runtime impact.)

## Genuinely deferred past plan completion (none owned by a remaining task; zero live-game functional impact)

| ID | Item | Sev | File | Why safe to defer |
|----|------|-----|------|-------------------|
| C | `npm run test:build` runs two near-identical full Vite builds (`swArtifact.test.js` uses `build:backend`, `sw-artifact.test.js` uses `build`) | nit | `tests/build-artifacts/` | Test-infra speed only; no runtime path. Consolidate the two suites (or share one build) when convenient. |
| D | `vite.config.js` `emitServiceWorker()` reads `readFileSync('./sw.js')` (cwd-relative) | nit | `vite.config.js` | Works for all npm-script invocations (cwd is always `ALNScanner/`). Would only fail a build from a wrong cwd; harden with an `import.meta.url`-relative path. |
| F | SW offline-nav tertiary fallback `caches.match('./')` may not resolve for never-cached sub-paths | low | `sw.js` | The primary offline-nav path (`caches.match(request)`) works after R7/R9; the SPA only navigates to `/gm-scanner/`, so `./` is never the path that matters. |
| G | Lifecycle-test per-test-const-capture pattern is fragile if a future test in that describe reuses shared `let` mocks | low | `tests/unit/ui/connectionWizard.test.js` | Pattern works and is documented with an explanatory comment; risk is only to future test authors. |
| H | Reconnect `done()` tests use real ~1s timers (slow suite) instead of fake timers | low | `tests/unit/network/connectionManager.test.js` | Suite-speed only; deterministic (well within Jest's 5s). Convert to fake timers if suite time becomes a concern. |
| I | `NETWORKED_MODE_USER_FLOW.md` still documents the removed `lastStationNum` counter (P1c.3/RL-7 deleted it) | low | `ALNScanner/docs/NETWORKED_MODE_USER_FLOW.md:149,215` | Doc drift only; no runtime impact. Update to describe server-driven station assignment (query `/api/state` for the next gap) + the unreachable→block-with-error path. (Code fixed in `cd3df40`; the functional fix itself, R10/`56916d4`, also corrected the timeout message to match `TimeoutError`.) |

## Phase 2 boundary-review deferrals (2026-06-02)

The 4-lens Phase 2 review fixed 4 issues in-place (R1 clientTxId parity, R2 cross-session
queue clear, R3 clientTxId handler key, R5/R6 test gaps). These were deliberately deferred:

**Carry-over to Phase 3 (NOT a ledger defer — a hard Phase 3 requirement):**
- **transaction:failed / backend:error has no consumer + dedup guard never cleared on permanent failure.** A rejected/invalid/paused scan drops the queue entry AND locks the token out of re-scan with no GM feedback (lost-scan-equivalent). Pre-existing; user approved deferring to Phase 3. **Phase 3 MUST wire a listener that surfaces the error AND `unmarkTokenAsScanned` on non-duplicate permanent failure.**

| ID | Item | Sev | File | Why safe to defer |
|----|------|-----|------|-------------------|
| J | `resetForNewSession` doesn't clear the old session's persisted `networkedScannedTokens:<oldSid>` key | low | `unifiedDataManager.js` resetForNewSession | Harmless — new session uses a different key; just a localStorage leak across sessions. Remove the old key on session change when convenient. |
| K | session-not-active `transaction:result` emits `transactionId: null` but the AsyncAPI schema requires a non-null string | nit | `adminEvents.js` not-active emit | Pre-existing; not validated by any test, and the scanner ignores transactionId on a status:'error' result. Relax the contract to `[string,'null']` for non-accepted results or omit the field. |
| L | ~~`rejected` status dead on the GM WS path~~ **RESOLVED (P3.4a)** | — | `asyncapi.yaml` + `transactionService.js` | Phase 3 P3.4a (option B) made invalid-token emit `status:'rejected'` (permanent), so `rejected` is now LIVE and emitted; not-active stays `error` (transient → now also definitive-reject per PR3-C). No longer dead. |
| M | No fallback if `sync:full` never arrives after connect (queue flush only fires from sync:full) | low | `networkedSession.js` | Backend auto-sends `sync:full` on every successful GM connect (gmAuth.js), so the queue always flushes in practice. Entries stay persisted regardless (no loss) — only a delayed flush in a rare dropped-emit edge. Add a defensive post-connect timer only if this is ever observed. |
| N | sync:full re-entrancy: a 2nd sync:full mid-`syncQueue` can restore reconcile-dropped entries (stale `survivors` snapshot) | low | `networkedQueueManager.js` syncQueue | Self-healing — the restored entry is one the server already recorded, so the next replay returns `duplicate` and it's removed. Redundant replay, no double-count/loss. Recompute survivors from the live array (not the batch snapshot) if it ever matters. |

## Phase 3 boundary-review deferral (2026-06-02)
The Phase 3 review fixed the MEDIUM (gate scanning while paused) + the leaks/in-flight-reject in-place. One LOW deferred:

| O | Double-replay / double-toast on reconnect-during-in-flight | low | `networkedQueueManager.js` `_submitDurable`/`syncQueue` | A connected scan's `_submitDurable` keeps the entry in `tempQueue` until its result; if a reconnect fires `syncQueue` in that window, the same entry is replayed again under the same clientTxId → two live handlers → both resolve → double `transaction:failed` (double toast) + a leaked listener (cleaned at +30s/destroy). NO scoring/dedup bug (idempotent unmark, no-op remove). Clean fix: an `_inFlight` Set — `_submitDurable` adds the clientTxId before replay (removes on settle) and `syncQueue` skips+keeps in-flight entries (push to survivors, don't re-replay). Also subsumes item N. Optional hardening — narrow reconnect-timing edge. |

**Status:** revisit after the comms-fixes plan is fully implemented. None blocks any remaining phase. The Phase 3 carry-over (transaction:failed/unmark) was HONORED during Phase 3 (P3.4 + the gate/in-flight-reject redesign per the user's pause-semantics decision).

## Scoreboard rendering unification — DEFERRED FEATURE (2026-06-02, user-scoped)

During Phase 4 prep the P0.4 reconciliation surfaced a larger latent opportunity. The user
scoped the immediate work to **remote-control + de-dup only** (no GM scoreboard view, no
cross-build refactor) and asked to **track the rest separately**. Recorded here so the
mapping analysis (workflow wf_c225b2b7-a7f) isn't lost:

**What was deliberately NOT done (a future feature, its own plan):**
- **GM-scanner embedded scoreboard mirror.** The GM scanner renders team *standings*
  (`uiManager.renderScoreboard`) + an owner *picker* (`EvidencePickerRenderer`), but NOT the
  owner-grouped evidence cards/pages that `backend/public/scoreboard.html` shows. An embedded
  live mirror would be a real feature.
- **Cross-component shared rendering module.** `scoreboard.html` is a standalone non-bundled
  vanilla-JS file → it can't import ALNScanner ES6 modules. Genuinely sharing owner-grouping /
  currency / `escapeHtml` / `calculatePages` between the two requires a build/serving decision
  (make scoreboard.html a Vite target, or extract a framework-agnostic module both load).
- **`scoreboard:page` architectural fork (must resolve before any GM mirror).** `scoreboard:page`
  is NOT "show page N" — it's "next/prev/to-owner" against each client's OWN,
  `window.innerHeight`-dependent page set (`calculatePages`, scoreboard.html:1018). So two
  displays (or a display + a GM mirror) on different-size screens paginate differently → a
  `scoreboard:page:owner` can land on different pages. A GM mirror needs either forced-identical
  page math OR a **server-authoritative page model** (scoreboardControlService computes &
  broadcasts the resolved page index). This is a latent correctness issue in the EXISTING
  multi-display remote-control too (out of scope to fix now).

**What IS in scope now (Phase 4a P0.4 cluster):** contract oneOf += BatchAck/PlayerScan;
MESSAGE_TYPES += scoreboard:page (→ strict P0.4 toEqual passes); a minimal `scoreboard:page`
consumer (confirmation hint in EvidencePicker — parity-free: reflects owner for `owner`, a
brief next/prev confirmation otherwise); fix the owner-sort parity bug (GM picker sorts
ALPHABETICAL @uDM:301 but the display sorts recency-DESC @scoreboard.html:994 → align the GM
picker to the display order); extract a GM-internal currency formatter helper (≈8 duplicated
`$n.toLocaleString()` sites in uiManager). De-dup is GM-INTERNAL + behavioral-parity only — NOT
cross-component code-sharing (blocked by the build boundary, excluded by the user).

## Phase 4a boundary-review deferrals (2026-06-02)
The 4-lens Phase 4a review fixed 3 issues in-place (R1 phantom CC-8b guard → discriminating; R2 sync:full music.playlist object|null contract type; R3 networkedSession scoreboard:page routing test). These NITs were deferred (no live-game impact):

| ID | Item | Sev | File | Why safe to defer |
|----|------|-----|------|-------------------|
| P | `showGroupCompletionNotification(data)` is dead code (zero `src/` callers; only its unit test) AND reads `data.bonus`/`data.groupId`/`data.multiplier` — none of which exist in the backend `group:completed` payload (`{teamId, group, bonusPoints, completedAt}`). The live toast goes through `app.js` (correctly uses `bonusPoints`). P4a.13's formatCurrency switch on its `$` line now makes it render `+$0` instead of throwing on `undefined.toLocaleString()` — masking the field mismatch if ever re-wired. | nit | `ALNScanner/src/ui/uiManager.js:739-774` | Dead code, not on any live path. Either DELETE the method+test, or align field names to `{teamId, group, bonusPoints}` before any future wire-up. |
| Q | `getExposedOwners` adds an alphabetical `localeCompare` tie-break that the wall scoreboard's sort does NOT have (scoreboard.html sorts purely by `lastExposed DESC`, ties fall to Map-insertion order); scanner also tracks MAX exposure time vs scoreboard's last-written. Diverges only on exact-timestamp ties or out-of-order arrival. | nit | `ALNScanner/src/core/unifiedDataManager.js:311` | Benign picker-vs-wall ordering nuance on rare ties; the deterministic tie-break is arguably an improvement. Full page-set parity already ledgered out of scope. |
| R | `lighting-state.test.js` first assertion `expect(['string','object']).toContain(typeof activeScene)` is near-tautological (`typeof null==='object'`), satisfied by string OR null. The `if (!==null) toBe('string')` check + the second test carry the real SR-1 pin. | nit | `backend/tests/contract/websocket/lighting-state.test.js:8-15` | Cosmetic; SR-1 is adequately covered. Drop the tautological line when convenient. |
| S | `app.js` group:completed toast uses inline `$${bonusPoints.toLocaleString()}` rather than the new `formatCurrency()` helper (the one currency site the de-dup skipped — app.js didn't already import it). | nit | `ALNScanner/src/app/app.js:159` | Output identical; cosmetic consistency only. Import + use `formatCurrency` if app.js gains other currency sites. |

## Phase 4d boundary-review deferrals (2026-06-03)
The 3-lens Phase 4d review (logic/security/test-quality) fixed all substantiated findings in-place (WS-6 LOW-1 connected guard, WS-6 LOW-2 chain reset, HealthRenderer status/data-service-id escaping, 2 comment-hygiene NITs — all in commit b2647ce). Two items are deferred by design (no live-game impact):

| ID | Item | Sev | File | Why safe to defer |
|----|------|-----|------|-------------------|
| T | **WS-6 full per-command requestId correlation.** The interim fix serializes same-action gm:commands client-side because acks correlate only by `action` name (two in-flight same-action commands would cross-resolve on the first ack). The robust fix is a coordinated contract change: backend echoes a per-command `requestId` on `gm:command:ack`, scanner correlates on it, removing the serialization entirely (and its ~10s worst-case post-timeout latency on same-action churn). | nit (interim by design) | `ALNScanner/src/network/orchestratorClient.js` (`sendCommand`/`_sendCommandOnce`/`_actionChains`); `backend/contracts/asyncapi.yaml` (gm:command + gm:command:ack) | Serialization correctly prevents cross-resolution today; only same-action commands during reconnect churn are affected, and only with added latency (never wrong data). A contract change touches backend + scanner — its own coordinated task. |
| U | **CommandSender.sendCommand() shares the WS-6 by-action cross-resolution risk, uncovered.** The WS-6 fix lives in `orchestratorClient.sendCommand()`, used ONLY by `teamRegistry` for `session:addTeam`. The admin controllers (Session/Video/Audio/Bluetooth/Lighting/Cue/Sound) route gm:commands through the standalone `src/admin/utils/CommandSender.js` `sendCommand()`, which registers a one-time by-action ack listener and has the SAME latent cross-resolution risk for rapid same-action admin commands (e.g. two quick `video:queue:add`). Not flagged as a live defect (admin commands are operator-paced, rarely fired twice within one ack window during churn). | nit (latent, out of scope) | `ALNScanner/src/admin/utils/CommandSender.js` | Operator-paced single-fire commands; the cross-resolution window is the ack round-trip. Fold into the same requestId-correlation contract change (T) rather than duplicating the chaining shim. |

**Status:** Both fold naturally into one future "gm:command requestId correlation" contract task (backend + scanner coordinated). Neither blocks merge or a live 2-hour show.

## E2E remediation findings (2026-06-03)
Mapping the comms-fixes behavioral deltas onto the L3 suite (and validating on the Pi) surfaced one product-behavior finding worth a decision, plus test-infra lessons:

| ID | Item | Sev | File | Why deferred / note |
|----|------|-----|------|--------------------|
| V | **GM scanner gives up auto-reconnecting after `maxRetries=5` (~16s of 1→2→4→8→16s backoff), then dispatches `auth:required`.** Consequence: the GM auto-reconnects across a *transient blip* (same server, reconnect succeeds on the first retry — verified by B2) but does NOT auto-reconnect across a *backend restart* (~10–20s Pi downtime outlasts the retry budget) — it falls back to a manual re-auth prompt. JWT is stable across restart (`jwtSecret` constant default), so a *reload* or manual reconnect recovers; the limitation is purely "stops trying after ~16s". | nit (by-design, user-aware) | `ALNScanner/src/network/connectionManager.js` (`maxRetries`, `_calculateRetryDelay`, `_setupReconnectionHandler`) | Acceptable for a stable appliance (orchestrator restarts are rare; manual reconnect is a known recovery). If you want the GM to auto-recover from a longer outage/restart with no operator action, change the retry loop to keep retrying capped at the 30s `maxDelay` instead of giving up at 5 (small, unit-testable change). Out of scope for the comms-fixes plan. |

**Test-infra lessons (for whoever next writes L3 disconnect/reconnect tests):**
- Playwright `BrowserContext.setOffline(true)` does NOT drop an established socket.io WebSocket promptly (only blocks new connections); `waitForDisconnected` times out. Don't use it to simulate a GM-scanner outage.
- To simulate a transient transport drop with the server staying up (token valid, session in memory — the realistic blip, and the only path the GM auto-reconnects), use `page.routeWebSocket(/\/socket\.io\//, ws => { if (online) ws.connectToServer(); else ws.close(); })`. `connectToServer()` with NO `onMessage` handlers is a transparent bidirectional proxy, so socket.io's heartbeat/framing pass through verbatim. Gate an `online` flag + close the live route to open/close the outage window. See `07b` "transient connection drop" test.
- An orchestrator stop/restart is a DETERMINISTIC disconnect (server closes sockets immediately, unlike setOffline) but is NOT a clean auto-reconnect test because of finding V (the GM gives up before a ~10–20s Pi restart completes). Use it only for restart-recovery tests that drive a fresh connection (reload / re-auth), e.g. flow 24's scoreboard path.
