# Map: backend game state and its delivery

Reader: backend-game. Tree: `/home/user/ALN-Ecosystem`, branch `claude/nice-curie-hescfv`, commit `26fc2f2`. Read-only pass. Nothing was run. All paths are under `backend/src/` unless they start with `backend/contracts/`, `ALNScanner/` or `docs/`. Terms follow `CONTEXT.md` (sections 0, 2, 4, 4b, 5). Words CONTEXT.md lacks are listed in the last section. "Inference" marks anything I reasoned out instead of reading.

## Conclusions

1. One object holds almost all game facts: `sessionService.currentSession` (a `Session`, `services/sessionService.js:24`). It holds teams and scores (`session.scores`, live `TeamScore` instances), transactions, player scans, devices and the claim registry (`metadata.scannedTokensByDevice`). Every other holder is a copy built on demand (`services/session/persistenceListeners.js:10-14`).
2. Persistence is a whole-session JSON rewrite after every mutation, to two keys (`session:<id>` and `session:current`), ordered by a promise-chain write queue (`sessionService.js:691-731`). There is no event log. The only restore is at boot (`sessionService.js:104-175`).
3. The pack has no live-update path. Activation freezes manifest, game.json, strings, theme and cues in module variables (`packService.js:96-101, 1215-1248`). No pack-changed event exists in `asyncapi.yaml`. Pack identity reaches clients only inside sync:full, /health, the manifest endpoint and the handshake `packHash`. Hot-apply must add four things: swap the snapshot and the scoring memo, re-bake the token catalog, reload cues, and notify clients (section 7).
4. A fact can reach a client by four routes: a live event, sync:full, an HTTP snapshot (`GET /api/state`), or a client-fetched file (`/api/tokens`, `/api/pack/files/*`). The snapshot and live builders are different code for: session, devices, player scans, game clock, cue engine, display mode, and the transaction mapping (duplicated inline). They are the same code for: video, health, bluetooth/audio/lighting, sound, music, held items (wrapper differs), and score rows (`TeamScore.toJSON`). Table in section 3.
5. sync:full has 18 keys: 16 from one builder (`websocket/syncHelpers.js:36-159`) and 2 added by callers (`deviceScannedTokens`, `reconnection`). Six code sites send it. They disagree on the device filter and on the extra keys (section 3).
6. CONTRADICTION. `websocket/adminEvents.js:77-90` omits `musicService` from `performSystemReset`. After any `system:reset`, the music broadcast listeners (`broadcasts.js:497`), music cue forwarding (`cueEngineWiring.js:141`) and `musicService.reset()` (`systemReset.js:122`) are skipped. Broadcast-triggered sync:full then carries the default music block (`syncHelpers.js:226-234`). Consequence is inference. Tests do not catch it: the test helper passes a full service set.
7. CONTRADICTION (inference). Listener order differs between boot and after a reset. Boot: persistence listeners register first (`app.js:206`), broadcasts second (`server.js:296`). Reset: broadcasts first (`systemReset.js:138`), persistence second (`systemReset.js:161`). On `scores:reset` after a reset, the broadcast listener builds `recentTransactions` before the persistence listener clears `session.transactions` (`syncHelpers.js:63` runs before its first `await` at `:104`). The GM scanner reads `recentTransactions`, not `session.transactions` (`ALNScanner/src/network/messageRouters.js:105-109`).
8. CONTRADICTION. The handshake guard covers only `deviceType === 'gm'` (`websocket/socketServer.js:53`). Any other socket connects with no token. `sync:request` has no auth check (`server.js:75-104`), so an unauthenticated socket gets full sync:full. Its undefined `deviceId` also creates `metadata.scannedTokensByDevice["undefined"]` (`models/session.js:381-383`, inference on persistence). `session:update` (full `metadata`), `device:*`, `display:mode` and service `error` go to every socket (`io.emit`, `broadcasts.js:75,120,166,464,604`; `deviceHelpers.js:32`).
9. CONTRADICTION. `gm:identified` is emitted (`websocket/gmAuth.js:188`) but is not in `asyncapi.yaml` and not in the GM scanner's `MESSAGE_TYPES` (`ALNScanner/src/network/orchestratorClient.js:26-49`). The code emits 23 distinct event names; the contract lists 22.
10. CONTRADICTION. `GET /api/tokens` re-reads tokens.json from disk on every call (`routes/resourceRoutes.js:55`, `services/tokenService.js:75-119`). `GET /api/pack/files/*` serves live bytes under the frozen manifest whitelist (`packService.js:1450-1463`). The engine scores from the boot-baked token catalog (`app.js:201-203`). After a pack edit on disk, client copies and engine can disagree.
11. Rejected and duplicate GM scans are not stored and not broadcast. The duplicate branch returns before `session.addTransaction` (`transactionService.js:212-223`); the invalid-token branch likewise (`:179-190`). The submitter gets `transaction:result`; nothing else records the attempt.
12. Order on the transaction path: the claim (transaction and device registry) is written synchronously before `processScan` returns. `transaction:result` goes to the submitter before `transaction:new` reaches the room, because the persistence listener's save is not awaited by the emitter (`persistenceListeners.js:97-112`, `adminEvents.js:269-292`). When a group completes, `group:completed` (`transactionService.js:462`, inside `updateTeamScore` at `:247`) is emitted before `transaction:accepted` (`:282`), so clients can see the group event first.
13. Counters drift. `metadata.totalScans` and `uniqueTokensScanned` are never decremented on delete (`transactionService.js:654-751`). `gmStations`/`playerDevices` never decrement on disconnect; `removeDevice` has no caller (grep, section 6). `connectedDevices` only grows within a game session.
14. Dead or latent: `offlineQueueService.isOffline` is never set true in production (only read at `adminEvents.js:203`), so the GM offline queue is unreachable. `session.videoQueue` is never written. `transactionService.recentTransactions` is written (`:497`) and never read in `src/`, and is not trimmed on delete. `transactionService.isDuplicate`/`findOriginalTransaction` adapters have no callers. `session:started` and `transaction:queued` have no listener. `archiveOldSessions`, `cleanOldBackups`, `getArchivedSessions` have no production caller, so `backup:session:*` keys accumulate. `persistenceService.getAllSessions` would return the current game session twice (`session:` prefix matches `session:current`, `persistenceService.js:190`).
15. `transaction:deleted` carries only the affected team's score, although the rebuild rewrites every team (`transactionService.js:737` builds `allTeamScores`; `broadcasts.js:256-261` drops it).
16. `src/index.js` does not start the server. It requires `server.js`, whose `require.main === module` guard (`server.js:483`) is then false (inference). Production runs `src/server.js` directly (`backend/ecosystem.config.js:12`).
17. Replayed player-scan batches still fire cue triggers: `scanRoutes.js:325` → `sessionRegistry.js:92` → `cueEngineWiring.js:119`. The route comment says replays never trigger video (`scanRoutes.js:354-357`). Video is skipped; cues are not (inference). `batch:ack` goes to room `device:<id>`, which only GM sockets join (`gmAuth.js:102`), so HTTP scanners never receive it (inference).
18. Cue-engine fired/spent sets clear only on `cueEngineService.reset()` (system reset, `cueEngineService.js:1166`), not on `createSession`. Another reader owns the cue engine; flagged here because "cleared at" for game-session facts depends on it (inference).
19. Gaps in this sheet: video, music, cue, health, bluetooth, audio, lighting, sound, display, profile and dormancy services are cited only as sync:full inputs, not mapped. GM scanner and scoreboard copies are cited only where I read them (`messageRouters.js`, `orchestratorClient.js`, `scoreboard.html` event list). I ran nothing, so every consequence is read, not observed.

## 1. Module table

Scope list: `find` below. 52 `.js` files. Rows in this table: 52. Check: `sed -n '/^## 1\. Module table/,/^## 2\./p' <this file> | grep -c '^| `'` prints 52, and the sorted first column equals the sorted `find` output (diff empty).

```
cd /home/user/ALN-Ecosystem/backend/src && find app.js server.js index.js services/sessionService.js services/transactionService.js services/persistenceService.js services/offlineQueueService.js services/tokenService.js services/packService.js services/systemReset.js services/heartbeatMonitorService.js services/discoveryService.js services/scoreboardControlService.js services/session gameRules models storage websocket routes middleware -name '*.js' ! -name resolution.js ! -name endpointServices.js ! -name packNeeds.js ! -name dormancyWording.js | sort | wc -l
52
```

| File | Lines | Role | Runtime facts held or written |
|---|---|---|---|
| `app.js` | 351 | Builds the Express app and routes; `initializeServices()` is the boot sequence. | Holds none. Triggers pack and profile activation, token bake, cue load (`:192,197,201-203,245-246`). |
| `index.js` | 7 | Vestigial entry that requires `server.js`. | None. Does not start the server (`server.js:483`, inference). |
| `server.js` | 485 | Creates HTTP(S) and Socket.io servers, registers handlers and shutdown, answers `sync:request`. | Holds `server`, `io`, `discoveryService`, `serverState`, `isInitialized` (`:52-57`). Saves the current session on shutdown (`:202-209`). |
| `gameRules/cueValidation.js` | 421 | Pure pack-gate rules and vocabulary tables for cues. | None. |
| `gameRules/cueVocabulary.js` | 56 | Pure game-event normalizers for cue conditions. | None. |
| `gameRules/duplicatePolicy.js` | 123 | Pure GM duplicate rules: per-device, first-come-first-served, per-mode `claims`. | None. Reads the claim registry and transactions it is handed. |
| `gameRules/formatting.js` | 50 | Pure money format parser and formatter. | None. |
| `gameRules/grants.js` | 111 | Pure grant algebra and the action-to-floor-function table. | None. |
| `gameRules/modeSemantics.js` | 251 | Pure mode resolver with a baked legacy ALN mode table. | Module constant `LEGACY_ALN_MODES` and a once-warn latch (`:36,:143-160`). |
| `gameRules/scoring.js` | 305 | Pure points, group completion, bonus and full score rebuild. | None. |
| `middleware/auth.js` | 370 | Mints and verifies operator and observe tokens; Express gates. | `adminTokens`, `tokenExpiry`, `observeTokens` (in memory, `:13-20`); hourly cleanup interval (`:346`). |
| `models/deviceConnection.js` | 243 | Device record with heartbeat and sync-state helpers. | Record shape only. |
| `models/session.js` | 426 | The `Session` aggregate: status transitions, transactions, player scans, devices, claim registry, metadata. | All game-session facts (section 2). |
| `models/teamScore.js` | 265 | Entity score row: points, bonus, groups, admin adjustments. | `currentScore`, `baseScore`, `bonusPoints`, `tokensScanned`, `completedGroups`, `adminAdjustments`, `lastTokenTime`. |
| `models/token.js` | 112 | Backend token record (value, group, media, metadata). | Record shape; instances live in `transactionService.tokens`. |
| `models/transaction.js` | 195 | GM/scan transaction record and its state changes. | Record shape; status `accepted`/`duplicate`/`error`. |
| `models/videoQueueItem.js` | 243 | Video queue item record (used by `videoQueueService`). | None in this scope. |
| `routes/adminRoutes.js` | 111 | `POST /api/admin/auth` (mint operator token), `GET /api/admin/logs`. | Writes `adminTokens` through `generateAdminToken`. |
| `routes/healthRoutes.js` | 115 | `GET /health` with pack and profile identity; registers player heartbeats. | Writes `session.connectedDevices` on every poll with `deviceId` (`:88`). |
| `routes/musicRoutes.js` | 89 | Music track and playlist reads; guarded playlist write. | None. |
| `routes/packRoutes.js` | 48 | Serves the active pack manifest and whitelisted pack files. | None. |
| `routes/resourceRoutes.js` | 230 | Token DB, ESP32 asset manifest and files, vocabulary, scoreboard page render. | `manifestCache` (asset manifest, mtime-keyed, `:29-30`). Mints an observe token per scoreboard serve (`:205`). |
| `routes/scanRoutes.js` | 422 | Player/ESP32 scan and batch endpoints; emits `player:scan` and `batch:ack`. | Holds `processedBatches` (batch idempotency cache, `:183`) and its cleanup interval (`:186`). Writes `session.playerScans`. |
| `routes/sessionRoutes.js` | 59 | `GET /api/session`. | None. |
| `routes/stateRoutes.js` | 77 | `GET /api/state` (sync:full over HTTP, ETag). | None. |
| `services/discoveryService.js` | 145 | UDP `ALN_DISCOVER` responder and console banner. | `udpServer`, `port`. No game facts. |
| `services/heartbeatMonitorService.js` | 136 | Marks timed-out HTTP devices disconnected (30 s timeout, 15 s check). | `io`, `checkInterval`. Writes device status through `disconnectDevice` (`:115`). |
| `services/offlineQueueService.js` | 294 | Queue of GM transactions while the offline flag is set. | `gmTransactionQueue`, `isOffline`, `processingQueue` (`:30-33`). Persists key `offlineQueue` (`:245`). |
| `services/packService.js` | 1484 | Pack activation gate, frozen pack snapshot, and the rule getters. | `activeManifest`, `activeGameConfig`, `activeStrings`, `activeTheme`, `activeCues`, `activated`, `_cachedScoringRules`, `manifestCache*` (`:88-103,1334`). |
| `services/persistenceService.js` | 369 | Key/value facade over the storage backend with session helpers. | Storage handle; keys `session:<id>`, `session:current`, `tokens:all`, `gameState:current`, `backup:session:*`, `archive:session:*` (`:168-260`). |
| `services/scoreboardControlService.js` | 58 | Stateless emitter that turns GM page commands into `scoreboard:page:requested`. | None. |
| `services/session/persistenceListeners.js` | 198 | Listeners that persist `scores:reset`, `transaction:accepted`, `score:adjusted`, `transaction:deleted` onto the session. | Writes transactions, claim registry, metadata counters (`:44-47,97,101`). |
| `services/session/sessionRegistry.js` | 135 | Team, transaction, player-scan and device mutations on the current session. | Writes `scores` (team), `transactions`, `playerScans`, `connectedDevices` (`:38,63,80,108,124`). |
| `services/sessionService.js` | 857 | Game session lifecycle, preflight gate, restore, write queue. | `currentSession`, `_writeQueue` (`:24,28`). Writes status, clock/cue snapshots, pack stamp, preflight stamp. |
| `services/systemReset.js` | 305 | Orchestrates `system:reset`: archive, end, tear down, rebuild. | None. Tears down and re-registers listeners and services. |
| `services/tokenService.js` | 203 | Reads tokens.json and bakes token value and group multiplier from the pack. | None (functions). Output becomes `transactionService.tokens`. |
| `services/transactionService.js` | 897 | GM scan processing, score mutation, group completion, delete and rebuild. | `tokens` Map, `recentTransactions` (`:29-30`). Writes `session.scores` and `session.transactions`. |
| `storage/FileStorage.js` | 222 | node-persist file backend. | Files under `config.storage.dataDir`. |
| `storage/MemoryStorage.js` | 143 | In-memory backend for tests. | `data` Map. |
| `storage/StorageInterface.js` | 104 | Abstract storage contract. | None. |
| `storage/index.js` | 43 | Picks file or memory storage. | None. |
| `websocket/adminEvents.js` | 322 | `gm:command` and `transaction:submit` handlers. | `resetInProgress` mutex (`:22`). |
| `websocket/broadcasts.js` | 747 | Service-event to client-event wiring and room delivery. | `activeListeners`, `broadcastListenersActive`, `teamScoreStash`, `_pushTimers` (`:14-23`). Joins sockets to `session:<id>` rooms (`:667-682`). |
| `websocket/deviceHelpers.js` | 55 | Marks a device disconnected and emits `device:disconnected`. | Writes device `connectionStatus`. |
| `websocket/deviceTracking.js` | 47 | Socket `disconnect` handler. | Writes device status via `disconnectDevice`. |
| `websocket/environmentHelpers.js` | 75 | Builds the `environment` block of sync:full with safe defaults. | None. |
| `websocket/eventWrapper.js` | 48 | Wraps payloads in the `{event,data,timestamp}` envelope and emits. | None. |
| `websocket/gmAuth.js` | 219 | Post-handshake GM identify: rooms, device registration, first sync:full. | Writes `connectedDevices`, joins rooms `device:`, `gm`, `session:`, `team:` (`:102-135`). |
| `websocket/listenerRegistry.js` | 125 | Tracks cross-service listeners for cleanup (active only when `NODE_ENV=test`). | `listeners` Map (`:12-13`). |
| `websocket/scanResponse.js` | 108 | Shapes the scan result and award message. | None. Reads frozen pack strings and scoring display (`:27,35`). |
| `websocket/socketServer.js` | 163 | Creates Socket.io; handshake middleware verifies tokens and stamps `socket.tier`, `functions`, `deviceId`, `packHash`. | Stamps socket fields (`:109-127`). |
| `websocket/syncHelpers.js` | 276 | Builds the sync:full payload and its sub-blocks. | None. |

## 2. Runtime-fact table for the game

Columns follow the task. "Dead" marks a holder with no reader or no writer found by grep.

| Fact | Authority | Copies | Writers | Change events | Delivery paths | Persistence | Cleared or rebuilt at |
|---|---|---|---|---|---|---|---|
| Game session record (id, name, times, status, metadata) | `sessionService.currentSession`, a `Session` (`sessionService.js:24`; `models/session.js:10`) | Disk `session:current` and `session:<id>` (`sessionService.js:233-234,728-729`); sync:full `session` = `toJSON()` (`syncHelpers.js:133`); `session:update` subset (`broadcasts.js:75-83,120-128`); `GET /api/session` (`sessionRoutes.js:36-49`); GM scanner stores (not mapped) | `createSession` (`:206`); `startGame` (`:317`); `updateSession` (`:396`); `endSession` (`:513`); restore (`:110`) | `session:created` (`:241`), `session:started` (`:345`, no listener), `session:updated` (`:354,429,539`; `sessionRegistry.js:42`; `persistenceListeners.js:50,112,148,179`). Broadcast as `session:update` (`broadcasts.js:73,114`) | `session:update` to ALL sockets, live. sync:full to joining GM (`gmAuth.js:179`), `sync:request` (`server.js:96`), `gm` room on create (`broadcasts.js:103`): snapshot. `GET /api/session`, `GET /api/state`: snapshot | Every mutation, through the write queue (`sessionService.js:691-711`). Both keys. Backup on end (`:534`) | End: `currentSession = null` (`:552`). New session ends the old one first (`:201-203`). System reset deletes `session:current` (`:770`) and `initState` (`:776`). Boot restores it (`:108-111`) |
| Game session phase (status) | `session.status`, transitions in `models/session.js:140-169`, driven by `sessionService` | `session.gameClock` snapshot (`sessionService.js:339,468,486,722`); clock status in `gameClockService` and sync:full `gameClock` (`syncHelpers.js:168-191`); `cueEngine.active`; `session:update.status` | `createSession` sets `setup` (`:208`); `startGame` sets `active` (`:317`); pause/resume (`:461-487`); `endSession` sets `ended` (`:513`) | `session:updated`; `gameclock:*` and `phase:changed` push `service:state` gameclock (`broadcasts.js:573-575`) | `session:update` (all sockets); sync:full; `service:state` to `gm` room, debounced 50 ms (`broadcasts.js:487-493`) | As above. Clock persisted only while not stopped (`sessionService.js:721-723`) | End and reset as above. Restored clock re-seated from snapshot (`sessionService.js:151-159`) |
| Teams | `session.scores[].teamId` (`persistenceListeners.js:10-14`; `transactionService.js:89-92`) | `toJSON().teams` (`models/session.js:318`); `session:update.teams`; room `team:<id>`, joined at connect only (`gmAuth.js:129-135`), no emitter targets it (grep); GM scanner team registry (not mapped) | `createSession` via `initializeTeamScores` (`sessionService.js:209,624-631`); `addTeamToSession` (`sessionRegistry.js:18-50`) from `session:addTeam` (`commandExecutor.js:295-318`); auto-create `_getOrCreateTeamScore` (`transactionService.js:357-368`); rebuild defensive create (`:883-886`) | `session:updated` (`sessionRegistry.js:42`). Auto-create emits none itself; the following `transaction:accepted` persistence emits `session:updated` | `session:update.teams` live; sync:full snapshot | With the session | With the session. `resetScores` keeps teams (`transactionService.js:571-598`) |
| Transactions (accepted GM) | `session.transactions` (`models/session.js:176-185`; pushed as a `Transaction` instance at `transactionService.js:234`) | Disk; `transactionService.recentTransactions` (dead, `:29,496-504`); sync:full `recentTransactions` (enriched, `syncHelpers.js:63-81`) and `session.transactions` (raw); `transaction:new` (`broadcasts.js:192-211`); GM scanner data manager (not mapped) | `processScan` (`transactionService.js:234`); persistence re-add, idempotent (`persistenceListeners.js:97`); `deleteTransaction` splice (`:721`); `scores:reset` clears (`persistenceListeners.js:44`). Duplicates and rejects are never stored (`:179-223`) | `transaction:accepted` (`:282`) → `transaction:added` (`persistenceListeners.js:111`) → `transaction:new` (`broadcasts.js:183-226`). `transaction:deleted` (`:732`) | `transaction:new` to room `session:<id>` live (`:216`); `transaction:deleted` to the same room (`:267`); sync:full snapshot; `transaction:result` to the submitter only (`adminEvents.js:292`) | After each accept, via `saveCurrentSession` (`persistenceListeners.js:108`) | Score reset (`persistenceListeners.js:44`); end; system reset |
| Entity scores (`currentScore`, `baseScore`, `bonusPoints`, `tokensScanned`, `lastTokenTime`) | `session.scores[]` live `TeamScore` instances, mutated in place (`transactionService.js:380-392`) | `transaction:accepted.teamScore` snapshot (`:284`) → `teamScoreStash` (`broadcasts.js:19,231-243`) → `transaction:new.teamScore` (`:210`); `score:adjusted.teamScore`; `transaction:deleted.updatedTeamScore` (affected team only; `allTeamScores` built at `transactionService.js:737`, not broadcast); sync:full `scores` (`getTeamScores`, `:558-563`, sorted desc) and `session.scores`; GM scanner score map and scoreboard page (not mapped) | `updateTeamScore` (`:383-384`); `_applyGroupCompletion` (`:431,450`); `adjustTeamScore` (`:132`); `resetScores` (`:586-589`); `rebuildScoresFromTransactions` (`:817-894`) | `transaction:accepted`, `score:adjusted` (`:538`), `transaction:deleted`, `scores:reset` (`:595`) | Rows ride `transaction:new.teamScore` (null for non-scoring, non-group modes, `:284`), `score:adjusted` (session room), sync:full | Session save | `resetScores` zeroes rows and clears adjustments; `lastTokenTime` is not cleared (`teamScore.js:152-159`). Delete rebuilds all teams (`:817`). End; system reset |
| Group completion and bonuses | `TeamScore.completedGroups` and `bonusPoints` (`teamScore.js:71-75,111-118`). Rule: `gameRules/scoring.js:133,184` | `group:completed` event (not stored); recompute in `computeTeamScores` (`scoring.js:220-292`); sync:full `scores[].completedGroups`; token catalog `groupMultiplier`, baked at boot (`tokenService.js:163-165`); pack `groups` block (frozen) | `_applyGroupCompletion` (`transactionService.js:416-464`) from `updateTeamScore` (`:388`) and the unscored-counting branch (`:264-270`); rebuild (`:840`) | `group:completed` (`:462`). x1 groups are tracked, never evented (`:433-436`). No event when a delete un-completes a group | `group:completed` to `gm` room (`broadcasts.js:284-294`); completed list and bonus ride score rows and sync:full | Session save | `resetScores`; delete rebuild; end |
| Claimed tokens, per device | `session.metadata.scannedTokensByDevice[deviceId]` (`models/session.js:66,380-414`) | sync:full `deviceScannedTokens` for the connecting device only (`gmAuth.js:150-152`, `server.js:92-95`); sync:full `session.metadata` (all devices); `session:update.metadata` to all sockets; `GET /api/session` metadata; GM scanner scanned-token Set (not mapped) | Persistence listener, consuming claims only (`persistenceListeners.js:100-102`, fed by `transactionService.js:286-291`); `deleteTransaction` splice (`:699`); `scores:reset` (`persistenceListeners.js:47`). A READ also writes: `getDeviceScannedTokens` creates an empty entry (`models/session.js:381-383`) | None of its own. Rides `session:updated` (`persistenceListeners.js:112`) | `session:update.metadata` (all sockets, live); sync:full `deviceScannedTokens` only on connect and `sync:request` (not on `scores:reset` or other `gm`-room sync:full; the GM client keeps its set when the key is absent, `messageRouters.js:97`) | Session save | Score reset (all); delete (one entry); end |
| Claimed tokens, across the game session (first-come) | `session.transactions` where status `accepted` and mode is consuming, read by `duplicatePolicy.findOriginalTransaction` (`duplicatePolicy.js:58-68`); decision at `transactionService.js:206-223` | `metadata.uniqueTokensScanned` and `metadata.totalScans` (`models/session.js:186-190`), not decremented on delete; response `claimedBy` (`adminEvents.js:287-289`); GM scanner copies (not mapped) | `processScan` only | None. A duplicate yields only `transaction:result` (`adminEvents.js:292`) | Only through the transaction list in `transaction:new` and sync:full; clients derive it | Session save | Score reset (`persistenceListeners.js:44-47`); end |
| Player scans | `session.playerScans[]` (`models/session.js:202-221`) | sync:full `playerScans` (raw records, `syncHelpers.js:139`) and `session.playerScans`; live `player:scan` payload built inline in the route (`scanRoutes.js:111-119`, batch `:336-345`); `metadata.playerScanCount` (`models/session.js:215-218`); cue event `player:scan` via `player-scan:added` (`sessionRegistry.js:92`, `cueEngineWiring.js:119`) | `POST /api/scan` (`scanRoutes.js:82`); `POST /api/scan/batch` (`:325`) | `player-scan:added` (cue engine only); `player:scan` emitted by the route, not by `broadcasts.js` | `player:scan` to `gm` room, live; sync:full snapshot | Session save (`sessionRegistry.js:81`) | End. Not cleared by score reset (`persistenceListeners.js:40-43`). Batch with no session is acked but not stored (`scanRoutes.js:347-352`) |
| Admin score adjustments | `TeamScore.adminAdjustments[]` (`teamScore.js:83-96`) | `score:adjusted.teamScore.adminAdjustments`; sync:full `scores[]`; disk | `adjustTeamScore` (`transactionService.js:132`) from `score:adjust` (`commandExecutor.js:487-503`); replayed on rebuild (`:844-847`) | `score:adjusted` (`:538`) | Session room (`broadcasts.js:246-253`, payload `{teamScore}` only); sync:full | Session save (`persistenceListeners.js:131-161`) | `resetScores` clears (`:588`); end. Negative floor from pack `allowNegative` (`:125,854`) |
| Offline-queued scans (GM) | `offlineQueueService.gmTransactionQueue` (`:30`) with flag `isOffline` (`:32`) | Disk key `offlineQueue` (`:245`); HTTP batch idempotency cache `processedBatches` (`scanRoutes.js:183`, in memory, 1 h); player and ESP32 queues live on the devices (not mapped) | `enqueueGmTransaction` (`:60`) from `adminEvents.js:205`; `processQueue` shift (`:118`); `setOfflineStatus` (`:206`) has no production caller (grep: only `adminEvents.js:199,203` read the flag) | `transaction:queued` (`:84`, no listener); `offline:queue:processed` (`:169`) | `offline:queue:processed` and sync:full to `gm` room (`broadcasts.js:346,367`). sync:full has no queue key | `persistQueue` (`:243-251`) | `reset()` (`:271-287`); system reset (`systemReset.js:88`) |
| Connected devices | `session.connectedDevices[]` (`models/session.js:228-250`) | sync:full `devices` (filter varies by caller) and `session.connectedDevices` (all); counters `metadata.gmStations`/`playerDevices` (`:242-246`); Socket.io's own socket table and rooms | `gmAuth.js:120`; `initializeSessionDevices` (`broadcasts.js:664`); `/health` poll (`healthRoutes.js:88`); `disconnectDevice` (`deviceHelpers.js:28-29`); heartbeat monitor (`heartbeatMonitorService.js:115`); restore marks all disconnected (`sessionService.js:128-140`, not saved until the next write). `removeDevice` is never called | `device:updated` (`sessionRegistry.js:110`) → `device:connected` only for new or reconnecting (`broadcasts.js:159-181`); `device:disconnected` emitted by the helper (`deviceHelpers.js:32`) | Both device events to ALL sockets; sync:full snapshot | Session save on every update, including every player `/health` poll | End; system reset; restart marks disconnected |
| Active pack and its identity | `packService` module variables, frozen by `activatePack()` (`packService.js:96-101,1215-1248`) | `_cachedScoringRules` memo (`:1334`); `transactionService.tokens` (values and multipliers baked at boot, `tokenService.js:153-192`); cue engine cue set (`app.js:245-246`); sync:full `pack` (`syncHelpers.js:151`); `/health` `pack` (`healthRoutes.js:41`); `/api/pack/manifest` (`packRoutes.js:21`); `session.metadata.pack`; JWT `packHash` (`auth.js:63,137`); `socket.packHash` (`socketServer.js:127`); preflight stamp `packHash` (`sessionService.js:834`); scoreboard page strings/theme (`resourceRoutes.js:209-213`) | `activatePack` only, called from `app.js:192` | None. No pack-changed event exists | Snapshot only: sync:full, `/health`, manifest endpoint, handshake compare (`socketServer.js:139-148`) | Identity stamped into the session; the snapshot itself is never persisted | Process restart only. System reset does not re-activate (`systemReset.js:231-241`) |
| Game session creation stamp | `session.metadata.pack` (`sessionService.js:215-216`), `metadata.preflight` (`:224-225`; re-stamped `:295`, `:805-808`), `metadata.preflightOverride` (`:226,312`) | sync:full `session.metadata`; `session:update.metadata`; `GET /api/session`; disk | Those lines; null defaults in `models/session.js:67-73,84-95` | `session:created` payload carries `metadata` (`:248`); `session:updated` | `session:update` (all sockets); sync:full | Session save | New game session. Restore compares the stamp with the active pack and only warns (`:116-126`) |
| Token catalog | `transactionService.tokens` Map of `Token` (`:30,37-43`) | Disk `tokens:all` (`app.js:202`; never read, `persistenceService.js:233`); `GET /api/tokens` (live disk read); pack file `tokens.json`; `videoQueueService` reads the Map (`videoQueueService.js:752,758`); scanner and scoreboard copies | `init` (`transactionService.js:37`); `loadTokens` (`:604`, no production caller) | None | `GET /api/tokens`, `GET /api/pack/files/tokens.json`; per-event enrichment fields | `tokens:all` at boot | Process restart only |
| Auth stores (who may act) | `adminTokens`, `tokenExpiry`, `observeTokens` in `middleware/auth.js:13-20` | JWT bearer strings in clients | `generateAdminToken` (`:53`); `generateObserveToken` (`:130`) on every `GET /scoreboard`; `invalidateObserveTokens` (`:185`) | None | Verified at handshake (`socketServer.js:71-73`) and routes | None. A restart empties the stores, so every unexpired JWT fails (`auth.js:94-96`) | System reset flushes observe tokens only (`systemReset.js:129`); operator tokens survive |
| Transient delivery state | `teamScoreStash` (`broadcasts.js:20`, 10 s sweep `:240`); `_pushTimers` (`:23`); `resetInProgress` (`adminEvents.js:22`); `listenerRegistry.listeners` (test only) | None | `broadcasts.js:234,490,500` | None | None | None | `cleanupBroadcastListeners` (`broadcasts.js:701-743`) |
| Dead or derived fields | `session.videoQueue` (never written: grep for `.videoQueue` finds only the model); `metadata.gmStations`, `playerDevices`, `totalScans`, `uniqueTokensScanned` (derived counters) | `toJSON().videoQueue` (`models/session.js:322`) | Counters in `models/session.js:186-190,242-246,261-265` | None | Inside `metadata` to all sockets | Session save | Counters reset only by score reset (`persistenceListeners.js:45-46`) |
| Game clock and cue-engine snapshots on the session | `gameClockService` and `cueEngineService` (not mapped here) | `session.gameClock` (`sessionService.js:722`), `session.cueEngine` (`:726`) | `_persistCurrentSession` (`:718-731`) | Not mapped | sync:full `gameClock`, `cueEngine` | With the session | Restore re-seats them (`sessionService.js:151-174`) |

## 3. Delivery paths from the backend

### 3.1 The grep

```
cd /home/user/ALN-Ecosystem/backend/src && xargs grep -n "emitWrapped(\|emitToRoom(" < <scope list> | grep -v "function \|require(\|^websocket/eventWrapper.js" | wc -l
49
cd /home/user/ALN-Ecosystem/backend/src && xargs grep -n "io\.emit\|\.broadcast\|io\.to(\|io\.in(\|socket\.emit\|sockets\.emit" < <scope list>
websocket/eventWrapper.js:42   (io.to(room).emit — the helper itself)
routes/scanRoutes.js:399       (emitWrapped(io.to(`device:${deviceId}`), 'batch:ack', ...))
```

The 49 call sites: `server.js` 1; `gmAuth.js` 5; `broadcasts.js` 25; `deviceHelpers.js` 1; `adminEvents.js` 14; `scanRoutes.js` 3. The literal-event regex missed `score:adjusted`, `scores:reset` and `transaction:new` (template-literal room names), so the distinct count was taken by reading all 49 sites: 23 event names. Services that `this.emit` to other services are not client emits and are not listed here (they appear as "change events" in section 2).

### 3.2 Events emitted to clients

"All sockets" means `io.emit` through `emitWrapped(io, ...)`: every connected socket, authenticated or not. The `gm` room holds every authenticated socket, including display-tier (scoreboard) sockets (`gmAuth.js:106`). Room `session:<id>` holds authenticated sockets present at connect or at session creation (`gmAuth.js:124`; `broadcasts.js:667-682`).

| Event | Emit site | Payload builder | Receivers |
|---|---|---|---|
| `sync:full` | `server.js:96`; `gmAuth.js:179`; `broadcasts.js:103,325,367` | `syncHelpers.js:36-159` plus caller keys | Requesting socket; joining socket; `gm` room (3 sites) |
| `gm:identified` | `gmAuth.js:188` | Inline `{success, deviceId, sessionId}`. Not in `asyncapi.yaml`; no GM client handler | Joining socket |
| `session:update` | `broadcasts.js:75` (created), `:120` (updated) | Inline `{id,name,startTime,endTime,status,teams,metadata}` | All sockets |
| `session:overtime` | `broadcasts.js:149` | Inline; duration math at `:135-146` | `gm` room |
| `device:connected` | `broadcasts.js:166` | Inline from `device:updated` | All sockets |
| `device:disconnected` | `deviceHelpers.js:32` | Inline | All sockets |
| `transaction:new` | `broadcasts.js:216`; fallback `:223` | Inline `{transaction (enriched), teamScore}` from the stash | Room `session:<id>`; fallback all sockets |
| `transaction:result` | `adminEvents.js:207` (queued), `:250` (session not active), `:292` (processed) | Inline from `processScan` result | Submitting socket |
| `transaction:deleted` | `broadcasts.js:267`; fallback `:276` | Inline `{transactionId, teamId, tokenId, updatedTeamScore}` | Room `session:<id>`; fallback `gm` room |
| `score:adjusted` | `broadcasts.js:249` | Inline `{teamScore}` | Room `session:<id>` |
| `scores:reset` | `broadcasts.js:307` | Inline `{teamsReset}`; a sync:full follows | Room `session:<id>` |
| `group:completed` | `broadcasts.js:292` | Inline `{teamId, group, bonusPoints, completedAt}` (`completedAt` made at emit) | `gm` room |
| `offline:queue:processed` | `broadcasts.js:346` | Inline `{queueSize, results}` | `gm` room |
| `player:scan` | `scanRoutes.js:111`, `:336` | Inline in the route (batch adds `replayed: true`) | `gm` room |
| `batch:ack` | `scanRoutes.js:399` | Inline | Room `device:<deviceId>` (GM sockets only, inference: HTTP scanners never join) |
| `cue:fired`, `cue:completed`, `cue:error` | `broadcasts.js:448,452,456` | Cue engine event data (not mapped) | `gm` room |
| `display:mode` | `broadcasts.js:464` | `displayControlService` payload `{mode, previousMode}` | All sockets |
| `scoreboard:page` | `broadcasts.js:472` | `scoreboardControlService` data | `gm` room |
| `service:state` | `broadcasts.js:491` (generic, 50 ms debounce), `:502` (music), `:528` (video failed, immediate), `:591` (held) | `service.getState()`; `buildMusicState`; `{items}` | `gm` room |
| `gm:command:ack` | `adminEvents.js:56,96,118,136` | Inline `{action, success, message}` | Submitting socket |
| `error` | `gmAuth.js:31,86,209`; `adminEvents.js:33,153,166,177,227,238,307`; `broadcasts.js:604` | Inline `{code, message, ...}`; service errors `{service, message, code}` | Submitting socket; service errors to all sockets |

### 3.3 HTTP endpoints that return runtime state

| Endpoint | Handler | Runtime state returned | Auth | In OpenAPI |
|---|---|---|---|---|
| `GET /health` (`?deviceId=&type=player`) | `healthRoutes.js:25` | Pack and profile identity, uptime, timezone. A `deviceId` registers a player heartbeat in the session | None | Yes |
| `GET /api/session` | `sessionRoutes.js:16` | Session subset incl. full `metadata` (404 when none) | None | Yes |
| `GET /api/state` | `stateRoutes.js:32` | Full sync:full payload (all devices), ETag excluding `lastChecked` | None | Yes |
| `GET /api/pack/manifest` | `packRoutes.js:19` | Frozen manifest | None | Yes |
| `GET /api/pack/files/*` | `packRoutes.js:34` | Live bytes of an inventoried file | None | Yes |
| `GET /api/tokens` | `resourceRoutes.js:53` | Raw tokens.json, live disk read each call | None | Yes |
| `GET /api/assets/manifest`, `/images/:file`, `/audio/:file` | `resourceRoutes.js:71,89,116` | ESP32 asset sync (separate channel from the pack channel) | None | Yes |
| `GET /api/vocabulary` | `resourceRoutes.js:168` | Engine cue vocabulary | None | Yes |
| `GET /scoreboard`, `/scoreboard.html` | `resourceRoutes.js:225` | HTML with injected frozen strings, theme and a freshly minted observe token | None (the mint is a side effect of GET) | No (grep `scoreboard` in `openapi.yaml` finds nothing) |
| `POST /api/scan` | `scanRoutes.js:19` | Scan result incl. `videoQueued`; writes `playerScans` | None | Yes |
| `POST /api/scan/batch` | `scanRoutes.js:202` | Batch result; cached by `batchId` for 1 h | None | Yes |
| `POST /api/admin/auth` | `adminRoutes.js:17` | Mints an operator token | Password | Yes |
| `GET /api/admin/logs` | `adminRoutes.js:58` | Recent logs | Operator | Yes |
| `GET /api/music/tracks`, `/playlists`; `PUT /api/music/playlists` | `musicRoutes.js:9,21,40` | Music data; PUT needs `show-control` | PUT only | Yes |

`resourceRoutes` is mounted twice, at `/api` and at `/` (`app.js:119,122`). So `/tokens`, `/assets/*`, `/vocabulary` and `/api/scoreboard` also answer without the contract prefix (inference from the mount; not requested by any contract). Static files under `public/` are served after the routes (`app.js:143`).

### 3.4 sync:full: keys and callers

Keys (18). Builder keys come from `syncHelpers.js:132-158`.

| # | Key | Builder (file:line) |
|---|---|---|
| 1 | `session` | `session.toJSON()` (`syncHelpers.js:133`) |
| 2 | `scores` | `transactionService.getTeamScores()` (`:59`; `transactionService.js:558-563`) |
| 3 | `recentTransactions` | inline map over `session.transactions` (`syncHelpers.js:63-81`) |
| 4 | `videoStatus` | `videoQueueService.getState()` (`:57`) |
| 5 | `devices` | inline map of `connectedDevices`, optional connected-only filter (`:84-98`) |
| 6 | `serviceHealth` | `serviceHealthRegistry.getSnapshot()` (`:102`) |
| 7 | `playerScans` | `session.playerScans` (`:139`) |
| 8 | `environment` | `buildEnvironmentState` (`:104`; `environmentHelpers.js:41-70`) |
| 9 | `gameClock` | `buildGameClockState` (`:111,168-191`) |
| 10 | `cueEngine` | `buildCueEngineState` (`:114,200-215`) |
| 11 | `music` | `buildMusicState` (`:117,225-246`) |
| 12 | `heldItems` | `buildHeldItemsState` (`:120,257-274`) |
| 13 | `sound` | `soundService.getState()` or `{playing: []}` (`:123`) |
| 14 | `displayStatus` | `displayControlService.getStatus()` minus `timestamp` (`:127-130`) |
| 15 | `pack` | `packService.getActivePackInfo()` (`:151`) |
| 16 | `profile` | `profileService.getProfileInfo()` (`:157`) |
| 17 | `deviceScannedTokens` | Caller-added: `gmAuth.js:150-152,181`; `server.js:92-99` |
| 18 | `reconnection` | Caller-added: `gmAuth.js:155,182` only |

The contract's required list covers keys 1-16 (`asyncapi.yaml:315-331`), so keys 17 and 18 are optional there. Count command: `sed -n 132,158p websocket/syncHelpers.js | grep -c '^    [a-zA-Z]*,$\|^    [a-zA-Z]*: '` returns the 16 builder keys; keys 17-18 come from the two caller sites.

Callers and when each fires:

| # | Caller | Fires | Device filter | Extra keys | Target |
|---|---|---|---|---|---|
| 1 | `gmAuth.js:165-183` | Each authenticated `gm`-type socket connect (`server.js:123-129`); includes display-tier sockets | connected only | `deviceScannedTokens`, `reconnection` | That socket |
| 2 | `server.js:75-99` | Client emits `sync:request` (GM client does so from `MonitoringDisplay.js:197`); no auth check | connected only | `deviceScannedTokens` (no `reconnection`) | That socket |
| 3 | `broadcasts.js:98-103` | `session:created`, after devices are re-registered | none (all) | none | `gm` room |
| 4 | `broadcasts.js:312-325` | `scores:reset` | connected only | none | `gm` room |
| 5 | `broadcasts.js:353-367` | `offline:queue:processed` (path unreachable in production, section 2) | connected only | none | `gm` room |
| 6 | `stateRoutes.js:34-45` | `GET /api/state` | none (all) | none | HTTP response |

After `system:reset`, callers 3-5 build with the `musicService` captured at re-setup, which is `undefined` (conclusion 6).

### 3.5 Is the snapshot built by the same code as the live event?

| Fact | Snapshot builder | Live builder | Same code? |
|---|---|---|---|
| Game session | `session.toJSON()` (`syncHelpers.js:133`) | Inline subset (`broadcasts.js:75-83,120-128`) | No. Live omits scores, transactions, scans, devices |
| Score rows | `TeamScore.toJSON` via `getTeamScores` (`:59`) | `TeamScore.toJSON` at `transactionService.js:284,539,736` | Same method, different call sites and times |
| Transactions | `syncHelpers.js:63-81` | `broadcasts.js:192-211` | Two copies of the same field mapping; identical today. Drift risk |
| Devices | `syncHelpers.js:90-97` | `broadcasts.js:166-172`; `deviceHelpers.js:32-37` | No; field names differ (`id` vs `deviceId` at source) |
| Player scans | Raw record `{id, tokenId, deviceId, deviceType, timestamp, tokenData}` | Inline `{scanId, tokenId, deviceId, videoQueued, memoryType, timestamp, tokenData, replayed?}` (`scanRoutes.js:111-119`) | No |
| Claimed tokens | `deviceScannedTokens` (`gmAuth.js:150`) | none | Snapshot only |
| Video | `videoQueueService.getState()` (`syncHelpers.js:57`) | same call (`broadcasts.js:491,528`) | Yes |
| Health | `registry.getSnapshot()` (`:102`) | `registry.getState()` returns `getSnapshot()` (`serviceHealthRegistry.js:209-211`; `broadcasts.js:537`) | Yes |
| Bluetooth, audio, lighting | each `getState()` (`environmentHelpers.js:45,54,63`) | same (`broadcasts.js:543,549,556`) | Yes |
| Game clock | `buildGameClockState`: status, elapsed, expectedDuration, phase (`syncHelpers.js:168-191`) | `gameClockService.getState()` also has `startTime`, `totalPausedMs` (`gameClockService.js:99-113`) | No. Live key set is larger |
| Cue engine | `buildCueEngineState` adds `loaded` (`syncHelpers.js:205-210`) | `cueEngineService.getState()` has no `loaded` (`cueEngineService.js:169-175`) | No |
| Music | `buildMusicState` | same function (`broadcasts.js:502`) | Yes |
| Held items | `buildHeldItemsState` array | same function wrapped as `{items}` (`broadcasts.js:590-591`) | Same builder, different wrapper |
| Sound | `soundService.getState()` | same (`broadcasts.js:491`) | Yes |
| Display mode | `getStatus()` → `{currentMode, previousMode, pendingVideo}` | event `{mode, previousMode}` (`displayControlService.js:76,175,238,291`) | No; keys differ |
| Pack, profile | `getActivePackInfo()`, `getProfileInfo()` | none | Snapshot only |

## 4. Boot and reset

### 4.1 Boot order

Entry: PM2 runs `src/server.js` (`ecosystem.config.js:12`). Module load runs two timers: the batch cleanup (`scanRoutes.js:186`) and the token cleanup (`auth.js:346`, not in test).

`startServer` (`server.js:281`):

1. `createServer()` (`:284`, body `:226-278`): HTTP(S) server (`:229-250`), redirect server (`:254`), Socket.io with the handshake middleware (`:265`, `socketServer.js:16-153`), `app.locals.io` (`:267`), discovery object (`:273`).
2. `initializeServices()` (`:288`; `app.js:178`):
   1. `persistenceService.init()` (`app.js:183`).
   2. `packService.activatePack()` (`:192`): freezes pack; the gate may refuse boot.
   3. `profileService.activateProfile()` (`:197`).
   4. `tokenService.loadTokens()` (`:201`) bakes token values from the frozen pack; `persistenceService.saveTokens` (`:202`); `transactionService.init(tokens)` (`:203`, registers the `session:updated` listener, `transactionService.js:49,56-70`).
   5. `sessionService.init()` (`:206`): restores the session, stale devices, game clock (phases injected first), cue engine state; then registers `setupScoreListeners`, `setupPersistenceListeners`, `setupGameClockListeners` (`sessionService.js:178-184`).
   6. `offlineQueueService.init()` (`:207`).
   7. Environment services: bluetooth, audio, lighting, sound (`:211-214`).
   8. Music: paths set, MPD spawn (`:219-238`).
   9. Cue engine: `loadCues(packCues)` (`:245-246`); `setupCueEngineForwarding` (`:252-261`).
   10. Ducking rules (`:264-275`).
   11. VLC and display control when video is enabled (`:280-301`).
   12. Dormancy recompute and `restampAfterRestore` (`:325-330`), one guard.
   13. `serviceHealthRegistry.startRevalidation(..., 15000)` (`:333-340`).
3. `setupServiceListeners(io)` (`server.js:296`; `:138-160`): `setupBroadcastListeners` (`broadcasts.js:54`), heartbeat monitor `init` and `start` (`server.js:156-157`).
4. `setupWebSocketHandlers(io)` (`:300`; `:61-135`): requires state `SERVICES_READY`; registers `sync:request`, `gm:command`, `transaction:submit`, `disconnect`, then auto-identifies pre-authenticated GM sockets (`:123-129`).
5. `server.listen` (`:307`); then redirect server (`:321-326`) and discovery (`:329-331`).

Listener order on `transactionService` events at boot: session persistence (step 2.5), cue forwarding (2.9), broadcasts (3). Reset reverses this (4.2).

Shutdown (`server.js:163-217`): stop heartbeat and discovery, close io and server, clean services, then `saveCurrentSession` WITHOUT ending the session (`:200-209`).

### 4.2 `system:reset` (`systemReset.js:38-301`)

Entry: `adminEvents.js:53-105` (floor check `:54-62`, mutex `:64-68`). The caller passes 12 services and omits `musicService` (`:77-90`).

1. Archive only if the in-memory session is already `ended` (`:58-71`). `endSession` nulls the session, so this branch is rarely true (inference); otherwise it only warns.
2. `sessionService.endSession()` (`:74`): completes, stops the clock, suspends cues, saves, backs up, emits `session:updated` (`sessionService.js:503-559`).
3. `cleanupBroadcastListeners()` and `listenerRegistry.cleanup()` (`:79-80`). The registry cleanup is a no-op outside tests (`listenerRegistry.js:44-47`), so production relies on the next step's `removeAllListeners`.
4. Reset services in order (`:85-132`): `sessionService.reset()` (removes its listeners, deletes `session:current` and `gameState:current`, `initState`, `sessionService.js:752-785`); `transactionService.reset()` (keeps the token Map); `videoQueueService`; `offlineQueueService.reset()` (deletes `offlineQueue`); display control; bluetooth, audio, lighting; game clock, cue engine, sound; VLC; music (skipped in production, conclusion 6); `invalidateObserveTokens()` (`:129`); `serviceHealthRegistry.reset()` (`:132`).
5. `setupBroadcastListeners(io, ...)` (`:138-152`).
6. Cross-service listeners (`:160-163`): `transactionService.registerSessionListener`, `setupScoreListeners`, `setupPersistenceListeners`, `setupGameClockListeners`.
7. Cue forwarding re-registered (`:168-180`), then `displayControlService.init` (`:188-194`).
8. Ducking rules reload (`:197-209`).
9. Health re-probes: game clock, sound, cue reload from the frozen snapshot (`:234-241`), bluetooth, audio, lighting, VLC (`:220-274`).
10. `dormancyService.recompute()` (`:284-288`), then `startRevalidation` (`:291-298`).

Not rebuilt: pack snapshot, profile snapshot, token catalog, `processedBatches`, operator tokens, persisted `session:<id>` and backup keys. No `session:update` or `sync:full` reaches clients at the end of a reset; clients learn of the empty state at the next `session:created` (inference from reading `systemReset.js:296-300`).

## 5. The transaction path

From a GM's `transaction:submit` to stored transaction, score and broadcasts.

1. Handshake: `socketServer.js:49-153` verifies operator token (`:71`) or observe token (`:73`), rejects a live duplicate GM `deviceId` (`:85-106`), stamps `tier`, `functions`, `deviceId`, `packHash` (`:109-127`).
2. Connect: `server.js:67-129` registers handlers, then `gmAuth.handleGmIdentify` joins rooms (`gmAuth.js:102-135`), registers the device (`:120`), sends sync:full (`:165-183`) and `gm:identified` (`:188`).
3. `server.js:112` → `adminEvents.handleTransactionSubmit` (`:150`). Checks, in order: `deviceId` (`:152`); `tier === 'operator'` (`:165`); envelope (`:176`); Joi `gmTransactionSchema` with mode checked against the pack's modes (`:185-195`; `utils/validators.js:22-29,173-182`); offline flag (`:203`); session exists (`:236`); status `active` (`:247`).
4. `transactionService.processScan` (`:154-309`):
   1. Session must be active again (`:156-163`).
   2. `Transaction.fromScanRequest` (`models/transaction.js:150-175`) with mode default from the pack (`:171-174`).
   3. Token lookup in the boot-baked Map (`:177`); unknown → `rejected`, not stored (`:179-190`).
   4. Summary copied from the token (`:195-202`).
   5. `duplicatePolicy.checkDuplicate` (`:206-223`): per-device registry then first-come; duplicate → returned, not stored.
   6. `session.addTransaction` (`:234`): claim by transaction list, `totalScans`, `uniqueTokensScanned`.
   7. Points from `scoring.pointsFor` (`:240`), `transaction.accept` (`:241`).
   8. Standard-scoring modes: `updateTeamScore` (`:247`) mutates the team row, auto-creates the team if missing (`:357-368`), checks group completion (`:416-464`), emits `group:completed` (`:462`). Counting but unscored modes: group progress only (`:264-270`).
   9. `addRecentTransaction` (`:274`).
   10. Emit `transaction:accepted` `{transaction, teamScore, groupBonus, deviceTracking}` (`:282-292`); `deviceTracking` is null for non-consuming modes.
   11. Build the response through `websocket/scanResponse.js:71` (`createScanResponse`, `:516-525`), which reads video state.
5. Listeners on `transaction:accepted`, all synchronous up to their first `await`: persistence (`persistenceListeners.js:75-128`: idempotent re-add `:97`, claim registry `:100-102`, then `await saveCurrentSession` `:108`); cue forwarding (`cueEngineWiring.js:61`, which also calls `gameClockService.handlePhaseTrigger`, `:43-46`); broadcast stash (`broadcasts.js:231-243`).
6. `processScan` returns; `handleTransactionSubmit` builds the contract result (`adminEvents.js:272-289`) and emits `transaction:result` to the submitter (`:292`).
7. Later, when the save finishes: `transaction:added` (`persistenceListeners.js:111`) → `broadcasts.js:183-226` builds the enriched payload with the stashed `teamScore` and emits `transaction:new` to room `session:<id>`; `session:updated` (`:112`) → `session:update` to all sockets (`broadcasts.js:114-130`).
8. Persisted state: `session:current` and `session:<id>` rewritten (`sessionService.js:728-729`).

Group completion side path: `group:completed` (`:462`) goes to the `gm` room (`broadcasts.js:292`) and to the cue engine (`cueEngineWiring.js:65`) before step 10, so clients can see it before the transaction.

Other writers into the same path: `transaction:create` (manual) re-enters `processScan` (`transactionService.js:787`); offline-queue drain re-enters it (`offlineQueueService.js:129`).

## 6. Questions with several answers

| Question | Places that answer (file:line) | Can they disagree? Scenario |
|---|---|---|
| Is this token claimed? | (a) `session.transactions`, accepted consuming (`duplicatePolicy.js:58-68`; used at `transactionService.js:206`); (b) `metadata.scannedTokensByDevice[deviceId]` (`duplicatePolicy.js:106`); (c) `metadata.uniqueTokensScanned` (`models/session.js:188`); (d) sync:full `deviceScannedTokens` (`gmAuth.js:150`); (e) GM scanner Set (not mapped); (f) `TeamScore.completedGroups` for group claims | Yes. After `transaction:delete`, (a) and (b) drop the claim (`transactionService.js:699,721`) but (c) and `totalScans` keep it. The deletion broadcast carries no claim list, so (d)/(e) change only if the client acts on `transaction:deleted`. A different device may rescan only after (b) drops it |
| What is team X's score? | `session.scores[]` (`transactionService.js:380`); rebuild result (`:817`); `transaction:new.teamScore` stash (`broadcasts.js:210`); sync:full `scores` and `session.scores` (`syncHelpers.js:59,133`) | Yes, narrowly. The live path adds `token.value`; the rebuild uses recorded `tx.points` plus bonuses recomputed from the current catalog (`scoring.js:206-208`). They match while the pack is frozen. A deletion broadcast sends only the affected team (`broadcasts.js:256-261`), so other teams' recomputed rows reach clients only at the next sync:full (inference) |
| Which teams exist? | `session.scores` ids; `session:update.teams`; `toJSON().teams`; GM scanner registry | Yes. Auto-created teams (`transactionService.js:357-368`) appear in `scores` before any `session:addTeam` event; clients learn them from the following `session:update` |
| What phase is the game in? | `session.status` (`models/session.js:140-169`); `gameClockService.status`; `cueEngine.active`; `session.gameClock` snapshot; `session:update.status`; `GET /api/session` | Yes, by timing. `startGame` sets status before the clock starts (`sessionService.js:317` then `:332`); a throw between them leaves `active` with a stopped clock (inference). A restored game session re-seats the clock only from the last saved snapshot (`:151-159`) |
| Is the game session active enough to score? | `adminEvents.js:247` (status check); `transactionService.js:157` (again); `offlineQueueService.js:108` (`isActive`); `scanRoutes.js:43` (exists only, by decision A6) | No, by design: GM transactions need `active`; player scans need only existence |
| Which pack is running, and which rules scored this game session? | `packService.getActivePackInfo()` (frozen, but reads the disk manifest each call to warn on drift, `packService.js:1254-1270`); `session.metadata.pack` (`sessionService.js:215`); `/health`; handshake `packHash`; JWT `packHash`; preflight stamp `packHash` | Yes. After a restart under a different pack, the session's stamp differs from the active pack; the engine only warns (`sessionService.js:116-126`). Clients on another `packHash` only warn (`socketServer.js:139-148`) |
| What are the token values and groups? | `transactionService.tokens` (boot-baked); `GET /api/tokens` (live disk); `GET /api/pack/files/tokens.json` (live bytes under frozen hash); `persistence tokens:all` (boot, unread); scanner standalone copies | Yes. Edit tokens.json after boot: engine keeps old values; `/api/tokens` and the file endpoint return the new bytes; the manifest hash still names the old pack |
| Who is connected? | `session.connectedDevices[].connectionStatus`; sync:full `devices` (filtered or not); Socket.io socket table; counters in `metadata`; `device:*` events | Yes. Restart marks devices disconnected in memory only until the next save (`sessionService.js:128-140`). Counters never fall. A reloading GM can be refused `DEVICE_ID_COLLISION` until the old socket's disconnect is processed (ping timeout 60 s + 25 s interval, `config/index.js:76-77`; `socketServer.js:97-104`) |
| Is the system offline? | `offlineQueueService.isOffline` only (`adminEvents.js:203`) | One answer, and nothing sets it in production, so the question is always "no" |
| Has this player scan been recorded? | `session.playerScans`; `processedBatches` by `batchId` (`scanRoutes.js:221`); the response `status` | Yes. A batch retried after a restart is not found in `processedBatches` (memory only) and re-persists its scans (inference) |
| Can a video be queued from this scan? | `videoQueueService.canAcceptVideo()` (`scanRoutes.js:97`); `commandExecutor` dependency gate; sync:full `serviceHealth` and `videoStatus` | Owned by another reader. Listed because the scan route consumes it |
| Is the group complete? | `TeamScore.completedGroups`; `isGroupComplete` over transactions (`scoring.js:133`); `group:completed` events | Yes. x1 groups complete silently (`transactionService.js:433-436`); a delete rebuild can un-complete a group with no event |
| Is the game session ended? | `currentSession === null`; `session.status === 'ended'`; `GET /api/session` 404 | Yes. After `endSession` the server holds no session while clients hold the last `ended` `session:update` (`sessionService.js:539,552`) |

## 7. What hot-apply (CONTEXT.md section 4) would touch

Everything below reads the active pack once, at boot or at activation, and never again. Marked inference where I reason about effect.

| Item | Where it reads once | What hot-apply must do (inference) |
|---|---|---|
| Pack snapshot (manifest, game.json, strings, theme, cues) | `packService.activatePack` (`:1215-1248`), called once from `app.js:192` | Swap all five variables atomically and clear `_cachedScoringRules` (`:1334`, reset at `:1238`). Re-arm the drift warn latch |
| Token catalog | `tokenService.loadTokens` at `app.js:201-203`: `value` from scoring (`tokenService.js:166-169`), `groupMultiplier` from `groups` (`:163-165`), `name` from the token noun (`:147-150,173`) | Re-run the bake and call `transactionService.loadTokens` (`:604`, exists, no caller). `videoQueueService` also reads the Map (`videoQueueService.js:752,758`). `persistenceService.saveTokens` copy is unread |
| Cue set | `cueEngineService.loadCues` at `app.js:245-246` and `systemReset.js:236` (both from the frozen snapshot) | Reload cues; recompute dormancy (`app.js:326`); keep fired/spent sets consistent with new ids |
| Game clock rules | `getClockRules()` read at `startGame` (`sessionService.js:326-329`) and restore (`:153`); `getState().expectedDuration` per call (`gameClockService.js:108`); `buildGameClockState` per sync:full | Applies from the next `startGame` if the snapshot swaps. A running clock keeps its stored `overtimeThreshold` and phase table |
| Mode semantics, duplicate policy, scoring, floor | `packService.getGameConfig()` / `getScoringRules()` per call (`transactionService.js:125,173,210,239,444,487,678,828,854`; `validators.js:24`) | Follow the swap automatically. Mid-game this changes meaning: stored transactions keep recorded points, but the delete-rebuild recomputes bonuses from the new catalog (`scoring.js:206-208`), and an unresolvable stored mode counts as consuming (`duplicatePolicy.js:42-45`) |
| Award message and money format | `scanResponse.js:27,35` per call | Follows the swap |
| Game session pack stamp | `createSession` (`sessionService.js:215-216`) | A swap mid-game makes the stamp stale; restore and reports compare it (`:116-126`). Decide whether hot-apply is allowed only between game sessions (CONTEXT.md section 2, Activation) |
| Auth tokens | `packHash` claim and grants computed at issuance (`auth.js:35-42,54-63,137`) | Stale after a swap; no re-mint path |
| Scoreboard page | Strings and theme injected per serve (`resourceRoutes.js:209-213`) | New loads get the swap; an open kiosk keeps old strings until reload (inference) |
| Pack file serving | `resolvePackFile` checks the frozen manifest list but reads live bytes (`packService.js:1450-1463`) | Must swap manifest and bytes together or clients' sha1 checks fail |
| Client notification | No event. Identity travels in sync:full and `/health` only | Needs a new live event (AsyncAPI first, per the contract-first rule) or a forced sync:full to the `gm` room |
| Profile and dormancy | `activateProfile` at boot (`app.js:197`); `dormancyService.recompute` (`app.js:326`, `systemReset.js:285`, `sessionService.js:223`) | Out of scope here (other reader); `recompute` reads `packService.getManifest()` (`dormancyService.js:189`), so a swap needs a recompute |
| Handshake compare | `socketServer.js:139-148` reads identity per connect | Follows the swap; connected GM stations are not re-checked |
| Process-lifetime assumptions | Comments assert the snapshot is "frozen for the process lifetime" (`packService.js:95,1273`; `systemReset.js:231-233`) | Several comments and the CONTEXT.md Activation entry would need to change |

## Terms CONTEXT.md lacks

- **sync:full** (the full-state message and its builder). The message name appears in CLAUDE.md, not in CONTEXT.md.
- **Snapshot** and **live update** as delivery-path kinds. The task uses them; CONTEXT.md section 4b does not define them.
- **Room** (a Socket.io delivery group: `gm`, `session:<id>`, `device:<id>`, `team:<id>`). CONTEXT.md has 2 hits for "room", none about sockets.
- **Claim registry** (the per-device list `metadata.scannedTokensByDevice`), distinct from the session-wide claims in `session.transactions`. CONTEXT.md defines "consuming claim" only.
- **Write queue** (the promise chain that orders session writes).
- **Idempotency cache** (`processedBatches`).
- **Listener order** (the order handlers register on one emitter), which this pass found to be load-bearing.
- **Heartbeat** (the `/health?deviceId=` poll that keeps an HTTP device "connected").
- **Boot-baked copy** (a value computed from the pack once at boot and held, such as token value).
