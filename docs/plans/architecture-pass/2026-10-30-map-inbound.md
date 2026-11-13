# Map of the inbound direction (what each component sends to the backend)

Reader sheet for the architecture pass, 2026-10-30. Branch claude/nice-curie-hescfv, submodules at their pins. Read-only pass: nothing was run, no server or test started. Paths are relative to /home/user/ALN-Ecosystem unless they start with a component name. Claims marked "inference" were reasoned from code order, not observed. The CLAUDE.md files were treated as claims and checked.

Vocabulary follows CONTEXT.md sections 0, 2 and 4b. Where I needed a word CONTEXT.md lacks, I used it plainly and listed it at the end.

## Conclusions

1. The whole inbound surface is small. Sockets have three application handlers (`sync:request` server.js:75, `gm:command` server.js:107, `transaction:submit` server.js:112), a handshake middleware (socketServer.js:49-153) and `disconnect` (server.js:117). HTTP has 18 route handlers in 8 files (listing in 1d).
2. Action names have no drift. The AsyncAPI `gm:command` enum (asyncapi.yaml:1764-1822) has 59 actions. `commandExecutor` has 59 case labels. The two sets are identical (diff empty). The GM scanner sends 56 of them. Never sent by any scanner code: `music:seek`, `video:seek`, `transaction:create`. Cues can fire 24 (`CUE_ACTIONS`, cueValidation.js:91-116); 22 of those are also GM-sendable.
3. Claim mark at submit time. The live mark is gameOps.js:329-331 (consuming modes only), set before `queueTransaction` and before the green result screen (gameOps.js:376). NetworkedStorage.js:151-155 is the same mark inside `NetworkedStorage.addTransaction`, which the networked path never calls. Its only caller chain is gameOps.js:358, inside the standalone branch. All 8 emit sites in NetworkedStorage (lines 51, 137, via `_emitCommand` x7) are unreachable in networked production flow (inference from grep; unit tests do call them).
4. Unmarking has one caller. app.js:261-262 unmarks on `transaction:failed` with status rejected or error. Other clears: `resetForNewSession` (unifiedDataManager.js:544) and `resetBackendScores` (NetworkedStorage.js:437). Nothing unmarks on `transaction:deleted`. The backend frees the claim on delete (transactionService.js:696-700), but `removeTransactionFromBroadcast` (NetworkedStorage.js:394-403) only splices the cache. After a GM deletes a transaction, every GM station keeps a local lock on that token, and the lock is persisted (NetworkedStorage.js:67-75) so a reload does not clear it. The comment at unifiedDataManager.js:484-486 says unmark exists "for re-scanning after deletion", but no deletion path calls it.
5. Errors that come back as the `error` event (VALIDATION_ERROR, SESSION_NOT_FOUND, QUEUE_FULL, AUTH_REQUIRED) are treated as transient. The queue entry stays (networkedQueueManager.js:103-109, 219-228), the token stays marked, and `syncQueue` replays on every `sync:full` (messageRouters.js:151). A permanent validation failure (for example a mode the server's pack does not declare, validators.js:21-30) therefore loops, with an error toast each time (app.js:198-202).
6. Claims by other stations are only learned live. `sync:full` gives `deviceScannedTokens` for this device only (server.js:93-99, gmAuth.js:150-152), and `setTransactions` (NetworkedStorage.js:357-359) does not mark. A station that was disconnected or reloaded shows the green screen for a token another station already claimed, then gets a duplicate verdict (app.js:232-255). Design says this is decision A7; the sheet records that the screen is wrong first.
7. Command acks correlate by action name only. `CommandSender` (admin/utils/CommandSender.js:37-56) does not serialize same-action sends, while `OrchestratorClient.sendCommand` does (orchestratorClient.js:189-202). Two in-flight commands of one action through `CommandSender` both resolve on the first ack.
8. Credentials. Only 2 of 18 HTTP routes require a token (GET /api/admin/logs, PUT /api/music/playlists). No scanner sends an Authorization header over HTTP (grep for "Authorization|Bearer" in the sender scopes is empty). The only HTTP sender with a bearer is the config tool. `sync:request` works on any socket, including one with no token (socketServer.js:53 only authenticates `deviceType === 'gm'`). GET /api/state returns the same payload with no auth.
9. Contract contradictions. (a) The handshake documents `deviceType: "gm" | "admin"` (asyncapi.yaml:30) but an `admin` socket is never authenticated or identified (socketServer.js:53, server.js:123). (b) OpenAPI /health lists no query parameters, yet `?deviceId&type=player` registers the only HTTP device record (healthRoutes.js:51-93). (c) /scoreboard (mints the observe token, resourceRoutes.js:204-205) is not in OpenAPI. (d) `batch:ack` text says the GM scanner uploads batches (asyncapi.yaml:2071); only player and ESP32 scanners do, and neither holds a socket, so the event goes to an empty room (inference, gmAuth.js:102 is the only `device:` room join). (e) /api/tokens "Usage" says the GM scanner and PWA fetch it (openapi.yaml:211-214); neither does. (f) The gm:command prose lists a "Display: toggle" action that is not in the enum (asyncapi.yaml:1710).
10. The config tool does talk to the orchestrator: four HTTP calls (toolAuth.js:86, routes.js:399, 411, 428). It also reads and writes files directly (backend/.env, pack directory, backend/public/audio and videos) and imports backend modules in-process. Publishing a pack sends nothing to the running orchestrator; the running backend ignores the edit until restart (CONTEXT.md section 2, Activation).
11. Player-scan paths disagree on policy. Batch with no session answers "processed" but persists nothing (scanRoutes.js:317-352); the PWA and ESP32 then drop the batch. Any 4xx is final for the PWA (orchestratorIntegration.js:148-166, 333-356), but the ESP32 queues unknown responses and retries 429 (ScanResponse.h:73-74). The 2020 timestamp floor applies to batch only (scanRoutes.js:272), so an ESP32 scan stamped 1970 pre-SNTP persists online and is silently dropped from a queue.
12. `commandExecutor` has table entries with no case: `service:restart`, `service:out-of-service`, `service:in-service`, `preflight:run` (commandExecutor.js:98-101). They would answer "Unknown action" (line 963). `validateCommand` (line 1013) has no caller in src. Root CLAUDE.md lists "Pre-show verification" among GM capabilities; no scanner sender exists for it.
13. Order of replies for one `transaction:submit` (inference from event order): `transaction:result` is emitted after `processScan` returns (adminEvents.js:292); `transaction:new` is emitted only after the async session save resolves (persistenceListeners.js:110-111). The submitter most likely hears the result first. If the save rejects, no `transaction:new` is ever sent, though the claim is already in memory.
14. `system:reset` ack timeout on the GM scanner is a fixed 5 s (gameAdmin.js:311-314) while the reset re-inits Bluetooth, audio and lighting (systemReset.js, steps 4 and 6). A slow reset reports failure to the GM and the follow-on `session:create` is skipped; the late ack finds no listener (inference on duration).
15. Reconnect. The GM client builds a new socket each time (`reconnection: false`, orchestratorClient.js:88-91), so `socket.recovered` is always false and `reconnection` in `sync:full` is always false (gmAuth.js:155; no `connectionStateRecovery` anywhere in backend/src). Operator and observe tokens live in memory (auth.js:13-20), so a backend restart invalidates every GM token and every scoreboard token.
16. Silent loss on session change. `_handleSessionBoundary` calls `queueManager.clearQueue()` (networkedSession.js:258) when the session id changes. `clearQueue` dispatches no event (networkedQueueManager.js:401-405), so queued offline scans from the old session vanish without a message and the queue badge is not refreshed.
17. Station-name assignment is a race (connectionWizard.js:204-227): two stations that read /api/state before either connects get the same name. With no session, the server skips the collision check entirely (socketServer.js:89) and /api/state lists no devices.

Gaps. Unit, contract and e2e tests were not read. ESP32 TokenService.h is flagged binary by grep; it was read with grep -a only for the /api/tokens call. No cross-check of the `docs/` folders. Sections 3 and 6 mark each inference.

## Completion check

See the end of the sheet ("Completion check" section) for the greps and counts.

---

## 1. Inbound catalog

Legend for the credential column. OP = operator JWT (tier operator, aud orchestrator, 24 h, held in the in-memory store auth.js:13-14) presented in the socket handshake. OBS = observe token (tier device, class display, functions `["observe"]`, auth.js:130-151). None = no check. "Floor" = the granted-function check at commandExecutor.js:152-163.

### 1a. WebSocket messages other than gm:command

| # | Sender (file:line) | Message | Backend handler | Runtime fact it changes (authority) | Credential | Outcome path | Sender's copy before / after | Offline behaviour |
|---|---|---|---|---|---|---|---|---|
| W1 | GM scanner: orchestratorClient.js:88-103, fields set at connectionManager.js:145-148 | Handshake `auth {token, deviceId, deviceType:'gm', version:'1.0.0', packHash}` | socketServer.js:49-153, then server.js:123 -> gmAuth.js:27-215 | Device record in session.connectedDevices (sessionService); socket rooms `device:<id>`, `gm`, `session:<id>`, `team:<id>` (gmAuth.js:102-137) | OP, or OBS | `connect_error` with "CODE: text" (socketServer.js:56-103) or connect, then `sync:full` and `gm:identified` (gmAuth.js:179-192) | Nothing changed first. After: ConnectionManager state, pack identity sent as `packHash` | Retries with 1 s to 30 s backoff, +/-20% jitter, 5 tries on initial path (connectionManager.js:181-197, 330-340); auth errors stop retries (167-176) |
| W2 | Scoreboard: backend/public/scoreboard.html:1559-1567 | Handshake with observe token, `deviceType:'gm'` asserted, deviceId `SCOREBOARD_DISPLAY[...]` (743-767) | same as W1 | No device record (gmAuth.js:61-64, 119); rooms yes (gmAuth.js:123-125) | OBS | as W1; on `AUTH_`/`DEVICE_ID_` error the page reloads to mint a new token (scoreboard.html:1631-1634) | Page state | socket.io default reconnection (not disabled), same token until expiry |
| W3 | GM scanner: networkedQueueManager.js:348 via orchestratorClient.js:156-166 | `transaction:submit {tokenId, teamId, deviceId, deviceType, mode, summary, timestamp, clientTxId}` (built at gameOps.js:338-346; clientTxId added at networkedQueueManager.js:45-47) | server.js:112 -> adminEvents.js:150-318 | Claim and score. Claim registry: session.metadata.scannedTokensByDevice plus session.transactions (sessionService; decision by gameRules/duplicatePolicy.js); score: transactionService on session.scores | OP (tier check adminEvents.js:165) | `transaction:result` to submitter (adminEvents.js:292), `error` event with `clientTxId` (183-317), later `transaction:new` to session room (broadcasts.js:216) | Marks token claimed and shows green result BEFORE reply (gameOps.js:329-346, 376). After: removes queue entry on accepted, duplicate, rejected, error; unmarks on rejected and error only (queueManager 89-100, app.js:232-264) | Persisted first in localStorage `networkedTempQueue` (queueManager 53-54, 360-366), replayed on each `sync:full` (messageRouters.js:151). Per attempt 30 s timeout (299-300). Queue has no size cap |
| W4 | GM scanner: NetworkedStorage.js:137 | `transaction:submit` without clientTxId | same as W3 | same | OP | none handled by that code | Marks claim (151-155) | Unreachable on the networked path (see Conclusion 3) |
| W5 | GM scanner: MonitoringDisplay.js:197. Scoreboard: scoreboard.html:1591, 1639 | `sync:request` (no payload, no envelope) | server.js:75-104 | Nothing. Read. (Side effect: `getDeviceScannedTokens` creates an empty array key, session.js:380-386) | None | `sync:full` to the requester | Replaced wholesale by sync:full | Only sent when connected |

### 1b. gm:command, one row per action

Common to every row unless the last column says otherwise. Receiver path: server.js:107 -> adminEvents.js:30-142 -> `executeCommand` (commandExecutor.js:120). Credential: OP, plus the floor function in column "Floor" (grants.js:61-87; observe sockets get none). Outcome: `gm:command:ack {action, success, message}` (adminEvents.js:118-122, errors 136-140), plus the broadcast named in the fact column. Sender copy: the controllers change nothing locally and wait for the ack (CommandSender.js:29-66, 5 s unless noted); state screens update from broadcasts. Offline: `connection.send` throws "Socket not connected" (orchestratorClient.js:157-159), the promise rejects at once, no queue, `safeAdminAction` shows an error toast (domEventBindings.js:21-32). Exceptions are in the last column.

Floor key. SL = session-lifecycle, SC = show-control, SI = score-intervention.

| # | Action | Sender (file:line) | Handler line (commandExecutor.js) | Fact it changes (authority) | Floor | Exception |
|---|---|---|---|---|---|---|
| 1 | session:create | admin/SessionManager.js:31 | 230 | Game session replaced, new one in setup (sessionService); `session:update` + `sync:full` (broadcasts.js:73-110) | SL | Ends any current session (sessionService.js:200-202) |
| 2 | session:start | SessionManager.js:49 | 245 | Phase setup -> active, game clock (sessionService, gameClockService); preflight gate | SL | NO-GO ack prefix drives a typed override (gameAdmin.js:73-114) |
| 3 | session:pause | SessionManager.js:57 | 274 | Phase (sessionService); `session:update` | SL | |
| 4 | session:resume | SessionManager.js:65 | 281 | Phase (sessionService) | SL | |
| 5 | session:end | SessionManager.js:73 | 288 | Phase, session nulled (sessionService) | SL | |
| 6 | session:addTeam | core/teamRegistry.js:301 via orchestratorClient.js:178-203 | 295 | Team row in session.scores (sessionService/sessionRegistry.js:18-47); `session:update` | SL | Uses `OrchestratorClient.sendCommand` (10 s, same-action chain). Local registry adds the team after the ack (teamRegistry.js:307-308) |
| 7 | video:play | admin/VideoController.js:29 | 326 | Resumes current video (VLC is authority; videoQueueService caches); `service:state` video | SC | Needs VLC healthy (SERVICE_DEPENDENCIES, line 39) |
| 8 | video:pause | VideoController.js:37 | 336 | same | SC | |
| 9 | video:stop | VideoController.js:45 | 346 | Skips current and clears queue | SC | |
| 10 | video:skip | VideoController.js:53 | 357 | Skips current | SC | |
| 11 | video:queue:add | VideoController.js:64 | 382 | Video queue (videoQueueService) | SC | Needs VLC |
| 12 | video:queue:reorder | VideoController.js:74 | 394 | Queue order (videoQueueService) | SC | Ungated by health |
| 13 | video:queue:clear | VideoController.js:82 | 406 | Queue (videoQueueService) | SC | Ungated by health |
| 14 | display:idle-loop | admin/DisplayController.js:27 | 415 | Display mode (displayControlService); `display:mode` | SC | Needs VLC |
| 15 | display:scoreboard | DisplayController.js:35 | 416 | Display mode | SC | Needs display service |
| 16 | display:return-to-video | DisplayController.js:44 | 417 | Display mode | SC | Needs VLC |
| 17 | display:status | DisplayController.js:52 | 451 | Nothing (read) | SC | `resultData` is dropped from the ack |
| 18 | scoreboard:page:next | admin/ScoreboardController.js:24 | 462 | Nothing stored; rebroadcast `scoreboard:page` (scoreboardControlService, broadcasts.js:471) | SC | Echo reaches GMs and scoreboards |
| 19 | scoreboard:page:prev | ScoreboardController.js:29 | 468 | same | SC | |
| 20 | scoreboard:page:owner | ScoreboardController.js:38 | 474 | same | SC | |
| 21 | score:adjust | admin/AdminOperations.js:39 | 487 | Team score and adjustment ledger (transactionService on session.scores); `score:adjusted` to session room | SI | Refused if it crosses zero and pack forbids negatives (transactionService.js:121-128) |
| 22 | score:reset | AdminOperations.js:28 | 505 | Scores zeroed, transactions and claim registry cleared (transactionService, persistenceListeners.js:47); `scores:reset` + `sync:full` | SI | |
| 23 | transaction:delete | AdminOperations.js:49 | 520 | Transaction removed, claim freed, scores rebuilt (transactionService.js:654-740); `transaction:deleted` | SI | |
| 24 | system:reset | app/domains/gameAdmin.js:335 | 570 throws; real handler adminEvents.js:53-105 | Everything: session archived and ended, services reset, observe tokens rotated (systemReset.js) | SL | Hand-rolled listener, 5 s (gameAdmin.js:310-340); mutex adminEvents.js:64-68 |
| 25 | bluetooth:scan:start | admin/BluetoothController.js:29 | 577 | Scan state (bluetoothService / BlueZ); `service:state` bluetooth | SC | |
| 26 | bluetooth:scan:stop | BluetoothController.js:37 | 585 | same | SC | |
| 27 | bluetooth:pair | BluetoothController.js:48 | 592 | Pairing (BlueZ) | SC | 45 s timeout |
| 28 | bluetooth:unpair | BluetoothController.js:57 | 593 | same | SC | 15 s |
| 29 | bluetooth:connect | BluetoothController.js:68 | 594 | same | SC | 30 s |
| 30 | bluetooth:disconnect | BluetoothController.js:77 | 595 | same | SC | 15 s |
| 31 | audio:route:set | admin/AudioController.js:32 | 612 | Stream route (audioRoutingService / PipeWire); `service:state` audio | SC | Applies, then persists; a persist failure acks false after the sink switched (inference, lines 618-619) |
| 32 | audio:volume:set | AudioController.js:42 | 954 | Stream volume (PipeWire) | SC | |
| 33 | lighting:scene:activate | admin/LightingController.js:28 | 625 | Scene (Home Assistant; lightingService caches); `service:state` lighting | SC | |
| 34 | lighting:scenes:refresh | LightingController.js:36 | 633 | Scene list cache (lightingService) | SC | |
| 35 | sound:play | admin/SoundController.js:36 | 642 | pw-play process (soundService) | SC | |
| 36 | sound:stop | SoundController.js:47 | 663 | same | SC | |
| 37 | cue:fire | admin/CueController.js:29 | 672 | Cue run (cueEngineService); `cue:fired` | SC | Ack success may mean "held" (lines 357-358) |
| 38 | cue:enable | CueController.js:39 | 697 | Cue enabled set (cueEngineService) | SC | |
| 39 | cue:disable | CueController.js:49 | 709 | same | SC | |
| 40 | cue:stop | CueController.js:69 | 720 | Running cue | SC | |
| 41 | cue:pause | CueController.js:59 | 730 | Running cue | SC | |
| 42 | cue:resume | CueController.js:79 | 740 | Running cue | SC | |
| 43 | held:release | CueController.js:89 | 750 | Held item (cueEngineService / videoQueueService hold list) | SC | |
| 44 | held:discard | CueController.js:99 | 772 | same | SC | |
| 45 | held:release-all | CueController.js:108 | 787 | same | SC | try-all; names re-held ids |
| 46 | held:discard-all | CueController.js:117 | 807 | same | SC | |
| 47 | music:play | admin/MusicController.js:23 | 822 | MPD playback (musicService / MPD); `service:state` music | SC | |
| 48 | music:pause | MusicController.js:27 | 823 | same | SC | |
| 49 | music:stop | MusicController.js:31 | 824 | same | SC | |
| 50 | music:next | MusicController.js:35 | 825 | same | SC | |
| 51 | music:previous | MusicController.js:39 | 826 | same | SC | |
| 52 | music:setVolume | MusicController.js:49 | 834 | MPD volume | SC | Debounced 150 ms in the UI (domEventBindings.js:37-42) |
| 53 | music:setShuffle | MusicController.js:57 | 843 | MPD | SC | |
| 54 | music:setLoop | MusicController.js:65 | 851 | MPD | SC | |
| 55 | music:loadPlaylist | MusicController.js:73 | 859 | MPD queue | SC | |
| 56 | service:check | AdminOperations.js:59 | 884 | Health registry via probe (serviceHealthRegistry); `service:state` health | SC | |

Executor accepts these 3 that no scanner code sends:

| # | Action | Sender | Handler line | Fact (authority) | Floor |
|---|---|---|---|---|---|
| 57 | music:seek | none in scanners (cues only) | 868 | MPD position | SC |
| 58 | video:seek | none in scanners (cues only) | 367 | VLC position | SC |
| 59 | transaction:create | none in repo scanner code; config-tool commandForm.js mentions it as vocabulary only | 542 | Manual transaction (transactionService.createManualTransaction) | SI |

Cue-sourced dispatch (no ack): cueEngineService.js:783 and cue/timelineRuntime.js:243 call `executeCommand` with `source:'cue'`. Failure shows as `cue:error` (cueEngineService.js:791-797).

### 1c. HTTP requests

| # | Sender (file:line) | Request | Handler | Fact it changes (authority) | Credential | Outcome | Sender's copy | Offline |
|---|---|---|---|---|---|---|---|---|
| H1 | GM: connectionWizard.js:83 | GET {candidate}/health, ~509 probes in batches of 32 | healthRoutes.js:25 | none | None | ok flag | candidate list | no retry |
| H2 | GM: connectionWizard.js:204 | GET /api/state | stateRoutes.js:32 | none | None | JSON | picks next GM_Station_N from `devices` | on failure refuses to assign (237-245) |
| H3 | GM: connectionWizard.js:339 | GET /health | healthRoutes.js:25 | none | None | ok flag | none | error text |
| H4 | GM: connectionWizard.js:350 | POST /api/admin/auth {password} | adminRoutes.js:17 | Mints OP token into in-memory store (auth.js:53-83) | Password | `{token, expiresIn}` | stores token and URL in localStorage (381-384) | error text |
| H5 | GM: connectionManager.js:66 | GET /health before each connect attempt | healthRoutes.js:25 | none | None | ok flag | state | failure feeds backoff (139-141) |
| H6 | GM: services/StateValidationService.js:125 | GET /health | healthRoutes.js:25 | none | None | ok | none | clears stale state on fail (172-188) |
| H7 | GM: StateValidationService.js:148 | GET /api/session | sessionRoutes.js:16 | none | None | 404 = no session | none | as H6 |
| H8 | GM: core/packLoader.js:136 | GET /api/pack/manifest (orchestrator-served) or pack-manifest.json | packRoutes.js:19 | none | None | manifest | staged pack refresh, pointer flip | falls back to cache then bundle |
| H9 | GM: packLoader.js:222 | GET /api/pack/files/<path> per manifest file | packRoutes.js:34 | none | None | file | per-file sha1 verify | as H8 |
| H10 | GM: packLoader.js:394 | same-origin static pack files (bundled tier) | express.static (app.js:143) or PACK_PATH route (app.js:138) | none | None | file | | |
| P1 | PWA: aln-memory-scanner/js/orchestratorIntegration.js:105 | POST /api/scan {tokenId, teamId?, deviceId, deviceType:'player', timestamp} | scanRoutes.js:19 | Player scan appended to session.playerScans (sessionService); video enqueued (videoQueueService) | None | 200 accepted; 409 `{error:SESSION_NOT_FOUND}` or `{status:'rejected'}`; 404; 400; 503 | Shows memory first (app.js:457), video alert after response (437-445). Local `scannedTokens` set is display-only | Queued only on fetch rejection or 5xx (116-146); also queued if `connected` is false (98-101); cap 100, drops oldest (171-173) |
| P2 | PWA: orchestratorIntegration.js:271 | POST /api/scan/batch {batchId, transactions[]} | scanRoutes.js:202 | playerScans entries; replayed scans never queue video (354-362) | None | 200 with per-item results; 4xx; 5xx. Also `batch:ack` WS event (no listener, see Conclusion 9d) | Snapshot kept until 200 or 4xx (PS-1) | Retries every 10 s tick (441-447) |
| P3 | PWA: orchestratorIntegration.js:426 | GET /health?deviceId&type=player | healthRoutes.js:25 | Device record, type player (sessionService.updateDevice); heartbeat | None | ok flag | `connected` flag | every 10 s (463-471) |
| P4 | PWA: js/app.js:64, 74 | GET ./data/tokens.json (fallback ./tokens.json) | express.static or PACK_PATH route (app.js:131-143) | none | None | file | token DB | demo data fallback |
| P5 | PWA: app.js:105 | GET /api/pack/manifest (networked) or ./data/pack-manifest.json | packRoutes.js:19 | none | None | identity | display only | ignores failure |
| P6 | PWA: config.html:398, 414 | GET http://host:8000/health, no-cors discovery probe | HTTP redirect server | none | None | opaque | URL list | |
| E1 | ESP32: services/OrchestratorService.h:216 | POST /api/scan, one attempt, 10 s | scanRoutes.js:19 | as P1 | None | classified by ScanResponse.h:51-75 | Display after outcome (Application.h:570-597) | RETRY_QUEUE -> queue.jsonl (Application.h:581, OrchestratorService.h:256-307); cap 100 FIFO (config.h:63-65) |
| E2 | ESP32: OrchestratorService.h:531 | POST /api/scan/batch, 30 s, up to 6 tries (1020-1050) | scanRoutes.js:202 | as P2 | None | 200 only counts as success (541-548) | Removes uploaded entries | Entries stay on any non-200 |
| E3 | ESP32: OrchestratorService.h:346 | GET /health?deviceId (no `type`) | healthRoutes.js:25 | Device record, registered as type player (healthRoutes.js:54) | None | ok + timezone | connection state | background task every 10 s (config.h:42, OrchestratorService.h:1270) |
| E4 | ESP32: TokenService.h:217 (binary file, read with grep -a) | GET /api/tokens | resourceRoutes.js:53 | none | None | token JSON | local tokens.json | cached copy |
| E5 | ESP32: AssetService.h:102 | GET /api/assets/manifest | resourceRoutes.js:71 | none | None | manifest | local manifest diff | abort |
| E6 | ESP32: AssetService.h:200 | GET /api/assets/images/<id>.bmp, /api/assets/audio/<id>.<ext> | resourceRoutes.js:89, 116 | none | None | file | SD file with sha1 check | retried next boot |
| S1 | Scoreboard: scoreboard.html (served page) | GET /scoreboard | resourceRoutes.js:225 | Mints an OBS token into the page (204-205) | None | HTML | n/a | |
| S2 | Scoreboard: scoreboard.html:1493 | GET /api/tokens | resourceRoutes.js:53 | none | None | JSON | owner totals | logs error |
| S3 | Scoreboard: scoreboard.html:1231 | GET /api/pack/files/game.json | packRoutes.js:34 | none | None | JSON | money format, evidence modes | baked fallback |
| C1 | Config tool: config-tool/lib/toolAuth.js:86 | POST /api/admin/auth {password} at tool login | adminRoutes.js:17 | OP token held server-side by the tool | Password | token | kept in `_orchestratorToken` | login still succeeds if orchestrator is down (92-95) |
| C2 | Config tool: lib/routes.js:399 | GET /api/music/tracks via proxy | musicRoutes.js:9 | none | None | JSON | none | 502 to SPA |
| C3 | Config tool: lib/routes.js:411 | GET /api/music/playlists | musicRoutes.js:21 | none | None | JSON | none | 502 |
| C4 | Config tool: lib/routes.js:428 | PUT /api/music/playlists | musicRoutes.js:40 | Playlist file (musicService) | Bearer OP with show-control | `{ok:true}` or 400/401/503 | none | 502; 401 if no token held |
| X1 | Config tool: lib/routes.js:299 | GET {HOME_ASSISTANT_URL}/api/states | Home Assistant, not the orchestrator | none | HA token | scenes | | empty list |

The config tool's SPA calls only its own server (public/js/utils/api.js:30, relative `/api`). The service workers (ALNScanner/sw.js, aln-memory-scanner/sw.js) re-issue same-origin requests and treat /api/* and /health as network-first (ALNScanner/sw.js:148-154); they add no new endpoints.

### 1d. Route files and what reaches them

| File | Handlers | Receives from |
|---|---|---|
| adminRoutes.js | POST /auth (17), GET /logs (58) | /auth from GM wizard and config tool. /logs receives nothing from any client in this repo (grep "admin/logs" finds only the route and its docs) |
| healthRoutes.js | GET /health (25) | GM scanner, PWA, ESP32 |
| musicRoutes.js | GET /tracks, GET /playlists, PUT /playlists | config tool only |
| packRoutes.js | GET /pack/manifest, /pack/files/* | GM scanner, PWA, scoreboard |
| resourceRoutes.js | GET /tokens, /assets/manifest, /assets/images/:file, /assets/audio/:file, /vocabulary, /scoreboard(.html) | /tokens: ESP32, scoreboard. /assets: ESP32. /scoreboard: venue browser. /vocabulary receives nothing (config tool serves its own copy, lib/routes.js:206) |
| scanRoutes.js | POST /, POST /batch | PWA, ESP32 |
| sessionRoutes.js | GET / | GM scanner (StateValidationService) |
| stateRoutes.js | GET / | GM scanner wizard |

resourceRoutes is mounted twice (app.js:119 at /api, app.js:122 at /), so /tokens, /scoreboard and the rest also answer at the root, and /api/scoreboard exists. The rate limiter covers `/api/` only (app.js:110), so /health, /scoreboard and the root aliases are exempt.

---

## 2. Commands

### 2a. What the GM scanner can send

Greps (run from the repo root):

```
# A: controller sites (one literal action each)
grep -rn "sendCommand(this\.connection" ALNScanner/src                 -> 54 lines
# B: NetworkedStorage fire-and-forget sites
grep -rn "this\._emitCommand(" ALNScanner/src                          -> 7 lines
# C/D: the two other literal sites
grep -rn "orchestratorClient\.sendCommand(" ALNScanner/src             -> 1 line (teamRegistry.js:301, session:addTeam)
grep -rn "emit('gm:command'" ALNScanner/src                            -> 3 lines (orchestratorClient.js:245 generic, NetworkedStorage.js:51 generic, gameAdmin.js:335 system:reset)
```

Distinct actions after de-duplication: 54 (A) + session:addTeam (C) + system:reset (D) = 56. The 7 `_emitCommand` actions (transaction:delete, score:adjust, session:create, session:end, session:pause, session:resume, score:reset) all also appear in A, so they add nothing new. The list is in section 1b rows 1-56. No sender uses a computed action name (every call passes a string literal).

### 2b. What the executor accepts

```
grep -nE "^      case '[A-Za-z:-]+'" backend/src/services/commandExecutor.js   -> 59 labels
sed -n 1764,1822p backend/contracts/asyncapi.yaml                             -> 59 enum entries
```

`default` at commandExecutor.js:963 answers "Unknown action". `system:reset` has a case that only throws (570-574) because adminEvents.js:53 handles it first.

### 2c. The difference

```
comm -23 scanner_actions executor_cases   -> empty   (scanner sends nothing the executor lacks)
comm -13 scanner_actions executor_cases   -> music:seek, transaction:create, video:seek   (3)
comm -23 executor_cases contract_enum     -> empty
comm -13 executor_cases contract_enum     -> empty
```

Table-only names with no case (would hit `default`): `service:restart`, `service:out-of-service`, `service:in-service`, `preflight:run` (commandExecutor.js:98-101). They sit in `REQUIRED_PAYLOAD_FIELDS` and in the floor prefix list (grants.js:78-84) but not in the contract enum.

### 2d. Which actions cues can also fire

`CUE_ACTIONS` has 24 keys (cueValidation.js:91-116). Dispatch of any non-GM source is refused for names outside that set (commandExecutor.js:136-143).

```
sound:play sound:stop lighting:scene:activate (payload carries role, not sceneId)
video:queue:add video:play video:pause video:stop video:skip video:seek
music:play music:pause music:stop music:next music:previous music:setVolume music:setShuffle music:setLoop music:loadPlaylist music:seek
display:scoreboard display:idle-loop display:return-to-video
audio:route:set audio:volume:set
```

22 of the 24 are GM-sendable. The 2 cue-only (never sent by a scanner) are `music:seek` and `video:seek`. The 35 executor actions that cues cannot fire: all session:*, score:*, transaction:*, system:reset, bluetooth:*, cue:*, held:*, scoreboard:page:*, display:status, lighting:scenes:refresh, service:check, video:queue:clear, video:queue:reorder.

---

## 3. Acknowledgements and their races

### R1. Token claimed at submit time (the primary case)

Order of events for one consuming scan on a connected station:

1. `processNFCRead` checks the local Set (gameOps.js:253) and the local session status copy (233-241).
2. `recordTransaction` marks the token (gameOps.js:329-331), which also persists the Set under `networkedScannedTokens:<sessionId>` (unifiedDataManager.js:477-482, NetworkedStorage.js:67-75).
3. `queueTransaction` persists the entry (networkedQueueManager.js:53-54) and sends it if `client.isConnected` (59-68).
4. The green result screen and stats update run right after (gameOps.js:375-376). The screen shows locally computed points (gameOps.js:319-323), not the backend's.
5. Backend: validate (adminEvents.js:195), offline flag (203, never true in production, see below), session status (247), `processScan` (transactionService.js:154-300), then `transaction:result` (292). `transaction:new` follows after the save (persistenceListeners.js:110-111).
6. Scanner reaction by `status`:

| Reply | Queue entry | Mark | GM sees |
|---|---|---|---|
| accepted | removed | kept (correct) | nothing new; `transaction:new` updates cache and re-marks (NetworkedStorage.js:378-381) |
| duplicate (carries `claimedBy`) | removed | kept (correct) | toast "claimed by X"; result screen repainted only if still on the same token (app.js:235-254) |
| rejected (invalid token) | removed | unmarked (app.js:261-262) | toast "Scan rejected" |
| error (session paused or not active, adminEvents.js:247-259) | removed | unmarked | toast; scan is lost, GM must rescan |
| `error` event (VALIDATION_ERROR, SESSION_NOT_FOUND, QUEUE_FULL, AUTH_REQUIRED) | kept | kept | generic toast "Server error" (app.js:198-202); no unmark |
| queued (backend offline flag) | kept | kept | nothing |
| no reply in 30 s or socket drop | kept | kept | nothing until reconnect |

7. After a drop, the handshake `sync:full` carries this device's `deviceScannedTokens`. `reconcileWithServerState` drops queued consuming entries the server already recorded (networkedQueueManager.js:132-149), then `syncQueue` replays the rest.

Notes.

- The backend "offline" path that answers `queued` is dead in production. `setOfflineStatus` has no caller outside offlineQueueService.js (grep over backend/src), and the service header says so (offlineQueueService.js:14-17). The `queued` branch in the scanner is therefore only reachable in tests.
- The unmark gap is Conclusion 4: no unmark on `transaction:deleted`. What the GM sees. After an admin deletes a transaction, the token's history row disappears, scores drop (broadcast), and a rescan on any station shows "Token Already Scanned" (gameOps.js:253-256) though the backend would accept it. A reload does not help (rehydrate, NetworkedStorage.js:83-96). Only a new session id, `score:reset`, or manual localStorage edit clears it.
- Looped `error` events (Conclusion 5) produce one toast per `sync:full` per stuck entry. `sync:full` also arrives from every `sync:request` (MonitoringDisplay `_requestInitialState`) and from several server broadcasts (broadcasts.js:103, 325, 367).
- Mark vs broadcast on other stations. A second station that gets `transaction:new` marks the token fleet-wide (NetworkedStorage.js:365-381). Between the first station's accept and that broadcast, a second scan on station 2 passes the local check and is refused by the backend as duplicate. That is the intended last line of defence.
- The `transaction:new` broadcast carries no clientTxId, so the submitter cannot tie it to its own submit; it matches on `transaction.id` only for cache de-duplication.
- Reply order (inference): result first, broadcast second. If `saveCurrentSession` rejects, the catch at persistenceListeners.js:122 logs and `transaction:added` is never emitted. Result: accepted for the submitter, no `transaction:new` for anyone, score not pushed, until the next `sync:full`.

### R2. gm:command ack plus broadcast (two sources)

Applies to every row in 1b. The ack reports the executor's return value only. State arrives separately as `service:state`, `session:update`, `score:adjusted`, `transaction:deleted`, `display:mode`, or `cue:*` events. The two paths are not ordered with respect to each other.

- Ack true, state late or never. The GM sees a success toast and an old screen. Nothing re-requests state except a reconnect or the next `sync:full`.
- Ack false, state changed. Possible when the executor throws after a side effect. Example (inference): `audio:route:set` applies the route then persists it (commandExecutor.js:618-619); a persist failure acks false with the sink already switched, and `service:state` audio shows the new route.
- Ack timeout (5 s default, CommandSender.js:31-34). The GM sees "<action> timeout after 5000ms" while the command may still run. A late ack is ignored (listener removed). Slow actions with explicit longer timeouts: bluetooth pair 45 s, connect 30 s, unpair and disconnect 15 s. `session:create`, `system:reset`, `lighting:*` and `service:check` use 5 s.
- Same-action overlap through `CommandSender`: both listeners match on action only (CommandSender.js:44), so the first ack settles both promises. If press 1 succeeds and press 2 would have failed ("No video playing"), the GM sees two successes. `OrchestratorClient.sendCommand` serializes (orchestratorClient.js:189-202), but only `session:addTeam` uses it.
- Rejected before an ack exists. A non-GM socket gets an `error` event `AUTH_REQUIRED "Not authorized"` (adminEvents.js:32-37), not an ack. `CommandSender` ignores `error` events, so the GM waits out 5 s and sees a timeout, while the global handler clears the token and reopens the wizard (messageRouters.js:157-167).
- Floor refusal does produce an ack (`success:false`, commandExecutor.js:157-161; system:reset at adminEvents.js:56-61).
- Disconnect while waiting. `OrchestratorClient._cleanup` drops chains (orchestratorClient.js:381); `CommandSender` has no disconnect hook, so the pending command times out at 5 s.

### R3. system:reset

Sender (gameAdmin.js:306-340) registers a one-shot ack listener, re-registers it on foreign acks (319-322), times out at 5 s, then sends `session:create`. Backend order: archive and end the session, tear down listeners, reset every service, rotate observe tokens, re-init services, ack. Local copies on every GM station (transactions, scores, claim Set) are not cleared by the reset itself; they clear when the new session's `session:update` arrives with a new id (networkedSession.js:246-259, which also calls `clearQueue`). Between reset and create, stations keep the old session's data and claim locks. The scoreboards lose their observe tokens at the reset (systemReset.js, `invalidateObserveTokens`); their live sockets stay up until a reconnect is needed, then reload.

### R4. session:addTeam

Sender waits for the ack, then adds the team to its own registry (teamRegistry.js:301-308). Two GMs typing the same new name: the second ack is false "Team ... already exists" (sessionRegistry.js:26-29) though the team now exists; the GM sees an error and `session:update` fills the dropdown a moment later. `hasTeam` is checked first against the local copy (teamRegistry.js:222). Separate point: a scan for a team name never added still succeeds, because scoring auto-creates the row (transactionService.js:265, 381).

### R5. score:adjust and transaction:delete

Sender waits for the ack, then shows a toast and clears inputs (gameOps.js:584-593, 626-629). The score and history views update from `score:adjusted` and `transaction:deleted`. Two sources, no local optimistic change. If the broadcast is lost, the cache stays stale until `sync:full` (setTransactions replaces it).

### R6. Player scanners (HTTP response is the only source)

- PWA: marks its own `scannedTokens` and shows the memory before the response (app.js:442-457). That set has no backend authority; `session.playerScans` is the log. Video alert waits for the response (A4).
- ESP32: single attempt, then display (Application.h:570-597). 409 `status:rejected` shows "VIDEO UNAVAILABLE"; 409 SESSION_NOT_FOUND shows a NO SESSION screen and does not queue.
- Both rely on a connection flag refreshed every 10 s (PWA orchestratorIntegration.js:463-471, ESP32 config.h:42). In the stale window the PWA queues instead of sending (98-101); the ESP32 sends, fails, and queues.

### R7. Handshake and reconnect

Outcome is `connect_error` text. The GM scanner parses the prefix (orchestratorClient.js:353-357). `AUTH_INVALID` and `AUTH_REQUIRED` clear the token and reopen the wizard; `DEVICE_ID_COLLISION` and transport errors retry (connectionManager.js:165-197). The collision window: a fast reconnect while the server still lists the old socket is refused (socketServer.js:93-104); the client waits for server confirmation of its own disconnect before reopening (orchestratorClient.js:77-86).

---

## 4. Connections and identity

| Client | Transport and handshake or headers | Authentication | How the backend records it | On disconnect | On reconnect |
|---|---|---|---|---|---|
| GM scanner | WebSocket (`transports:['websocket']`), `auth {token, deviceId:'GM_Station_N', deviceType:'gm', version:'1.0.0', packHash}`. HTTP: none of its HTTP calls carry credentials | Password to POST /api/admin/auth gives a 24 h JWT (claims id, role admin, tier operator, class staffed, deviceId, functions, packHash; auth.js:53-70). Handshake verifies store membership plus signature plus audience (auth.js:91-121). Station name comes from /api/state (connectionWizard.js:204-227) | `socket.*` fields (socketServer.js:109-127); `DeviceConnection.fromIdentify` named "GM Station v1.0.0" with IP (gmAuth.js:66-76); `session.connectedDevices` via `updateDevice` (gmAuth.js:120); `device:connected` from `device:updated` listener (broadcasts.js:159-178); capacity cap `maxGmStations` 5 (config/index.js:39, gmAuth.js:84) | `handleDisconnect` marks the record `disconnected` and broadcasts `device:disconnected` reason manual (deviceTracking.js:27-35, deviceHelpers.js:23-39). GM liveness uses socket.io ping/pong (25 s interval, 60 s timeout, config/index.js:76-77). Client side: ConnectionManager reconnects unless the reason is client-initiated (connectionManager.js:241-273) | New socket, fresh handshake, new `sync:full` with `deviceScannedTokens` (gmAuth.js:150-184). Router restores scores, transactions, player scans, session state, store domains, then reconciles and flushes the queue (messageRouters.js:92-155). Session-id change clears the queue (networkedSession.js:246-259). A restarted backend has an empty token store, so reconnect gets `AUTH_INVALID` and the wizard (auth.js:94-96) |
| Scoreboard | Same WebSocket; `deviceType:'gm'` asserted, token is an observe token minted per page serve (resourceRoutes.js:204-205) | Observe store, signature, audience, tier device and class display (auth.js:160-179) | Verified tier decides display status (gmAuth.js:61); NO device record; `socket.deviceId` forced to the token claim `SCOREBOARD` (socketServer.js:122-124); joins rooms; collision check skipped for ids starting `SCOREBOARD_` (socketServer.js:85-86), which any client may claim | Handler finds no device record, no-op | socket.io reconnects with the same token. Expired or rotated token gives `AUTH_INVALID`, page reloads for a new token (scoreboard.html:1631-1634). Rotation happens at `system:reset` (systemReset.js, `invalidateObserveTokens`). Handlers send `sync:request` on `connect` (1585-1591); `socket.on('reconnect')` at 1637 is probably never fired by the Socket (inference: socket.io v4 emits it on the Manager) |
| Web player scanner | HTTP only. Body `deviceId` (`PLAYER_<ms>`, kept in localStorage `device_id`, orchestratorIntegration.js:20-29), `deviceType:'player'`. Heartbeat is `GET /health?deviceId&type=player` | None | Only /health registers it (healthRoutes.js:72-93): `DeviceConnection` type player, name "Player Scanner", IP, in `session.connectedDevices`. `/api/scan` does not touch the device record. With no session, nothing is recorded (95-100); the comment there says it registers at session creation, but `initializeSessionDevices` only walks sockets (broadcasts.js:640-681), so it registers on the next /health tick (inference) | No message. Heartbeat monitor checks every 15 s, times out after 30 s, marks disconnected, broadcasts `device:disconnected` reason timeout (heartbeatMonitorService.js, deviceHelpers.js) | Next /health with the same id counts as reconnection and broadcasts `device:connected`. Queue replay starts on the connected flag flipping (orchestratorIntegration.js:435-437) |
| ESP32 scanner | HTTPS with certificate checks off (`setInsecure`, OrchestratorService.h header note at 917) and a fresh client per request. `deviceId` from config or MAC. Heartbeat is `GET /health?deviceId=...` with no `type` | None | Registered as type player, not esp32, because `type` defaults to player (healthRoutes.js:54). Scan bodies say `esp32` but the device list does not | Same timeout path as PWA. A health-check retry loop can take about 61 s when the orchestrator is down (httpWithRetry, OrchestratorService.h:1020-1050) | Core-0 task every 10 s: health, then batch upload of 10 (config.h:42, OrchestratorService.h:1293-1306). Batch id stable across HTTP retries and unique per boot (BatchId.h) |
| Config tool | Own HTTP server on port 9000 (server.js:13). To the orchestrator: plain `fetch` with 5 s timeout. No WebSocket | Own JWT, aud config-tool, signed with the backend's JWT_SECRET read from backend/.env (toolAuth.js:100-141). Orchestrator token fetched at login with the same password (toolAuth.js:83-96) and held server-side | Not recorded: no handshake, no `/health` call, no device record | n/a | Token re-fetched only at the next tool login. If the orchestrator was down at login, PUT playlists returns the backend's 401 (routes.js:423-426) |

Session boundary, restated for the pass: GM stations are the only senders with a socket identity. Player scanners and ESP32 are identified only by the `deviceId` strings they choose.

---

## 5. Contract check

AsyncAPI is backend/contracts/asyncapi.yaml, OpenAPI is backend/contracts/openapi.yaml.

| Inbound item | Contract (line) | Code (line) | Match |
|---|---|---|---|
| Handshake auth fields | asyncapi 20-51 | socketServer.js:50-127 | Mostly. Mismatch: `admin` deviceType never authenticates (code treats only `'gm'`). Contract says invalid deviceType is rejected (asyncapi 56-58); code lets it through unauthenticated (socketServer.js:151-152). Observe-token path matches (asyncapi 42-47) |
| sync:request | asyncapi 130-145 | server.js:75-104 | Match (bare event, no envelope). The reply adds `deviceScannedTokens` but not `reconnection` (server.js:96-99); SyncFull documents both (asyncapi 869, 884) |
| transaction:submit | asyncapi 900-970 | adminEvents.js:150-318, validators.js:173-182 | Partial. Contract requires deviceId in `data`; server overwrites it with the socket's (adminEvents.js:189-193). Scanner also sends `deviceType` and `timestamp` inside `data`; neither is in the contract `data` properties (asyncapi 934-965). Server schema accepts both. Flow text at 910-915 repeats `transaction:new` twice |
| transaction:result | asyncapi 972-1045 | adminEvents.js:207-292 | Match on status enum (accepted, duplicate, error, queued, rejected) and clientTxId echo. `error` carries SESSION_PAUSED or SESSION_NOT_ACTIVE (adminEvents.js:248-249); the contract field has no enum, so no mismatch |
| error (with clientTxId) | asyncapi 2338-2399 | adminEvents.js:153-170, 227-243, 307-316 | Match. Code enum values emitted all appear in the enum. Contract line 2395 says clients must display errors; the queue manager does not treat them as final (Conclusion 5) |
| gm:command | asyncapi 1695-1928 | commandExecutor.js:227-969 | Enum matches 59 to 59. Payloads are `type: object` with no per-action schema except prose for `session:start`, bluetooth, audio:route:set, lighting. Prose list at 1707-1716 omits most actions and names "toggle" (not in enum). Scanner payload keys checked against executor reads for all 56 sent actions; all agree |
| gm:command:ack | asyncapi 1930-1979 | adminEvents.js:118-122 | Match (`{action, success, message}`) |
| POST /api/admin/auth | openapi 49-150 | adminRoutes.js:17-51 | Match for 200 and 401. Not checked line by line for 400 shape |
| GET /api/vocabulary | openapi 151-200 | resourceRoutes.js:168-176 | Match; no client sends it |
| GET /api/tokens | openapi 202-282 | resourceRoutes.js:53-65 | Shape matches. "Usage" text is stale (GM scanner and PWA do not call it). `lastUpdate` is the request time (resourceRoutes.js:60), not a data time |
| GET /api/assets/manifest, images, audio | openapi 283-470 | resourceRoutes.js:71-138 | Not compared field by field |
| GET /api/pack/manifest, /files/* | openapi 473-604 | packRoutes.js:19-43 | Match in routes |
| GET /health | openapi 606-700 | healthRoutes.js:25-113 | Mismatch. Query parameters `deviceId` and `type`, the device-registration side effect, and the 400 for any type but player are undocumented. Response fields match |
| POST /api/scan | openapi 701-923 | scanRoutes.js:19-175 | Match for 200, both 409 shapes, 404, 400, 503. Description says the scanner "IGNORES response body" (715-716); both scanners now parse it |
| POST /api/scan/batch | openapi 925-1130 | scanRoutes.js:202-421 | Response shape matches. Undocumented: batches with no session report `processed` but persist nothing (scanRoutes.js:317-352); idempotency cache is in memory (183) and lost on restart |
| GET /api/session | openapi 1132-1190 | sessionRoutes.js:16-56 | Match |
| GET /api/state | openapi 1192-1340 | stateRoutes.js:32-74 | Shape from `buildSyncFullPayload`; not compared field by field |
| GET /api/admin/logs | openapi 1341-1445 | adminRoutes.js:58-109 | Match on bearer security; no sender |
| GET /api/music/tracks, /playlists; PUT /playlists | openapi 1446-1600 | musicRoutes.js:9-168 | Match on routes and PUT security |
| GET /scoreboard, /scoreboard.html | not in OpenAPI | resourceRoutes.js:225 | Undocumented endpoint that mints a credential |
| Static mounts (/gm-scanner, /player-scanner, /videos, /audio) | not in OpenAPI | app.js:143, symlinks in backend/public | Undocumented |
| batch:ack (server to device room) | asyncapi 2058-2150 | scanRoutes.js:395-416 | Text describes the wrong sender (GM) and a 60 s client wait that no client implements |

Counts: 18 route handlers in code (grep in 1d); OpenAPI documents 17 operations (grep `operationId`). The difference is /scoreboard and /scoreboard.html counted as one route with two paths in code, undocumented in OpenAPI.

---

## 6. Questions with several answers

Each entry lists the question, every place that answers it, and a disagreement scenario.

**Q1. May this GM scan be accepted (is the token already claimed)?**
Answers: (a) scanner local Set check gameOps.js:253, fed by optimistic marks, localStorage, per-device `deviceScannedTokens`, and live broadcasts (NetworkedStorage.js:154, 378-381, 458); (b) queue reconcile at reconnect networkedQueueManager.js:132-149; (c) backend `duplicatePolicy.checkDuplicate` per device plus first-come over session.transactions (duplicatePolicy.js:83-117, called at transactionService.js:206), the authority; (d) standalone LocalStorage (out of scope here).
Disagreements. After `transaction:delete`: (a) says claimed, (c) says free. A station that reconnected after a gap: (a) says free, (c) says claimed by another station. After a looped `error` event: (a) says claimed, (c) never saw it.

**Q2. Is the session in a state that allows GM scans?**
Answers: scanner copy `dataManager.sessionState.status` (gameOps.js:233-241); adminEvents.js:247-265; transactionService.js:154-160 (returns `rejected`, a different status word than adminEvents' `error`).
Disagreement. Station A's copy says active; another GM paused a moment ago and the `session:update` has not arrived. Backend answers `error`/SESSION_PAUSED; the scanner already showed green, then unmarks and toasts. The `rejected` path in processScan is only reachable if the session changes between the two checks; with no await between them (adminEvents.js:247 to 269), I found no real window.

**Q3. Is this a valid team?**
Answers: teamRegistry `selectTeam` (any non-empty trimmed string, teamRegistry.js:208-228); executor `session:addTeam` (trim, non-empty, unique, commandExecutor.js:295-316, sessionRegistry.js:26-29); `gmTransactionSchema.teamId` (trim, non-empty, no existence check, validators.js:175); scoring auto-create (transactionService.js:265, 381). sessionRegistry.js:12 says all teams must be created via addTeamToSession.
Disagreement. A scan submitted for a team name the session never created succeeds and creates the team with a warning.

**Q4. Is this mode valid, and how many points did it earn?**
Answers: scanner `settings.mode` and local scoring (gameOps.js:319-323, scoring.js from the scanner's loaded pack); backend `packDeclaredMode` (validators.js:21-30) and `scoring.pointsFor` (transactionService.js:240). The result screen uses the scanner's number; `transaction:result.points` is not displayed.
Disagreement. Scanner running a stale pack (handshake `packHash` differs): backend only warns in its log (socketServer.js:139-148), nobody tells the scanner. Either points differ silently, or the mode is refused with VALIDATION_ERROR on every replay (Conclusion 5).

**Q5. Does this token exist?**
Answers: scanner fuzzy match against its pack (gameOps.js:246, tokenManager); backend exact lookup (transactionService.js:177); ESP32 local `tokens.json` gate before sending (Application.h:540-548); PWA local `tokens.json`.
Disagreement. Scanner pack has a token the backend lacks: scanner shows success, backend answers `rejected`, scanner unmarks and toasts. ESP32 never sends unknown ids, so the backend's 404 path (scanRoutes.js:64-70) is unused by it.

**Q6. Is this scan timestamp acceptable?**
Answers: POST /api/scan accepts any ISO date (scanRoutes.js:22, validators.js:168); POST /api/scan/batch rejects anything before 2020 (scanRoutes.js:179, 272).
Disagreement. ESP32 scan stamped `1970-01-01T...` before SNTP (Application.h:665-673): sent live, it is stored with that time; the identical scan taken offline and queued comes back `failed`, and the ESP32 deletes the batch on HTTP 200 (OrchestratorService.h:541-545). Lost without a trace (inference on timing).

**Q7. Is a 4xx reply final, or should the scan be retried?**
Answers: PWA says final for all 4xx (orchestratorIntegration.js:148-166, 333-356). ESP32 says final only for 409 SESSION_NOT_FOUND and 409 rejected; everything else, including other 4xx, goes to the queue (ScanResponse.h:51-75), and its HTTP helper retries 5xx and connection failures but stops at 404 and 409 (OrchestratorService.h:1020-1035).
Disagreement. A 429 from the rate limiter (app.js:110, 100 requests per minute per IP on /api/): PWA drops the scan or batch, ESP32 keeps it.

**Q8. Is this station name free?**
Answers: /api/state device list at wizard time (connectionWizard.js:218-223); handshake collision check against `session.connectedDevices` (socketServer.js:89-104).
Disagreement. Two stations read the list before either connects, both pick GM_Station_2; one is refused at handshake and the saved name is reused on later attempts (connectionWizard.js:193-199). With no session both checks are blind: the list is empty and the handshake check is skipped, so two sockets share one id (inference on the downstream effect: one device record, shared claim registry, one disconnect marks it disconnected).

**Q9. Is the orchestrator reachable?**
Answers: GM `checkHealth` before each connect (connectionManager.js:61-78) and socket state; PWA `connected` flag (10 s poll, orchestratorIntegration.js:418-471); ESP32 `ORCH_CONNECTED` (10 s task). Backend answers only by replying.
Disagreement. Within the poll gap the PWA queues a scan though the server is up, or sends one though it just went down. Both end up recorded eventually.

**Q10. Is this client's pack current?**
Answers: backend compares `packHash` at handshake and logs a mismatch (socketServer.js:139-148); `/health.pack` exposes the server identity (healthRoutes.js:41) but GM `checkHealth` reads only `response.ok`; PWA shows identity on its config page only (app.js:98-124). No component acts on a mismatch.

**Q11. May this caller run this command?**
Answers: handshake tier (socketServer.js:71-79); `handleGmCommand` requires `deviceType === 'gm'` on the socket (adminEvents.js:32); the system:reset floor check (54-62); the executor floor (commandExecutor.js:152-163); the cue-source vocabulary (136-143); `transaction:submit` checks `tier === 'operator'`, not a function (adminEvents.js:165).
Disagreement. None found today, because v1 operator tokens carry the whole floor. The mechanisms differ in kind (tier for transactions, functions for commands), which will matter when restricted tokens exist.

---

## Completion check

Counted, with commands (run from /home/user/ALN-Ecosystem; the action lists were built from the greps below and diffed with `comm`):

| What | Count | Command |
|---|---|---|
| Scanner `sendCommand(this.connection` sites | 54 | `grep -rn "sendCommand(this\.connection" ALNScanner/src \| wc -l` |
| `_emitCommand(` sites | 7 | `grep -rn "this\._emitCommand(" ALNScanner/src \| wc -l` |
| Other literal gm:command senders | 2 distinct actions | teamRegistry.js:301, gameAdmin.js:335 |
| Distinct actions the scanner can send | 56 | union of the above, `sort -u` |
| Executor case labels | 59 | `grep -oE "^      case '[A-Za-z:-]+'" backend/src/services/commandExecutor.js \| sort -u \| wc -l` |
| AsyncAPI enum entries | 59 | `sed -n 1764,1822p backend/contracts/asyncapi.yaml` |
| `CUE_ACTIONS` keys | 24 | `sed -n 91,116p backend/src/gameRules/cueValidation.js` |
| Executor minus scanner | 3 (music:seek, transaction:create, video:seek) | `comm -13` |
| Scanner minus executor | 0 | `comm -23` |
| GM scanner WebSocket send sites | 8 | `grep -rnE "socket\.emit\(\|client\.send\(\|connection\.send\(" ALNScanner/src` (MonitoringDisplay.js:197, CommandSender.js:62, gameAdmin.js:335, orchestratorClient.js:161 and 245, networkedQueueManager.js:348, NetworkedStorage.js:51 and 137), all in section 1 |
| GM scanner `fetch(` sites | 7 | `grep -rnw "fetch(" ALNScanner/src` (connectionWizard.js:83, 204, 339, 350; StateValidationService.js:125, 148; connectionManager.js:66), all in 1c |
| packLoader `_fetch(` sites | 3 | `grep -n "this\._fetch(" ALNScanner/src/core/packLoader.js` (136, 222, 394) |
| PWA `fetch(` sites | 6 (+2 in config.html) | `grep -n "fetch(" aln-memory-scanner/js/*.js` and config.html:398, 414 |
| Scoreboard sends | 2 fetches, 1 `io(`, 2 `sync:request` emits | `grep -nE "fetch\(\|io\(\|socket\.emit\(" backend/public/scoreboard.html` |
| Config tool `fetch(` sites | 5 (4 to the orchestrator, 1 to Home Assistant) | `grep -rn "fetch(" config-tool/lib config-tool/server.js` |
| ESP32 HTTP call sites | 8 sites, 6 distinct requests (E1 to E6) | `grep -rnE "_http\.http(GET\|POST)\(\|httpGETWithRetry\(\|httpPOSTWithRetry\(\|httpGETStreamToSD\(" arduino-cyd-player-scanner/ALNScanner_v5 -a` |
| Backend route handlers | 18 in 8 files | `grep -cE "router\.(get\|post\|put\|delete)\(" backend/src/routes/*.js` |
| Backend socket handlers | 4 (`sync:request`, `gm:command`, `transaction:submit`, `disconnect`) plus the connection and `io.use` middleware | `grep -n "socket\.on(\|io\.on(" backend/src` |
| Routes that receive nothing from these clients | 2 (GET /api/admin/logs, GET /api/vocabulary) | `grep -rn "admin/logs\|api/vocabulary"` over the sender scopes |

Every route file in backend/src/routes appears in 1c or 1d.

## Terms CONTEXT.md lacks

- Handshake (the Socket.io connection-time `auth` object and its middleware checks).
- Acknowledgement or ack, as a named kind of delivery path (reply to the sender only), versus broadcast.
- Broadcast and room (who receives an emit).
- Claim mark (the GM scanner's local, optimistic record that a token is claimed, and its unmark). CONTEXT.md has "claim" and "copy", not this.
- Offline queue (client side), and the correlation id (`clientTxId`).
- Heartbeat (HTTP `/health` with a device id, used as liveness for player scanners).
- Device record (an entry in `session.connectedDevices`).
- Operator token and observe token appear once in CONTEXT.md but have no entry of their own.
- `sync:full` and `gm:command` are not defined as terms.
