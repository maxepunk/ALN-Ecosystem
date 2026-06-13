# Backend Core Review — transaction/session/scoring spine + websocket layer

Reviewer scope: `backend/src/services/{transactionService,sessionService,tokenService}.js`, `backend/src/models/`, `backend/src/utils/validators.js`, `backend/src/websocket/`, `backend/src/config/index.js`. Date: 2026-06-09. All line numbers verified against working tree.

## Summary

| Severity | Count |
|----------|-------|
| P0 (confirmed bug) | 3 |
| P1 (likely defect) | 4 |
| P2 (structural debt / contract drift) | 10 |
| P3 (polish) | 6 |
| Doc drift items | 4 |

Headline: the score-mutation paths that *aren't* the happy scan path (`scores:reset`, `transaction:delete`, restart-restore) are mutually inconsistent. The dual ownership of team scores (`transactionService.teamScores` Map vs `session.scores` array) is the root cause of all three P0s.

---

## Findings

### P0 — Confirmed bugs

**F-BCORE-01 | P0 | transactionService.js:196-199 + models/session.js:133-147 | `session.metadata.totalScans` and `uniqueTokensScanned` are never updated for GM transactions | fix-now**
`processScan()` pushes the transaction directly into `session.transactions` (line 199, the "atomic claim"). The sessionService `transaction:accepted` listener then calls `Session.addTransaction()` (sessionService.js:102), whose idempotency check (`some(tx => tx.id === transaction.id)`, session.js:136) finds the already-pushed entry and **returns before** `metadata.totalScans++` / `uniqueTokensScanned.push()` (session.js:142-146). These are the only writers (verified by grep). Result: every session persists `totalScans: 0, uniqueTokensScanned: []` despite GM transactions. Evidence of test gap: the only test asserting `totalScans` (`tests/unit/models/session.test.js:193`) calls `addTransaction()` directly, masking the production path. Also affects `GET /api/session` and the `session:update` contract example (`totalScans: 47`).

**F-BCORE-02 | P0 | sessionService.js:38-62 | `scores:reset` listener resets `session.scores` with wrong/nonexistent field names; stale `baseScore`/`bonusPoints` resurrect scores after restart | fix-now**
The listener sets `score.currentScore = 0`, `score.transactionCount = 0`, `score.lastUpdated = ...`. TeamScore JSON (teamScore.js:192-204) has **no `transactionCount` or `lastUpdated` fields** — actual fields are `tokensScanned`, `bonusPoints`, `baseScore`, `completedGroups`, `lastUpdate`. So after a reset, `session.scores` persists with `currentScore: 0` but **stale `baseScore`, `bonusPoints`, `tokensScanned`, `completedGroups`**. Two consequences: (a) the `sync:full` broadcast after reset (broadcasts.js:290-318) carries zeroed top-level `scores` (from the correctly-reset in-memory Map) alongside a `session.toJSON().scores` with stale values — internally inconsistent payload; (b) on orchestrator restart, `restoreFromSession()` (transactionService.js:690-707) rebuilds TeamScore instances from the stale JSON, and the team's **first new scan recomputes `currentScore = staleBaseScore + points + staleBonusPoints`** (teamScore.js:61-65) — the entire pre-reset score silently returns. No unit test covers this listener (grep for `scores:reset` in sessionService.test.js: zero hits).

**F-BCORE-03 | P0 | transactionService.js:879-913 + sessionService.js:171-202 | `deleteTransaction` rebuild wipes `adminAdjustments` for ALL teams and persists/broadcasts only the affected team | fix-now**
`rebuildScoresFromTransactions()` clears the Map and recreates every team via `TeamScore.createInitial()` (line 892) — `adminAdjustments` audit trail and applied admin deltas are discarded for **every** team, not just the one whose transaction was deleted. The `transaction:deleted` persistence listener then upserts only `updatedTeamScore` (sessionService.js:183-185), so `session.scores` for other teams keeps old (adjusted) values while the in-memory Map holds rebuilt (unadjusted) ones — the divergence materializes the next time any other team scans (its rebuilt, adjustment-stripped score is upserted over the session copy). Net: any `transaction:delete` silently reverts all prior `score:adjust` commands. Same rebuild path also interacts with F-BCORE-04.

### P1 — Likely defects

**F-BCORE-04 | P1 | transactionService.js:607-624 + 736-792 | `resetScores` leaves `session.transactions` intact → later `transaction:delete` resurrects all pre-reset scores | needs-owner-decision**
`resetScores()` clears `recentTransactions` and zeroes TeamScores but does not touch `session.transactions`. `deleteTransaction()` later calls `rebuildScoresFromTransactions(session.transactions)` — recomputing scores from the **full, never-cleared history**, so every team's pre-reset score comes back (ghost scoring; the session-validate tool has a "DuplicateHandling: ghost scoring" detector, suggesting this class of bug has been seen). Owner must decide the semantics: should `scores:reset` clear/mark transactions, or should rebuild respect a reset watermark?

**F-BCORE-05 | P1 | sessionService.js:316-324 | `createSession` only ends the previous session when `isActive()` — paused/setup sessions are orphaned | fix-in-phase-2**
`if (this.currentSession && this.currentSession.isActive())` skips `endSession()` for `paused` and `setup` sessions. The old session is silently overwritten: never `complete()`d, never backed up (`persistenceService.backupSession` only runs in `endSession`), and its `session:{id}` file persists forever with status `paused`/`setup` (never eligible for `archiveOldSessions`, which requires `isCompleted()`, sessionService.js:607). `endSession()` itself handles all three states (line 555) — the guard is just too narrow.

**F-BCORE-06 | P1 | sessionService.js:520-529 | `updateSessionStatus('active')` from `setup` activates the session without starting the game clock / cue engine | fix-now**
The `active` case calls `session.start()` (which permits `setup → active`, session.js:98) but only runs the clock/cue/music resume cascade `if (oldStatus === 'paused')`. A `session:resume` gm:command (commandExecutor.js:136-141) or `PUT` with `status: 'active'` issued while the session is in `setup` silently bypasses `startGame()`: no `gameClockService.start()`, no `cueEngineService.activate()`, no `gameStartTime`, no overtime threshold — yet transactions are now accepted. Should throw (`Cannot resume: session is in "setup"`), mirroring `startGame()`'s state guard.

**F-BCORE-07 | P1 | sessionService.js:784-794 + storage/FileStorage.js:63-71 | No write serialization on session persistence — concurrent saves can land out of order | fix-in-phase-2**
Every accepted transaction triggers `saveCurrentSession()` (two awaited `setItem`s) from an async listener. There is no per-key write queue or mutex anywhere in persistenceService/FileStorage, and node-persist `setItem` is not atomic (no temp+rename). Two rapid scans → overlapping writes; snapshot A (older) can complete after snapshot B (newer), leaving the older state on disk; a crash mid-write can corrupt `session:current` (`forgiveParseErrors: false` then makes restore throw at init). Mitigated in practice by each call serializing the *live* session object at call time, but completion order is unguaranteed. A simple promise-chain write queue in `saveCurrentSession` fixes it.

### P2 — Structural debt / contract drift

**F-BCORE-08 | P2 | adminEvents.js:218-228 vs contracts/asyncapi.yaml:822-826 | Paused/setup `transaction:result` sends `transactionId: null`, violating contract (required, `format: uuid`, not nullable) | fix-now (contract or code)**
The unit test even encodes the violation as expected behavior (`tests/unit/websocket/adminEvents.test.js:227-238` asserts the shape without running ajv contract validation). Either make `transactionId` nullable in the contract for transient errors, or omit/synthesize an id.

**F-BCORE-09 | P2 | sessionService.js:96-127 | Dead "old format" branch in `transaction:accepted` persistence listener | subsumed-by-platform-refactor**
The `payload.teamScore !== undefined` guard and the "OLD FORMAT: callers still handle persistence" comment are migration leftovers — the only emitter (transactionService.js:224-232) always sends the new format (and detective mode sends `teamScore: null`, which still passes `!== undefined`). The branch can never take the old path; it only obscures the contract of the event.

**F-BCORE-10 | P2 | sessionService.js:128-133 | Persistence failure after scanner already received `accepted` is swallowed (log-only, no retry/alert) | needs-owner-decision**
The scan response returns synchronously from `processScan` while persistence happens in the listener. If `saveCurrentSession()` throws, the transaction lives only in memory (and `transaction:added`/`session:updated` are also skipped — so GMs never see `transaction:new` for an accepted scan). At minimum the error path should still emit the broadcast events or surface a health alert.

**F-BCORE-11 | P2 | persistenceService.js:187-201 | `getAllSessions()` matches key `session:current` → current session returned twice | fix-in-phase-2**
`keys.filter(k => k.startsWith('session:'))` includes the `session:current` alias. `archiveOldSessions()` (sessionService.js:598-625) would archive the same ended session twice; `getActiveSessions()` double-counts. Latent (no production caller of `archiveOldSessions` found), but a one-line filter fix.

**F-BCORE-12 | P2 | transactionService.js:258-292 | Non-GM branch of `isDuplicate()` (and `transaction:rescan` event) is unreachable production code | subsumed-by-platform-refactor**
`processScan` is only invoked from `adminEvents.handleTransactionSubmit` (gmTransactionSchema enforces `deviceType: 'gm'`, validators.js:136), `offlineQueueService.processQueue` (GM queue), and `createManualTransaction` (defaults `'gm'`). Player/ESP32 scans flow through `scanRoutes` → `addPlayerScan`, never `processScan`. The 30-line player/esp32 rescan-analytics branch and the `transaction:rescan` event have no live trigger and no consumer — and they imply a code path the architecture docs describe as real.

**F-BCORE-13 | P2 | sessionService.js:710-719 | `sessionService.addTransaction()` is production-dead and is a second, competing persistence path | subsumed-by-platform-refactor**
Only integration tests call it (`tests/integration/state-synchronization.test.js:61`, `session-lifecycle.test.js:277,334`). Those tests therefore exercise a flow production never uses (and which skips device tracking + score upsert). Delete the method or migrate tests to the event-driven path.

**F-BCORE-14 | P2 | socketServer.js:74-95 | DEVICE_ID_COLLISION check can lock a legitimate GM out for up to the 60s ping timeout | needs-owner-decision**
After a network blip, the stale socket's device entry stays `connectionStatus: 'connected'` until Socket.io ping timeout fires `handleDisconnect`. The reconnecting same-device GM is rejected at handshake until then. Consider matching on live socket presence (`io.sockets`) or evicting the old socket instead of rejecting the new one.

**F-BCORE-15 | P2 | models/session.js:64-65 (also transaction.js:35-36, teamScore.js:43-44) | `validate()` return value discarded; `Object.assign(this, data)` uses raw input | subsumed-by-platform-refactor**
`validate()` runs with `stripUnknown: true` but the stripped/coerced result is thrown away — unknown fields (and un-coerced values) land on the instance anyway. The schema is effectively assert-only, and sessionSchema is missing real persisted fields (`playerScans`, `gameClock`, `gameStartTime`, `teams`, `metadata.scannedTokensByDevice`, `metadata.playerScanCount`), so round-trip integrity depends on the assign-not-validate accident. Either validate-and-assign the validated value with a complete schema, or drop the pretense.

**F-BCORE-16 | P2 | models/token.js:80-98 | `Token.toJSON()` silently drops `metadata.rating/group/rfid/summary/owner` and `mediaAssets.processingImage` | fix-in-phase-2**
`createScanResponse` embeds the full token instance (transactionService.js:515); any JSON serialization of it (socket.io, logging) loses the fields broadcasts.js separately needs (`token?.metadata?.rating`, `owner`, etc. — broadcasts.js:203-208 reads them off the live instance, so it works today, but `clone()` at token.js:113 already loses data).

**F-BCORE-17 | P2 | transactionService.js (whole file) + sessionService.js (whole file) | God-file accretion; see "Proposed split seams" below | subsumed-by-platform-refactor**

### P3 — Polish

**F-BCORE-18 | P3 | sessionService.js:398-405 | `session:started` event has zero consumers** — broadcasts.js doesn't listen (clients get state via the `session:updated` emitted at line 408); cueEngineWiring forwards `session:created` but not `session:started`. The comment "Emit session:started event for broadcasts" is wrong. Remove or wire it. tag: fix-in-phase-2.

**F-BCORE-19 | P3 | broadcasts.js:20,231-236 | `teamScoreStash` leaks an entry whenever `transaction:added` doesn't follow `transaction:accepted`** (e.g., persistence listener bailed on missing session, or save threw before `emit('transaction:added')` at sessionService.js:117). Unbounded Map over a long session; add TTL or delete-on-error. tag: fix-in-phase-2.

**F-BCORE-20 | P3 | gmAuth.js:72 | `canAcceptGmStation()` capacity check is check-then-act** across an awaited `updateDevice`; two concurrent identifies can both pass at the limit. Low stakes (cap is operational, default 5). tag: fix-in-phase-2.

**F-BCORE-21 | P3 | config/index.js:50,169-171 + models/transaction.js:171-181 | `duplicateWindow` config + `isWithinDuplicateWindow()` are dead** — no caller; actual duplicate policy is per-session-forever. The config validation enforces a knob that does nothing and misleads readers about the duplicate model. tag: fix-in-phase-2.

**F-BCORE-22 | P3 | tokenService.js:38,77,80,138 | `console.log/warn/error` instead of Winston** — violates backend/CLAUDE.md "Winston logger (no console.log)". Also `_loadTokensFile` logs a scary `console.error` for the first path on every boot when only the second path exists. tag: fix-now (trivial).

**F-BCORE-23 | P3 | transactionService.js:97 | Stray placeholder comment `// ... (skip to adjustTeamScore)` committed to source** — looks like an artifact of pasting an excerpted/LLM-truncated version of the file back in. No code appears missing (file is coherent), but it should be removed and the diff that introduced it audited. tag: fix-now (trivial).

---

## Proposed split seams (engine vs game-rules boundary)

**transactionService.js (972L) → 4 modules:**

1. **`gameRules/scoring.js` (pure game rules, no I/O, no EventEmitter):** `updateTeamScore`, `isGroupComplete`, `calculateGroupBonus`, `rebuildScoresFromTransactions` — refactored as pure functions over `(tokens, transactions, teamScores)`. This is the exact surface that must stay in parity with GM Scanner `LocalStorage.js`; making it pure makes the parity contract testable (same fixture in both repos). The hidden `sessionService.getCurrentSession()` reads inside `isGroupComplete`/`rebuildScores` (lines 433, 881) are the main blocker — pass transactions/teams in.
2. **`gameRules/duplicatePolicy.js` (pure):** `isDuplicate`/`findOriginalTransaction` minus the dead non-GM branch (F-BCORE-12).
3. **`transactionProcessor.js` (engine/orchestration):** `processScan`/`createManualTransaction` — validate → claim → apply rules → emit `transaction:accepted`. Keeps the single synchronous claim window (currently correct: no `await` between session check at line 137 and push at line 199 — preserve that invariant explicitly with a comment/test).
4. **Response shaping out of the service:** `createScanResponse`/`getResponseMessage` (lines 507-564) are wire-format concerns referencing `videoQueueService` for `waitTime` — move next to adminEvents/scanRoutes adapters.

**sessionService.js (842L) → 3 modules:**

1. **`sessionLifecycle.js` (game rules-ish):** create/start/pause/resume/end state machine + cascades to gameClock/cueEngine/music (`updateSessionStatus`, `startGame`, `endSession`). Fixing F-BCORE-05/06 belongs here.
2. **`sessionPersistence.js` (plumbing):** the `setupPersistenceListeners`/`setupScoreListeners` listener bodies, `upsertTeamScore`, `saveCurrentSession` (with a write queue per F-BCORE-07), restore-on-init. This is the "sessionService owns ALL persistence" responsibility, currently interleaved with lifecycle.
3. **Device/team registry:** `updateDevice`/`removeDevice`/`addTeamToSession`/`addPlayerScan` — session-content mutations, neither lifecycle nor persistence policy.

**Cross-cutting prerequisite:** collapse the dual score ownership. `transactionService.teamScores` (Map of live TeamScore) and `session.scores` (array of JSON) are kept in sync by four hand-written paths (`syncTeamFromSession`, `restoreFromSession`, `upsertTeamScore`, `_onSessionCreated`) and all three P0s are desync bugs between them. Make `session.scores` canonical and derive the Map (or vice versa) before any engine/rules split, or the split will fossilize the duplication.

---

## Doc drift

| # | Claim | Reality |
|---|-------|---------|
| D-1 | backend/CLAUDE.md "System Reset" says systemReset re-wires via `sessionService.registerTransactionListeners()` and `sessionService.registerBroadcastListeners()` | No such methods exist. systemReset.js:165-167 calls `setupScoreListeners()` / `setupPersistenceListeners()` / `setupGameClockListeners()` |
| D-2 | Root CLAUDE.md scoring table: backend config "Loads shared config (**env vars override**)" | config/index.js:69-82 has no env override for `valueRatingMap`/`typeMultipliers`; only `scoring-config.json` + hardcoded fallback |
| D-3 | Root CLAUDE.md scan-request comment "teamId ... (alphanumeric, 1-30 chars)" contradicts its own "No validation restrictions" section | validators.js:12: `Joi.string().trim()` — any non-empty string, no length cap (sessionService.addTeamToSession JSDoc at line 663 repeats the stale "alphanumeric, 1-30 chars") |
| D-4 | Root CLAUDE.md deviceType table implies backend duplicate logic handles `player`/`esp32` re-scan allowance ("See `transactionService.js` `isDuplicate()` method for implementation") | That branch is unreachable (F-BCORE-12); the real player re-scan allowance is simply that scanRoutes never does duplicate checks |

Verified-accurate spot checks (no drift): `score:updated`/`state:update`/`state:sync` truly absent from src; `gm:command:ack` = `{action, success, message}` (adminEvents.js:100-104); GM scans don't trigger video (processScan has no videoQueue call; scanRoutes player path does); `sync:full` builder includes all documented domains (syncHelpers.js:132-147); transaction event flow diagram matches code.

## Test-quality notes

- **Good:** contract tests (`tests/contract/websocket/transaction-events.test.js`) run real services through a real socket and validate with ajv against asyncapi.yaml — including locking the status enum to what the backend actually emits (lines 353-391). This is the strongest layer.
- **transactionService.test.js:158-164** still passes the removed `session` second argument to `processScan()` (Slice 5 removed it) — silently ignored; update to avoid implying the old API.
- **transactionService.test.js:18-21** sets `transactionService.sessionListenerRegistered`, a property the service never reads — test-invented state that does nothing.
- **adminEvents.test.js:227-238** asserts the `transactionId: null` paused-result shape without contract validation, baking in the F-BCORE-08 violation.
- **Coverage holes matching the P0s:** no test drives `session.metadata.totalScans` through `processScan` (only via direct `addTransaction`, masking F-BCORE-01); no test at all for the sessionService `scores:reset` listener (F-BCORE-02); no test for `deleteTransaction`'s effect on *other* teams' `adminAdjustments` (F-BCORE-03); no test for `createSession` over a paused session (F-BCORE-05); no test for resume-from-setup (F-BCORE-06).
- **Integration tests** (`state-synchronization`, `session-lifecycle`) call production-dead `sessionService.addTransaction()` (F-BCORE-13) — they verify a path users never hit.
- broadcasts.test.js mocking services via the shared factories is appropriate here (the unit under test is the wrapper/room logic, services are collaborators) — not a mock-the-UUT smell.

## Open questions

1. **Detective-claims-token semantics:** a detective (0-point) transaction is `status: 'accepted'`, so FCFS duplicate detection permanently blocks a later Black Market sale of that token by any team (transactionService.js:311-323). Root CLAUDE.md says "Teams decide per-token" — is "decide once, irrevocably" intended? If yes, document it; if no, this is a P1.
2. **`scores:reset` intent:** should it clear `session.transactions` (full game restart) or keep them (audit)? Determines the F-BCORE-04 fix.
3. **Is `session.metadata.totalScans` consumed** by the GM Scanner UI or `npm run session:validate`? If yes, F-BCORE-01 is user-visible today; if no, candidate for deletion instead of fix.
4. **Admin adjustments after rebuild (F-BCORE-03):** should `transaction:delete` replay `adminAdjustments` on top of rebuilt scores, or are adjustments meant to be ephemeral? Affects whether `adminAdjustments` belongs in the pure scoring engine's input.
