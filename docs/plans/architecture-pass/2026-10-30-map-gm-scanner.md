# Map of the GM scanner's copies of runtime state

Reader sheet for the architecture pass. Scope is every `.js` file under `ALNScanner/src/` (67 files, 16486 lines) plus `ALNScanner/index.html` for structure. Tree read: branch `claude/nice-curie-hescfv`, HEAD `b756a280`. `git diff --stat 26fc2f2 HEAD -- ALNScanner backend/src` printed nothing, so the code matches the named commit. ALNScanner is at its pin `e83723c` with a clean tree. I ran no test, server or git write command. Nothing here was executed; every runtime claim is a read of code, and anything I reasoned out is marked "inference".

Terms follow `CONTEXT.md` section 4b (runtime state, authority, copy, delivery path) and section 2 (one truth, verdict). Concepts CONTEXT.md lacks are named plainly and listed at the end.

Backend files were read only where needed to name the authority or to check a scanner claim. Paths starting `backend/` are under `backend/src/` (except `backend/public/`). Scanner paths without a prefix are under `ALNScanner/src/`.

## Conclusions

1. The scanner holds copies on three delivery paths, not two. Service domains go `service:state` to `StateStore` to `MonitoringDisplay` subscriptions to renderers. Transactions, scores, claims and player scans go through `messageRouters.js` to `UnifiedDataManager` to `NetworkedStorage`. The game session and the team list go a third way: `MonitoringDisplay._handleMessage` listens to `message:received` directly (MonitoringDisplay.js:35, :216-258) and feeds `SessionRenderer` and `TeamRegistry`, while `gameAdminRouter` feeds `UnifiedDataManager.sessionState` from the same event. The game session therefore has two parallel consumers of one event, with different merge rules.
2. `sync:full` is the only repair mechanism, and each copy treats it differently. Replace: transactions, player scans, all 10 StateStore domains, TeamRegistry, device list. Per-record replace that never prunes: `backendScores`. Union: the claimed-token set. Merge: `sessionState`. See section 2 and section 6.
3. The scanner never marks a copy stale. On socket drop nothing is cleared and no domain is flagged. The orchestrator-status dot in the admin panel is only redrawn on `sync:full` and on admin-tab open (MonitoringDisplay.js:338, :376), never on disconnect. The header dot is separate (connectionManager.js:44-46).
4. A claimed token is never released locally when the backend releases it. `transaction:deleted` carries `tokenId` (backend/websocket/broadcasts.js:259), but `gameOpsRouter` ignores it (messageRouters.js:47-54) and `removeTransactionFromBroadcast` does not touch `scannedTokens` (NetworkedStorage.js:394-403). The only unmark call is on a failed scan (app.js:262). After a GM deletes a transaction, the scanner's own duplicate check (gameOps.js:253) keeps refusing the re-scan until a page reload or new game session, while the backend would accept it.
5. A page reload drops the persisted offline queue. `UnifiedDataManager.currentSessionId` starts null (unifiedDataManager.js:50). The first `sync:full` or `session:update` after load looks like a new game session (networkedSession.js:246-258), which calls `resetForNewSession` and `queueManager.clearQueue()`. The queue is restored from `networkedTempQueue` at construction (networkedQueueManager.js:34) and wiped moments later. The "survives reload" design (TQ-1, TQ-7) holds only across socket drops within one page life. Inference from the trace; not run.
6. The networked team-details screen never shows backend scores. `GameOpsRenderer` reads `this.dataManager?.backendScores` (GameOpsRenderer.js:221). `UnifiedDataManager` has no such field, so the lookup is always undefined and the screen falls back to a local calculation. The local calculation uses `getTeamCompletedGroups`, which no storage strategy implements (unifiedDataManager.js:569-575 returns `[]`). Group bonus shows as $0 and completed groups never render, while the scoreboard (backend scores) shows the real bonus. Admin adjustments never show in networked mode either (GameOpsRenderer.js:242).
7. In networked mode the scanner computes points itself and shows them (gameOps.js:319-320, uiManager.js:473, GameOpsRenderer.js:299). The result screen always says "Transaction Complete!" (uiManager.js:466) before the backend answers. The backend never receives the local points (gameOps.js:338-346). The numbers come from the scanner's own pack copy, loaded once at app start.
8. The scanner never reacts to the backend's pack identity. It sends `packHash` in the handshake (orchestratorClient.js:101). It ignores `pack` and `profile` in `sync:full` (grep, section 6). `loadPack()` has one caller, at startup (initializationSteps.js:146). The CONTEXT.md section 4 self-heal line "a GM scanner with stale rules re-fetches the pack and reconnects" has no code in the scanner.
9. Standalone mode makes the scanner the authority for the game session, claims, scores and groups. It copies the backend's rules by re-implementation (LocalStorage.js:350-535), sharing only pack values and mode flags. Gaps against the backend: no setup/active gate and an ended session still accepts scans (LocalStorage.js:302 checks only `paused`); `group:completed` is never announced; transactions get no `id`, so the delete button and `removeTransaction` are unreachable from the UI (inference, section 5).
10. Dead or half-wired paths: the event `game-state:updated` is listened to (main.js:164) but nothing emits it; `session-state:updated`, `player-scans:synced`, strategy `session:updated` are emitted and never listened to; `showGroupCompletionNotification` has no caller; `NetworkedStorage`'s command methods (addTransaction, removeTransaction, adjustTeamScore, createSession, endSession, pause, resume, resetScores) have no networked caller; `AdminController.pause/resume` call methods no module defines; `TeamRegistry` score fields are written and never read.
11. Of the 22 `MESSAGE_TYPES`, 19 have a handler and 3 have none (`offline:queue:processed`, `batch:ack`, `cue:completed`). 11 write a scanner copy of backend runtime state. `session:overtime` has a consumer, but the router comment says none exists (messageRouters.js:186-188 versus MonitoringDisplay.js:230).
12. Bug in `buildGameActivity`: it reads `SF_MemoryType` off the object `findToken` returns, but `findToken` returns `{token, matchedId}` (gameActivityBuilder.js:55-60 versus tokenManager.js:284). For tokens claimed with no player discovery the type, rating and potential value come out empty. `getExposedOwners` handles the shape correctly (unifiedDataManager.js:315-317).
13. Key hygiene: `StateValidationService.clearStaleState` removes `aln_game_session_mode` and `aln_session_data`, which nothing writes (StateValidationService.js:182-185). The real key is `gameSessionMode`, cleared separately by `clearMode`. It does not clear `networkedSessionId`, `networkedScannedTokens:<id>` or `networkedTempQueue`. Auto-connect also requires a session to exist on the orchestrator (StateValidationService.js:90-96), so a reload while no game session exists drops networked mode and shows the wizard.
14. Contradictions with the scanner's own map (ALNScanner/CLAUDE.md): Phase 1H does not load transactions or scanned tokens (initializationSteps.js:77-79 only updates the badge). The debug recipes read `localStorage 'transactions'`, a key no code writes. `refreshAllDisplays` does not re-render a template (MonitoringDisplay.js:374-378). The StateStore API list omits `replace` (stateStore.js:50), which `sync:full` uses for every domain. Detail in the appendix.
15. Gaps in this sheet: I did not read `ALNScanner/sw.js`, the scanner tests, or the E2E suite. I read backend code only for the authority side of each fact. Whether the order of `sync:full` against `MonitoringDisplay` construction ever loses an event is inference.

## 1. Module table

Counts: `find ALNScanner/src -name '*.js' | wc -l` gives 67; `find ALNScanner/src -name '*.js' | xargs cat | wc -l` gives 16486. "Copies" lists the runtime-state copies the file holds (H) or writes (W). "none" means the file holds no backend runtime state.

| File | Lines | Role | Copies |
|---|---|---|---|
| main.js | 294 | Builds the singletons, wires `UnifiedDataManager` events to UI refreshes, starts the app | none; listens to 7 UDM events (:131-187) |
| app/app.js | 714 | App shell and the single dependency-injection point; mode selection; builds `NetworkedSession` | H `currentTeamId`, `currentInterventionTeamId`; W `NetworkedStorage.socket` (:541) |
| app/adminController.js | 144 | Creates the 12 admin modules once; `pause`/`resume` hooks | none |
| app/initializationSteps.js | 527 | The 11-phase startup; restore-mode decision; pack info line | R `aln_auth_token`, `aln_orchestrator_url` |
| app/sessionModeManager.js | 144 | Locks deployment mode (networked or standalone) | H `mode`, `locked`; W `gameSessionMode` |
| app/domains/gameOps.js | 635 | Scan pipeline, team entry, transaction recording, score and delete interventions | W claim mark (:330, :360); computes `points` (:320) |
| app/domains/gameAdmin.js | 428 | Session lifecycle commands, report download, system reset | none; reads `getSessionData` |
| app/domains/showControl.js | 111 | Video and display-mode command wrappers | none |
| app/domains/environment.js | 28 | Empty boundary for bluetooth, audio, lighting, music | none |
| admin/MonitoringDisplay.js | 435 | Direct `message:received` listener, StateStore subscriber, owner of the admin panel renders | H `devices` (:22), `_currentDisplayMode` (:38); W TeamRegistry (:226, :334) |
| admin/AdminOperations.js | 68 | Sends `score:reset`, `score:adjust`, `transaction:delete`, `service:check` | none |
| admin/SessionManager.js | 82 | Sends `session:create/start/pause/resume/end` | none |
| admin/VideoController.js | 96 | Video transport and queue commands | none |
| admin/DisplayController.js | 63 | Display-mode commands | none |
| admin/AudioController.js | 54 | Audio routing and volume commands | none |
| admin/BluetoothController.js | 89 | Bluetooth scan, pair, connect commands | none |
| admin/LightingController.js | 48 | Lighting scene commands | none |
| admin/CueController.js | 129 | Cue fire, enable, disable, held-item commands | none |
| admin/SoundController.js | 59 | Sound play and stop commands | none |
| admin/MusicController.js | 84 | Music (MPD) commands | none |
| admin/ScoreboardController.js | 45 | Scoreboard evidence navigation commands | none |
| admin/utils/CommandSender.js | 69 | Sends `gm:command`, waits for the `gm:command:ack` with the same action | none |
| core/unifiedDataManager.js | 968 | Facade over the two storage strategies; derived scores, groups, stats; `sync:full` apply methods | H `sessionState` (:53), `currentSessionId` (:50), `scannedTokens` (shared reference, :43); W all NetworkedStorage fields |
| core/storage/NetworkedStorage.js | 498 | Networked strategy: local cache of backend data | H `transactions`, `backendScores`, `scannedTokens`, `playerScans`, `currentSessionId` (:29-33); W `networkedScannedTokens:<id>`, `networkedSessionId` |
| core/storage/LocalStorage.js | 629 | Standalone strategy: the authority for session, claims, scores, groups | H `sessionData`, `scannedTokens`, `playerScans` (always empty); W `standaloneSession` |
| core/storage/IStorageStrategy.js | 185 | Strategy interface and typedefs | none |
| core/stateStore.js | 95 | Domain-keyed container for service state | H `_state`, `_prev`, `_listeners` for 10 domains |
| core/teamRegistry.js | 321 | Team list for the team-entry screen | H `teams` Map (:30); W `aln_recent_teams` |
| core/gameActivityBuilder.js | 112 | Builds the Game Activity view from transactions and player scans | derived, no stored copy |
| core/tokenManager.js | 309 | Holds the loaded pack's token database; fuzzy token lookup; group inventory | H `database`, `groupInventory`, `packInfo`, `gameConfig` (pack copy) |
| core/scoring.js | 219 | Scoring tables, group multipliers, token value | H `SCORING_CONFIG`, `PACK_GROUPS` (pack copy) |
| core/modeSemantics.js | 413 | Mode table and the mode-flag helpers (consuming, scoring, evidence) | H `activeModes`, entity label (pack copy) |
| core/packLoader.js | 457 | Loads the pack: network, cache, bundled; staged refresh | H `_active`; W `aln_pack_active`, Cache API `aln-pack-<hash>` |
| core/strings.js | 172 | Pack wording | H `PACK_STRINGS` (pack copy) |
| core/theme.js | 280 | Pack colors and rating display | H `PACK_THEME` (pack copy) |
| core/sessionReportGenerator.js | 522 | Builds the markdown report from session, scores, transactions, player scans | derived |
| network/orchestratorClient.js | 386 | Socket.io wrapper; forwards 22 event types as `message:received` | H `socket`, `isConnected` |
| network/connectionManager.js | 396 | Token and health checks, retry, reconnect | H `state`, `retryCount`, `token` |
| network/networkedSession.js | 271 | Builds the services, runs the router chain, detects game-session boundaries | none; calls reset |
| network/messageRouters.js | 227 | The four router functions that apply events to UDM and StateStore | W UDM, StateStore, `aln_auth_token` (removal) |
| network/networkedQueueManager.js | 434 | Offline queue of unconfirmed scans; replay | H `tempQueue`; W `networkedTempQueue` |
| services/StateValidationService.js | 194 | Pre-connect checks: token, `/health`, `/api/session` | none; W removals of stale keys |
| ui/uiManager.js | 535 | Screen navigation, toasts, stats, scan result screen; delegates to two renderers | H `previousScreen` |
| ui/settings.js | 76 | Station settings | H `deviceId`, `mode` (GM's chosen transaction mode); W same keys |
| ui/connectionWizard.js | 588 | Connect form, station-name assignment, queue indicator, page-lifecycle reconnect | W `aln_orchestrator_url`, `aln_auth_token`, `aln_station_name`; R `/api/state` |
| ui/renderers/SessionRenderer.js | 324 | Session panel and game clock | H `_viewState`, `_lastElapsed`, `_clockState`, `_phase` |
| ui/renderers/VideoRenderer.js | 238 | Video now-playing, queue, progress | H `_displayMode`, `_lastVideoState`, interpolation base |
| ui/renderers/MusicRenderer.js | 361 | Music panel and ducking display | H `_lastPosition`, `_lastDuration`, `_isPlaying`, timer |
| ui/renderers/HealthRenderer.js | 223 | Service health dashboard | H `_lastData`, `_mode`, `_forceExpanded` |
| ui/renderers/HeldItemsRenderer.js | 113 | Held-items list with live duration counter | H `_items` Map |
| ui/renderers/CueRenderer.js | 355 | Quick-fire grid, standing cues, active cues | H DOM maps `_standingEls`, `_activeEls`, `_gridSignature` |
| ui/renderers/EnvironmentRenderer.js | 399 | Lighting, audio routing, bluetooth | H `_activeSceneId`, `_volumeValues` (:47), sink and device keys |
| ui/renderers/GameOpsRenderer.js | 704 | Scoreboard, team details, token cards, Game Activity | none; reads UDM |
| ui/renderers/GameAdminRenderer.js | 98 | Session status panel for standalone | none; reads `getCurrentSession` |
| ui/renderers/EvidencePickerRenderer.js | 65 | Scoreboard-evidence owner dropdown | H `_lastOwners` |
| ui/renderers/dormancyWording.js | 32 | Wording for a dormant service's door (parity copy of backend wording) | none |
| utils/domEventBindings.js | 396 | Click delegation from `data-action` to app, dataManager, settings | none |
| utils/nfcHandler.js | 192 | Web NFC wrapper | none |
| utils/debug.js | 81 | Debug message buffer | H message list |
| utils/config.js | 26 | Constants | none |
| utils/jwtUtils.js | 30 | JWT expiry check | none |
| utils/formatCurrency.js | 73 | Money format from the pack | H `MONEY_SPEC` (pack copy) |
| utils/formatDuration.js | 46 | Duration text | none |
| utils/showToast.js | 40 | Toast | none |
| utils/escapeHtml.js | 14 | HTML escape | none |
| utils/escapeCssAttrValue.js | 24 | CSS selector escape | none |
| utils/slugify.js | 19 | CSS-safe id | none |

Row count check: the table has 67 rows (13 admin, 8 app, 14 core, 1 main, 5 network, 1 services, 14 ui, 11 utils).

## 2. Copies

Authority for all rows below is a backend module unless the row says the scanner is the authority. "Snapshot" means a full-state event; "live update" means an incremental event.

### 2.1 Runtime-fact table

| Fact | Authority | Copies | Writers | Change events | Delivery paths | Persistence | Cleared or rebuilt at |
|---|---|---|---|---|---|---|---|
| Game session record (id, name, status, teams, metadata) | `sessionService` current session (backend/websocket/syncHelpers.js:133 `session.toJSON()`; backend/websocket/broadcasts.js:73, :114) | `UnifiedDataManager.sessionState` (unifiedDataManager.js:53); `UnifiedDataManager.currentSessionId` (:50); `NetworkedStorage.currentSessionId` (NetworkedStorage.js:33); `SessionRenderer._viewState` (SessionRenderer.js:21); `localStorage networkedSessionId` | `updateSessionState` (unifiedDataManager.js:944) from `session:update` (messageRouters.js:197-201) and `sync:full` (:119-123); `resetForNewSession` (:542); `setSessionId` (NetworkedStorage.js:485); `SessionRenderer.render` from MonitoringDisplay.js:224, :332 | UDM emits `session-state:updated` (:948, :964), no listener; `SessionRenderer` redraws DOM | `session:update` live (to all clients, backend/websocket/broadcasts.js:73-125); `sync:full` snapshot; both carry different shapes (update has `teams` ids and `metadata`; snapshot has `scores`, `transactions`, `playerScans`, `connectedDevices`) | `networkedSessionId` only; the record itself is not stored | Game session end: not cleared (status becomes `ended`, no boundary, messageRouters.js:198). New game session: id change calls `resetForNewSession` (networkedSession.js:246-258), but `sessionState` is merged, not reset. Reload: starts as `{id:null,status:'disconnected'}`. `sync:full` with `session:null` sets `{}` (unifiedDataManager.js:946). |
| Team list | `session.scores` team ids (backend/models/session.js:318) | `TeamRegistry.teams` Map (teamRegistry.js:30); `sessionState.teams`; `backendScores` keys; `aln_recent_teams` (standalone only) | `populateFromSession` (teamRegistry.js:160): clear then refill; called from MonitoringDisplay.js:226 (`session:update`) and :334 (`sync:full`). `addTeam` after a successful `session:addTeam` ack (teamRegistry.js:308). Nothing calls `removeTeam` or `clear`. | `teams:updated`, `team:added` (teamRegistry.js:117, :123) | `session:update` (ids only, so scores reset to 0 in the registry), `sync:full` (ids plus scores) | `aln_recent_teams` (standalone, teamRegistry.js:282) | Rebuilt on every session event. A null session is ignored (teamRegistry.js:161), so teams survive a `sync:full` with `session:null`. |
| Transactions | `session.transactions` (backend/websocket/syncHelpers.js:63-81); only accepted ones are persisted and broadcast (backend/services/session/persistenceListeners.js:93-114; inference for "duplicates never arrive") | `NetworkedStorage.transactions` (:29); inside `sessionState.transactions` after a `sync:full` merge | `setTransactions` replace (NetworkedStorage.js:357); `addTransactionFromBroadcast` add-if-absent by id (:365); `removeTransactionFromBroadcast` remove by id (:394); `resetForNewSession` sets `[]` (unifiedDataManager.js:551) | UDM emits `transaction:added` (:250) on broadcast add; strategy emits `transaction:deleted` (NetworkedStorage.js:400); `sync:full` replace emits nothing | `transaction:new` live (room `session:<id>`, backend/websocket/broadcasts.js:216); `transaction:deleted` live (:267); `sync:full` snapshot | none | New game session boundary (cleared). Reload (empty until `sync:full`). `scores:reset` does not clear them; the following `sync:full` replaces them (backend/websocket/broadcasts.js:297-326). |
| Team scores | `transactionService.getTeamScores()` (backend/websocket/syncHelpers.js:59) | `NetworkedStorage.backendScores` Map (:30); `TeamRegistry.teams[].score` (unread); `sessionState.scores` (stale after merge); the result-screen local points (uiManager.js:473); team-details local sums (unifiedDataManager.js:685) | `updateTeamScoreFromBackend` (unifiedDataManager.js:801) replaces the team's record, from `transaction:new` (messageRouters.js:42-44), `score:adjusted` (:32-36), `transaction:deleted` (:51-53), `sync:full` (:102-104). `resetBackendScores` zeroes in place (NetworkedStorage.js:418) | UDM emits `team-score:updated` per team (unifiedDataManager.js:819) | `transaction:new.teamScore` live (null when the backend stash missed, backend/websocket/broadcasts.js:210); `score:adjusted` live; `sync:full.scores` snapshot | none | `resetForNewSession` clears the Map (:553). `scores:reset` zeroes entries and keeps teams. Never pruned by `sync:full`. A `sync:full` with `session:null` and `scores:[]` leaves old entries. |
| Claimed tokens (claim guard) | Per-device registry `scannedTokensByDevice` plus first-come-first-served over `session.transactions` (backend/gameRules/duplicatePolicy.js:83-120; backend/models/session.js:381-422) | `NetworkedStorage.scannedTokens` Set (:31), shared by reference with `UnifiedDataManager.scannedTokens` (:43, `_syncScannedTokens` :142); `localStorage networkedScannedTokens:<sessionId>`; queued entries in `tempQueue` | Local mark before the backend answers: `markTokenAsScanned` (gameOps.js:330 via unifiedDataManager.js:477). Live add on `transaction:new` for consuming modes (NetworkedStorage.js:378-381). `setScannedTokens` union from `sync:full.deviceScannedTokens` (:453-460). Unmark on a failed scan only (app.js:262). Clear on `scores:reset` (NetworkedStorage.js:437) and on boundary (unifiedDataManager.js:544-550) | none emitted | `transaction:new` live (all stations); `sync:full.deviceScannedTokens` snapshot, this device's tokens only (backend/websocket/gmAuth.js:150) | Written to `networkedScannedTokens:<id>` on every change (NetworkedStorage.js:67-75) | Boundary, `scores:reset`. Not cleared on `transaction:deleted` (conclusion 4). `sync:full` `recentTransactions` does not mark claims: only the live path does. |
| Player scans | `session.playerScans` (backend/websocket/syncHelpers.js:139) | `NetworkedStorage.playerScans` (:32); `sessionState.playerScans` after merge | `setPlayerScans` replace (:466) from `sync:full`; `addPlayerScan` add-if-absent by id (:474) from `player:scan` via `handlePlayerScan` (unifiedDataManager.js:835); boundary sets `[]` (:552) | `player-scan:added` (:855); `player-scans:synced` (:882, no listener) | `player:scan` live; `sync:full` snapshot | none | Boundary; reload |
| Connected devices | `session.connectedDevices` (backend/websocket/syncHelpers.js:83-98) | `MonitoringDisplay.devices` (MonitoringDisplay.js:22) | Replace from `sync:full` (:341-342); add-if-absent on `device:connected` (:265-267); remove on `device:disconnected` (:269) | DOM redraw only | `device:*` live, `sync:full.devices` snapshot | none | Never cleared at boundary or disconnect. The array lives as long as the `MonitoringDisplay` instance, which `AdminController` creates once per page. |
| Display mode (venue display) | `displayControlService` (backend/websocket/syncHelpers.js:125-130) | `MonitoringDisplay._currentDisplayMode` (:38, starts `IDLE_LOOP`); `VideoRenderer._displayMode` (VideoRenderer.js:34, starts null) | `_handleDisplayMode` (MonitoringDisplay.js:275-289) from `display:mode` live and from the `sync:full` re-emit (messageRouters.js:140-144) | none; DOM only | `display:mode` live; `sync:full.displayStatus.currentMode` snapshot | none | Reload resets to defaults. Display mode is not a StateStore domain. |
| Service domains (music, video, health, bluetooth, audio, lighting, sound, gameclock, cueengine, held) | One backend service each; delivered via `service:state` | `StateStore._state[domain]` and `_prev` (stateStore.js:13-14) | `replace` from `sync:full` for all 10 (messageRouters.js:127-136); `update` shallow merge from `service:state` (:173) | Domain listeners (stateStore.js:34-42, :66-74); no notification when a flat shallow compare says nothing changed | `service:state` live; `sync:full` snapshot | none | No reset method exists. Nothing clears it at boundary, disconnect or reload (reload recreates it empty, main.js:62). |
| Game clock (extrapolated) | `gameClockService` (backend/websocket/syncHelpers.js:168) | StateStore `gameclock`; `SessionRenderer._lastElapsed` ticking each second (SessionRenderer.js:150-156) | `renderGameClock` from the store subscription (MonitoringDisplay.js:183) | DOM | As service domains | none | Timer stops when the renderer is destroyed. A local second-by-second extrapolation, so it drifts between pushes. |
| Pending local actions (offline queue) | The scanner (unconfirmed scans); outcome decided by the backend | `NetworkedQueueManager.tempQueue` (networkedQueueManager.js:29); `localStorage networkedTempQueue`; `#queueCount` DOM | `queueTransaction` add (:42); `_removeByClientTxId` (:116); `reconcileWithServerState` remove consuming entries already on the server (:132); `syncQueue` remove definitive results (:161); `clearQueue` wipe (:401); `loadQueue` restore at construction (:34) | `queue:changed` (:55, :121, :145, :261). `clearQueue` emits none, so the indicator keeps the old count. | `transaction:result` live per submit (matched by `clientTxId`, :323) | `networkedTempQueue` on every change (:363) | Boundary wipes it (networkedSession.js:258), including on the first event after reload (conclusion 5) |
| Connection state and auth | Backend (JWT, device registry) | `OrchestratorClient.isConnected` (:63); `ConnectionManager.state`, `token` (connectionManager.js:33, :32); `NetworkedStorage.socket` (stale after reconnect); header DOM class; `localStorage aln_auth_token` | Socket events (orchestratorClient.js:303-317); `ConnectionManager` (:154, :239); `app.js:541` copies the socket reference once | `socket:connected`, `socket:disconnected`, `socket:error`; `connected`, `disconnected`, `auth:required` | Local socket events | `aln_auth_token`, `aln_orchestrator_url`, `aln_station_name`, `gameSessionMode` | Token removed on auth failure (connectionManager.js:170, :351; messageRouters.js:161; StateValidationService.js:176) |
| Station identity | Backend device registry rejects collisions (`DEVICE_ID_COLLISION`, orchestratorClient.js:81-84); the scanner proposes the id from `/api/state` (connectionWizard.js:204-226) | `Settings.deviceId` (settings.js:19); `localStorage deviceId`; `aln_station_name` | `connectionWizard.js:387-390` | `settings:saved`, `settings:changed` | HTTP read at first assignment only | `deviceId`, `aln_station_name` | Never cleared by code |
| Deployment mode (networked or standalone) | The scanner | `SessionModeManager.mode`, `locked` (sessionModeManager.js:21-22); `localStorage gameSessionMode`; body class | `setMode` (:39) | none | Local choice | `gameSessionMode` | `clearMode` (:79), reload keeps it |
| GM's selected transaction mode | The scanner (sent with each scan) | `Settings.mode`; `localStorage mode` | `selectMode` (gameOps.js:61), validated against the pack at startup | `settings:changed` | Local | `mode` | Reset to the pack's first mode if undeclared |
| Standalone game session | The scanner | `LocalStorage.sessionData` (LocalStorage.js:31); `scannedTokens`; `localStorage standaloneSession` | `createSession`, `addTransaction`, `removeTransaction`, `adjustTeamScore`, `resetScores`, pause, resume, end | `transaction:added`, `transaction:deleted`, `team-score:updated`, `scores:cleared`, `data:cleared`, `session:updated` | none | `standaloneSession` after every change (LocalStorage.js:114) | Fresh mode selection removes the key (app.js:465). Reload restores only a session started today (LocalStorage.js:79-83). |
| Pack (not runtime state; frozen at the backend's activation) | `packService` active pack (backend), served at `/api/pack/*` | `TokenManager.database`, `gameConfig`, `packInfo` (tokenManager.js:25-27, :68-74); `SCORING_CONFIG` and `PACK_GROUPS` (scoring.js:38, :137); `activeModes` (modeSemantics.js:71); `PACK_STRINGS`, `PACK_THEME`, `MONEY_SPEC`; `localStorage aln_pack_active`; Cache API `aln-pack-<hash>` | `loadDatabase` at startup (tokenManager.js:50-103); staged refresh (packLoader.js:205-284) | none | HTTP at app start; handshake `packHash` goes the other way | `aln_pack_active` and the cache | No refresh until reload (packLoader.js header). The scanner never compares with the backend's `pack` field. |

### 2.2 Write paths per copy

Each cell says what the path does and whether it replaces, merges or adds. "n/a" means the path does not touch that copy.

| Copy | Live event handler | `sync:full` restore | Local action before the backend confirms | Offline queue | Reload restore from localStorage |
|---|---|---|---|---|---|
| `UDM.sessionState` | `session:update`: merge `{...old,...payload}` (unifiedDataManager.js:954-957) | merge of `payload.session`, or replace by `{}` when null (:946) | n/a | n/a | none; starts `status:'disconnected'` (:53-59) |
| `UDM.currentSessionId` | set from `payload.id` (:961) | set from `session.id` (:961) | n/a | n/a | none; null (:50) |
| `NetworkedStorage.currentSessionId` | n/a | set only through a boundary (`setSessionId`, :485) | n/a | n/a | replace from `networkedSessionId` (:85-87) |
| `NetworkedStorage.transactions` | `transaction:new`: add if absent (:365-369); `transaction:deleted`: remove (:394-398) | replace (:357-359) | none; the result screen is drawn without a stored row | n/a | none |
| `NetworkedStorage.backendScores` | per-team record replace (`set`, :410) on three events | per-team replace for each score (messageRouters.js:102-104); no prune | none; the result screen shows locally computed points | n/a | none |
| `NetworkedStorage.scannedTokens` | `transaction:new`: add if consuming (:378-381); `scores:reset`: clear (:437) | union in place (:453-460) | add on scan (gameOps.js:330); remove on rejected scan (app.js:262) | `reconcileWithServerState` removes queue entries, not claims | union in place from `networkedScannedTokens:<id>` (:88-91) |
| `NetworkedStorage.playerScans` | `player:scan`: add if absent (:474-479) | replace (:466-468) | n/a | n/a | none |
| `TeamRegistry.teams` | `session:update`: clear, then refill from `teams` ids with score 0 (teamRegistry.js:164-190) | clear, refill from `session.scores` and `session.teams` | `addTeam` after the `session:addTeam` ack (:308) | n/a | none (networked); `aln_recent_teams` for the display list (standalone) |
| `MonitoringDisplay.devices` | `device:connected` add if absent; `device:disconnected` remove (:265-270) | replace (:353) | n/a | n/a | none |
| `MonitoringDisplay._currentDisplayMode`, `VideoRenderer._displayMode` | replace (:287, :282) | replace through the re-emit (messageRouters.js:140-144) | n/a | n/a | defaults |
| `StateStore` domains | `service:state`: shallow merge, skipped if equal (stateStore.js:18-43) | `replace` per domain, skipped if equal (:50-75) | n/a | n/a | none |
| `NetworkedQueueManager.tempQueue` | `transaction:result` accepted, duplicate, rejected or error: remove the entry (networkedQueueManager.js:89-92) | `reconcileWithServerState` removes consuming entries already recorded; `syncQueue` replays the rest | add on every scan, connected or not (:53) | replay by `client.send('transaction:submit')` (:348) | replace by `JSON.parse` of `networkedTempQueue` (:387-389), then usually wiped by the first boundary |
| `LocalStorage.sessionData` (standalone) | n/a | n/a | the only writer in standalone | n/a | replace from `standaloneSession` if started today (LocalStorage.js:75-86) |

### 2.3 Every localStorage key in src

Command that finds them:

```
grep -rhoE "localStorage\.(get|set|remove)Item\(\s*'[^']+'" ALNScanner/src --include=*.js | sed -E "s/.*\('//; s/'$//" | sort -u
```

It printed 12 literal keys. Two more reach storage without a literal: the template key `networkedScannedTokens:${id}` (NetworkedStorage.js:60) and the pack pointer `aln_pack_active` through an injected storage object (packLoader.js:34, :193, :264). That is 14 keys. `grep -rn "sessionStorage\|indexedDB" ALNScanner/src --include=*.js | wc -l` printed 0. The Cache API (`aln-pack-<hash>`, packLoader.js:35, :214, :312) is the only other persistent store.

| Key | Written at | Read at | Removed at | Holds |
|---|---|---|---|---|
| `aln_auth_token` | connectionWizard.js:383 | app.js:405, :507; initializationSteps.js:359; StateValidationService.js:59 | connectionManager.js:170, :351; messageRouters.js:161; StateValidationService.js:176 | JWT |
| `aln_orchestrator_url` | connectionWizard.js:382 | app.js:505; connectionWizard.js:460; initializationSteps.js:399 | never | backend URL |
| `aln_station_name` | connectionWizard.js:384 | connectionWizard.js:194 | never | station id |
| `deviceId` | settings.js:52 | settings.js:35, :49 | never | station id (second copy) |
| `mode` | settings.js:53 | settings.js:37, :50 | never | GM's selected transaction mode |
| `gameSessionMode` | sessionModeManager.js:107 | sessionModeManager.js:120 | sessionModeManager.js:133 | deployment mode |
| `networkedTempQueue` | networkedQueueManager.js:363 | networkedQueueManager.js:387 | networkedQueueManager.js:365, :403 | unconfirmed scans |
| `networkedSessionId` | NetworkedStorage.js:488 | NetworkedStorage.js:85 | never | game session id for the claim-guard key |
| `networkedScannedTokens:<sessionId>` | NetworkedStorage.js:71 | NetworkedStorage.js:88 | never (old keys accumulate, one per game session; inference: no removal call exists) | claim guard |
| `standaloneSession` | LocalStorage.js:114 | LocalStorage.js:75 | app.js:465 | the whole standalone game session |
| `aln_recent_teams` | teamRegistry.js:282 | teamRegistry.js:266 | never | standalone team names |
| `aln_pack_active` | packLoader.js:264 | packLoader.js:193 | never | pack pointer |
| `aln_game_session_mode` | never | never | StateValidationService.js:182 | nothing writes it |
| `aln_session_data` | never | never | StateValidationService.js:185 | nothing writes it |

## 3. The delivery paths inside the scanner

There are two named paths plus two the task did not name. All start at `OrchestratorClient._setupMessageHandlers`, which turns each of the 22 socket events into one `message:received` CustomEvent (orchestratorClient.js:329-343). Three listeners hang on that event: `NetworkedSession._messageHandler` (networkedSession.js:236), `MonitoringDisplay._messageHandler` (MonitoringDisplay.js:35), and one replay handler per in-flight queued scan (networkedQueueManager.js:345). Registration order puts `NetworkedSession` first (it registers in `initialize`, MonitoringDisplay on the later `connected` event), so UDM is updated before TeamRegistry and `SessionRenderer` for the same event (inference from registration order).

Router chain, in order (networkedSession.js:222-225): `gameOpsRouter`, `sharedInfraRouter`, `gameAdminRouter`, `showControlRouter`. First router to return true wins. `showControlRouter` always returns false (messageRouters.js:223-227).

### 3.1 Every MESSAGE_TYPES entry, traced

Count: `sed -n '/^export const MESSAGE_TYPES/,/^];/p' ALNScanner/src/network/orchestratorClient.js | grep -c "^  '"` prints 22. Below: 22 rows. Handler column cites the code that acts. "Copy written" says which copy changes and how.

| # | Event | Handler (file:line) | Path | Copy written |
|---|---|---|---|---|
| 1 | `sync:full` | `sharedInfraRouter` messageRouters.js:92-155; MonitoringDisplay.js:234 | UDM and StateStore, plus direct | sessionState merge; claims union; backendScores per-team replace; transactions replace; playerScans replace; 10 store domains replace; display mode re-emit; queue reconcile and flush; TeamRegistry clear and refill; devices replace |
| 2 | `transaction:result` | replay handler networkedQueueManager.js:302-337 (no router) | queue | `tempQueue` entry removed on accepted, duplicate, rejected, error; nothing else |
| 3 | `transaction:new` | `gameOpsRouter` messageRouters.js:38-45 | UDM | transactions add; claims add (consuming); backendScores per-team replace |
| 4 | `transaction:deleted` | `gameOpsRouter` :47-54 | UDM | transactions remove; backendScores per-team replace; claims NOT touched |
| 5 | `score:adjusted` | `gameOpsRouter` :32-36 | UDM | backendScores per-team replace |
| 6 | `scores:reset` | `gameOpsRouter` :56-58 | UDM | backendScores zeroed, teams kept; claims cleared and persisted |
| 7 | `session:update` | `gameAdminRouter` :197-202; MonitoringDisplay.js:223-228 | UDM, plus direct | sessionState merge; boundary check (skipped when status is `ended`); SessionRenderer redraw; TeamRegistry clear and refill |
| 8 | `session:overtime` | MonitoringDisplay.js:230-232 | direct | none (DOM only) |
| 9 | `device:connected` | MonitoringDisplay.js:238-241 | direct | devices add if absent |
| 10 | `device:disconnected` | MonitoringDisplay.js:239-241 | direct | devices remove |
| 11 | `group:completed` | `gameOpsRouter` :64-66 then app.js:204-209 | app event | none (toast) |
| 12 | `display:mode` | MonitoringDisplay.js:253-255 | direct | display mode copies replace |
| 13 | `gm:command:ack` | CommandSender.js:41; `OrchestratorClient._sendCommandOnce` orchestratorClient.js:222-234 (direct socket listener); gameAdmin.js:333 (direct socket) | command | none |
| 14 | `offline:queue:processed` | none | none | none (the backend follows it with a `sync:full`, backend/websocket/broadcasts.js:336-373, which is how it reaches the copies) |
| 15 | `batch:ack` | none | none | none |
| 16 | `error` | `sharedInfraRouter` :157-168; replay handler networkedQueueManager.js:308-316 | app event, queue | `aln_auth_token` removed on `AUTH_*` or `PERMISSION_DENIED`; in-flight replay promise rejected |
| 17 | `player:scan` | `gameOpsRouter` :60-62 | UDM | playerScans add if absent |
| 18 | `scoreboard:page` | `gameOpsRouter` :68-71 then app.js:216-224 | app event | none (toast) |
| 19 | `cue:fired` | MonitoringDisplay.js:244-246 | direct | none (toast) |
| 20 | `cue:completed` | none | none | none |
| 21 | `cue:error` | MonitoringDisplay.js:248-250 | direct | none (toast) |
| 22 | `service:state` | `sharedInfraRouter` :170-175 | StateStore | store domain shallow merge |

Totals: 22 traced. With a handler: 19. Without: 3 (rows 14, 15, 20). Writing a scanner copy of backend runtime state: 11 (rows 1, 3, 4, 5, 6, 7, 9, 10, 12, 17, 22). Writing local persistent state only: 2 (rows 2, 16). Toast or no copy: 6 (rows 8, 11, 13, 18, 19, 21).

### 3.2 The StateStore path (service domains)

Feeds: `sharedInfraRouter` cases `sync:full` (messageRouters.js:125-137, `replace`) and `service:state` (:170-175, `update`). No other router writes the store.

Readers, all through `MonitoringDisplay._wireStoreSubscriptions` (MonitoringDisplay.js:53-66) except one direct read:

| Domain | Subscription | Renderer |
|---|---|---|
| `cueengine` | MonitoringDisplay.js:88 (arrays to Maps and Sets) | CueRenderer |
| `held` | :98 | HeldItemsRenderer |
| `video` | :113; also `store.get('video')` at :302 | VideoRenderer, plus the "Return to Video" button |
| `sound` | :119 | inline DOM write, no renderer |
| `lighting` | :141 | EnvironmentRenderer |
| `audio` | :146 | EnvironmentRenderer, plus MusicRenderer ducking |
| `bluetooth` | :159 | EnvironmentRenderer |
| `music` | :164 | MusicRenderer |
| `health` | :176 | HealthRenderer |
| `gameclock` | :183 (adapter strips unknown fields, :180-182) | SessionRenderer.renderGameClock |

Screens that read it: only the admin view (`#admin-view`, index.html:329). Admin sections marked `data-requires="networked"` hold the markup (index.html:346, :429, :476, :504, :517).

### 3.3 The UnifiedDataManager path (everything else)

Feeds: `gameOpsRouter` (transactions, scores, player scans, plus the two event-only cases), `sharedInfraRouter` `sync:full` (:96-123), `gameAdminRouter` `session:update`.

Readers:

| Reader | Reads | Screen |
|---|---|---|
| `main.js` listeners (:131-187) | `transaction:added`, `transaction:deleted`, `data:cleared`, `team-score:updated`, `scores:cleared`, `player-scan:added` | refresh history badge, scan-screen stats, history screen, scoreboards, team details, admin Game Activity, evidence picker |
| `GameOpsRenderer.renderScoreboard` (:41-83) | `getTeamScores()` (:48), label from `isFromBackend` (:61) | scoreboard screen and `#admin-score-board` |
| `GameOpsRenderer.renderTeamDetails` (:129-290) | `getEnhancedTeamTransactions`, `calculateTeamScoreWithBonuses` (:135), and the broken `backendScores` lookup (:221) | team-details screen |
| `GameOpsRenderer.renderGameActivity` (:384-) | `getGameActivity()` (:397) | history screen and `#admin-game-activity` |
| `uiManager.showTokenResult` (:421-508) | `calculateTokenValue` (:473) | result screen |
| `uiManager.updateSessionStats`, `updateHistoryStats` | `getSessionStats()`, `getGlobalStats()` | scan screen, history screen |
| `EvidencePickerRenderer.render` (main.js:128) | `getExposedOwners()` (unifiedDataManager.js:301) | admin "Scoreboard Evidence" section |
| `gameOps.processNFCRead` (:233-241) | `sessionState.status` | gate on the scan screen |
| `gameAdmin.downloadSessionReport` (:214-253) | `getSessionData`, `getTeamScores`, `getTransactions`, `getPlayerScans` | markdown download |
| `GameAdminRenderer.renderSessionStatus` (:30-97) | `getCurrentSession()` | standalone admin panel only |

### 3.4 The direct path and the app-event path

| Path | Feeds | Readers |
|---|---|---|
| Direct `message:received` in `MonitoringDisplay._handleMessage` | `session:update`, `sync:full`, `session:overtime`, `device:*`, `display:mode`, `cue:fired`, `cue:error` | `SessionRenderer` (session panel), `TeamRegistry` (team-entry list via `gameOps._renderTeamList`, gameOps.js:101-116), device list DOM, `VideoRenderer.setDisplayMode`, toasts |
| `NetworkedSession` re-dispatch to `App` | `group:completed`, `scoreboard:page`, `error`, queue `transaction:failed`, `auth:required` | `app.js:185-264`: toasts, error banners, the wizard, and `unmarkTokenAsScanned` (app.js:262) |

### 3.5 Every file in src/ui/renderers

Count: `ls ALNScanner/src/ui/renderers/*.js | wc -l` prints 11.

| Renderer | Path it reads | Source of its data |
|---|---|---|
| CueRenderer.js | StateStore `cueengine` | MonitoringDisplay.js:88-95 |
| EnvironmentRenderer.js | StateStore `lighting`, `audio`, `bluetooth` | MonitoringDisplay.js:141, :146, :159 |
| EvidencePickerRenderer.js | UDM | `getExposedOwners()` from transactions (main.js:128) |
| GameAdminRenderer.js | UDM | `getCurrentSession()`; standalone only (gameAdmin.js:425, app.js:481) |
| GameOpsRenderer.js | UDM | `getTeamScores`, `getEnhancedTeamTransactions`, `getGameActivity`, `calculateTeamScoreWithBonuses` |
| HealthRenderer.js | StateStore `health` | MonitoringDisplay.js:176 |
| HeldItemsRenderer.js | StateStore `held` | MonitoringDisplay.js:98 |
| MusicRenderer.js | StateStore `music` and `audio` (ducking) | MonitoringDisplay.js:146-166 |
| SessionRenderer.js | Direct path (`render`) and StateStore `gameclock` (`renderGameClock`) | MonitoringDisplay.js:224, :332, :183 |
| VideoRenderer.js | StateStore `video` plus direct `display:mode` | MonitoringDisplay.js:113, :282 |
| dormancyWording.js | none (pure wording helper used by HealthRenderer, CueRenderer) | parity copy of backend/gameRules/dormancyWording.js |

## 4. Facts the scanner decides itself in networked mode that the backend also decides

| Fact | Scanner decision (file:line) | Backend decision (file:line) | Can they disagree, and when |
|---|---|---|---|
| Is this token already claimed (duplicate) | `isConsumingMode(settings.mode) && dataManager.isTokenScanned(tokenId)` (gameOps.js:253). The Set holds this station's marks, the device's tokens from `sync:full`, and live `transaction:new` claims. | `duplicatePolicy.checkDuplicate`: per-device registry plus first-come-first-served over session transactions (backend/gameRules/duplicatePolicy.js:83-120), called at backend/services/transactionService.js:206 | Yes. (a) After `transaction:deleted` the backend releases the claim; the scanner keeps it (conclusion 4). (b) A claim made by another station while this one was offline appears in `recentTransactions` but not in the Set, so the scanner lets the scan through and the backend rejects it (then `transaction:failed`, app.js:232-255). |
| Points for a token | `calculateTokenValue` from the scanner's pack copy: gameOps.js:320 (computed, not sent), uiManager.js:473 (result screen), GameOpsRenderer.js:299 (every token card), NetworkedStorage.js:245 (Game Activity fallback) | `scoring.pointsFor` (backend/gameRules/scoring.js:51); `transaction.accept(points)` (backend/services/transactionService.js:241) | Yes if the scanner's pack differs from the backend's active pack. The token card recomputes from the scanner's table even when `tx.points` is present. |
| Team score total | Team details: `calculateTeamScoreWithBonuses` (unifiedDataManager.js:685-741), used because the `backendScores` lookup fails (GameOpsRenderer.js:221) | `computeTeamScores`, `groupBonusAmount` (backend/gameRules/scoring.js:184, :220); the scoreboard shows the backend number (`getTeamScores`, NetworkedStorage.js:194) | Yes, whenever a group bonus or an admin adjustment exists: team details shows base only, scoreboard shows the total. |
| Group completion | `getTeamCompletedGroups` returns `[]` (unifiedDataManager.js:569-575) so the scanner decides "no group is ever complete" in team details and report-style views | `isGroupComplete` (backend/gameRules/scoring.js:133) | Yes, always for any completed group. ALNScanner/CLAUDE.md names this as F-GMS-02. |
| Game session status gate for scanning | `sessionState.status !== 'active'` blocks the scan (gameOps.js:233-241) | `session.status !== 'active'` returns `rejected` (backend/services/transactionService.js:157-163) | Yes during the window where the local `sessionState` is older than the backend state (after a drop, or before the first event after reload, when status reads `disconnected`). The scanner is the stricter side. |
| Does the token exist (unknown token) | `tokenManager.findToken` with fuzzy match on colons, hyphens, case (tokenManager.js:276-302; gameOps.js:246) | `this.tokens.get(transaction.tokenId)` (backend/services/transactionService.js:178) | Yes if the packs differ or the fuzzy match maps a read to a different id than the backend would accept. The scanner sends the matched id, or the raw id marked as scanned when no match (gameOps.js:259-261, :330). |
| Which modes are consuming, scoring, counting toward groups | `modeSemantics` from the scanner's pack copy (modeSemantics.js:273-324) | `backend/gameRules/modeSemantics.js` from the active pack | Yes if the packs differ; the backend gate refuses unknown modes, the scanner disables the affordance. |
| Does a team exist | `teamRegistry.hasTeam` then `session:addTeam` (teamRegistry.js:222-224) | The backend also creates a score row on first scan (backend/services/transactionService.js:261 comment) | Low risk, but two creation paths. |
| Is the orchestrator reachable | `ConnectionManager.checkHealth` (connectionManager.js:61-78), `StateValidationService.checkOrchestratorHealth` (:120) | backend `/health` and the socket's own connection tracking | Yes; `client.isConnected` can stay true until the transport times out. The queue then tries to send (networkedQueueManager.js:59). |
| Station name free to use | `_findNextStationId` over `/api/state` devices (connectionWizard.js:203-226) | `DEVICE_ID_COLLISION` at handshake (orchestratorClient.js:77-80, :347-349) | Yes by design; the backend wins. |
| Token still valid | `isTokenValid` with a 60 second buffer (jwtUtils.js) | backend JWT check at connect | Yes at the edge; the scanner clears the token early. |
| Which evidence owners are exposed | `getExposedOwners`: evidence-mode, `accepted` status, owner from tx or token (unifiedDataManager.js:301-331) | the wall scoreboard's own filter (backend/public/scoreboard.html, outside src; named in the scanner comment near :293) | Possible; two implementations of one filter, kept in step by comment only. |
| Preflight go or no-go | The scanner reads the backend's decision from a message prefix `NO-GO: ` (gameAdmin.js:26, :88) | `commandExecutor` builds the message (backend/services/commandExecutor.js:263) | Coupled by string match, not a typed field. |

Facts the scanner decides alone that the backend never sees: whether to mark a token before sending (gameOps.js:329-331), which result screen to paint (uiManager.js:421-508), whether the Game Activity entry is "available" or "claimed" (gameActivityBuilder.js:36, :74).

## 5. Standalone mode

Standalone is the scanner's own authority. `LocalStorage` (LocalStorage.js:16-629) is the only store; `gameOps.recordTransaction` takes the standalone branch at gameOps.js:349-363.

### 5.1 Where the scanner is the authority

| Fact | Where it is decided |
|---|---|
| Game session record and status | `LocalStorage.sessionData` (:31-37); `createSession` :163, `pauseSession` :203, `resumeSession` :229, `endSession` :187 |
| Duplicate and claim | `scannedTokens` Set filled by consuming mode only (:324-326); rebuilt from transactions on load (:97-107); consulted at gameOps.js:253 |
| Unknown token | Refused, nothing stored (gameOps.js:350-357) |
| Points | `calculateTokenValue` (scoring.js:202) called at gameOps.js:320, stored on the transaction |
| Team score and `tokensScanned` | `_updateTeamScore` (:350-388) |
| Group completion and bonus | `_checkGroupCompletion` (:394-438): needs 2 or more group tokens, multiplier above 1 |
| Delete and rebuild | `removeTransaction` (:445) and `_recalculateTeamScores` (:503-535) |
| Admin adjustment and score floor | `adjustTeamScore` (:544-603), floor at :570-577 |
| Reset | `resetScores` (:262-293): zero scores, clear transactions and claims |

### 5.2 Rules shared with, or copied from, the backend's gameRules

Shared data (read from the pack at runtime): `SCORING_CONFIG.BASE_VALUES`, `TYPE_MULTIPLIERS`, `ALLOW_NEGATIVE` (scoring.js:38-48, :64-97); group multipliers (`PACK_GROUPS`, scoring.js:137-162); mode flags (`modeSemantics.js`).

Re-implemented in the scanner (parity by hand, the "parity surface" in CONTEXT.md section 2):

| Backend rule (file:line) | Scanner copy (file:line) | Known differences |
|---|---|---|
| `pointsFor` (backend/gameRules/scoring.js:51) | `isScoringMode` check at gameOps.js:319 plus `calculateTokenValue` | Same result when packs match. `Math.floor` mirrors the backend (scoring.js:218). |
| `isGroupComplete` (backend/gameRules/scoring.js:133) | `_checkGroupCompletion` (LocalStorage.js:394-438) | Both need 2 or more tokens. |
| `groupBonusAmount` sums catalog values of scored members (backend/gameRules/scoring.js:184-210) | sums `tx.points` of counted transactions (LocalStorage.js:429) | Equal for ALN. Inference: a non-consuming counting mode could repeat a token and the scanner would add it twice; the backend uses a Set of token ids. |
| `computeTeamScores` rebuild (backend/gameRules/scoring.js:220) | `_recalculateTeamScores` (LocalStorage.js:503) | Both replay admin adjustments and apply the pack floor. |
| `duplicatePolicy.checkDuplicate` (backend/gameRules/duplicatePolicy.js:83) | the Set check (gameOps.js:253) | One device, so per-device and first-come-first-served collapse into one Set. |
| Session must be `active` to score (backend/services/transactionService.js:157) | `addTransaction` blocks only `paused` (LocalStorage.js:302) | Gap: no `setup` state; an `ended` session still accepts scans; a fresh standalone launch scans with no session at all (`sessionData.status` undefined). |
| `group:completed` event (backend/websocket/broadcasts.js:284-293) | none | Gap: standalone never announces a completed group. |
| Reset clears claims (backend) | `resetScores` (LocalStorage.js:262) | Matches (train-review MAJOR 8 note in code). |
| Transaction ids (backend assigns) | none; `recordTransaction` builds no `id` (gameOps.js:305-317) and no code sets one (grep `\.id = ` finds only DOM ids) | Inference: `renderTokenCard` shows Delete only when `token.id` exists (GameOpsRenderer.js:330), so standalone delete is unreachable from the UI. Unit tests supply ids by hand (ALNScanner/tests/unit/core/storage/LocalStorage.test.js:60). Needs a test run to confirm. |

Other standalone limits: `LocalStorage.getTeamCompletedGroups` does not exist, so team details shows bonus $0 even when the scoreboard (which reads `team.score`, LocalStorage.js:129-141) includes it. `GameAdminRenderer` draws any non-paused status, including `ended`, as "Active" (GameAdminRenderer.js:76-95). `LocalStorage` restores only a session whose `startTime` is today (:79-83). Player scans are always empty (LocalStorage.js:43).

## 6. The connection lifecycle

Order of events on a cold load with a saved networked mode, then each later event. "Replace", "merge", "add" as in section 2.

| Step | What runs (file:line) | Effect on each copy |
|---|---|---|
| 1. Page load | `App.init` runs 11 phases (app.js:90-165). `loadDataManager` only updates the history badge (initializationSteps.js:77-79). Pack loaded at phase 1A (:146). `validateAndDetermineInitialScreen` (initializationSteps.js:384) calls `validateAll`: token, `/health`, `/api/session` (StateValidationService.js:45-104) | Pack copies set. All runtime copies empty. A failed check clears `aln_auth_token` and the mode (initializationSteps.js:412, :444). |
| 2. Networked init | `_initializeNetworkedMode` (app.js:499): new `NetworkedSession`, then `dataManager.initializeNetworkedMode` before the socket exists (:533) | `NetworkedStorage` created; `_rehydrateScannedTokens` sets `currentSessionId` and the claim Set from storage (NetworkedStorage.js:83-96) |
| 3. Services built | `_createServices` (networkedSession.js:140-166): `NetworkedQueueManager` constructor calls `loadQueue` (networkedQueueManager.js:34) | `tempQueue` replaced from `networkedTempQueue` |
| 4. Connect | `ConnectionManager.connect` (connectionManager.js:93): health check (:139), `client.connect` (:145), then event `connected` (:154) | none yet |
| 5. `connected` handler | `adminController.initialize()` (networkedSession.js:174-181) builds `MonitoringDisplay`, which registers its listener and emits `sync:request` (MonitoringDisplay.js:35, :44, :197) | StateStore subscriptions registered |
| 6. First `sync:full` (from the connect handshake, backend/websocket/gmAuth.js:179) | Router chain, `sharedInfraRouter` (messageRouters.js:92-155). Boundary first (:94): `UDM.currentSessionId` is null, so `resetForNewSession` runs (networkedSession.js:251) and `clearQueue` (:258). Then union claims, per-team scores, replace transactions and player scans, merge session, replace store domains, re-emit display mode, `reconcileWithServerState`, `syncQueue` | Every copy replaced or merged as in 2.2. The persisted queue is wiped by the boundary before `syncQueue` runs (conclusion 5). Claims set cleared then rebuilt from this device's server list only. |
| 7. Second `sync:full` (answer to `sync:request`) | Same handler; no boundary now (id matches) | Idempotent apply. `team-score:updated` fires once per team again. |
| 8. Live events | Section 3.1 | As in 2.2 |
| 9. Admin tab opened | `switchView('admin')` (app.js:322-327) then `updateAdminPanel` (gameOps.js:467-470) then `refreshAllDisplays` (MonitoringDisplay.js:374) then `sync:request` | A full `sync:full` apply, no boundary. Store `replace` skips notification when a flat domain is unchanged (stateStore.js:58-60). |
| 10. Socket drops (not client-initiated) | `disconnectHandler` (connectionManager.js:235): sets state, dispatches `disconnected`, schedules backoff 1s to 30s with jitter (:269-273, :330-340). `NetworkedSession._disconnectedHandler` calls `adminController.pause()` (networkedSession.js:183-187), which calls `pause` on modules that define none (adminController.js:98-103) | No copy cleared, no stale flag. Scans keep working: claims marked, entries queued and persisted, result screen drawn. The status dot is not redrawn. |
| 11. Reconnect | `connect()` again builds a NEW socket (orchestratorClient.js:88). `connected` event runs `adminController.initialize()` again, which logs "Already initialized" and does nothing (adminController.js:48-51). `MonitoringDisplay.resume` has no caller | One `sync:full` arrives from the handshake. Same game session id: no boundary, so union claims (stale claims stay), replace transactions, per-team scores, merge session. `syncQueue` replays entries; `NetworkedStorage.socket` still points at the dead old socket (app.js:541). |
| 12. Queue replay | `queueTransaction` writes first, then `_submitDurable` if connected (networkedQueueManager.js:53-68). `syncQueue` replays serially (:161-265), 30 second timeout each (:294-300) | Result `accepted`: entry removed, claim stays, the copy of the transaction arrives by `transaction:new`. `duplicate`, `rejected`, `error`: entry removed and `transaction:failed` raised; app.js:232-264 shows an error and unmarks only for non-duplicates. `queued` or timeout: entry stays. |
| 13. Page hidden or shown | `visibilitychange` closes the socket through `ConnectionManager.disconnect()` and reconnects on visible (connectionWizard.js:541-591). `disconnect()` removes the reconnect handler and does not dispatch `disconnected` | Same as steps 10-11 except `adminController.pause()` is not called. NFC is paused and re-armed. |
| 14. Page reload | Phases of step 1 repeat. Restored from localStorage: auth token, URL, station name, deployment mode, `deviceId`, `mode`, queue, claim guard, `networkedSessionId`, pack pointer. Not restored: transactions, scores, player scans, session record, store domains, devices, teams. | The first event with a session id is treated as a new game session (conclusion 5). |
| 15. New game session | Backend broadcasts `session:update` and then `sync:full` (backend/websocket/broadcasts.js:73-105). `session:update` hits the boundary first (messageRouters.js:197-200) | `resetForNewSession`: claims, transactions, player scans, scores cleared; `data:cleared` event redraws; `setSessionId` writes `networkedSessionId`; queue wiped without a `queue:changed` event. `sessionState` merged, not reset. StateStore untouched. |
| 16. Game session end | `session:update` status `ended` (backend/websocket/broadcasts.js:114) | `sessionState` merged; no boundary; no clearing; scans blocked by the status gate; report downloadable from retained copies |
| 17. Scores reset | `scores:reset` then `sync:full` (backend/websocket/broadcasts.js:297-326) | Scores zeroed, claims cleared, then `sync:full` replaces transactions |
| 18. System reset | `adminResetAndCreateNew` sends `system:reset` on the raw socket and waits for the ack (gameAdmin.js:307-340), then `session:create` | No handler clears copies; they clear when the next game session's id arrives (inference: backend/services/systemReset.js emits no `sync:full`; grep for `sync:full|session:update|emit` in that file printed nothing). |
| 19. Auth failure | `error` event with `AUTH_*` or `PERMISSION_DENIED` (messageRouters.js:157-168), or handshake reject (connectionManager.js:167-176) | Token removed; `auth:required`; wizard shown; copies stay |

Unconsumed `sync:full` fields: `pack` and `profile` (backend/websocket/syncHelpers.js:151, :157). Command that shows it: `grep -rn "payload\.pack\|syncData\.pack\|\.profile\b" ALNScanner/src --include=*.js` printed nothing.

HTTP reads that make transient copies: `/health` (connectionManager.js:66; StateValidationService.js:125), `/api/session` existence check only (StateValidationService.js:148, :161), `/api/state` device list for station naming (connectionWizard.js:204, :215), `/api/pack/manifest` and `/api/pack/files/*` (packLoader.js:112-113).

## 7. Questions with several answers

| Question | Places that answer (file:line) | Can they disagree, and when |
|---|---|---|
| Is this token claimed? | `UDM.scannedTokens` (gameOps.js:253); `NetworkedStorage.transactions` (Game Activity "claimed", gameActivityBuilder.js:92); `localStorage networkedScannedTokens:<id>` (reload); `tempQueue` (pending); backend `checkDuplicate` (duplicatePolicy.js:83). Standalone: `LocalStorage.scannedTokens` and `sessionData.transactions` | Yes. After a delete: Set says claimed, transactions say not, backend says free. After a claim by another station seen only through `sync:full`: Set says free, transactions say claimed, backend says claimed. After reload: the storage copy is cleared at the first boundary. |
| What is team X's score? | `backendScores` through the scoreboard and stats (NetworkedStorage.js:194, unifiedDataManager.js:747); local sum on the team-details screen (:685); per-card recompute (GameOpsRenderer.js:299); result-screen points (uiManager.js:473); `TeamRegistry.teams[].score` (unread); `sessionState.scores` (stale) | Yes. Scoreboard versus team details differs by group bonus and admin adjustments. The result screen shows a number the backend may never award (duplicate, rejection). |
| What is the game session's status, and may I scan? | `UDM.sessionState.status` (gameOps.js:234); `SessionRenderer._viewState` (SessionRenderer.js:37); `NetworkedStorage.getCurrentSession()` returns `'active'` whenever an id is set (NetworkedStorage.js:291-296, not used in networked mode); backend `session.status` (transactionService.js:157) | The first two are fed by one event but through two consumers with different merge rules. The third is hard-coded. Before the first event after reload, `sessionState.status` reads `disconnected` while `SessionRenderer` shows nothing. |
| Which teams exist? | `TeamRegistry.teams` (team-entry list); `backendScores` keys (scoreboard); `sessionState.teams`; standalone `aln_recent_teams` | Yes. A team with no scan is in the registry and not in the scoreboard (the scoreboard shows "No Teams Yet" when `backendScores` is empty, GameOpsRenderer.js:50-59). A `sync:full` with `session:null` leaves the registry unchanged (teamRegistry.js:161). |
| Which game session is current? | `UDM.currentSessionId` (:50); `NetworkedStorage.currentSessionId` (:33); `localStorage networkedSessionId`; `sessionState.id` | Yes after reload: storage holds the old id, UDM holds null, and the claim-guard key follows the storage copy until the boundary runs. |
| Is the orchestrator connected? | `OrchestratorClient.isConnected` (:63); `ConnectionManager.state` (:33); header class (connectionManager.js:373); admin-panel dot (MonitoringDisplay.js:400); `NetworkedStorage.isReady()` on a stale socket (NetworkedStorage.js:40) | Yes. The admin dot is redrawn only on `sync:full` and tab open. `NetworkedStorage.socket` is the pre-reconnect socket after any reconnect. |
| Is video available (the "is VLC usable" family)? | StateStore `health` row (HealthRenderer); StateStore `video` state (VideoRenderer); held items (HeldItemsRenderer); per-cue `disabledBy` and `dormantCommands` in `cueengine` (CueRenderer.js:76-135) | Possible. They arrive as separate `service:state` events, so a window exists where one has changed and another has not (inference; I did not read the backend publishing order). |
| What is the display showing? | `MonitoringDisplay._currentDisplayMode` (:38); `VideoRenderer._displayMode` (:34); StateStore `video` state | Yes. "Return to Video" visibility combines the first with the third (MonitoringDisplay.js:298-307). Both display copies start with different defaults (`IDLE_LOOP` versus null). |
| How long has the game been running? | StateStore `gameclock`; `SessionRenderer._lastElapsed` ticking locally (SessionRenderer.js:150-156); `HeldItemsRenderer` computes duration from the backend `heldAt` against the browser clock | Yes: local extrapolation drifts between pushes, and the held counter is wrong under clock skew (inference). |
| Which rules are in force? | Scanner pack copy (`TokenManager.packInfo`, settings pack line); handshake `packHash`; backend `pack` in `sync:full` (unread); backend `/health` | Yes after a pack publish mid-game. The scanner keeps its loaded pack until reload (packLoader header) and never compares. |
| What did players discover? | `NetworkedStorage.playerScans` (Game Activity); `sessionState.playerScans` (stale snapshot) | Yes between `sync:full` events. Only the first is read. |
| Who is connected? | `MonitoringDisplay.devices`; `sessionState.connectedDevices` (stale snapshot); `/api/state` at login | Yes. The list is never cleared on disconnect. |

## Appendix A. Claims in the maps, checked against the code

| Claim (source) | Result |
|---|---|
| "Phase 1H: Load DataManager (transactions + scannedTokens)" (ALNScanner/CLAUDE.md, Initialization Sequence) | False. `loadDataManager` only calls `updateHistoryBadge` (initializationSteps.js:77-79). The strategies load their own data in `initialize()` (LocalStorage.js:66, NetworkedStorage.js:105). |
| `localStorage.getItem('transactions')` debug recipes (ALNScanner/CLAUDE.md, Debugging and Troubleshooting) | No code reads or writes `transactions`. Standalone stores `standaloneSession` (LocalStorage.js:114). |
| "`MonitoringDisplay.refreshAllDisplays()` re-renders the template" (ALNScanner/CLAUDE.md, GOTCHA) | Not in the current code. It calls `updateSystemDisplay` and `_requestInitialState` only (MonitoringDisplay.js:374-378). |
| StateStore API: update, get, getAll, on, off (ALNScanner/CLAUDE.md) | Incomplete. `replace` exists (stateStore.js:50) and carries all of `sync:full`. |
| "Strategy selected at startup by SessionModeManager" (ALNScanner/CLAUDE.md) | The App picks it: `initializeStandaloneMode` (app.js:471) or `initializeNetworkedMode` (app.js:533). |
| "DataManager.scannedTokens ... persisted in localStorage" (ALNScanner/CLAUDE.md, Duplicate Detection) | Networked: yes, under `networkedScannedTokens:<id>`. Standalone: rebuilt from `standaloneSession` transactions, no separate key. |
| `initializationSteps.js:187-224` restore logic (ALNScanner/CLAUDE.md) | Moved. Now `determineInitialScreen` at :344 and `validateAndDetermineInitialScreen` at :384. |
| MESSAGE_TYPES list of 22 (ALNScanner/CLAUDE.md) | Correct against orchestratorClient.js:26-49. |
| `getTeamCompletedGroups()` returns `[]` pending F-GMS-02 (ALNScanner/CLAUDE.md) | Correct (unifiedDataManager.js:569-575), but the Troubleshooting entry for "Group completion bonuses not calculating" says the field-name bug is fixed; the display still shows $0. |
| A GM scanner with stale rules re-fetches the pack and reconnects (CONTEXT.md section 4, self-heal) | Not implemented in the scanner (conclusion 8). |
| "Admin modules ... pause/resume on connection state changes" (adminController.js header) | The calls exist, but the target methods do not (adminController.js:98-121). `MonitoringDisplay.resume` is never called. |
| `session:overtime` has no consumer (messageRouters.js:186-188) | MonitoringDisplay.js:230 consumes it. |
| Root CLAUDE.md: `sync:full` carries 10 service domains | Correct for the scanner's apply: 10 `store.replace` calls (messageRouters.js:127-136). |

## Completion check

- 22 `MESSAGE_TYPES` entries traced to handler and copy (section 3.1). Command: `sed -n '/^export const MESSAGE_TYPES/,/^];/p' ALNScanner/src/network/orchestratorClient.js | grep -c "^  '"`, printed 22. 19 have a handler, 3 have none.
- 14 localStorage keys, all in section 2.3. Command: the grep shown there (12 literal) plus the template key and the pack pointer.
- 11 renderer files in `ALNScanner/src/ui/renderers`, all in section 3.5. Command: `ls ALNScanner/src/ui/renderers/*.js | wc -l`, printed 11.
- 67 source files, all in section 1. Command: `find ALNScanner/src -name '*.js' | wc -l`, printed 67; total 16486 lines.

## Terms CONTEXT.md lacks

- Claim guard. The scanner's local set of tokens it believes are claimed (`scannedTokens`), used to refuse a duplicate before asking the backend.
- Game session boundary. The moment the scanner sees a game-session id different from its own, which triggers a full local reset (`_handleSessionBoundary`).
- Pending local action. A scan the scanner has accepted and persisted but the backend has not yet answered (the offline queue).
- Optimistic result. The "Transaction Complete!" screen drawn before the backend answers.
- Snapshot versus live update. The two kinds of delivery: a full-state event (`sync:full`) and an incremental event.
- Event copy versus derived copy. A copy filled by an event (backendScores) versus a value the scanner computes from other copies (team-details score, Game Activity, exposed owners).
- Parallel consumers. Two scanner modules that apply the same event to separate copies (UDM `sessionState` and `SessionRenderer`/`TeamRegistry` for `session:update`).
