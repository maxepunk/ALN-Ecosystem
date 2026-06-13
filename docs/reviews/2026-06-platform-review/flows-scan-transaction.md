# Wiring Trace Review: Scan / Transaction / Replay Flows

Date: 2026-06-09
Scope: GM scan (networked + standalone), web player scan, ESP32 scan, batch/queue replay, scoreboard delivery, contract & doc conformance.
Method: line-level trace of backend (`backend/src`), GM Scanner (`ALNScanner/src`), web player scanner (`aln-memory-scanner`), ESP32 (`arduino-cyd-player-scanner/ALNScanner_v5`), against `backend/contracts/*.yaml`.

## Summary

| Severity | Count |
|----------|-------|
| P0 (confirmed bug) | 1 |
| P1 (likely defect) | 8 |
| P2 (structural debt) | 7 |
| P3 (polish) | 4 |
| **Total** | **20** |

Flow verdicts: GM networked happy path, GM offline queue (NQ/TQ fixes), live web player scan → `player:scan` → Game Activity, video token → queue → `display:mode` → Now Playing, and scoreboard delivery (WebSocket, both modes) all trace correctly. The defects cluster in **replay paths** (web 409-requeue, ESP32 batchId reuse, backend offline queue) and **scoring parity** (detective-mode group completion).

---

## Findings

### F-SCAN-01 | P0 | aln-memory-scanner/js/orchestratorIntegration.js:93-112, backend/src/routes/scanRoutes.js:97-153 | Web scanner requeues server-REJECTED scans → duplicate session records + surprise video playback later | runtime-defect, fix-now

**Trace:** `/api/scan` persists the player scan to `session.playerScans` and broadcasts `player:scan` (scanRoutes.js:97-125) **before** the video-conflict check (line 128-141). If a video is already playing it responds **409**. On the web scanner, `scanToken()` treats any `!response.ok` as a network failure: `throw` → `catch` → `queueOffline(tokenId, teamId)` (orchestratorIntegration.js:93-111). The scan is later replayed via `POST /api/scan/batch`, which calls `sessionService.addPlayerScan()` **again** (scanRoutes.js:285-291) and `videoQueueService.addToQueue()` (line 300-303).

**Effect:** one physical tap of a video token during a busy video produces (a) two `playerScans` entries for the same scan (skews session report / GenAI pipeline / PlayerCorrelation validator), and (b) the video playing at an arbitrary later time — whenever the scanner next goes through an offline→online transition. Same requeue happens for 409 `SESSION_NOT_FOUND` and 400 validation errors (these retry forever; batch marks unknown tokens `failed` and drops them, but a no-session 409 single-scan is requeued and *will* be replayed and double-persist once a session exists).

**Fix shape:** in `scanToken()`, only queue on network-level failures (fetch rejection / 5xx); treat 4xx as definitive.

### F-SCAN-02 | P1 | arduino-cyd-player-scanner/ALNScanner_v5/services/OrchestratorService.h:486,515,835; backend/src/routes/scanRoutes.js:227-234 | ESP32 batchId resets on reboot → idempotency cache silently swallows new batches (scan loss) | runtime-defect, fix-now

**Trace:** `uint32_t _nextBatchId = 0` (line 835) is in-memory only. `batchId = deviceID + "_" + _nextBatchId` (486). Backend caches batch responses by batchId for 1 hour (`processedBatches`, scanRoutes.js:189-200) and returns the cached response on a match (227-234). Scenario: device uploads `SCANNER_X_0` at 19:00, power-cycles at 19:10 with queued offline scans, background task uploads a *new* batch also named `SCANNER_X_0` → backend returns the *cached* response with HTTP 200 → ESP32 sees `resp.code == 200` and calls `removeUploadedEntries(batch.size())` (508-512). The queued scans are deleted without ever being processed: no `playerScans` persistence, no video.

**Fix shape:** persist `_nextBatchId` (SD), or use a random component (millis/UUID) like the PWA does.

### F-SCAN-03 | P1 | arduino-cyd-player-scanner/ALNScanner_v5/services/OrchestratorService.h:213-218; backend/src/routes/scanRoutes.js:59-65 | ESP32 treats all 409s as success — but a player-scan 409 can mean "scan was NOT recorded" | runtime-defect, fix-now

**Trace:** `bool success = resp.success || (resp.code == 409)` with comment "orchestrator received scan (duplicate handled)". The backend **never returns 409 for player-scan duplicates** (duplicates are allowed for `deviceType != 'gm'`, transactionService.js:263-291 — and player scans don't even go through transactionService). The actual 409s from `/api/scan` are:
1. `SESSION_NOT_FOUND` (scanRoutes.js:59-65) — scan **not persisted**. ESP32 returns success → scan is not queued → permanently lost.
2. video-busy / vlc-down (scanRoutes.js:130-141) — scan *was* persisted; OK to treat as done (video intentionally skipped).

So every ESP32 scan made while no session exists (pre-game, after `session:end`) disappears, while the player sees the normal token display. The web scanner has the inverse bug (F-SCAN-01: requeues everything).

### F-SCAN-04 | P1 | backend/src/services/offlineQueueService.js:144-173 | Backend offline-queue replay drops player scans from session record | runtime-defect, fix-now

**Trace:** When the backend is flagged offline, `/api/scan` enqueues and answers 202 "Scan queued for processing when system comes online" (scanRoutes.js:27-46). On `setOfflineStatus(false)`, `processQueue()` drains `playerScanQueue` by **logging only** — it pushes a `{status:'processed', message:'Scan log synced'}` result and emits `scan:logged` (offlineQueueService.js:145-173). It never calls `sessionService.addPlayerScan()`, never broadcasts `player:scan`, never queues video. The scans vanish from `session.playerScans`, Game Activity, and the post-session report, despite the scanner having been told "queued for processing". (GM transactions in the same drain ARE properly re-processed via `processScan()`, lines 181-221.)

### F-SCAN-05 | P1 | backend/src/routes/scanRoutes.js:277-318 | Batch replay: videos queued hours later, even with NO session; no GM visibility until manual sync | needs-owner-decision

**Trace:** `/api/scan/batch` per entry: if no current session, persistence is skipped but the code **still falls through to `videoQueueService.addToQueue()`** (277-318) — a batch uploaded between sessions plays videos on the TV with no game running. With a session, every video token in a replayed batch triggers playback at upload time (openapi.yaml:713-719 documents "Videos queued if tokens have video property", so this is contract-sanctioned — but a player scanner that was offline for 2 hours will fire a video barrage at reconnect; videos beyond the first are rejected by `canAcceptVideo()` (video_busy), so effectively the **first queued video token plays, the rest are dropped** — neither outcome is what a designer would choose deliberately). Also: comment at 271-275 says GMs see batch entries "via next sync:full", but nothing triggers a sync:full after batch processing — Game Activity stays stale until a GM reconnects or scores reset.

**Replay-semantics summary (question 5 of brief):**
| Property | Live `/api/scan` | Batch replay |
|---|---|---|
| `session.playerScans` persistence | yes (before video check) | yes if session exists, **silently skipped otherwise** |
| `player:scan` broadcast → Game Activity | yes | **no** (deliberate), no sync:full push either |
| Video trigger | yes (gated by canAcceptVideo) | **yes — at upload time** (first wins, rest dropped) |
| Timestamp | original scan time (`scanRequest.timestamp \|\| now`) | original scan time (web: ms-epoch→ISO; ESP32: NTP-synced local+offset, or **1970-placeholder** pre-sync, F-SCAN-14) |
| Session report / GenAI pipeline | in timeline | in timeline at original time — except duplicates from F-SCAN-01 and 1970 entries from F-SCAN-14 |

### F-SCAN-06 | P1 | backend/src/services/transactionService.js:436-457,895-953 vs ALNScanner/src/core/storage/LocalStorage.js:351-392 | Group-completion parity: detective-mode tokens count toward groups on backend (order-dependently), never in standalone; backend's own rebuild disagrees with its live path | runtime-defect (latent with current token data), fix-in-phase-2

See "Parity analysis" below for the full side-by-side. Three concrete divergences:

1. **Detective tokens in a group.** Backend `isGroupComplete()` counts ALL accepted transactions for the team — `filter(tx => tx.teamId === teamId && tx.status === 'accepted')` (transactionService.js:438-444), mode is not checked. LocalStorage filters `tx.mode === 'blackmarket'` (LocalStorage.js:359-361). Group {A,B}: scan A detective, then B blackmarket → **backend completes the group and awards (m-1)×(value(A)+value(B))** — full bonus including a token the team earned $0 for; **standalone awards nothing**.
2. **Backend order dependence.** Reverse order (B blackmarket, then A detective): detective scans skip `updateTeamScore()` entirely (transactionService.js:208-217), so the completion check never runs on A's scan → **no bonus**, even though the same set of scans in the other order pays the full bonus. The bonus is never retroactively detected.
3. **Backend live vs rebuild.** `rebuildScoresFromTransactions()` (run after any admin transaction delete) filters `tx.mode !== 'detective'` **before** the group check (transactionService.js:898). A team holding a detective-completed group bonus loses it when ANY transaction is deleted (even an unrelated team's? — no, rebuild is global: deleting any transaction rebuilds all teams, line 792), with no event explaining the score drop.

Mitigating factor: current `ALN-TokenData/tokens.json` has exactly one group ("Marcus Mention", 1 token, multiplier 1), so no group bonus can fire at all today — these are latent until group data returns.

### F-SCAN-07 | P1 | ALNScanner/src/network/networkedQueueManager.js:84-96; ALNScanner/src/app/app.js:181-191,839-882 | Cross-device GM duplicate is invisible: submitting GM sees optimistic success, points never awarded, no correction | needs-owner-decision, fix-now

**Trace:** `recordTransaction()` (networked) marks the token scanned and shows the success result screen immediately (app.js:841,881-882 — "Token scored: $X" logged before the server answers). The server's `transaction:result status:'duplicate'` ("Token already claimed by Team X", transactionService.js:552-559, adminEvents.js:241-261) causes `_submitDurable` to remove the queue entry **without dispatching `transaction:failed`** (networkedQueueManager.js:87-96 only dispatches for `rejected`/`error`), and the app-level handler explicitly returns early on duplicates anyway (app.js:186). Duplicate transactions are not persisted or broadcast (`processScan` returns at line 188 before `transaction:accepted`), so no `transaction:new` corrects the UI either.

**Exposure:** local dedup normally catches same-device repeats, and `transaction:new` keeps each GM's transaction list current — but `addTransactionFromBroadcast()` (NetworkedStorage.js:363-368) **does not add the tokenId to `scannedTokens`**, and `sync:full`'s `deviceScannedTokens` is per-device (gmAuth.js:126-128). So GM B can always scan a token GM A already claimed; B's screen says success; B's team gets nothing; the "claimed by Team X" message is never shown to anyone. Most likely during offline-queue replay overlap, but reproducible live.

### F-SCAN-08 | P1 | backend/src/routes/scanRoutes.js:58-65 vs backend/src/websocket/adminEvents.js:216-234 | Player scans accepted (and videos played) during `setup`/`paused` sessions | needs-owner-decision

**Trace:** `/api/scan` checks only `if (!session)` — not `session.status`. GM transactions are rejected unless `status === 'active'` (adminEvents.js:216, transactionService.js:138-144), and the GM scanner blocks scans client-side for non-active sessions (app.js:746-754). But a player scanning during setup or pause persists a `playerScans` entry and can start video playback on the TV. If pause is meant to freeze the game, the player path ignores it.

### F-SCAN-09 | P2 | backend/src/services/transactionService.js:429-430 vs ALNScanner/src/core/storage/LocalStorage.js:371-382 | Single-token-group divergence (backend ≥2, standalone ≥1) | fix-in-phase-2

Backend: `if (groupTokens.length <= 1) return false`. LocalStorage: `if (allScanned && groupTokens.length > 0)` — a 1-token group with `(x2)` pays a bonus in standalone, never on backend. Both `docs/SCORING_LOGIC.md:50` and `ALNScanner/CLAUDE.md` ("Groups must have 2+ tokens") claim the 2+ rule for both. Latent today (the only 1-token group is x1).

### F-SCAN-10 | P2 | aln-memory-scanner/js/orchestratorIntegration.js:159-198,300-307 | Web batch retry mints a NEW batchId per attempt — backend idempotency never protects client retries | fix-in-phase-2

`processOfflineQueue()` calls `generateBatchId()` fresh each attempt. If a batch POST succeeds server-side but the response is lost, the client unshifts the batch and resends under a different batchId → backend processes it again (duplicate `playerScans`, second video-queue attempt). The whole point of the P0.2 batchId cache (scanRoutes.js:189-234) is defeated for the PWA; only ESP32 reuses an id across HTTP retries (`httpWithRetry` with stable id — correct, except F-SCAN-02). Also: a 400 response re-queues the batch forever (no permanent-failure handling, lines 188-192).

### F-SCAN-11 | P2 | aln-memory-scanner/js/orchestratorIntegration.js:108-112,257-265 | Web offline queue drains ONLY on offline→online transition | fix-in-phase-2

Scans queued via the error path while `connected === true` (e.g. one failed fetch, or F-SCAN-01's 409s) sit in localStorage until the connection monitor observes a disconnect/reconnect cycle or the page reloads. During a stable session that can be the entire game. No periodic drain (`processOfflineQueue` is invoked solely from `onConnectionRestored`).

### F-SCAN-12 | P2 | backend/contracts/openapi.yaml:562-694 vs backend/src/routes/scanRoutes.js | `/api/scan` response contract drift | fix-in-phase-2

- Implemented but undocumented: **404** `TOKEN_NOT_FOUND` (scanRoutes.js:79-85), 409 `{error:'SESSION_NOT_FOUND', message}` (59-65) which clashes with the documented 409 shape `{status:'rejected', message, tokenId, waitTime}`, and **503** `{error:'SERVICE_UNAVAILABLE'}` (49-55) which clashes with the documented 503 (offline-queue-full) shape `{status:'error', offlineMode}`.
- Documented 409 requires `waitTime`; the `vlc_down` branch omits it (scanRoutes.js:132-141 adds waitTime only for `video_busy`).
- These mismatches are exactly why ESP32's blanket-409 handling (F-SCAN-03) went unnoticed: the contract says 409 = video busy (scan recorded), the code also uses 409 = no session (scan NOT recorded).

### F-SCAN-13 | P2 | backend/src/config/index.js:78-81 + tokenService.js:56 vs ALNScanner/src/core/scoring.js:99-101 | Memory-type case sensitivity divergence | fix-in-phase-2

Backend lowercases both the multiplier map keys and the lookup (`(type||'unknown').toLowerCase()`); GM scanner does an exact-case lookup against the shared config's `Personal/Mention/...` keys with UNKNOWN(0x) fallback. A Notion entry of `"personal"` scores 1x networked / 0x standalone. Current data is canonical-case, so latent.

### F-SCAN-14 | P2 | arduino-cyd-player-scanner/ALNScanner_v5/Application.h (generateTimestamp pre-sync branch); backend/src/routes/scanRoutes.js:247-297 | ESP32 pre-NTP scans persist 1970 timestamps; batch entries are never schema-validated | fix-in-phase-2

Pre-SNTP scans are stamped `1970-01-01THH:MM:SSZ` (uptime). The batch endpoint applies **no per-item validation** (no `validate(...playerScanRequestSchema)` — contrast single-scan line 24), so these flow into `session.playerScans` verbatim. Session report timelines, "EventTimeline" validator ordering, and the GenAI pipeline see epoch-era scans. The ESP32 comment says "backend can identify un-synced scans by the 1970 prefix" — nothing in the backend does.

### F-SCAN-15 | P2 | backend/src/services/transactionService.js:203-217,367-368 vs ALNScanner/src/core/storage/LocalStorage.js:333-339 | `tokensScanned` counter divergence (detective/unknown) | subsumed-by-platform-refactor

Backend increments `tokensScanned` only for blackmarket (detective skips `updateTeamScore`). Standalone increments for every transaction including detective and 0-point ones. Team "tokenCount" on the scoreboard/team details differs between modes for the same play.

### F-SCAN-16 | P3 | backend/src/services/offlineQueueService.js:267-269 | `getQueueSize()` references nonexistent `this.queue` → TypeError if ever called | fix-in-phase-2

Constructor defines `playerScanQueue`/`gmTransactionQueue`; `this.queue` does not exist. No production caller today (dead code), but it's an exported public method on a singleton.

### F-SCAN-17 | P3 | backend/src/routes/scanRoutes.js:354-381 | `batch:ack` emitted to `device:${deviceId}` room — player/ESP32 devices are HTTP-only and never join socket rooms | subsumed-by-platform-refactor

Only GM scanners join `device:` rooms (gmAuth.js:89). The PWA and ESP32 never open WebSocket connections, so `batch:ack` (and its AsyncAPI section, asyncapi.yaml:1809+) is dead in practice. Both scanner clients decide success from the HTTP response instead.

### F-SCAN-18 | P3 | ALNScanner/src/core/scoring.js:47 vs backend/src/services/tokenService.js:21-24 | Group-name parse divergence on malformed names | fix-in-phase-2

Scanner regex `^(.+?)\s*\(x(\d+)\)$` requires the multiplier at end-of-string; backend strips `\s*\(x\d+\)` anywhere. `"Foo (x2) Bar"` → backend group "Foo Bar" multiplier 2; scanner group "Foo (x2) Bar" multiplier 1. Only matters for malformed Notion data.

### F-SCAN-19 | P3 | ALNScanner/src/core/scoring.js:75-83 | `normalizeGroupName()` exists but is unused by group matching | fix-in-phase-2

Both implementations do exact-case matching of parsed group names (LocalStorage.js:363-376, transactionService groupId), so they currently agree — but the normalizer (case/whitespace/apostrophe folding) was clearly written for this and is dead, leaving casing drift in Notion as a both-sides failure mode.

---

## Parity analysis: backend vs LocalStorage group completion

| Dimension | Backend (`transactionService.js`) | Standalone (`LocalStorage.js`) | Divergence? |
|---|---|---|---|
| Trigger | `updateTeamScore()` during `processScan`, **only for non-detective** scans of a grouped token (203-217, 371) | `_updateTeamScore()` after push, only when `tx.mode==='blackmarket' && tx.group` (342-344) | Trigger gating same; but… |
| Which scans count toward "all collected" | ALL `status==='accepted'` team txs **regardless of mode** (438-444) | Only `mode==='blackmarket'` txs (359-361) | **YES — detective txs count on backend only** (F-SCAN-06) |
| Order dependence | Detective-final ordering never fires the check → bonus permanently missed | Never completes with any detective member, any order | **YES — backend pays full bonus iff last group token is blackmarket** |
| Min group size | `groupTokens.length <= 1 → false` (429) | `groupTokens.length > 0` (382) | **YES — 1-token groups pay only in standalone** (F-SCAN-09) |
| Multiplier ≤ 1 | Group marked completed; bonus skipped (`calculateGroupBonus` returns 0; bonus gated at 381) | Early return — group never marked completed (353) | Cosmetic (`completedGroups` bookkeeping differs) |
| Bonus formula | `(m-1) × Σ token.value` over ALL group tokens from the **token DB** (386-393) | `(m-1) × Σ tx.points` over the team's blackmarket group **transactions** (383-384) | Equal when all members scanned blackmarket; **differs when any member was detective (backend includes its full DB value, standalone wouldn't complete at all)** |
| Current-token inclusion | `currentTokenId` explicitly added to the scanned set (447-449) | tx pushed to array before check (285, 359) | No (both include) |
| Token in multiple groups | N/A — schema has single `SF_Group`; both key off one group per token | same | No |
| UNKNOWN-type member | Counts toward completion; contributes 0 to bonus (value=0) | Counts (blackmarket tx with points 0); contributes 0 | No |
| Recalc after delete | `rebuildScoresFromTransactions` **excludes detective** from group check (898) — disagrees with backend's own live path | `_recalculateTeamScores` replays through the same `_updateTeamScore` — self-consistent | **YES — backend-internal inconsistency** (F-SCAN-06.3) |
| Group name matching | exact match on `extractGroupName(SF_Group)` | exact match on `parseGroupInfo(...).name` | Agree, except end-anchored regex edge (F-SCAN-18) |

**Net:** for any future group containing a token a team chose to expose (detective) rather than sell, networked play can pay a large order-dependent bonus that standalone play never pays — the worst kind of mode divergence because both are "correct per their own code".

---

## Doc drift

1. **`docs/SCORING_LOGIC.md:72`** — points GM Scanner group logic at `ALNScanner/src/core/dataManager.js` lines 418-471. That file does not exist (logic lives in `src/core/storage/LocalStorage.js:351-392`). Root CLAUDE.md has the correct path; SCORING_LOGIC.md (the declared "single source of truth") is stale.
2. **`docs/SCORING_LOGIC.md:50` + `ALNScanner/CLAUDE.md` ("Groups must have 2+ tokens")** — not enforced in LocalStorage (F-SCAN-09); only backend enforces it.
3. **`arduino-cyd-player-scanner/CLAUDE.md` scan flow: "409 -> Display (duplicate OK for player scanners)"** — backend never returns 409 for player duplicates; actual 409 causes are no-session (scan NOT recorded — lost, F-SCAN-03) and video-busy. The OrchestratorService.h:218 comment repeats the same wrong claim.
4. **Root CLAUDE.md: "`player:scan` broadcasts player scanner activity to GM room (persisted to session.playerScans)"** — true for live scans only. Backend-offline 202-queued scans are never persisted (F-SCAN-04); batch-replayed scans are persisted but never broadcast and no sync:full is pushed (F-SCAN-05). Backend CLAUDE.md documents the batch no-broadcast but not the offline-queue loss.
5. **Backend CLAUDE.md "Player Scanner Connectivity" debug example** — `curl ... -d '{"tokenId":"test","deviceId":"s1"}'` would 400 (missing required `deviceType`); misleading as a connectivity check.
6. **`ALNScanner/CLAUDE.md` transaction flow step 6 "Update backendScores Map"** — accurate, but the flow omits that the result screen is shown optimistically at step 4 before backend confirmation; combined with F-SCAN-07 the documented flow overstates what the GM actually sees on rejection.

## Test-quality notes

1. **`backend/tests/e2e/flows/07c-gm-scanner-scoring-parity.test.js:290`** — the group-completion parity test **silently skips** ("console.warn") when no group with 2+ tokens exists. Current production `ALN-TokenData/tokens.json` has exactly one group with one token, so the flagship parity test never executes against real data, and E2E "passes" say nothing about F-SCAN-06/09.
2. **`backend/tests/unit/services/transactionService.test.js:357-735`** — duplicate and group tests call the private methods (`isDuplicate`, `isGroupComplete`, `calculateGroupBonus`) directly and hand-assemble `session.transactions = [tx1]`, bypassing `processScan()`. They assert implementation internals rather than scan-to-score behavior; none covers detective-mode group membership, the order-dependence in F-SCAN-06, or live-vs-rebuild consistency.
3. **`ALNScanner/tests/unit/core/storage/LocalStorage.test.js:190-235`** — covers x2 bonus and multiplier≤1 only. No single-token group test (would have caught F-SCAN-09), no detective-member-in-group test, and no shared fixture exercising both implementations with identical inputs (the obvious parity unit test for the "verify BOTH implementations" rule in root CLAUDE.md).
4. **`backend/tests/contract/scanner/request-schema-validation.test.js`** — good request-side AJV coverage, but **request-only**: no test that `/api/scan` error responses (404 / 409-no-session / 503) match the OpenAPI response schemas — exactly where the implementation has drifted (F-SCAN-12); and no equivalent AsyncAPI validation of the GM `transaction:submit` payload the way the HTTP payloads are validated.
5. **`tests/unit/orchestratorIntegration.test.js` (PWA)** — exercises queueing/scan operations, but the constructor's side-effectful design forces heavy fetch/timer mocking; nothing pins down the "only queue on network failure, not 4xx" behavior, which is how F-SCAN-01 survived.

## Open questions for owner

1. **Replay video semantics:** should batch-replayed scans ever queue videos (current contract says yes)? Suggested: never, or only if `timestamp` is within N minutes of upload. Also: should batch be rejected/held when no session is active instead of half-processing?
2. **Detective tokens and groups:** is the intended rule "any processed token counts toward group completion" (backend live path, made order-independent) or "only sold tokens count" (standalone)? This decides which of three current behaviors to keep.
3. **Cross-team duplicate UX:** should the submitting GM get a "claimed by Team X" toast when the server returns `duplicate` for an optimistically-shown scan (F-SCAN-07)? Should `transaction:new` broadcasts mark tokens scanned on other GMs to prevent the attempt entirely?
4. **Player scans during setup/paused:** intentional (intel gathering allowed pre-game) or should `/api/scan` mirror the GM active-session gate?
5. **Batch visibility:** push a `sync:full` (or per-entry `player:scan` with a `replayed: true` flag) after batch processing so Game Activity reflects drained queues?
6. **Backend offline queue:** is the `isOffline` HTTP path still a supported mode? If yes, F-SCAN-04 needs the drain to call `addPlayerScan`; if no, delete the path (it currently creates a false "queued for processing" promise).
