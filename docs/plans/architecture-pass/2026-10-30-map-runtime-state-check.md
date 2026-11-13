# Check of the runtime-state map (`2026-10-30-map-runtime-state.md`)

This file checks every claim in the map's sections 3, 4, 5 and 8, and 19 rows of section 2. Each claim was treated as wrong until the code showed it held. The tree is branch `claude/nice-curie-hescfv` at `5ccadd42`. `git diff 26fc2f2 HEAD` over `backend/src`, `backend/public`, `ALNScanner`, `aln-memory-scanner` and `arduino-cyd-player-scanner` is empty, so the code is the code the map read. Nothing was run. Every verdict comes from reading the cited lines. Backend paths are under `backend/src/` unless prefixed. GM paths are under `ALNScanner/src/`.

Verdicts:
- **holds**: the code says what the map says. A note may correct a citation or add a qualifier that does not change the claim.
- **wrong**: the code says something else. The evidence column gives the correction.
- **unsupported**: no citation in the map reaches the code.

## Verdict counts

| Section | Claims | Holds | Wrong | Unsupported |
|---|---|---|---|---|
| §3.1 more than one authority | 13 | 12 | 1 | 0 |
| §3.2 copies that only grow | 23 | 18 | 5 | 0 |
| §4.1 four routes | 4 | 3 | 1 | 0 |
| §4.2 snapshot vs live builders | 14 | 13 | 1 | 0 |
| §4.3 who else sends | 3 | 3 | 0 | 0 |
| §5 questions with several answers | 23 | 19 | 3 | 1 |
| §8 Q1-Q6 (split into claims) | 14 | 9 | 5 | 0 |
| §8 "what the questions miss" 1-7 | 7 | 5 | 2 | 0 |
| §2 rows sampled | 19 | 17 | 2 | 0 |
| **Total** | **120** | **99** | **20** | **1** |

## Verdict table

### §3.1 Facts with more than one authority

| Claim | Verdict | Evidence |
|---|---|---|
| Game session phase: `startGame` sets status before the clock starts; elapsed keeps counting after `stop()`; `NetworkedStorage.getCurrentSession()` says `active` whenever an id exists | holds | `sessionService.js:317` `currentSession.start()`, `:332` `gameClockService.start()`; `gameClockService.js:93-97` `getElapsed` uses `Date.now()` when status is not paused and `gameStartTime` is never cleared by `stop()` (`:75-91`); `NetworkedStorage.js:291-296` hard-codes `status:'active'` |
| Is a video playing: a paused video is "not playing" to `isPlaying`, `getCurrentVideo`, `canAcceptVideo`; `processQueue` guards on `isPlaying()` and `addToQueue` on `!currentItem`, so a paused video can be overwritten; during the idle loop VLC says playing while the queue is idle | holds | `videoQueueService.js:969-971`, `:977-981` (null unless playing), `:901-903` (only `isPlaying()` blocks), `:89-91` (paused `currentItem` passes the guard), `:70` (`addToQueue` skips `processQueue` while paused). An overwrite needs another `processQueue` caller, such as `releaseHeld` (`:951`). §3.1 lists seven places, not the "six readers" that Q5 and Conclusion 4 count |
| Display health and visibility: SCOREBOARD with `visible` false and a success ack; `display` red after a system reset with a live kiosk; a kiosk that closed cleanly while hidden reports healthy with no process | holds | `displayControlService.js:233-244` (warns on `shown === false`, then returns `success:true`); `serviceHealthRegistry.js:285-292` reset downs `display`; `displayDriver.js:255-258` `ensureBrowserRunning` returns early with no report while the process lives; `displayDriver.js:209-210`, `:370-375` |
| Held items: two stores, two counters, merged at push; expiry only for `video_busy`; different release rules; `releaseAll` stops at the first throw | holds | `heldItemsStore.js:26,83` (counter `_globalHeldIdCounter`) vs `videoQueueService.js:16,917` (`heldIdCounter`); auto-discard only at `cueEngineService.js:861-868`; `releaseCue` `:1046-1056` vs `releaseHeld` `videoQueueService.js:941-952`; `commandExecutor.js:793-799` has no try/catch round `releaseCue`/`releaseHeld` (the comment there says "TRY-ALL") |
| Which pack is running: after a publish without a restart, the engine keeps old rules, the TV reads the new `game.json`, `/api/tokens` returns new tokens, the GM keeps its cached old pack, the PWA shows its own file | holds | `packService.js:1254-1269` `getManifest` returns the frozen manifest; `:1450-1463` serves current disk bytes under it; `scoreboard.html:1231` fetches `/api/pack/files/game.json`; `tokenService.js:75-119` re-reads disk. Note: the GM's old pack is the engine's pack. They agree, and the GM differs from the TV and `/api/tokens`, not from the engine (see §8 Q6) |
| Is this token claimed: after a delete, backend free, GM Set claimed, GM list free, counters still counting | holds | `transactionService.js:691-718` splices the device claim; `uniqueTokensScanned`/`totalScans` untouched; `messageRouters.js:47-54` ignores `tokenId`; `NetworkedStorage.js:394-403` leaves the Set |
| Team score: GM scoreboard vs team details differ by every group bonus and admin adjustment | holds | `GameOpsRenderer.js:221` reads `dataManager.backendScores`, which `UnifiedDataManager` does not have (grep finds it only at `unifiedDataManager.js:553` on the strategy); no strategy implements `getTeamCompletedGroups`, so `unifiedDataManager.js:569-575` returns `[]` and the bonus is 0 |
| Lighting health: three writers; a host with no token never reports | holds | `lightingService.js:114-116`, `:207`, `:254`; `:103-105` returns before reporting; `:46-49` `init` returns first |
| Music connected: private flag and registry; a dormant latch leaves the flag true; `_setConnected` pushes nothing | holds | `musicService.js:228-231`; `serviceHealthRegistry.js:81-87` ignores reports while dormant; no `emit` in `_setConnected` |
| Is equipment installed: profile, env flags and probes are not reconciled | holds | `profileService.js:105-153` (frozen, warn-only on drift); `config/index.js:91-98`, `:137-140` |
| Player-scan team: ESP32 static `TEAM_ID`; PWA `'001'` literal | holds | `arduino-cyd-player-scanner/ALNScanner_v5/models/Config.h:18`; `aln-memory-scanner/js/app.js:435`; nothing writes `sessionStorage.currentTeam` (grep) |
| Orchestrator reachable: "A dead server shows 'online' on player devices for up to 10 s" | **wrong** | The ESP32 health check runs inside `httpWithRetry` (`OrchestratorService.h:341-356`), which makes 6 attempts with a 5 s timeout each and backoff 1+2+4+8+16 s (`:1020-1050`). `_connState` stays `ORCH_CONNECTED` until all of them fail (`:1293-1310`), which is about 100 s after the crash. The PWA polls every 10 s with a 5 s timeout, so it shows online for up to about 15 s. R54 itself records the 61 s of retries. The admin-dot half of the row holds (`MonitoringDisplay.js:338,376,400` are the only redraws) |
| Standalone vs networked rules: no `setup`/`active` gate; `group:completed` never announced; a non-consuming counting mode can be summed twice | holds | `LocalStorage.js:302` blocks only `paused`; `_checkGroupCompletion` `:394-438` only logs; `:404-406` filters by `countsTowardGroups` and `:430` sums `tx.points` per transaction, while `scoring.js:184-210` sums distinct scored token ids |

### §3.2 Copies that only grow

| Claim | Verdict | Evidence |
|---|---|---|
| `totalScans`, `uniqueTokensScanned` never decremented on delete; reset by score reset | holds | `models/session.js:186-190` only increments; `deleteTransaction` (`transactionService.js:654-751`) never touches them; `persistenceListeners.js:45-46` |
| `gmStations`, `playerDevices`, `playerScanCount` never decremented | holds | `models/session.js:215-218,242-246`; `removeDevice` decrements (`:256-266`) but `sessionService.removeDevice` (`:679`) has no caller (grep) |
| `session.connectedDevices`: `removeDevice` has no caller; every `/health?deviceId` poll adds or refreshes | holds | as above; `healthRoutes.js:88` |
| `scannedTokensByDevice["undefined"]` from an unauthenticated `sync:request` | holds | `server.js:75-99` has no auth check and passes `socket.deviceId` (undefined); `models/session.js:380-383` creates the key on read. It happens only while a session exists |
| `transactionService.recentTransactions`: written, never read, never trimmed on delete | **wrong** | It does not grow. `addRecentTransaction` caps it at `config.game.recentTransactionsCount` (default 10) (`transactionService.js:496-503`; `config/index.js:62`). "Never read" holds: `getRecentTransactions` (`:550`) has no production caller. The bounded list is dead state, not growth |
| Disk keys `session:<id>`, `backup:session:*`: `archiveOldSessions`, `cleanOldBackups` have no production caller; `getAllSessions` counts `session:current` twice | holds | No callers (grep). Citation fix: `archiveOldSessions` is at `sessionService.js:565`, not in `persistenceService.js`. `persistenceService.js:187-201` filters `startsWith('session:')`, which matches `session:current` |
| `backend/logs/*.log` grows; written by every process that imports the logger | holds (cause corrected) | Rotation is configured (`logger.js:86-101`, `maxsize`/`maxFiles`), but `maxsize` is the string `'10m'` (`config/index.js:85`). Winston 3.17 tests `size >= this.maxsize` (`node_modules/winston/lib/winston/transports/file.js:510`), which is always false against `'10m'`, so the files never rotate. `exceptions.log` and `rejections.log` have no limit at all. The map's "many writers" is not the cause |
| `gameClockService.getElapsed()` after `stop()` | holds | `gameClockService.js:75-97`; `gameStartTime` is cleared only by `_reset` |
| GM `scannedTokens` and `networkedScannedTokens:<id>`: union on every SF; no release on delete; one key per session | holds | `NetworkedStorage.js:453-460`, `:394-403`, `:60-75`. Note: the in-memory Set is cleared at every boundary, including the first event after a reload (`unifiedDataManager.js:544-550`; see R12), so it grows only within a page life |
| GM `backendScores`: never pruned; SF with `scores:[]` leaves old rows | holds | `unifiedDataManager.js:801-811`; `messageRouters.js:102-104` |
| GM `MonitoringDisplay.devices` never cleared at boundary or disconnect | holds | `MonitoringDisplay.js:22`, `:265-270`. A SF replaces it (`:355-358`), so it is not strictly add-only |
| GM `TeamRegistry.teams`: nothing calls `removeTeam` or `clear`; a null session is ignored | **wrong** | `populateFromSession` runs `this.teams.clear()` and refills on every non-null `session:update` and SF (`teamRegistry.js:160-190`; callers `MonitoringDisplay.js:225,331`). It goes stale only across a null session (`:161`). The `clear()` method is uncalled, but the Map is cleared. R3 itself says "clear then refill" |
| GM `StateStore`: no reset method; nothing clears it at boundary or disconnect | holds | `core/stateStore.js:11-90` has `update`/`replace`/`get` only; `resetForNewSession` comments that it does not touch it (`unifiedDataManager.js:557-558`) |
| GM `sessionState`: merged, never reset; keeps keys from old sessions | **wrong** | A null session resets it to `{}` (`unifiedDataManager.js:944-951`, reached from `messageRouters.js:121-122`). "Keeps keys from an old session" holds only across a direct id change (merge at `:954-957`) |
| PWA `alnMemoryScanner.scannedTokens`: no session link, never cleared | holds | `aln-memory-scanner/js/app.js:195-215`; only read and write sites (grep) |
| TV `state.teamScores` between snapshots: per-team set; only a SF clears | **wrong** | `handleSessionBoundary` also clears it when a `session:update` arrives with a new id (`scoreboard.html:1473-1486`, called at `:1692-1693`). `scores:reset` zeroes the rows and keeps the keys (`:1719-1735`) |
| `videoQueueService._heldVideos` never expires | holds | `videoQueueService.js:915-963`; no timer |
| Held cues with reason `service_down`: no timer; nothing releases on recovery | holds | `cueEngineService.js:744-752`; the only auto-discard is `video_busy` (`:861-868`); the only `health:changed` listener outside broadcasts is `videoQueueService.js:31-34` (held videos only) |
| `spentOnceCues`, `firedClockCues` cleared only by system reset | holds | Assigned only in `_reset` (`cueEngineService.js:68,84`) and `restore` (`:1128-1130`); `createSession`/`endSession` do not touch them (`sessionService.js:195-260,503-559`) |
| `_sinkInputRegistry` dead indexes after a missed `remove` | holds | `audioRoutingService.js:431-440` returns a registry id with no check; removal only at `:823` |
| `musicService._pausedByGameClock` cleared only by reset | **wrong** | `resumeFromGameClock` clears it (`musicService.js:437-442`), called on session resume (`sessionService.js:481`). It stays set only if the session ends or is reset while paused-by-clock, because `endSession` does not resume (`:503-559`) |
| Operator tokens survive a system reset; hourly cleanup by expiry only | holds | `middleware/auth.js:13-14,341-345`; `systemReset.js:129` flushes observe tokens only |
| `processedBatches`: bounded by 1 h sweep, forgotten by restart | holds | `routes/scanRoutes.js:181-190`, module-level `Map` |

### §4.1 Four routes from the backend

| Claim | Verdict | Evidence |
|---|---|---|
| Four routes: live event, `sync:full`, HTTP snapshot, client-fetched file | holds | `broadcasts.js`; `syncHelpers.js:36-159`; `stateRoutes.js`, `sessionRoutes.js`, `healthRoutes.js`; `resourceRoutes.js:53-65`, `packRoutes.js` |
| "Every fact in R1-R16 travels on at least two of them" | **wrong** | R11 (backend offline queue) reaches no client: no SF key, and `offline:queue:processed` is unreachable because `isOffline` is never set (`offlineQueueService.js:206`, no production caller) and the GM has no handler. R12 is client-held; its outcome comes back on one route only (`transaction:result` for the GM, the HTTP reply for players) |
| The GM applies the same fact through three internal paths, `MonitoringDisplay._handleMessage` listening directly for session, teams, devices, display mode | holds | `MonitoringDisplay.js:35`, `:216-252`; `messageRouters.js` |
| The session record is consumed twice from one event, merge in one and replace in the other | holds | `messageRouters.js:197-202` → `updateSessionState` merge; `MonitoringDisplay.js:223-228` → `SessionRenderer.render` and `TeamRegistry.populateFromSession` |

### §4.2 Snapshot and live update built by different code

| Claim | Verdict | Evidence |
|---|---|---|
| Game session: `toJSON()` vs inline subset | holds | `syncHelpers.js:133`; `broadcasts.js:75-83,120-128` |
| Score rows: same `toJSON`, different call sites; live may be `null`; delete sends one team of a full rebuild | holds | `broadcasts.js:188-210,231-243`; `transactionService.js:735-737` builds `allTeamScores`, `broadcasts.js:256-261` drops it |
| Transactions: two copies of one mapping, identical today | holds | `syncHelpers.js:63-81` and `broadcasts.js:192-208` emit the same 14 keys |
| Devices: "field names differ (`id` vs `deviceId`)" | **wrong** | Both wire shapes use `deviceId`: SF `syncHelpers.js:90-97`, `device:connected` `broadcasts.js:166-172`, `device:disconnected` `deviceHelpers.js:32-37`. `id` exists only on the model. The real difference is the key set: only the SF has `connectionStatus`, and `device:disconnected` alone has `disconnectionTime` and `reason`. "Snapshot filter varies by sender" holds |
| Player scans: `id` vs `scanId` | holds | `models/session.js:203-210` vs `scanRoutes.js:111-119,336-345`; the GM maps `scanId`→`id` (`unifiedDataManager.js:841-848`) |
| Claimed tokens: snapshot only, absent from the three `gm`-room SFs; GM keeps its Set when absent | holds | `gmAuth.js:150-152`; `server.js:92-95`; broadcasts SFs never add it; `messageRouters.js:97` |
| Game clock: snapshot omits `startTime`, `totalPausedMs`; GM adapter strips extras | holds | `syncHelpers.js:168-191` vs `gameClockService.js:99-113`; `MonitoringDisplay.js:180-187` |
| Cue engine: `loaded` only in the snapshot | holds | `syncHelpers.js:205-210` vs `cueEngineService.js:168-174` |
| Display mode: `getStatus()` vs `{mode, previousMode}`; GM re-emits the SF as a fake live event; TV ignores the SF | holds | `syncHelpers.js:125-130`; `displayControlService.js` emits `{mode, previousMode}`; `messageRouters.js:140-144` (drops `previousMode`, `pendingVideo`); TV SF handler `scoreboard.html:1741-1789` reads no `displayStatus` |
| Held items: same builder, different wrapper | holds | `broadcasts.js:589-592`; `messageRouters.js:134` |
| Music: same function; the contract says the live push lacks `playlists` | holds | `broadcasts.js:497-507`; `asyncapi.yaml:2674-2677` |
| Video, health, bluetooth, audio, lighting, sound: same `getState()`/`getSnapshot()` | holds | `environmentHelpers.js:45,54,63`; `syncHelpers.js:57,101,121`; `broadcasts.js:487-493` |
| Pack, profile: snapshot only, no pack-changed event | holds | `syncHelpers.js:151,157`; no such message in `asyncapi.yaml` (message list grep) |
| Preflight: neither | holds | grep for `preflight` in `routes/` and `websocket/` hits only comments (`healthRoutes.js:40`, `socketServer.js:138`) |

### §4.3 Who else sends the "same" fact

| Claim | Verdict | Evidence |
|---|---|---|
| `sync:full` has 18 keys (16 from the builder, 2 from callers) and six senders; GM and TV each ask for a second one on connect | holds | Builder returns 16 keys (`syncHelpers.js:132-158`); `gmAuth.js:177-182` adds `deviceScannedTokens`, `reconnection`; senders `gmAuth.js`, `server.js:75`, `broadcasts.js` ×3, `stateRoutes.js`; `MonitoringDisplay.js:194-199`; `scoreboard.html:1591,1639` |
| Room targeting: session room, `gm` room, all sockets | holds | `emitToRoom` at `broadcasts.js:216,253,267,294,346,367`; `emitWrapped(io, …)` at `:75,120,166,464` and `deviceHelpers.js:32` |
| `gm:identified` emitted but in neither the contract nor `MESSAGE_TYPES`; code emits 23 names, contract lists 22; three of the GM's 22 have no handler | holds | 23 distinct names by grep of `emitWrapped`/`emitToRoom`; 22 server→client messages in `asyncapi.yaml` (`gm:identified` only in prose at `:295`); `orchestratorClient.js:26-49`; no handler for `offline:queue:processed`, `batch:ack`, `cue:completed` (grep) |

### §5 Questions with several answers

| Claim | Verdict | Evidence |
|---|---|---|
| Is this token claimed? Disagree after a delete, after a SF-only claim by another station, after reload | holds | As §3.1. Note: after a reload the rehydrated Set (`NetworkedStorage.js:83-96`) is wiped by the first SF, because `UnifiedDataManager.currentSessionId` starts null (`unifiedDataManager.js:50`; `networkedSession.js:246-259`) |
| What is team X's score? | holds | `uiManager.js:472-477` computes points locally; the rest is as §3.1 |
| Which teams exist? | holds | `transactionService.js:357-368`; a team added by `session:addTeam` has no `backendScores` row until the next SF (`NetworkedStorage.js:194-210`) |
| What phase, may I scan? | holds | `gameOps.js:233-241`; `scanRoutes.js:43` (existence only) |
| Which game session is current? | holds | `sessionService.js:539,552`; GM ids as cited |
| Which pack is running? | holds | As §3.1; `socketServer.js:139-148` warns only |
| Token values and groups: the GM recomputes every card even when `tx.points` is present | holds | `GameOpsRenderer.js:299` → `scoring.js:202-217` ignores `points` |
| Who is connected? | holds | `syncHelpers.js:84-98`; `config/index.js:76-77` (60 s + 25 s) |
| Is the orchestrator reachable? "player devices show online for up to 10 s after a crash" | **wrong** | Same correction as §3.1: about 100 s on the ESP32 (`OrchestratorService.h:341-356,1020-1050`), up to about 15 s on the PWA. The TV 5-minute rule holds (`scoreboard.html:1580-1606`, `onAny` counts application events only) |
| Is the system offline? One answer, never set | holds | `adminEvents.js:203`; `setOfflineStatus` has no production caller |
| Has this player scan been recorded? A 4xx batch is dropped by the PWA and retried forever by the ESP32 | holds | `orchestratorIntegration.js:333-356`; `OrchestratorService.h:540-545` removes entries only on 200 |
| Which team did a player scan belong to? | holds | As §3.1 |
| Has a token been seen or exposed? | holds | `aln-memory-scanner/js/app.js:195-215` |
| Can a video be queued from this scan? | holds | `scanRoutes.js:97`; `videoQueueService.js:895-903` |
| Is VLC usable? Another MPRIS player can mark `vlc` healthy while `_ownerBusName` is null | holds | `mprisPlayerBase.js:255-265` accepts every sender while the owner is null; `vlcMprisService.js:436-438` reports healthy on any signal; `:127` nulls the owner on exit |
| Is the display healthy? The "Return to Video" button combines two copies; the TV ignores the snapshot | holds | `MonitoringDisplay.js:296-308`; TV as §4.2 |
| Is equipment X installed? The operator door cannot be set | holds | `dormancyService.setOutOfService` has no caller; the four actions fall to `Unknown action` (`commandExecutor.js:98-101,963-968`) |
| Is a cue enabled? `enableCue` re-arms a spent once-cue | holds | `cueEngineService.js:298` |
| Is the clock running? | holds | `gameClockService.js:75-97`; `SessionRenderer.js:150-156` |
| Is the game session ended? "the server holds nothing while every client holds the last ended record" | **wrong** | True only until the next restart. `endSession` writes the ended record to `session:current` (`sessionService.js:530-534`), and only `reset` deletes that key (`:770`). `init` reloads `session:current` unconditionally (`:108-110`), so after a restart `currentSession` is the ended session. While it is current, `GET /api/session` returns it, and `scanRoutes.js:43-50` accepts player scans into it because the check is existence only. The engine's comment at `:521-528` expects this ("would resurrect the session … on restart") |
| Which rules are in force on this GM? "the GM keeps its loaded pack until reload" | **wrong** | A reload changes nothing while the orchestrator runs. `/api/pack/manifest` serves the frozen manifest (`packRoutes.js:19-31` → `packService.js:1254-1269`), so a reloaded GM re-activates the same pack from its cache (`packLoader.js:155-163`). A GM without that hash cached tries a staged refresh against the frozen manifest. The live bytes fail sha1 (`:220-224`), and the GM falls to its last cache pointer or the bundled copy (`:170-185`), neither of which is the engine's pack. "Until reload" should be "until the orchestrator restarts". The second case is the real split |
| Is a VLC, MPD or kiosk running on this machine? Two orchestrators each own the pid files; the second reaps the first's child | holds | `processMonitor.js:180-192` (pid file plus cmdline substring, SIGTERM); `displayDriver.js:127-147` |
| Which pack and profile did this test run use, and is the environment real? | unsupported | The row cites only the clients sheet §4.6 (`E2E_PACK_PATH`, `provisionForRun`, `harnessProvides`). No code line in the map reaches it |

### §8 The six questions

| Claim | Verdict | Evidence |
|---|---|---|
| Q1: game facts have one authority; GM screens honour it unevenly (result screen local points, team-details local sum, scan gate Set, Game Activity from the list) | holds | `uiManager.js:472-477`; `GameOpsRenderer.js:221`; `gameOps.js:253`; `gameActivityBuilder.js:84-92` |
| Q1: "Thirteen facts have more than one deciding place" | holds | §3.1 has 13 rows |
| Q1: "The pack has one authority in principle and five in practice (R15)" | **wrong** | The map's own §3.1 pack row lists six deciding places (frozen snapshot, live disk bytes, GM, PWA, ESP32, config tool), and Q5 says "six answerers" |
| Q2: health and service state travel apart; `connected` fields read at push time; TV drops all but `gameclock`; dormancy stops nothing | holds | `broadcasts.js:536-538`; `serviceHealthRegistry.js:97-105`; `scoreboard.html:1792-1797`; `app.js:326` runs after every service start |
| Q3: every outside program is read by text parsing or event streams; the probe covers six of nine services and never the display; VLC `track` never re-read | holds | `serviceHealthRegistry.js:236-244`; `mprisPlayerBase.js:158-177` reads `PlaybackStatus` only |
| Q3: "No reading carries an age" | **wrong** | Every health entry carries `lastChecked`, written on every `report()` (`serviceHealthRegistry.js:94-98`) and shipped in every `health` push and SF (`:217-223`). Every envelope carries a send `timestamp` (`eventWrapper.js:14-18`). What is true is that no client reads either for staleness: `HealthRenderer.js` never references `lastChecked` (grep) |
| Q4: a second orchestrator or test run can reap children, kill kiosks, kill `pactl subscribe`, launch the kiosk; 8 contract files and 21 integration files reach these calls | holds | Counts by grep (`initializeServices` in 8 contract files; `resetAllServicesForTesting`/`performSystemReset` in 21 integration files); `audioRoutingService.js:110` `_killStaleMonitors` has no test guard; `displayControlService.js:90-94` pre-launch with no guard |
| Q5: "Twenty-three questions have more than one answerer (§5)" | **wrong** | §5 has 23 rows, and one of them ("Is the system offline?") is the single-answer case Q5 itself names, so 22 questions have several answerers. Likewise "'is a video playing' has six readers": the §3.1 row lists seven |
| Q6 game session end: record nulled; held items, running cues, queue, once-cue sets, growing elapsed stay; GM clears nothing | holds | `sessionService.js:503-559` (only clock stop and cue suspend); `messageRouters.js:198` skips the boundary on `ended` |
| Q6 new game session: the GM "merges the session record and keeps the service panels, devices and the team registry" | **wrong** | The team registry is cleared and refilled from the new session on its first `session:update` (`teamRegistry.js:164`, via `MonitoringDisplay.js:225`). Panels, devices and the merged record are kept as stated |
| Q6 system reset: music dropped (production), `display` red, listener order reversed, no SF at the end of the reset | holds | `adminEvents.js:77-90` omits `musicService`; `systemReset.js:122,138-162`; no `sync:full` in `performSystemReset`. Note: the GM's "reset and create new" flow sends `session:create` right after (`gameAdmin.js:343`), which broadcasts a SF to the `gm` room (`broadcasts.js:98-103`). Citation fix for "tests pass it": the cited `integration-test-server.js:116` is the `sync:request` builder call. The tests that pass `musicService` into the reset are `tests/integration/service-state-push.test.js:49-64` |
| Q6 restart: session, clock and standing cues restored; running cues, queues, held items, music and VLC copies lost or defaulted; credentials die | holds | `sessionService.js:108-174`; `auth.js:13-20` in-memory. Omission: the restart also restores an ended session as current (see §5 "Is the game session ended?") |
| Q6 pack change: "the GM rejects it until reload" | **wrong** | The GM rejects it until the orchestrator restarts, not until reload (see §5 "Which rules are in force on this GM?"). The PWA and ESP32 halves hold |
| Q6 summary: "no client is told to re-check after a reset" | holds | No event is emitted to clients at the end of `performSystemReset` |

### §8 What the map shows that the six questions miss

| Claim | Verdict | Evidence |
|---|---|---|
| 1. Write rule of a copy (replace, merge, add-only, union) | holds | `NetworkedStorage.js:357,365,453-460`; `unifiedDataManager.js:954-957`; `stateStore.js:18-75` |
| 2. Snapshot and live built by different code for seven facts | holds | §4.2 "No" rows (session, devices, player scans, game clock, cue engine, display mode) plus transactions' duplicated mapping |
| 3. Unauthenticated sockets receive `session:update` and can request a full snapshot | holds | `socketServer.js:51-53` guards only `deviceType === 'gm'`; `server.js:75` has no auth check; `emitWrapped(io, 'session:update', …)` |
| 4. "No copy in the engine or any client carries the time it was last confirmed" | **wrong** | Health entries carry `lastChecked` (`serviceHealthRegistry.js:94-98`) on the wire. The finding should be "no client uses it", as in Q3 |
| 5. Contract drift on three payloads (music `playlists`/`playlist`, cue-engine `loaded`, game-clock keys) and one event | **wrong** | Only music and `gm:identified` drift. The contract declares the snapshot and push shapes separately, and both match the code: SF `cueEngine` requires `loaded` (`asyncapi.yaml:838`), while `DomainStateCueengine` requires `[cues, activeCues, disabledCues]` (`:2757-2763`). SF `gameClock` requires `[status, elapsed, expectedDuration, phase]` (`:822`), while `DomainStateGameclock` requires `startTime`, `totalPausedMs` (`:2736-2738`). Music does drift: push `playlist` is typed string-or-null (`:2677`) against an object in code, and the push description excludes `playlists` (`:2678-2679`) though `buildMusicState` sends it |
| 6. Dead and unreachable paths (offline queue, operator door, `validateCommand`, `HeldItemsStore` video branch, `batch:ack`, standalone delete button) | holds | `validateCommand` has no caller (grep, export only at `commandExecutor.js:1061`); `heldItemsStore.js:180-210` uncalled; `batch:ack` to `device:<id>` (`scanRoutes.js:399`), joined only in `gmAuth.js:102`; standalone transactions get no `id` (`gameOps.js:305-317`) and the delete button needs `token.id` (`GameOpsRenderer.js:330`) |
| 7. Player devices send a team the session never declared | holds | As §3.1 |

### §2 rows sampled (19)

| Row | Verdict | Evidence |
|---|---|---|
| R1 game session record, "Cleared at: End: `currentSession = null`" | **wrong** | The boundary list misses the restart: `session:current` keeps the ended record (`sessionService.js:533`) and `init` restores it as current (`:108-110`). The rest of the row holds: `unifiedDataManager.js:944-961`; `messageRouters.js:197-202`; `MonitoringDisplay.js:223-228` |
| R3 teams | holds | `teamRegistry.js:160-190`; `transactionService.js:357-368`; the `team:<id>` room has no emitter (grep) |
| R4 transactions incl. the checked system-reset reversal | holds | Boot: `app.js:206` → `sessionService.js:178-181`, then `server.js:296` → `:139`. Reset: `systemReset.js:138` then `:161-162`. `broadcasts.js:301-325` builds the SF and `syncHelpers.js:63` maps transactions before the first `await` (`:104`); `persistenceListeners.js:44` clears afterwards; the GM replaces (`messageRouters.js:105-107`); the TV rebuilds evidence (`scoreboard.html:1759-1777`) |
| R5 team scores | holds | `GameOpsRenderer.js:221`; `NetworkedStorage.js:409-433` (`scores:reset` → `clearBackendScores` → `resetBackendScores`, which also clears the claim Set) |
| R7 claim registry | holds | `persistenceListeners.js:100-102`; `transactionService.js:691-718`; `NetworkedStorage.js:368-381,453-460`; `messageRouters.js:47-54` |
| R9 player scans incl. replayed batches still fire cue triggers | holds | `scanRoutes.js:325-345`; `sessionRegistry.js:92`; `cueEngineWiring.js:119-121` |
| R12 pending local actions incl. the checked reload wipe | holds | `networkedQueueManager.js:34,401-405`; `networkedSession.js:246-259`; `unifiedDataManager.js:50` |
| R13 connected devices: live events "with field names that differ from the SF (`id` vs `deviceId`)" | **wrong** | Same correction as §4.2 Devices: all three shapes use `deviceId`, and they differ in key sets. The GM matches on `deviceId` in both paths (`MonitoringDisplay.js:266-269,355-358`) |
| R15 active pack, GM "a publish without a restart leaves the GM on the old pack" | holds | `packLoader.js:155-185,205-240`. The old pack is the engine's (frozen manifest). A GM with no cached copy of it ends on another cache or the bundled copy |
| R21 game clock | holds | `gameClockService.js:75-113`; `broadcasts.js:572-576`; `syncHelpers.js:168-191` |
| R24 standing-cue state incl. the two GM new-session flows | holds | `SessionManager.js:30-31`; `gameAdmin.js:307-343`; `cueEngineService.js:55-97` |
| R26 held cues; `CONTEXT.md` §4 says every held cue auto-discards after 10 s | holds | `CONTEXT.md:334-335`; `cueEngineService.js:861-868` (video_busy only) |
| R27 held videos; ids share wire format from two counters | holds | `videoQueueService.js:16,917`; `heldItemsStore.js:26,83` |
| R29 current video: `clearQueue` nulls it without `video:completed` and without stopping VLC | holds (qualified) | `videoQueueService.js:842-875`. `clearQueue` itself does not stop VLC, but when something was playing it emits `video:idle`, and `displayControlService` answers that by loading the idle loop on VLC (`displayControlService.js:58-61`, `_doSetIdleLoop` `:172-174`) |
| R31 display mode | holds | `displayControlService.js:31-35,233-244,403-425` |
| R36 ducking: `video:failed` and `clearQueue` emit no `video:completed`, so music can stay ducked | holds | `broadcasts.js:386-411` wires only started/completed/paused/resumed; `videoQueueService.js:417-433,842-875` |
| R37 music incl. system reset omitting `musicService` | holds (citation corrected) | `adminEvents.js:77-90`; `broadcasts.js:497`; `cueEngineWiring.js:141`; `musicService.js:95-108,176-191` never read MPD status. The tests that pass `musicService` to the reset are `tests/integration/service-state-push.test.js:49-64`, not `integration-test-server.js:116` |
| R40 sounds; shutdown does not kill `pw-play` children | holds | `server.js:163-217` calls no `soundService` method |
| R46 health entries incl. display stays `down: Reset` after system reset | holds | `serviceHealthRegistry.js:236-244,281-292`; `systemReset.js:218-274`; `displayDriver.js:255-258` |

## Omissions: engine areas the map leaves out

Method: `find backend/src ALNScanner/src -name '*.js'` (157 files), checked against the map by basename, and against each sheet's module table. The map never names 53 of the files. Most are pure helpers (formatting, escaping, `responseBuilder`, `execHelper`, `withTimeout`, `slugify`). The areas below hold or decide runtime state, or change a boundary, and have no row.

1. **Restart resurrects an ended game session.** `session:current` keeps the ended record (`sessionService.js:533`) and `init` restores it (`:108-110`). Player scans are then accepted into a finished game (`scanRoutes.js:43`). R1, §5 and Q6 all miss it.
2. **Pending GM admin commands.** `admin/utils/CommandSender.js` and `OrchestratorClient.sendCommand` (`orchestratorClient.js:189-242`) hold in-flight `gm:command`s awaiting an ack, with a timeout. Acks are matched by action name only (inbound sheet item 7). This is the command twin of R12 and has no row. `app/domains/gameAdmin.js:307-343` runs its own ack listener on the same socket.
3. **The video queue item state machine.** `models/videoQueueItem.js` (pending, playing, paused, completed, failed; `playbackStart`, `pausedPosition`, `duration`) is the actual authority under R28/R29 and every "is a video playing" reader in §3.1, and it is never named.
4. **Device record internals.** `models/deviceConnection.js` (heartbeat time, sync state) feeds `heartbeatMonitorService` and R13. `websocket/deviceTracking.js` (`handleDisconnect`) is the socket-side path that marks GM and TV sockets disconnected. R13 cites only the HTTP heartbeat path (`deviceHelpers.js`).
5. **The persistence substrate.** `storage/FileStorage.js`, `MemoryStorage.js`, `StorageInterface.js`, and the `NODE_ENV=test` switch between them. It is the medium of every "Persistence" cell, including the data directory. §7 asserts the isolation without a code citation.
6. **Orchestrator discovery.** `services/discoveryService.js` (UDP 8888 responder) advertises the address and protocol clients use to find the engine. It is a runtime fact with an authority and no row.
7. **GM boot restoration.** `app/initializationSteps.js` (`determineInitialScreen` `:344`, `validateAndDetermineInitialScreen` `:384`) decides on reload whether networked mode, the session and the token survive. R56 cites only `StateValidationService`. `app/adminController.js` holds admin-module lifecycle (`initialized`, `modules`, pause and resume on reconnect), which decides whether panels exist to receive pushes.
8. **GM pack-derived tables beyond scoring.** `core/theme.js` (`PACK_THEME`, rating display), `core/modeSemantics.js` (mode behaviour), and `ui/renderers/EvidencePickerRenderer.js` (owner list) are copies of pack facts that R15 lists only by symbol.
9. **The GM report.** `core/sessionReportGenerator.js` builds the post-game report from the retained copies. §5 says "the GM report is built from retained copies" with no row and no citation.
10. **GM UI and NFC state.** `utils/nfcHandler.js` (whether the reader is listening) and the `uiManager` screen stack (current and previous screen, the cleared team input) decide whether a scan is taken at all. Neither is mapped.
11. **Message envelope time.** `websocket/eventWrapper.js` stamps every message with a send `timestamp`. The map's "no age anywhere" conclusions do not consider it (see Q3 above).
12. **HTTP side doors that read or change state.** `routes/adminRoutes.js` (`/api/admin/auth` mints R18 credentials, `/logs` reads the growing logs) and `routes/musicRoutes.js` (`GET /tracks` lists the music directory live, `PUT /playlists` writes R39) are absent from the delivery-path columns. R39 credits the playlist write only to the config tool proxy.
13. **MPD client connection state.** `musicService._mpd`, `_reconnecting`, `_eventsWired` and the `_send` timeout-drop (`utils/withTimeout.js`) decide when the music copy is live. Only the `connected` flag is in R37.
