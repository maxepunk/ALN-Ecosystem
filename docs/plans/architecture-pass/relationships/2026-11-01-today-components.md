# Today's big components against the engine's ten jobs

**Status: reader sheet for the architecture pass, step 1, relationships level. Nothing here is decided.** Every target shape stays a candidate for step 3. This sheet maps what exists today: which big part serves which job, what each part decides and what it only shows, and every message, request, file or event that crosses between parts, placed under the job it serves.

- **Date:** 2026-11-01.
- **Tree:** `/home/user/ALN-Ecosystem`, branch `claude/nice-curie-hescfv`, HEAD `005f65d1`. Submodule pins from `git submodule status`: ALN-TokenData `6f9bc30`, ALNScanner `b521774`, aln-memory-scanner `e0bf299`, arduino-cyd-player-scanner `f81aba5`. The stale clones beside the repository were not read. `backend/.env` was not opened.
- **What was run:** `git` read commands, `sed -n`, `grep`, `ls`, `find | wc` and one `python3` JSON key listing (the pack files). No server, test, build or device. Nothing here was executed.
- **Code drift since the maps.** The maps read the code at `26fc2f2`. Since then, outside `docs/`, `backend/src` changed in one file (`backend/src/services/audioRoutingService.js`, 10 lines added, 5 removed) and the ALNScanner pin moved from `e83723c` to `b521774`, a 4-file, comment-only diff in `ALNScanner/src` (checked with `git diff --stat` and, for `messageRouters.js`, the diff itself). Carried GM-scanner line numbers can sit a few lines off (the unmark call in `ALNScanner/src/app/app.js` is now at line 264; the GM map said 262).
- **Sources and citation keys.** EJ = `docs/plans/architecture-pass/2026-10-31-engine-jobs.md` (the ten jobs; a citation `EJ:N` is line N, and `EJ J4` means the job's entry). JC = `2026-10-31-jobs-capabilities.md`. JF = `2026-10-31-jobs-flaws.md`. AN = `2026-10-30-cause-analysis.md` (flaws C1 to C16). SP = `2026-10-31-standalone-pass.md` (flaw N1 proposed). MD = `2026-10-30-map-direction.md` (the 52 capabilities; "cap 16" is capability 16, EJ's numbering). IN = `2026-10-30-map-inbound.md` (sections 1a, 1b, 1c, 1d, 3 to 6; row ids W, 1b numbers, H, P, E, S, C, X). RS = `2026-10-30-map-runtime-state.md` (rows R1 to R61; section 0 read first, then sections 3 to 8). BG = `2026-10-30-map-backend-game.md`, BS = `-map-backend-show.md`, GM = `-map-gm-scanner.md`, CT = `-map-clients-tests.md`. DG = `DEPLOYMENT_GUIDE.md`. CTX = `CONTEXT.md`. All records are in `docs/plans/architecture-pass/` unless a path says otherwise. Code paths are relative to the repository root.
- **How a code citation was checked.** A code citation written as `path:line` alone was re-read in this tree on 2026-11-01. A code citation followed by "via KEY" was carried from that record and not re-read. Where I reasoned instead of reading, the line says "inference".
- **Words.** "Authority", "copy" and "delivery path" are CTX section 4b: the authority is the place that decides a runtime fact, a copy is that fact held anywhere else, the delivery path is its route to a screen. "Component" is the owner's word for the big pieces; the design words (module, interface, seam, depth, leverage, locality) are used as `codebase-design` defines them and only where a structural claim needs them. "Game" is one played game, a game session (CTX section 1). "The tablet" is a GM scanner, "the phone" the web player scanner, "the hardware scanner" the ESP32. "Standalone" and "networked" are deployment modes (CTX section 1, "mode", meaning 2).
- **Placements are mine.** Which job a crossing or a fact belongs to is this sheet's placement, drawn from EJ's job definitions. Where a crossing serves two jobs it is placed under one primary job and the other is named. Nothing in this sheet changes EJ's jobs.

## 1. The ten jobs, in one line each

As EJ section 2 words them, with the three applied changes.

| Job | In one line |
|---|---|
| J1 | Run any game from its pack; every part of the kit runs the same version of the pack and says which. |
| J2 | Keep one true record of the game, and show it truly everywhere, also after reconnecting. |
| J3 | Answer every scan and GM command once, clearly, and remember what happened. |
| J4 | Run the show's equipment (video, music, sound, lights, displays, speakers) and know its true state. |
| J5 | Move each game through its life (setup, start, pause, end, reset, restart, next game) with a defined fate for every fact. |
| J6 | Let designers build, change and try games safely (publish, apply, rehearse) without disturbing a live show. |
| J7 | Give each person exactly what their role needs, and let each do only what their role allows. |
| J8 | Run wherever the venue and the game need: this venue's kit, with or without an engine, on other kits later. |
| J9 | Tell the truth about what it knows: unknown, old, broken and not installed show as what they are. |
| J10 | Stay trustworthy as it changes: tests prove the show path, joins are checked, installed pieces match, tests never touch a live show. |

Matrix codes (used in section 5): **D** decides a fact for that job (it is the authority, or makes the call itself); **H** holds or shows a copy and has no say; **R** carries out the work, or delivers, on someone else's say-so; **·** not involved; a trailing **!** means section 6 lists this cell, either as one of the parts a job is split across with nothing joining them, or as work that belongs to another part.

## 2. What the mapping shows

Twelve findings, strongest first. Each is argued with its citations in sections 3 to 6.

1. **One part decides the game's facts, and five others each decide a piece of the same facts for themselves.** In a networked game the backend is the authority for claims, scores, teams and the phase (RS R1 to R10, section 8 Q1). The tablet also decides, before the backend answers: it marks a token claimed (`ALNScanner/src/app/domains/gameOps.js:329-331`), computes and shows the points (`gameOps.js:319-323` via IN section 3 R1 step 4) and shows "Transaction Complete" (`gameOps.js:376`). The phone and the hardware scanner each decide whether a token exists before sending (via CT sections 1.2, 1.3). The TV decides which modes count as evidence (`backend/public/scoreboard.html:1231`). A standalone tablet decides everything, from a hand-kept second copy of the backend's rules (SP section 1). That is J2 and J3 each split across up to six parts.
2. **J1, the pack, is the most spread job and nothing joins its holders.** Nine places hold the pack or a part of it: the backend's frozen snapshot, the live disk bytes served under it, the tablet's loaded copy, the phone's nested file, the hardware scanner's SD copy, the TV's fetched `game.json`, the config tool's working tree, the standalone tablet's cache, and the sync scripts' output (RS R15, R16, R17; CT conclusions 4 to 6). No message says the pack changed (RS section 4.2, last "Pack, profile" row), and the config tool sends the engine nothing when it publishes (CT section 2, "How the running orchestrator sees an edit").
3. **The tablet is a command center and a second engine in one.** It carries its own scoring tables, mode rules, pack loader and a full standalone game store (`ALNScanner/src/core/scoring.js:64`, `core/storage/LocalStorage.js:302`; GM section 1 module table). The standalone game needs those; the networked game uses them for the result screen. Nothing under `ALNScanner/src` imports `backend/src/gameRules/`; the four mentions are comments (SP section 1).
4. **The player devices are outside the game's wiring.** The phone and the hardware scanner have no socket, no credential and receive no runtime state; they learn "no game" only from a scan reply (CT conclusion 2; IN section 4). They also fall into the engine's records as `player` even when the hardware scanner sends `esp32` (`backend/src/routes/healthRoutes.js:54`).
5. **The two scoreboards are one page and two deployments.** The TV is that page in a browser the backend itself launches (`backend/src/utils/displayDriver.js:77`), sharing the screen with the idle loop and videos. The Pi 4 is the same page in a browser a person or the machine's autostart starts (DG:2423-2428). The page drops nine of the ten service domains (`scoreboard.html:1792`) and ignores the snapshot's display mode (CT section 1.1 table).
6. **The config tool reaches the engine by file and by import, not by message.** It writes `backend/.env`, the audio routing file and the media folders directly, imports engine modules in the same process, and runs the engine's pack check as a child process (`config-tool/server.js:47`; CT section 2). An edit becomes visible only at the engine's next restart; no apply call exists.
7. **The outside programs decide what is true, and the engine's picture of them is parsed text with no age.** VLC, MPD, the audio system, Bluetooth, Home Assistant and the TV's browser each decide what they are doing; the engine reads each by parsing output or an event stream (RS section 6). The TV's browser sits on both sides: the engine runs it, and it is also a client of the engine (`displayDriver.js:77`; `backend/src/websocket/gmAuth.js:54-66`).
8. **J5 (life of a game) is carried in at least six places and owned by none.** The backend has two hand-kept wirings (boot at `backend/src/app.js:178-352`, Reset System at `backend/src/services/systemReset.js:122-162`), the tablet infers a boundary from a session id change (via IN R3), the TV does the same (`scoreboard.html` via CT section 1.5 row 5), the phone's seen set and the hardware scanner's queue outlive every game (RS R59, R12). No part states what a boundary does to each fact (AN C4).
9. **J9 (tell the truth) is answered separately by five parts.** "Is the engine reachable" has a different answer on the tablet, the phone, the hardware scanner, the scoreboard page (the TV and the Pi 4 run the same rule) and the engine's own device list (RS R54, section 5 row "Is the orchestrator reachable?"). The preflight's result reaches no screen except as a session stamp and the text of an acknowledgement (RS R50).
10. **J6 (design safely) has an author surface and no apply step.** The tool authors and publishes; the engine adopts only at start; hot-apply and the preview engine do not exist (RS R15; MD capabilities 16, 20). The only real join between the two is the engine code the tool imports.
11. **The tests are organised per part, not per job, and the joins between parts are checked in three places.** Cross-part contract tests exist for the tablet's event list and command names, the phone's and hardware scanner's request payloads and the pack files (section 7). Nothing checks the hardware scanner's token-file shape against the pack, a fake against its real class, or the scoreboard page's handling of the snapshot (AN C14, C16; CT conclusion 14). Test runs share the live machine's files and programs (RS section 7).
12. **Four parts do another part's job today.** The tablet judges scans; the backend serves the scoreboard page, mints its credential and injects the pack's wording into the page text (`backend/src/routes/resourceRoutes.js:204-213`); the config tool writes the engine's environment and media; the test harness writes into the live media folders (RS section 7). Section 6 lists these with citations.

## 3. The components, one entry each

Entry shape: what it is and who uses it; a table of the jobs it serves (how, whether it decides or only shows, citation); its crossings by job, as ids into section 4; and where it does another part's job or nothing joins it (the detail is in section 6).

### 3.1 The backend (the orchestrator)

**What it is.** One Node.js process on the show machine (`backend/src/server.js`, `backend/src/app.js`). By file count: 35 service files (16,505 lines), 11 websocket files (2,185), 11 `gameRules` files (1,877), 8 route files (1,151), 6 model files, 10 utility files, 4 storage files, 1 middleware file (`find backend/src/<dir> -name '*.js'`, counted 2026-11-01). Every other part talks to it, and it is the only part that drives the outside programs.

| Job | How the backend serves it | Decides, or only shows | Cite |
|---|---|---|---|
| J1 | Adopts one pack at boot and refuses to start on a pack that fails the check; serves the pack's file list and files and the token list; injects the pack's wording and colours into the scoreboard page text; scores a networked game from the pack's rules | Decides which pack is active and how a networked game scores. Only serves the pack files: the bytes come from disk on every request, under an inventory frozen at boot | `backend/src/app.js:192`; `backend/src/services/packService.js:1215,1450`; `backend/src/routes/packRoutes.js:19,34`; `backend/src/routes/resourceRoutes.js:53,204`; RS R15, R16 |
| J2 | Holds the one game record (teams, scores, transactions, claimed tokens, player scans, devices, phase) and builds both ways it reaches a screen: the catch-up snapshot and the live events | Decides every game fact in a networked game. Delivery is by two builders written apart for seven facts | `backend/src/services/sessionService.js:24`; `backend/src/websocket/syncHelpers.js:36`; `backend/src/websocket/broadcasts.js:216`; RS R1 to R10, section 4.2 |
| J3 | Answers a GM scan over the socket and a player scan over HTTP; writes the record after each accept; keeps player scans | Decides accepted, duplicate, rejected and error. Does not mark a reply final, stored or matched to a request on every route | `backend/src/websocket/adminEvents.js:150,247,292`; `backend/src/routes/scanRoutes.js:43,317,347`; `backend/src/services/transactionService.js:154,206`; `backend/src/services/session/persistenceListeners.js:108`; IN sections 3, 6 |
| J4 | Dispatches 59 commands from GM tablets and from cues; runs nine services (VLC, music, sound, Bluetooth, audio routing, lighting, game clock, cue engine, display); refuses a command whose service is down | Decides its own intent (queue, display mode, routes, held items). The outside programs decide what is true; the engine reads them | `backend/src/services/commandExecutor.js:39,120`; `backend/src/services/serviceHealthRegistry.js:233`; RS sections 2 (R21 to R45), 6; IN section 2 |
| J5 | Runs the game session through setup, active, paused, ended; boots; rebuilds itself on Reset System; restores the session, clock and standing cues after a restart | Decides each boundary, by two hand-kept lists of steps that differ | `backend/src/services/sessionService.js:108,532`; `backend/src/app.js:178-352`; `backend/src/services/systemReset.js:122,138,162`; RS R4 (checked), section 8 Q6 |
| J6 | Provides the pack check the config tool runs at publish and the `PACK_PATH` and `PROFILE_PATH` seams; has no apply step | Decides nothing here; adoption happens only at start | `backend/src/app.js:131`; `config-tool/server.js:47`; CT section 2; RS R15 |
| J7 | Verifies a credential at connection, files each socket into rooms, keeps a display out of the station list, enforces the operator floor on commands and checks the operator tier on transactions | Decides who is a station, a display or nothing. A client's own `deviceType` still decides whether a credential is asked for at all | `backend/src/middleware/auth.js:13,53`; `backend/src/websocket/socketServer.js:49,53`; `backend/src/websocket/gmAuth.js:54-66,102`; `backend/src/services/commandExecutor.js:152`; `backend/src/websocket/adminEvents.js:165`; IN section 4 |
| J8 | Reads the installation profile once at boot, the environment flags, serves client code from static folders and symlinks, answers UDP discovery | Decides which equipment counts as installed (profile, flags and probes disagree today) | `backend/src/app.js:143,197`; RS R49, section 5 row "Is equipment X installed?"; `ls -la backend/public` (`gm-scanner` is a symlink to `../../ALNScanner/dist`) |
| J9 | Keeps one health entry per service with three words (healthy, down, dormant), dormancy, the preflight and `/health` | Decides the health words. The state of a service and its health travel on different routes | `backend/src/services/serviceHealthRegistry.js:288`; `backend/src/services/preflightService.js:83`; RS R46 to R50, section 8 Q2 |
| J10 | Owns the contracts (`backend/contracts/openapi.yaml`, `asyncapi.yaml`, `session-bundle.schema.json`) and the backend test layers | The contracts are the written joins; the tests prove some of them (section 7) | `ls backend/contracts`; CT section 3 |

**Crossings.** J1: P4, P5, S1 to S3, H8 to H10, E4 to E6, V1 (carries pack identity). J2: W5, V1 to V12, V17. J3: W3, W4, P1, P2, E1, E2, V2, V13 to V17. J4: 1b rows 7 to 20 and 25 to 55 and 57 to 58, C2 to C4, X1, V12, V19 to V22, O1 to O11. J5: 1b rows 1 to 6, 24, H6, H7. J7: W1, W2, H2, H4, P3, E3, C1, V9, V10, V18, V23. J8: H1, H3, P6. J9: 1b row 56, H5, V22. J10: T1 to T5. Ids are defined in section 4.

**Where it does another part's job, or nothing joins it.** It decides the hardware scanner's type for the device list because a route defaults to `player` (`healthRoutes.js:54`); a read endpoint registers a device (`healthRoutes.js:51-93` via IN conclusion 9b). It serves the scoreboard page and mints the page's credential in the same call (`resourceRoutes.js:204-205,225`). It serves live disk bytes of the pack under a frozen inventory (J1 split). It launches and kills the TV's browser by process pattern machine-wide (`displayDriver.js:127`; RS section 7).

#### 3.1b Inside the backend: module groups against the jobs

The same mapping one level down. Groups are by what the files do (BG and BS file tables, RS rows); each group's depth is a judgment from the records, marked "inference" where it is mine.

| Module group | Files | Jobs it carries | Note |
|---|---|---|---|
| Pack and rules | `services/packService.js`, `tokenService.js`, `profileService.js`; `gameRules/` (`scoring.js`, `duplicatePolicy.js`, `modeSemantics.js`, `packNeeds.js`, `resolution.js`, `endpointServices.js`, `cueValidation.js`, `cueVocabulary.js`, `grants.js`, `dormancyWording.js`, `formatting.js`) | J1 primary; J9 (`resolution.js`, `packNeeds.js`); J7 (`grants.js`); J2 (`scoring.js`, `duplicatePolicy.js`) | `gameRules` is the surface the tablet's standalone rules must match (CLAUDE.md root, "Scoring"; SP section 1). Pure functions, so deep where it matters (inference) |
| The game record | `services/sessionService.js`, `transactionService.js`, `session/` (`persistenceListeners.js`, `sessionRegistry.js`), `persistenceService.js`, `models/`, `storage/` | J2, J3, J5 | One object holds nearly every game fact (RS conclusion 1). `sessionService` owns persistence by design (CLAUDE.md root, "Event Architecture") |
| Entry points | `websocket/` (`socketServer.js`, `gmAuth.js`, `adminEvents.js`, `broadcasts.js`, `syncHelpers.js`, `deviceTracking.js`, `deviceHelpers.js`, `eventWrapper.js`, `environmentHelpers.js`, `listenerRegistry.js`, `scanResponse.js`); `routes/` (8 files); `middleware/auth.js` | J3, J2, J7 | Two doors for scans (socket for GM, HTTP for players), two snapshot builders and live builders per fact (RS section 4.2) |
| Command dispatch and cues | `services/commandExecutor.js`, `cueEngineService.js`, `cueEngineWiring.js`, `cue/`, `heldItemsStore.js` | J4 primary; J3 (the ack); J7 (floor check) | `commandExecutor.js` is the one dispatch for tablets and cues (IN section 2). Held cues and held videos live in two stores (RS R26, R27) |
| Show services | `videoQueueService.js`, `vlcMprisService.js`, `mprisPlayerBase.js`, `displayControlService.js`, `musicService.js`, `mpdConfigBuilder.js`, `soundService.js`, `audioRoutingService.js`, `audio/`, `bluetoothService.js`, `lightingService.js`, `gameClockService.js`, `scoreboardControlService.js` | J4 | Each reads its outside program its own way (RS section 6); music keeps a private connected flag beside the shared registry (`musicService.js:73`) |
| Health and honesty | `serviceHealthRegistry.js`, `dormancyService.js`, `preflightService.js`, `heartbeatMonitorService.js` | J9 primary; J4; J7 (heartbeat marks a device disconnected) | The registry is read by 31 sites (RS R46) |
| Life of the engine | `app.js` (boot), `services/systemReset.js`, `server.js` (shutdown) | J5 | Boot and Reset System are two lists (RS R4 checked; `adminEvents.js:77-90` omits `musicService` from the reset call while `systemReset.js:122` handles it when passed) |
| Machine edge | `utils/processMonitor.js`, `utils/displayDriver.js`, `utils/dockerHelper.js`, `services/discoveryService.js` | J4, J8, J10 | Fixed pid file names under `/tmp` (`displayDriver.js:53`; `vlcMprisService.js:117`; `musicService.js:607`) |
| Unwired | `services/offlineQueueService.js` | J3 | The flag that would route a scan to it is never set in production (`offlineQueueService.js:14`; RS R11) |

### 3.2 The GM scanner, networked

**What it is.** The GM's tablet app: an ES6-module PWA (67 files, 16,486 lines under `ALNScanner/src`; GM header) built to `ALNScanner/dist` and served by the backend at `/gm-scanner` through a symlink. In networked mode it reads tokens by Web NFC (`ALNScanner/src/utils/nfcHandler.js:23`), holds a socket under an operator credential and is the game's command center (four sections: Game Ops, Show Control, Environment, Game Admin).

| Job | How it serves the job | Decides, or only shows | Cite |
|---|---|---|---|
| J3 | Builds and sends each scan (`transaction:submit` with a `clientTxId`), keeps an offline queue, shows a result screen | Decides a first verdict itself: marks the token claimed, computes points and shows "Transaction Complete" before the engine answers. Only an engine reply of rejected or error unmarks | `gameOps.js:253,329-331,376`; `app.js:228-275`; IN section 3 R1 |
| J2 | Holds copies of every game fact the engine sends and draws them | Shows. Four write rules for copies of facts from the same message: replace (transactions, panels), merge (session record), add-only (scores, claims, devices), union (claims) | GM conclusion 2; RS section 8 "What the map shows" item 1 |
| J4 | The admin panel: twelve controllers send 56 distinct `gm:command` actions and draw ten service domains | Shows and sends. It changes nothing locally and waits for the acknowledgement | IN sections 1b, 2a; GM section 1 module table |
| J5 | Sends session create, start, pause, resume, end and Reset System | Decides a new game has started when a session id changes, and wipes its queue and claims on that inference | `ALNScanner/src/network/networkedSession.js:246-259` via IN section 3 R3; `ALNScanner/src/core/unifiedDataManager.js:50` via GM conclusion 5 |
| J7 | Is the GM role: asks for an operator credential, holds it in `localStorage`, sends it in the handshake | Decides its station name from a list it read before connecting, so two tablets can pick the same name | `ALNScanner/src/network/orchestratorClient.js:88-103`; `connectionWizard.js:204-227` via IN section 6 Q8 |
| J8 | Locks networked or standalone by a tap and runs the connection wizard (probes about 509 addresses) | Decides the mode for itself, once, until reload | `ALNScanner/src/app/sessionModeManager.js:30-40` via SP section 1; IN H1 |
| J9 | Draws the health dashboard, held items and the "pack" line in settings | Shows. It marks no copy stale on a disconnect, and the admin connection dot is redrawn only on a snapshot or when the tab opens | GM conclusion 3; `MonitoringDisplay.js:338,376` via GM |
| J1 | Loads the pack at start (network, cache, bundled), runs its own scoring and mode tables from it, sends `packHash` in the handshake | Holds a copy; ignores the snapshot's `pack` and `profile` keys. A reload is the only refresh | `orchestratorClient.js:101`; `ALNScanner/src/core/scoring.js:64`; GM conclusion 8; RS R15 |
| J10 | Exports `MESSAGE_TYPES` so a contract test can compare it with the contract | Carries a seam for a test | `backend/tests/contract/scanner/client-contract-conformance.test.js:12-20` |

**Crossings.** J1: H8 to H10. J2: W5, V1 to V12, V17. J3: W3, V2, V13, V16. J4: 1b rows 7 to 20, 25 to 56. J5: 1b rows 1 to 6, 24, H6, H7. J7: W1, H2, H4. J8: H1, H3. J9: H5, V22. Ids in section 4.

**Where it does another part's job, or nothing joins it.** It judges scans (J3) and computes points (J2) from its own copy of the rules. The team-details screen reads a field the data manager does not have, so it shows a local sum while the scoreboard screen shows the engine's (`GameOpsRenderer.js:221` via GM conclusion 6). The unmark after `transaction:deleted` is missing (`messageRouters.js:47-52`, re-read: only the transaction id and the team score are used). A tablet that reloads loses its persisted queue to its own boundary inference (GM conclusion 5, inference).

#### 3.2b Inside the GM scanner: module groups against the jobs

| Module group | Files | Jobs | Note |
|---|---|---|---|
| App shell and four domains | `app/app.js` (714), `app/domains/gameOps.js` (635), `gameAdmin.js` (428), `showControl.js` (111), `environment.js` (28), `adminController.js`, `initializationSteps.js` (527), `sessionModeManager.js` (144) | J3, J5, J8; J4 as wrappers | `app.js` is the one place that injects collaborators. `environment.js` holds no behaviour (GM section 1) |
| Admin controllers | `admin/` (12 controllers, `MonitoringDisplay.js` 435, `utils/CommandSender.js`) | J4 primary; J5; J2 (score and delete); J9 | Same-action acknowledgements match by action name only in `CommandSender` (IN conclusion 7) |
| Data and storage | `core/unifiedDataManager.js` (968), `storage/NetworkedStorage.js` (498), `storage/LocalStorage.js` (629), `stateStore.js`, `teamRegistry.js`, `gameActivityBuilder.js`, `sessionReportGenerator.js` | J2, J3 | Facade over two strategies. `NetworkedStorage`'s command methods have no networked caller (GM conclusion 10) |
| Pack copy | `core/packLoader.js` (457), `tokenManager.js`, `scoring.js`, `modeSemantics.js` (413), `strings.js`, `theme.js` | J1 | Runtime pack loading with staged refresh. The baked shim in `scoring.js` warns when active (`scoring.js:18,34`) |
| Network | `network/orchestratorClient.js`, `connectionManager.js`, `networkedSession.js`, `messageRouters.js`, `networkedQueueManager.js` | J2, J3, J7 | Four routers by job (gameOps, gameAdmin, showControl, sharedInfra); the session record is read twice from one event with two merge rules (RS section 4.1) |
| Screens and renderers | `ui/uiManager.js`, `settings.js`, `connectionWizard.js`, `ui/renderers/` (10 renderers) | J2, J4, J9 | Idempotent differential renderers for service domains (CLAUDE.md of ALNScanner, "HealthRenderer") |
| Start-up validation | `services/StateValidationService.js` | J5, J9 | Clears two keys nothing writes and none of the three that matter (GM conclusion 13) |
| Utilities | `utils/nfcHandler.js`, `jwtUtils.js`, `config.js`, `debug.js`, `domEventBindings.js` | J3 (the tap), J7 (credential expiry) | |

### 3.3 The GM scanner, standalone

**What it is.** The same app started in standalone mode: the tablet is the whole game (`ALNScanner/src/core/storage/LocalStorage.js`, 629 lines), with a text field for a team name and no engine. It is deployable from a static host (ALNScanner/CLAUDE.md, "Dual Operation Modes").

| Job | How it serves the job | Decides, or only shows | Cite |
|---|---|---|---|
| J2 | Holds the game record (session, claims, scores, groups) in `localStorage` | Decides everything. It re-implements the engine's scoring, duplicate and group rules by hand | `LocalStorage.js:31-37` via RS R58; SP section 1 |
| J3 | Records a scan and shows the result | The store answers and the caller ignores the answer: a scan into a paused game shows complete and records nothing; setup and ended accept scans (the gate checks only `paused`) | `LocalStorage.js:302`; SP section 2 C9; EJ J3 "standalone" |
| J5 | Starts, pauses, ends, reloads; restores a session started today | Decides each boundary by its own code; opens into an unnamed Active game; no screen starts a named or second game | SP section 2 C4 (SG-01 to SG-04); EJ J5 "standalone" |
| J8 | Is the standalone choice, made by a tap on the first screen | Decides for itself; nothing records that the game is standalone | `sessionModeManager.js:30-40,95-110` via SP section 1 |
| J1 | Loads the pack through the same loader from same-origin static files, or the bundled copy | A tablet that reloads online mid-game adopts the newest published pack under the game in progress (SP SG-03) | SP section 2 C12; EJ J1 "standalone" |
| J9 | Hides every service panel; no verdict says the tablet is ready | Shows nothing about readiness | `ALNScanner/index.html:346,366,429,476,504,517` via SP section 2 C2 |
| J4, J6, J7, J10 | None. No venue service runs, no engine to rehearse against, no credential | | SP section 2 C2, C3, C13 |

**Crossings.** J1: H10 (same-origin static pack files, carried as H10). No message leaves the tablet. The pack is the only thing it fetches (H8 to H10).

**Where it does another part's job, or nothing joins it.** It is the only authority for a standalone game and holds a second copy of the backend's rules with no shared code and no test that compares the two beyond one cross-mode scoring test that skips its group case on the real pack (`backend/tests/e2e/flows/07c-gm-scanner-scoring-parity.test.js`; SP:147; EJ J10 "standalone"). Two standalone tablets are two separate games (SP section 2 C1, SG-06).

### 3.4 The web player scanner

**What it is.** A vanilla-JS PWA (`aln-memory-scanner/`) a player opens on a phone; reads a token by QR or NFC; HTTP only (`fetch`), no socket and no credential. Served from the backend at `/player-scanner/` (networked) or from a static host (standalone); the mode is the URL path.

| Job | How it serves the job | Decides, or only shows | Cite |
|---|---|---|---|
| J3 | Sends `POST /api/scan` and `/api/scan/batch`, shows the memory, queues on failure | Decides whether a token exists (never sends an unknown id), new or revisited, whether a 4xx reply is final (every 4xx is final), and whether it is online (a 10 s poll) | `aln-memory-scanner/js/orchestratorIntegration.js:105-167`; CT section 1.2; IN section 6 Q5, Q7, Q9 |
| J1 | Reads its own token file (`data/tokens.json`, nested submodule pin `15d8d2e`, 81 tokens, one still carrying a retired `(x1)` suffix) and shows the pack identity on its config page | Holds a copy that is not the engine's active pack unless `PACK_PATH` shadows it | `aln-memory-scanner/js/app.js:61-87,98-125,131-142` via CT conclusion 5; CT section 1.2 "Pin facts" |
| J4 | A video token starts a video through the engine's scan route; the phone shows "video unavailable, rescan" on a queued or rejected video scan | Shows. The engine decides whether the video starts | `scannerCore.js:68-98` via CT section 1.2; `scanRoutes.js:97-99` via RS R28 |
| J7 | Is the player role: no account, no credential, a device id kept in `localStorage` | Decides its own id and sends a team of `sessionStorage.currentTeam` or the literal `'001'`; nothing writes that key | `orchestratorIntegration.js:20-29`; `app.js:435` via CT conclusion 8 |
| J8 | Standalone by URL path, no manual setting | Decides for itself; in standalone sends nothing | `orchestratorIntegration.js:33-34`; `scannerCore.js:51-54` via CT section 1.2 |
| J9 | Shows online or offline from its poll, and a pack line | Decides its own "Offline" word, so a standalone game reads as an outage all night | CT section 1.2; SP section 2 C10 |
| J5 | None by design: its seen set (`alnMemoryScanner`), queue and pending batch outlive every game | Holds device-lifetime facts with no link to a game | RS R59, R12; CT section 1.5 rows 6, 7 |
| J2 | Its seen set is a fact the game never learns | Decides a "revisited" word that survives a new game on the same phone | RS section 5 row "Has a token been seen or exposed?" |

**Crossings.** J1: P4, P5. J3: P1, P2. J7: P3. J8: P6. Also loads `qr-scanner` from `unpkg.com` (`aln-memory-scanner/index.html:138`), the one crossing to the internet in this sheet. Reads the page's `?token=` query (`aln-memory-scanner/js/app.js:539`) from the tag's second record (J1, J3; `ALN-TokenData/tag-writer.html:444`).

**Where it does another part's job, or nothing joins it.** It judges whether a token exists, a verdict the engine also gives (RS section 5 row "Does this token exist?" via IN Q5). It decides retry policy for a reply differently from the hardware scanner on the same route (IN Q7). Its pack is a separate file from the engine's pack (J1 split).

### 3.5 The hardware player scanner (ESP32)

**What it is.** C++ firmware on a CYD board with an NFC reader (`arduino-cyd-player-scanner/ALNScanner_v5/`). HTTPS, certificate checks off; a Core-0 task polls `/health` every 10 s and uploads queued scans. No standalone mode.

| Job | How it serves the job | Decides, or only shows | Cite |
|---|---|---|---|
| J3 | Reads a tag, checks the token against its SD token list, makes one bounded `POST /api/scan` attempt, queues otherwise | Decides read failed, unknown token (never sent), and the outcome class of a reply: 409 no-session final, 409 rejected final success, everything else queued | `ALNScanner_v5/services/ScanResponse.h:51-75`; `Application.h:525-548,570-597` via IN R6, CT section 1.3 |
| J1 | Pulls `GET /api/tokens` at boot into an SD file (refused above 50,000 bytes) and syncs BMPs and audio from the asset manifest | Holds copies; carries no `pack` identity when the asset manifest file lacks the key (the committed one does) | `OrchestratorService.h:541`; `TokenService.h:203-264`, `AssetService.h:145-158`, `config.h:90` via CT conclusions 5, 6, 7 |
| J4 | A video token asks the engine to start a video; shows "video unavailable" when queued or rejected | Shows | `Application.h:689-730` via CT section 1.3 |
| J7 | Is the player role: no credential; `deviceId` from `config.txt` or the MAC | The engine records it as `player` (a route default), not `esp32` | `healthRoutes.js:54`; IN section 4 |
| J8 | Always networked; treats a missing engine as an outage that never ends | Decides its own "Disconnected" word; no standalone mode | `OrchestratorService.h:1289-1313` via SP section 1; parity gap in SP section 4 (24-row table, seven rows behind the phone, via EJ J8) |
| J9 | Shows a red Disconnected and a rising queue count when the poll fails | Decides its connection word; up to about 61 s inside a poll before it notices | `OrchestratorService.h:1020-1052,1266-1320` via CT section 1.3 |
| J5 | None: its `/queue.jsonl` and token list outlive every game; queued lines reach a later networked game | Holds device-lifetime facts; the engine refuses queued lines with no real time (a 1970 stamp) | SP section 3, SP-18 (SP:199); IN section 6 Q6 |

**Crossings.** J1: E4, E5, E6. J3: E1, E2. J7: E3. Nothing arrives at the device from the engine except answers to its own requests (CT conclusion 2).

**Where it does another part's job, or nothing joins it.** It decides whether a token exists before the engine sees it (the engine's 404 path is unused by it). Its token-file shape is kept by hand on both sides (AN C14: the device cannot read the pack's own token file). It is the one client that pulls media from the engine (J1, J8), through the engine's asset folders and the committed manifest file (`resourceRoutes.js:19-46,71-83` via CT conclusion 6).

### 3.6 The TV scoreboard

**What it is.** One file, `backend/public/scoreboard.html`, shown on the venue TV by a Chromium window the backend launches itself with `?kiosk=true&deviceId=SCOREBOARD_HDMI` (`backend/src/utils/displayDriver.js:77`). The audience reads it. It shares the screen with the idle loop and the game-event videos, which is why the engine shows and hides it (DG:2423-2428).

| Job | How it serves the job | Decides, or only shows | Cite |
|---|---|---|---|
| J7 | Is the audience's screen: a read-only credential (an observe token) minted into the page text on every serve; joins the same rooms as a tablet | Decides nothing about who it is; asserts `deviceType: 'gm'` in the handshake and the engine tells it apart by the credential's tier | `backend/src/routes/resourceRoutes.js:204-205`; `scoreboard.html:1559`; `backend/src/websocket/gmAuth.js:54-66` |
| J2 | Draws team scores, exposed evidence, the countdown and the ticker from the engine's snapshot and events | Shows. Write rules: scores replace per team, evidence adds on an event and replaces on a snapshot, the clock replaces | `scoreboard.html:1741`; CT sections 1.1, 1.5 rows 1 to 3 |
| J1 | Fetches `game.json` bytes once at load and `/api/tokens` once; receives the pack's wording and colours injected at serve time | Decides which modes count as evidence from the pack, and the money format; falls back to a baked `detective` default with a console warning. Sends no `packHash` | `scoreboard.html:1231`; `resourceRoutes.js:208-213` via RS R15; CT section 1.1 |
| J4 | Shows the engine's display mode as an overlay (in kiosk mode only) | Shows. Misses `display:mode` while disconnected and ignores the snapshot's display status, so a TV reloaded mid-video shows the wrong overlay until the next event | `scoreboard.html:1051-1068,1741`; CT conclusion 3 |
| J5 | Resets on a changed session id and on `scores:reset`; reloads the page on an auth refusal and every 23 hours | Decides its own boundary from the id | `scoreboard.html` via CT section 1.5 rows 1, 2, 5; `:1630-1634,1853` via CT section 1.1 |
| J9 | Shows its own connection word | Decides its own liveness: a countdown keeps ticking after a disconnect; a connection quiet for five minutes is torn down and rebuilt | `scoreboard.html:1581-1606` (re-read); CT section 1.1 "Offline and reconnect" |
| J3, J6, J8, J10 | None | | |

**Crossings.** J1: S1 to S3. J2: W5 (it sends `sync:request`), V1, V3 to V7, V11. J4: V12, V22 (it reads only the `gameclock` domain and drops the rest, `scoreboard.html:1792`). J7: W2, V18. Does not handle `player:scan`, `cue:*`, `device:*`, `session:overtime`, `batch:ack` or `gm:command:ack` (CT section 1.1).

**Where it does another part's job, or nothing joins it.** It decides the evidence rule from a file it fetched itself, while the engine's rules come from the frozen snapshot (J1 split; RS section 3.1 "Which pack is running"). It extrapolates the countdown from a local clock (J2, J9). It holds the game's evidence as a copy with no age.

### 3.7 The Pi 4 scoreboard

**What it is.** The same `scoreboard.html` in a fullscreen browser on a separate Raspberry Pi 4 on the kit network. Nothing in the repository sets this machine up; the guide's launcher is `chromium --kiosk ... --app=https://[IP]:3000/scoreboard` started by a person or the machine's autostart (DG:2423-2428, 2475-2480). The engine does not run it and does not rebuild it (DG:2423-2428).

| Job | How it serves the job | Decides, or only shows | Cite |
|---|---|---|---|
| J7 | A second audience screen on the same read-only credential | A display, not a GM station: it takes no station slot and no device row | DG:2437; `gmAuth.js:54-66`; `backend/src/websocket/socketServer.js:85-88` |
| J2 | Same as the TV: scores, evidence, countdown from the snapshot and events | Shows | `scoreboard.html:1741` |
| J8 | Is the first remote display: a screen on another device over the kit network | Decides nothing; the engine cannot tell whether it is alive, and the planned `display.remote` count in the preflight does not exist yet | CTX:471-475; MD capability 39; `gmAuth.js:61-64,119` via IN section 4 |
| J9 | Same rule as the TV: its own connection word, its own zombie reconnect | Decides its own liveness | `scoreboard.html:1581-1606` |
| J4 | Takes no part in display mode: the overlay is drawn in kiosk mode only, and the guide's launcher passes no `kiosk=true` (inference from `scoreboard.html:742-768,1051-1068` and DG:2471-2474) | | |
| J1 | Same as the TV (S2, S3, S1) | Holds a copy of `game.json` and tokens from page load | `scoreboard.html:1231` |

**Crossings.** Same as the TV (section 3.6) minus nothing the engine launches. It registers under a per-browser id `SCOREBOARD_DISPLAY_<time>` kept in `sessionStorage` (`scoreboard.html:742-768`), an id prefix that skips the engine's duplicate-id check (`socketServer.js:85-88`). A certificate regenerated on the engine makes it warn until clicked through by hand (DG:2411-2415), a J10 and J8 matter placed under C15.

**Where it does another part's job, or nothing joins it.** Nothing joins it to the engine except the open socket; the engine's preflight cannot count it (MD capability 39).

### 3.8 The config tool

**What it is.** An Express server on port 9000 with a browser SPA (`config-tool/`; `server.js:13`, loopback bind unless `CONFIG_TOOL_HOST` is set, `server.js:18`). It is the designer's authoring surface and the installer's venue configuration. In the production lifecycle it covers Author and venue configuration; it has no Rehearse, Run or Review function and no Deploy item (CT section 2, "Where it sits").

| Job | How it serves the job | Decides, or only shows | Cite |
|---|---|---|---|
| J6 | Private drafts of the pack, edited and published through the engine's own check; a publish log | Decides publish conflicts (content hash) and refuses on a failed check. Publish tells the running engine nothing | `config-tool/lib/publish.js:100,165`; `config-tool/lib/draftStore.js:69-116` via CT section 2; RS R61 |
| J1 | Authors scoring, cues, strings, theme and token-file edits as pack data; runs `backend/scripts/validate-pack.js` as a child process; rebuilds the manifest | Decides schema validity of its own writes. Imports the engine's cue vocabulary, grants and manifest builder in the same process | `config-tool/server.js:47`; `config-tool/lib/routes.js:11` via CT section 2; `configManager.js:21,229` via CT |
| J8 | Edits `backend/.env`, presets and audio routing; does not edit the installation profile (that store is future) | Decides nothing at the engine: environment edits apply at the engine's next start | `config-tool/lib/configManager.js:121-135` via CT section 2; `draftStore.js:9-10` via CT section 2 |
| J4 | Uploads sounds and videos by direct write into the engine's media folders; proxies music playlist edits to the engine with a server-held engine credential; reads Home Assistant scenes | Writes the `routes` block of the audio routing file that nothing in the engine reads | `config-tool/lib/routes.js:266-287,291-312,421-442` via CT section 2; RS R34 |
| J7 | Has its own login door against the same `backend/.env` password, with its own token (audience `config-tool`) and a second engine token fetched at login | Decides its own sessions; the engine's `computeGrants` is imported to shape the token. A password edit applies to the tool at once and to the engine at restart | `config-tool/lib/toolAuth.js:83-96,100-141` via CT section 2; CT conclusion 13 |
| J10 | Its 16 unit tests and one browser smoke test; CI installs the backend's dependencies first because the tool imports engine code | The import is the only code join between a client and the engine | `.github/workflows/test.yml` via CT section 2 "Coupling" |
| J2, J3, J5, J9 | None. It receives no runtime state | | CT conclusion 2 |

**Crossings.** J7: C1. J4: C2, C3, C4, X1. J1 and J6: files (the pack folder in `ALN-TokenData`, drafts under `config-tool/data/drafts`), the child process `validate-pack.js`, in-process imports. J8: `backend/.env`, `backend/config/environment/routing.json`, presets under `config-tool/presets`. J4: `backend/public/audio`, `backend/public/videos`. These file crossings are listed in section 4 as F1 to F8.

**Where it does another part's job, or nothing joins it.** It writes the engine's environment and media folders itself, work the engine's own panels and bundle plan would carry (J8, J4, J1). Its README says cue edits apply on "restart or system:reset", but a reset reloads the same frozen snapshot, so only a restart works (CT conclusion 12; `systemReset.js:231-239` via CT). It holds a login that differs from the engine's whenever the password was edited but the engine not restarted.

### 3.9 The pack data (and the tools that write it)

**What it is.** The `ALN-TokenData` submodule: `game.json` (top-level keys `kind`, `schemaVersion`, `requires`, `id`, `title`, `modes`, `scoring`, `groupRules`, `groups`, `duplicatePolicy`, `entities`, `functions`, `gameClock`, `strings`, `cues`, `lightingRoles`, `lightingRoleFallbacks`, `surfaces`, `theme`), `tokens.json` (81 tokens), `cues.json`, `strings.json`, `theme.json`, `pack-manifest.json` (keys `kind`, `schemaVersion`, `packId`, `version`, `contentHash`, `engine`, `files`, `hardware`), a schema for each, `tag-writer.html` and `token-checkin.html` with `shared/aln-tools.js` (listed with `python3` JSON keys and `ls`, 2026-11-01). Around it: the Notion sync script `scripts/sync_notion_to_tokens.py` (reads Notion, writes `tokens.json` atomically, generates BMPs, then the two manifest builders `generate_asset_manifest.py` and `build_pack_manifest.py`, `sync_notion_to_tokens.py:1-20,36-38`), `backend/scripts/build-pack-manifest.js` and `validate-pack.js`, the toy packs under `backend/tests/e2e/fixtures/packs/` (`toy-heist`, `toy-heist-require`, `parity-pack`), and two nested submodule copies of the pack (`ALNScanner/data`, `aln-memory-scanner/data`, the latter at a different pin than the root, CT conclusion 5). The media the pack names is not in it: `backend/public/videos`, `backend/public/audio`, and the BMP and audio folders under `aln-memory-scanner/assets/` with a checked-in `assets/manifest.json` (RS R17).

| Job | How it serves the job | Decides, or only shows | Cite |
|---|---|---|---|
| J1 | Is the game: tokens, modes, scoring, groups, cues, clock, wording, colours, what each screen shows | Decides the game's definition. Decides no runtime fact | CTX section 0; EJ J1 |
| J6 | The draft base the config tool copies; the Notion sync is today's content tool | The sync aborts on an incomplete fetch and prunes only on request | `scripts/sync_notion_to_tokens.py:1-20`; CT section 2 |
| J8 | The manifest's `hardware` key states the pack's equipment needs, read by the engine to decide what is dormant tonight | Holds the needs; the profile and the engine decide what is installed | `ALN-TokenData/pack-manifest.json` keys; RS R47 |
| J4 | Carries the show's cues and lighting roles | Holds them; the engine's cue engine decides when they fire | `ALN-TokenData/game.json` keys `cues`, `lightingRoles` |
| J10 | Schemas, a manifest freshness check, and a second pack as a permanent test subject | The dual-pack Tier L matrix swaps packs per leg | `backend/tests/contract/pack/pack-schemas.test.js`; `.github/workflows/test.yml:225-235`; CT section 3.2 |
| J3 | The NFC tag writer puts a token id on a tag as the first record and a `?token=` URL as the second (the hardware scanner reads the first, the phone the URL) | Decides the physical tag format | `ALN-TokenData/tag-writer.html:444`; `aln-memory-scanner/js/app.js:539-541`; ALN-TokenData/CLAUDE.md:92 ("Tag Format (NDEF)") |

**Crossings.** Files only, read or written by: the backend (boot, live bytes), the tablet (loader), the phone (nested file), the hardware scanner (asset and token sync), the TV (two fetches), the config tool (working tree, drafts), the sync script (writes), the test harness (fixtures). Ids: P4, P5, E4 to E6, S2, S3, H8 to H10, F1 to F3, F9, F11, F12.

**Where it does another part's job, or nothing joins it.** Nothing tells a holder that the pack changed; each holder re-reads at its own moment (RS R15, R16). The sync script and the config tool both write pack files (J1, J6) by different paths. The pack has no field that says a game runs without an engine (N1; SP section 1).

### 3.10 Tests, CI and the rung-1 rig

**What it is.** Twelve test configuration files (`CT section 3.1`), by layer: backend unit (110 files), contract (40), integration (38), end-to-end Tier L (26 flow files, run on a 4-leg matrix: production pack, toy pack, toy pack with lighting dormant, require-pack with the same profile) and Tier H (3 files, hardware, not in CI); tablet unit (86 plus 1 contract, 1 build-artifact test, 6 browser specs); phone unit (4); config tool (16 plus one browser smoke test); hardware scanner native tests (8 directories); sync-script tests (5 files plus a shared fixture file). CI is `.github/workflows/test.yml` (six jobs, a summary and the Tier L matrix), `rung1.yml` and `capability-probe.yml` (CT sections 3.1 to 3.3). The rung-1 rig is the scripts under `backend/tests/rung1/` (`up.sh`, `probe.sh`, `engine.sh`, `audit-flows.js`, `down.sh`, `provision.js`, `generate-fixtures.js`, `onboard-ha.js`; `ls`, 2026-11-01); its container recipe survived, the container did not (MD capability 46; EJ J10).

| Job | How it serves the job | Decides, or only shows | Cite |
|---|---|---|---|
| J10 | Proves the show path in layers; pins joins between parts in three contract tests | Decides green or red. A green run does not show the real path works (fakes unchecked, skips counted as green, coverage per file) | AN C16; CT section 3 |
| J1 | The dual-pack run: the same Tier L suite as ALN and as the toy game | Decides whether a change that passes on ALN is generic | `.github/workflows/test.yml:225-235`; CTX section 0 (toy pack) |
| J8 | The rung-1 rig: the real software stack with fake physics (null sinks, a virtual display, witness lights); `provision.js` also serves as the end-to-end harness's environment module | Decides which equipment a test run adopts. The harness is "ambient first": it adopts a live display, audio and Bluetooth when present | CT conclusion 16; `backend/tests/rung1/provision.js` via CT section 3.2 |
| J6 | Generates simulation profiles from a pack's needs (`backend/scripts/lib/simulationProfile.js`), the seed of the preview engine's profile | Not a rehearse surface | MD capability 21 |
| J4 | Reaches live equipment: the real kiosk, pid files, `pkill` patterns, the real Home Assistant container on some flows | Touches the live show's programs (the harm); proves device behaviour only for three tagged hardware files | RS section 7; CT conclusions 15 to 18 |
| J2, J3, J5, J7, J9 | Prove behaviour of those jobs through flows; none of them owns a job | | CT section 3.2 |

**Crossings.** J10: T1 to T5 (the test runs against the live machine) and the three contract tests of section 7 (the joins). J1: F9 (fixtures and toy packs). J8: F10 (the rig's scripts).

**Where it does another part's job, or nothing joins it.** The fixture generator writes placeholder videos under real token names into the live media folder (`backend/tests/e2e/setup/generate-fixtures.js:99,129-155` via RS section 7), a J1 and J4 harm done by a J10 tool. Tests are organised per part (twelve configs), not per job.

### 3.11 The outside programs the backend drives

Each program decides what it is doing. The engine reads it by the route in the table and holds a copy with no age (RS section 8 Q3). Entries are short because the program's own decision is the whole of its job; the engine's reading side is in 3.1 and section 4 (O1 to O11).

| Program | What it decides | How the engine reads or drives it | Who else touches it | Jobs | Cite |
|---|---|---|---|---|---|
| VLC (`cvlc`) | What is playing, the position, the volume | Starts it under a process monitor with a fixed pid file; parses `dbus-monitor` session-bus text (100 ms debounce); a 15 s resync reads only the playback state; position is read live; the queue's own position is wall-clock arithmetic | The tests (unit tests build real process monitors and read the real pid file) | J4 | `backend/src/services/vlcMprisService.js:117,125`; `backend/src/utils/processMonitor.js:180`; RS R29, R30, section 6 |
| MPD (music) | State, volume, track, position, shuffle and loop | `mpd2` client on `/tmp/aln-mpd.sock`, parsed `status` and `currentsong` on idle events; start reads nothing, so after an engine restart the panel says stopped; keeps a private `connected` flag beside the registry | The config tool (playlist file, through the engine's proxy) | J4 | `backend/src/services/musicService.js:73,607`; RS R37 to R39 |
| The audio system (PipeWire, `pactl`, `pw-play`) | Which sinks exist, routes, sink-input indexes, volumes; whether a sound plays | Parses `pactl` output and `pactl subscribe` lines; `pw-play` is read only from the child's exit; at start it kills every `pactl subscribe` on the machine | The tests (eight contract files call the service init) | J4 | `backend/src/services/audioRoutingService.js:110`; `backend/src/services/soundService.js:58`; RS R33 to R36, R40, section 7 |
| Home Assistant (and its container) | Scenes and the active scene; whether it is reachable | HTTP and a WebSocket subscribed to `state_changed`; three health writers; starts and stops the container through `docker`; a host with no token never reports | The config tool (reads scenes); a real container on test flows | J4 (J8 for the host mode) | `backend/src/services/lightingService.js:103`; RS R43 to R45; `config-tool/lib/routes.js:291-312` via CT section 2 |
| Bluetooth (BlueZ) | Paired and connected devices and names | `bluetoothctl` text and a system-bus `dbus-monitor`, started only if the adapter was up at start; commands emit events without updating the cache | The tests (real adapter on test flows) | J4 | RS R41, R42, section 6 |
| The TV's browser (Chromium kiosk) | Whether it is alive and whether its window is visible | The engine spawns it, keeps its pid in a fixed file, shows and hides the window with `xdotool` and `wmctrl`, and kills by pattern machine-wide; reads only its process handle and a `visible` flag | The page it shows is also a client of the engine (section 3.6) | J4, J7, J2 | `backend/src/utils/displayDriver.js:53,77,127`; RS R32, section 6 |

Docker, `xdotool` and `wmctrl` are tools the engine calls, not programs it reads state from; they are inside the rows above.

## 4. The crossings, grouped by the job they serve

A crossing is one message, request, file, event or process call that goes from one part to another. This section places every crossing in IN (inbound catalog, sections 1a to 1d) and every row of RS (R1 to R61, plus its outside-program and machine-sharing sections) under one primary job, with secondary jobs in brackets. The placement is mine.

**Id key.** `W1` to `W5`: socket messages other than commands (IN 1a). `1b-N`: gm:command action number N (IN 1b; `1b-T1` to `1b-T4` are the four verbs that exist only in a table). `H1` to `H10`: the tablet's HTTP calls; `P1` to `P6`: the phone's; `E1` to `E6`: the hardware scanner's; `S1` to `S3`: the scoreboard's; `C1` to `C4` and `X1`: the config tool's (IN 1c). `A1` to `A5`: route files and doors with no client in IN (A1 `GET /api/admin/logs`, A2 `GET /api/vocabulary`, A3 the static mounts and symlinks, A4 UDP discovery on port 8888, A5 the service workers' pass-through). `V1` to `V23`: the 23 event names the backend emits (section 4.12). `O1` to `O11`: how the backend reads each outside program (RS section 6, in its order). `T1` to `T5`: how tests and a second engine reach the live machine (RS section 7, in its order). `F1` to `F12`: file, process and import crossings (defined at the head of section 4.7). `R1` to `R61`: RS rows (section 4.11). IN's own acknowledgement races are cited as "IN section 3, R1" to avoid a clash with RS ids.

### 4.1 J1: Run any game from its pack

| Id | From to | What crosses | Also serves | Cite |
|---|---|---|---|---|
| H8, H9 | Tablet to backend | `GET /api/pack/manifest`, then `GET /api/pack/files/<path>` per file; staged cache with per-file sha1 check and one pointer flip; falls back to cache then to the bundled copy | J8 (which channel by serving origin) | `ALNScanner/src/core/packLoader.js:136,222` via IN 1c; `backend/src/routes/packRoutes.js:19,34` |
| H10 | Tablet to its own origin | Same-origin static pack files (standalone and bundled tier) | J8 | `packLoader.js:394` via IN 1c; `backend/src/app.js:131-143` |
| P4 | Phone to its origin or the backend's static route | `./data/tokens.json` (the nested file; `PACK_PATH` shadows it when set) | J8 | `aln-memory-scanner/js/app.js:61-87,131-142` via IN 1c, CT conclusion 5 |
| P5 | Phone to backend | `GET /api/pack/manifest` for the identity line only | J9 | `aln-memory-scanner/js/app.js:98-125` via IN 1c |
| E4 | Hardware scanner to backend | `GET /api/tokens`, once at boot; refused above 50,000 bytes | J8 | `TokenService.h:203-264`, `config.h:90` via IN 1c, CT conclusion 7 |
| E5, E6 | Hardware scanner to backend | `GET /api/assets/manifest`; `GET /api/assets/images/<id>.bmp` and `audio/<id>.<ext>` per changed file, sha1 checked | J8 | `AssetService.h:102,200` via IN 1c; `backend/src/routes/resourceRoutes.js:71` |
| S2, S3 | Scoreboard to backend | `GET /api/tokens` once (owner totals); `GET /api/pack/files/game.json` once (evidence modes, money format) | | `scoreboard.html:1231` (re-read), `:1493` via IN 1c |
| S1 (injection half) | Backend to scoreboard | The pack's wording and colours written into the page text at serve | J7 (S1 also mints the credential) | `backend/src/routes/resourceRoutes.js:204-213,225` |
| V1 (the `pack` key) | Backend to tablet and scoreboard | The active pack's identity in the catch-up snapshot; the tablet and the scoreboard ignore it | J2 | `backend/src/websocket/syncHelpers.js:151`; GM conclusion 8; CT conclusion 3 |
| W1 (the `packHash` field) | Tablet to backend | Pack hash in the handshake; the backend compares and only logs a mismatch; the scoreboard sends none | J7 | `orchestratorClient.js:101`; `socketServer.js:139`; CT conclusion 3 |
| A2 | none to backend | `GET /api/vocabulary` (no sender; the tool serves its own copy) | | IN 1d |
| F1, F2, F7, F8, F11, F12 | See 4.7 | The pack's authoring and publishing paths | J6 | |
| F9 | Test harness to backend | `PACK_PATH` and `E2E_PACK_PATH` injection of a toy pack; the dual-pack matrix | J10 | `backend/src/app.js:131`; CT section 3.2 |

### 4.2 J2: Keep one true record and show it truly everywhere

| Id | From to | What crosses | Also serves | Cite |
|---|---|---|---|---|
| W5 | Tablet and scoreboard to backend | `sync:request`, no payload; the reply is a second `sync:full` on every connect; on a socket with no credential too | J7 | `backend/src/server.js:75`; `backend/src/websocket/socketServer.js:53` |
| 1b-21, 1b-22, 1b-23 | Tablet to backend | `score:adjust`, `score:reset`, `transaction:delete`: change scores, clear the record, free a claim | J7 (score-intervention floor), J3 (ack) | `commandExecutor.js:487,505,520` via IN 1b |
| 1b-59 | None sends it | `transaction:create`, manual transaction (executor accepts, no scanner code sends) | J3 | `commandExecutor.js:542` via IN 1b |
| V1, V3, V4, V5, V6, V7, V8, V11 | Backend to tablets and scoreboards | Snapshot; live transaction, delete, score adjustment, score reset, session update, overtime, group completed | J5 (V1, V6, V7), J7 (V7 reaches every socket) | section 4.12 |
| IN section 3, R5 | Tablet and backend | Score adjust and delete: the tablet waits for the ack and changes nothing locally; the views update from the two broadcasts | J3 | IN section 3 R5 |
| IN section 6, Q1 to Q4, Q8 | Tablet, backend | Questions with several answers: claimed, valid session phase, valid team, valid mode and points, free station name | | IN section 6 |

### 4.3 J3: Answer every action, and remember what happened

| Id | From to | What crosses | Also serves | Cite |
|---|---|---|---|---|
| W3 | Tablet to backend | `transaction:submit` with a `clientTxId` (persisted in `networkedTempQueue` first, replayed on every `sync:full`) | J2 (claim and score) | `backend/src/server.js:112`; `adminEvents.js:150-318`; `ALNScanner/src/network/networkedQueueManager.js:45-47,53-54` via IN 1a |
| W4 | Tablet to backend | `transaction:submit` without a `clientTxId` from `NetworkedStorage`; unreachable on the networked path | | `NetworkedStorage.js:137` via IN 1a, conclusion 3 |
| V2, V16 | Backend to submitting tablet | `transaction:result` (accepted, duplicate, rejected, error); the `error` event with the `clientTxId` for validation, session, queue and auth errors, treated as transient by the queue | | `adminEvents.js:292` (re-read); IN conclusion 5 |
| V13 | Backend to tablet | `gm:command:ack {action, success, message}` for every command; matched by action name only in the senders | J4, J5 | `adminEvents.js:118-122` via IN 1b; IN conclusion 7 |
| P1 | Phone to backend | `POST /api/scan` with `deviceType: 'player'`; replies 200, 409 no-session, 409 rejected, 404, 400, 503; every 4xx final for the phone | J4 (video queued) | `orchestratorIntegration.js:105`; `scanRoutes.js:43` |
| P2 | Phone to backend | `POST /api/scan/batch`, snapshotted batches, 10 s retry tick; a batch with no game is answered "processed" and stored nowhere | | `scanRoutes.js:317,347`; IN conclusion 11 |
| E1 | Hardware scanner to backend | `POST /api/scan`, one 10 s attempt; outcomes classed by `ScanResponse.h` | J4 | `ScanResponse.h:51-75`; `OrchestratorService.h` via IN 1c |
| E2 | Hardware scanner to backend | `POST /api/scan/batch`, 30 s, up to six tries; only 200 removes lines | | `OrchestratorService.h:541` |
| V14, V15 | Backend to device room | `offline:queue:processed` (no tablet handler; the path that sends it is unreachable) and `batch:ack` (sent to a room only tablets join, so no player device receives it) | | IN conclusion 9d, RS R11, R12 |
| V17 | Backend to tablet | `player:scan`, persisted to the player-scan list and broadcast to the GM room | J2 | `scanRoutes.js` via RS R9 |
| IN section 3, R1 to R4, R6, R7 | Tablet, backend, devices | The acknowledgement races: claim before reply, command ack plus broadcast, Reset System, add team, player replies from HTTP only, handshake and reconnect | | IN section 3 |
| IN section 6, Q5 to Q7 | Phone, hardware scanner, backend | Token exists, timestamp acceptable, 4xx final or retried | | IN section 6 |

### 4.4 J4: Run the show's equipment, and know its true state

| Id | From to | What crosses | Also serves | Cite |
|---|---|---|---|---|
| 1b-7 to 1b-13 | Tablet or cue to backend | video: `video:play`, `video:pause`, `video:stop`, `video:skip`, `video:queue:add`, `video:queue:reorder`, `video:queue:clear` | J3 (ack) | `commandExecutor.js:326-406` via IN 1b |
| 1b-14 to 1b-17 | Tablet or cue to backend | display: `display:idle-loop`, `display:scoreboard`, `display:return-to-video`, `display:status` | | `commandExecutor.js:415-451` via IN 1b |
| 1b-25 to 1b-30 | Tablet to backend | bluetooth: scan start, scan stop, pair, unpair, connect, disconnect (timeouts 45, 15, 30, 15 s) | | `commandExecutor.js:577-595` via IN 1b |
| 1b-31, 1b-32 | Tablet or cue to backend | `audio:route:set`, `audio:volume:set` | | `commandExecutor.js:612,954` via IN 1b |
| 1b-33, 1b-34 | Tablet or cue to backend | `lighting:scene:activate`, `lighting:scenes:refresh` | | `commandExecutor.js:625,633` via IN 1b |
| 1b-35, 1b-36 | Tablet or cue to backend | `sound:play`, `sound:stop` | | `commandExecutor.js:642,663` via IN 1b |
| 1b-37 to 1b-42 | Tablet to backend | cues: `cue:fire`, `cue:enable`, `cue:disable`, `cue:stop`, `cue:pause`, `cue:resume`; a success ack may mean "held" | | `commandExecutor.js:672-740` via IN 1b |
| 1b-43 to 1b-46 | Tablet to backend | held items: `held:release`, `held:discard`, `held:release-all`, `held:discard-all` | J3 | `commandExecutor.js:750-807` via IN 1b |
| 1b-47 to 1b-55 | Tablet to backend | music: `music:play`, `music:pause`, `music:stop`, `music:next`, `music:previous`, `music:setVolume`, `music:setShuffle`, `music:setLoop`, `music:loadPlaylist` | | `commandExecutor.js:822-859` via IN 1b |
| 1b-57, 1b-58 | Cue to backend | `music:seek`, `video:seek` (cues only; no scanner sends them) | | `commandExecutor.js:868,367` via IN 1b |
| 1b-T1, 1b-T2, 1b-T3 | None | `service:restart`, `service:out-of-service`, `service:in-service`: in the payload table and floor list, no case, so "Unknown action" | J9 (dormancy door) | `commandExecutor.js:98-101,963` (re-read 98, 963) |
| Cue-sourced dispatch | Cue engine to executor | `executeCommand` with `source:'cue'`, no ack; failure shows as `cue:error`; 24 actions allowed, 22 also GM-sendable | | IN 1b, 2d |
| C2, C3, C4 | Config tool to backend | `GET /api/music/tracks`, `GET /api/music/playlists`, `PUT /api/music/playlists` (writes the playlist file, bearer with show-control) | J6 | `config-tool/lib/routes.js:399,411,428` via IN 1c |
| X1 | Config tool to Home Assistant | `GET {HOME_ASSISTANT_URL}/api/states` for scene names | J6 | `config-tool/lib/routes.js:299` via IN 1c |
| V12, V19, V20, V21, V22 | Backend to tablets, scoreboards | `display:mode`; `cue:fired`, `cue:completed`, `cue:error`; `service:state` across ten domains | J9 (health domain), J7 | section 4.12 |
| O1 to O10 | Backend to each outside program | How each program is read and driven (section 4.9) | J9 | section 4.9 |

### 4.5 J5: Move each game through its life cleanly

| Id | From to | What crosses | Also serves | Cite |
|---|---|---|---|---|
| 1b-1 to 1b-6 | Tablet to backend | `session:create`, `session:start` (preflight gate, a NO-GO ack prefix matched by string), `session:pause`, `session:resume`, `session:end`, `session:addTeam` (the one command sent with a serialising sender) | J3, J2 | `commandExecutor.js:230-295` via IN 1b |
| 1b-24 | Tablet to backend | `system:reset`: handled in `adminEvents.js` before the executor; a hand-rolled listener with a fixed 5 s timeout, then `session:create` is sent; a slow reset reports failure and skips the create | J3 | `adminEvents.js:74-92` (re-read); `ALNScanner/src/app/domains/gameAdmin.js:306-340` via IN section 3 R3 |
| H6, H7 | Tablet to backend | `GET /health` and `GET /api/session` when the tablet restores networked mode after a reload; a reload while no game exists drops networked mode | J9 | `StateValidationService.js:125,148` via IN 1c; GM conclusion 13 |
| V6, V7, V1 | Backend to tablets, scoreboards | `scores:reset`, `session:update` (a new id triggers each client's own boundary), `sync:full` (after create, after a scores reset) | J2 | section 4.12; RS section 8 Q6 |
| System reset wiring | Backend to itself | Boot and Reset System wire listeners in opposite orders; a later scores reset hands tablets and the scoreboard the old transaction list | J2 | `backend/src/app.js:206`, `systemReset.js:138,162` (re-read); RS R4 (checked) |

### 4.6 J6: Let designers build, change and try games safely

There is no message from the config tool to the running engine: no reload, restart or apply call (CT section 2, "How the running orchestrator sees an edit"). The crossings are files, a child process and imports, listed in 4.7 (F1, F2, F7, F8). The one HTTP path is C4 under J4 (music playlists) and the login-time C1 under J7.

### 4.7 J8, and the file crossings

File, process and import crossings (defined here):

| Id | From to | What crosses | Primary job | Also | Cite |
|---|---|---|---|---|---|
| F1 | Config tool to the pack folder | Publish: sibling temp files, ordered renames, manifest last | J6 | J1 | `config-tool/lib/publish.js:165-192` (re-read 165) via CT section 2 |
| F2 | Config tool to its drafts | Copy of the live pack as a working draft; draft base re-stamped on publish | J6 | J1 | `config-tool/lib/draftStore.js:69-116,157-164` via CT section 2 |
| F3 | Config tool to `backend/.env` | Key-by-key merge, temp file then rename; read at the engine's start only | J8 | J7 (password) | `config-tool/lib/configManager.js:121-135` via CT section 2 |
| F4 | Config tool to `backend/config/environment/routing.json` | Audio routing; the engine reads only `ducking` | J8 | J4 | CT section 2; RS R34 |
| F5 | Config tool to `backend/public/audio` and `videos` | Direct upload and delete | J4 | J1 (media) | `config-tool/lib/routes.js:266-287` via CT section 2 |
| F6 | Config tool to presets | `config-tool/presets/*.json`; a load writes env, scoring and routing with backup and rollback | J8 | J6 | `configManager.js:436-482` via CT section 2 |
| F7 | Config tool to a child process | `node backend/scripts/validate-pack.js` at publish | J6 | J1 | `config-tool/server.js:47` |
| F8 | Config tool to engine code | In-process imports: `cueValidation`, `grants`, `build-pack-manifest` | J1 | J6, J7 | `config-tool/lib/routes.js:11`, `toolAuth.js:27`, `configManager.js:21,229` via CT section 2 |
| F9 | Test harness to the live checkout | Toy packs, fixtures, placeholder videos and music written into the live media folders | J10 | J1, J4 | `backend/tests/e2e/setup/generate-fixtures.js:99,129-155` via RS section 7 |
| F10 | Rig scripts to the machine | `up.sh`, `down.sh`, `provision.js`: delete pid files, SIGTERM listed pids, `docker rm -f` the witness container | J10 | J8 | `backend/tests/rung1/up.sh:47-51`, `down.sh:12,23-27` via RS section 7 |
| F11 | Notion sync script to the pack and assets | `tokens.json` (atomic), BMPs, asset manifest, pack manifest | J1 | J6 | `scripts/sync_notion_to_tokens.py:1-20,36-38` |
| F12 | Nested submodule copies | `ALNScanner/data` and `aln-memory-scanner/data` as git submodule checkouts of the pack (the phone's at pin `15d8d2e`) | J1 | J8 | CT conclusion 5 |

J8 crossings:

| Id | From to | What crosses | Also | Cite |
|---|---|---|---|---|
| H1 | Tablet to the network | `GET {candidate}/health` to about 509 addresses in batches of 32 (connection wizard discovery) | J9 | `connectionWizard.js:83` via IN 1c |
| H3 | Tablet to backend | `GET /health` at connect | J9 | `connectionWizard.js:339` via IN 1c |
| P6 | Phone to the network | `no-cors` discovery probe to `http://host:8000/health` | | `aln-memory-scanner/config.html:398,414` via IN 1c |
| A3 | Backend to every browser | Static mounts: `/gm-scanner` (symlink to `ALNScanner/dist`), `/player-scanner` (symlink to the phone's checkout), `/videos`, `/audio` | J10 (E2E tests the built folder, so stale `dist` tests stale code, CLAUDE.md root "Full Verification") | `backend/src/app.js:143`; `ls -la backend/public` |
| A4 | Backend to the LAN | UDP discovery on port 8888; no client in this repository reads it | | `backend/src/server.js:273-275` via IN conclusion 9 and CT conclusion 10 |
| A5 | Service workers | Same-origin re-issue; `/api/*` and `/health` network-first, with a synthetic 503 on the phone when offline | | `ALNScanner/sw.js:148-154` via IN 1c; `aln-memory-scanner/sw.js:152-170` via CT section 1.2 |
| Mode choice | none crosses | The tablet's tap, the phone's URL path, no setting on the hardware scanner, no field in the pack: nothing carries "this game is standalone" between parts | | SP section 1; EJ J8 |

### 4.8 J7: Give each person what their role needs, let each do only what their role allows

| Id | From to | What crosses | Also | Cite |
|---|---|---|---|---|
| W1 | Tablet to backend | Handshake `auth {token, deviceId, deviceType:'gm', version, packHash}`; verified against the in-memory token store, signature, audience; refused as `connect_error` with a code | J1, J8 (station name) | `backend/src/websocket/socketServer.js:49-153`; `gmAuth.js:27-215` via IN 1a |
| W2 | Scoreboard to backend | Handshake with an observe token and `deviceType:'gm'` asserted; no device record; ids starting `SCOREBOARD_` skip the duplicate-id check | | `scoreboard.html:1559`; `socketServer.js:85-88`; `gmAuth.js:54-66` |
| H2 | Tablet to backend | `GET /api/state`: full snapshot, no login; the tablet picks the next station name from its device list | J2 | `ALNScanner/src/ui/connectionWizard.js:204` via IN 1c; `backend/src/app.js:116` via RS section 0 |
| H4 | Tablet to backend | `POST /api/admin/auth {password}`: mints a 24 hour operator token in the engine's memory | | `backend/src/routes/adminRoutes.js:17` via IN 1c |
| C1 | Config tool to backend | `POST /api/admin/auth` at tool login with the same password; the engine token kept in the tool's memory | J4 | `config-tool/lib/toolAuth.js:86` via IN 1c |
| S1 (minting half) | Browser to backend | `GET /scoreboard` mints an observe token into the page; any browser that loads the page gets one | J1 | `backend/src/routes/resourceRoutes.js:204-205,225` |
| P3 | Phone to backend | `GET /health?deviceId&type=player`: the only thing that registers the phone as a device; no credential | J9 | `backend/src/routes/healthRoutes.js:51-93`; `orchestratorIntegration.js:426` via IN 1c |
| E3 | Hardware scanner to backend | `GET /health?deviceId` with no type: the route defaults to `player`, so the device list records the hardware scanner as a phone | J9 | `healthRoutes.js:54` |
| V9, V10, V23 | Backend to all sockets | `device:connected`, `device:disconnected` (to every socket, authenticated or not) and `gm:identified` (not in the contract) | J2 | `broadcasts.js:166` via RS section 4.3; `gmAuth.js:188` via IN conclusion 9 |
| V18, 1b-18 to 1b-20 | Tablet to backend to scoreboards | `scoreboard:page:next`, `:prev`, `:owner` from a tablet; the engine stores nothing and rebroadcasts `scoreboard:page` to the GM room, scoreboards included | J4 | `commandExecutor.js:462-474` via IN 1b; `broadcasts.js:471-472` via RS R60 |
| Floor | Inside the backend | The operator floor on commands (a granted-function check) and the operator-tier check on `transaction:submit`: two different mechanisms | J3 | `commandExecutor.js:152`; `adminEvents.js:165`; IN section 6 Q11 |

### 4.9 J9: Tell the truth about what it knows, and the outside programs

| Id | From to | What crosses | Also | Cite |
|---|---|---|---|---|
| H5 | Tablet to backend | `GET /health` before each connect attempt; only `response.ok` is read (the `pack` and `profile` fields are not) | J8 | `connectionManager.js:66` via IN 1c, section 6 Q10 |
| 1b-56 | Tablet to backend | `service:check`: a probe that reports into the registry; a different function for Bluetooth that does not report | J4 | `commandExecutor.js:884-950` via IN 1b, RS R41 |
| 1b-T4 | None | `preflight:run`: table entry only; the preflight result reaches clients only inside a session stamp and the text of an ack | | `commandExecutor.js:98-101`; RS R50 |
| V22 (health domain) | Backend to tablets | Health words per service; pushed on a status change only, message and time ride the snapshot | J4 | `broadcasts.js:536` (re-read); RS section 4.2 |
| A1 | None to backend | `GET /api/admin/logs`: operator log read, no sender in this repository | J3 | `backend/src/routes/adminRoutes.js:58` via IN 1d |
| O11 | Backend to the filesystem | `/proc/device-tree/model`, `/proc/<pid>/cmdline`, `/usr/share/zoneinfo`, `fs.watch` on the playlist file, the pack and token files themselves read live under a frozen manifest | J1 | RS section 6, last bullet |
| Reachability | Each client to the backend | Five separate answers (tablet socket plus health check, phone 10 s poll, hardware scanner 10 s poll with up to 61 s inside it, scoreboard socket with a 5 minute rule, the backend's own heartbeat monitor at 30 s) | | RS R54, section 5 |

Outside-program readings (RS section 6, in its order), all under J4 unless noted:

| Id | Program | Reading route | Cite |
|---|---|---|---|
| O1 | VLC | Session-bus `dbus-monitor` text, 15 s `PlaybackStatus` resync, live position read | `mprisPlayerBase.js:158-177,203-308` via RS section 6 |
| O2 | The TV's browser | Process handle and a `visible` flag; window found fresh on each show or hide | `displayDriver.js:34-49,102-115` via RS section 6 |
| O3 | `dbus-monitor` and `dbus-send` on the session bus | The VLC stream, owner bus name by `GetNameOwner` | `mprisPlayerBase.js:257-265,326-330` via RS section 6 |
| O4 | `dbus-monitor` on the system bus | BlueZ `PropertiesChanged` signals, 500 ms debounce | `bluetoothService.js:495-514,565-620` via RS section 6 |
| O5 | MPD | `mpd2` client on `/tmp/aln-mpd.sock`, idle events | `musicService.js:456-531` via RS section 6 |
| O6 | PipeWire through `pactl` | `list sinks short`, `list sink-inputs`, `info`, `subscribe` lines | `pactlClient.js:51-207` via RS section 6 |
| O7 | `pw-play` | The child's exit code and error event only | `soundService.js:91-104` via RS section 6 |
| O8 | BlueZ through `bluetoothctl` | Text from `show`, `devices`, `info`, scan and pairing lines | `bluetoothService.js:117-209` via RS section 6 |
| O9 | Home Assistant | HTTP, a `state_changed` WebSocket | `lightingService.js:110-209` via RS section 6 |
| O10 | Docker | `docker ps`, `start`, `stop` stdout | `utils/dockerHelper.js:19-93` via RS section 6 |
| O11 | Filesystem reads | Placed under J9 above | RS section 6 |

### 4.10 J10: Stay trustworthy as it changes

| Id | From to | What crosses | Cite |
|---|---|---|---|
| T1 | Tests and a second engine to the live machine | Six fixed `/tmp/aln-pm-*.pid` names and MPD files shared by every engine on the host; the orphan reap by command-line substring; the kiosk launch kills by pid file and then by pattern machine-wide; the audio service kills every `pactl subscribe` | `backend/src/utils/processMonitor.js:180`; `displayDriver.js:53,127`; `audioRoutingService.js:110` (re-read); RS section 7 |
| T2 | Each test layer to the live programs | Unit tests build real process monitors; contract tests call `initializeServices()` in eight files; integration tests run Reset System in 21 files; Tier L runs three engines that adopt the live display, audio and Bluetooth; four flows pin the venue profile and drive real Home Assistant | RS section 7 |
| T3 | Test runs to shared files | `backend/logs/*.log`, `backend/.env`, `backend/public/{audio,videos,music}`, `ALN-TokenData/`, `config-tool/presets`, `backend/config/music-playlists.json` | RS section 7 |
| T4 | Test runs to ports and the network | Live 3000, 8000, UDP 8888, 9000, 8443, 8123; the rig on 3199; the config tool smoke test on 9123 posts its fixture password to `ORCHESTRATOR_URL` (default the live engine) | RS section 7; `config-tool` smoke per CT section 2 |
| T5 | What is isolated | Per-worker data and log folders and a per-worker bus; `NODE_ENV=test` switches storage to memory; pid files, MPD paths, Home Assistant, the virtual display, audio, Bluetooth, the kiosk and the TV are not isolated; blue's eight fixes are absent here | RS section 7 |
| F9, F10 | See 4.7 | | |
| Joins that are tested | Contract tests against the written contracts | Section 7 | |

### 4.11 Runtime-state rows R1 to R61, each placed under a job

Each row is a runtime fact that has an authority and copies in other parts (RS section 2). "Crosses" names the route between parts by id; the row's own detail is in RS.

| R | Fact | Primary job (also) | Crosses between | By |
|---|---|---|---|---|
| R1 | Game session record | J2 (J5) | backend to tablet, scoreboard, `GET /api/session` | V7, V1, H7 |
| R2 | Game session phase | J2 (J5) | backend to tablet, scoreboard | V7, V22 (gameclock) |
| R3 | Teams | J2 | backend to tablet, scoreboard | V7, 1b-6 |
| R4 | Accepted GM transactions | J2 (J3) | backend to tablet, scoreboard | V3, V4, V1 |
| R5 | Team scores | J2 | backend to tablet, scoreboard | V3, V5, V4, V1 |
| R6 | Group completion and bonuses | J2 | backend to tablet, scoreboard (the scoreboard only logs it) | V11 |
| R7 | Claimed tokens per device | J2 (J3) | backend to the connecting tablet only | V1 (`deviceScannedTokens`), V3 |
| R8 | Claimed tokens across the game | J2 | backend to tablet (as transactions) | V3, V2 |
| R9 | Player scans | J3 (J2) | phone and hardware scanner to backend to tablet | P1, P2, E1, E2, V17 |
| R10 | Admin score adjustments | J2 | backend to tablet | V5 |
| R11 | Backend queue of GM scans and the offline flag | J3 | backend to tablet (never fires) | V14 |
| R12 | Scans a client accepted that the backend has not answered | J3 | tablet, phone, hardware scanner to backend | W3, P2, E2, V15 |
| R13 | Connected devices | J7 (J2) | backend to tablet; phone and hardware scanner by `/health` | V9, V10, V1, P3, E3 |
| R14 | Game creation stamp (pack, preflight, override) | J1 (J5) | backend to tablet inside the session record | V7, V1 |
| R15 | Active pack and its identity | J1 | backend to every client; config tool to the backend's folder | H8, H9, P4, P5, E4, S1, S3, F1 |
| R16 | Token catalog | J1 | backend to phone, hardware scanner, scoreboard, tablet | H9, P4, E4, S2 |
| R17 | Media assets | J1 (J8) | backend folders to hardware scanner, phone cache; config tool to folders | E5, E6, F5 |
| R18 | Credentials | J7 | backend to tablet, scoreboard, config tool | H4, C1, S1, W1, W2 |
| R19 | Transient delivery state | J2 | inside the backend | none crosses |
| R20 | Dead or derived session fields | J2 | backend to tablet inside metadata | V7, V1 |
| R21 | Game clock | J2 (J4) | backend to tablet, scoreboard | V22 (gameclock), V1 |
| R22 | Game phase and overtime flag | J2 | backend to tablet | V22, V8 |
| R23 | Running compound cues | J4 | backend to tablet | V22 (cueengine), V19 to V21 |
| R24 | Standing-cue state | J4 (J5) | backend to tablet | V22 (cueengine) |
| R25 | Cues silenced by dormancy | J4 (J9) | backend to tablet | V22 (cueengine) |
| R26 | Held cues | J4 (J3) | backend to tablet | V22 (held), 1b-43 to 1b-46 |
| R27 | Held videos | J4 | backend to tablet | V22 (held) |
| R28 | Video queue | J4 | backend to tablet; a player scan feeds it | V22 (video), P1, E1 |
| R29 | Current video and progress | J4 | backend to tablet | V22 (video) |
| R30 | VLC player state | J4 | VLC to backend to tablet | O1, V22 (video) |
| R31 | Display mode | J4 (J7) | backend to tablet, scoreboard | V12, V1 |
| R32 | The TV's browser (alive, visible) | J4 | browser process to backend | O2, V22 (health) |
| R33 | Audio sinks and sink-input registry | J4 | PipeWire to backend to tablet | O6, V22 (audio) |
| R34 | Audio routes and default sink | J4 | tablet to backend to PipeWire; config tool writes a file nothing reads | 1b-31, F4, V22 (audio) |
| R35 | Stream volumes | J4 | tablet to backend to PipeWire | 1b-32, V22 (audio) |
| R36 | Ducking | J4 | backend to tablet | V22 (audio) |
| R37 | Music playback | J4 | MPD to backend to tablet | O5, V22 (music) |
| R38 | Music playlist, shuffle, loop | J4 | tablet to backend to MPD | 1b-53 to 1b-55, V22 (music) |
| R39 | Playlist catalog | J4 (J6) | config tool to backend to file; backend to tablet | C4, V22 (music) |
| R40 | Sounds playing | J4 | tablet to backend to `pw-play` | 1b-35, 1b-36, O7, V22 (sound) |
| R41 | Bluetooth devices | J4 | BlueZ to backend to tablet | O4, O8, V22 (bluetooth) |
| R42 | Bluetooth scan and pair in progress | J4 | tablet to backend to BlueZ | 1b-25 to 1b-30, V22 (bluetooth) |
| R43 | Lighting scenes and active scene | J4 | Home Assistant to backend to tablet | O9, 1b-33, 1b-34, V22 (lighting) |
| R44 | Lighting connection | J4 (J9) | Home Assistant to backend to tablet | O9, V22 (health, lighting) |
| R45 | Home Assistant container started by us | J4 (J8) | backend to Docker | O10 |
| R46 | Each service's health entry | J9 (J4) | backend to tablet | V22 (health), 1b-56, V1 (`serviceHealth`) |
| R47 | Dormant latch, door profile | J9 (J4) | profile and pack to backend to tablet | V22 (health, cueengine) |
| R48 | Dormant latch, door operator | J4 (J9) | none (no sender) | 1b-T2, 1b-T3 |
| R49 | Active installation profile | J8 (J9) | profile file to backend; `/health` to every client | V1 (`profile`), H5, P3, E3 |
| R50 | Preflight result | J9 | backend to tablet inside session stamp and ack text | 1b-2, 1b-T4, V13 |
| R51 | Pre-play hooks | J4 | inside the backend | none crosses |
| R52 | Child-process supervision state | J4 (J10) | backend to the programs; pid files shared | O1 to O10, T1 |
| R53 | Health revalidation timer | J9 | inside the backend | none crosses |
| R54 | Is the orchestrator reachable (each client's view) | J9 | each client to backend | H5, P3, E3, W1, W2 |
| R55 | Station identity | J7 | tablet to backend at connect; scoreboard and phones by their own ids | H2, W1, W2, P3, E3 |
| R56 | Deployment mode | J8 | none crosses (a tablet tap, a phone path) | none |
| R57 | The tablet's selected transaction mode | J1 (J3) | tablet to backend inside each scan | W3 |
| R58 | Standalone game record | J8 (J2) | none crosses | none |
| R59 | Phone's scanned token ids | J2 (J5) | none crosses | none |
| R60 | Scoreboard page position and evidence cycling | J7 (J2) | tablet to backend to scoreboard | 1b-18 to 1b-20, V18 |
| R61 | Config tool state (drafts, publish log, tokens) | J6 | config tool to files; to backend by C1, C4 only | F1, F2, C1, C4 |

### 4.12 The 23 events the backend emits

From RS section 4.3 and IN section 1a; rooms from RS section 4.3. The contract lists 22 of them (RS section 4.3, last bullet).

| Id | Event | Goes to | Primary job (also) | Tablet handler | Scoreboard |
|---|---|---|---|---|---|
| V1 | `sync:full` | the GM room (three senders), the requester, `GET /api/state` | J2 (J5, J1, J9) | yes | replaces scores and evidence, ignores the rest |
| V2 | `transaction:result` | the submitter | J3 | yes | no |
| V3 | `transaction:new` | the game's room | J2 (J3) | yes | adds evidence, sets score |
| V4 | `transaction:deleted` | the game's room, else the GM room | J2 | yes | removes evidence, sets score |
| V5 | `score:adjusted` | the game's room | J2 | yes | sets score |
| V6 | `scores:reset` | the game's room | J2 (J5) | yes | zeroes scores, clears evidence |
| V7 | `session:update` | every socket | J2 (J5, J7) | yes, twice | new id resets; seeds team rows |
| V8 | `session:overtime` | the GM room | J2 | yes | no |
| V9 | `device:connected` | every socket | J7 | yes | no |
| V10 | `device:disconnected` | every socket | J7 | yes | no |
| V11 | `group:completed` | the GM room | J2 | toast | logs |
| V12 | `display:mode` | every socket | J4 | yes | overlay in kiosk mode |
| V13 | `gm:command:ack` | the sender | J3 (J4, J5) | yes | no |
| V14 | `offline:queue:processed` | the GM room | J3 | no handler | no |
| V15 | `batch:ack` | the device's room | J3 | no handler | no |
| V16 | `error` | the submitting socket | J3 | yes | no |
| V17 | `player:scan` | the GM room | J3 (J2) | yes | no |
| V18 | `scoreboard:page` | the GM room | J7 (J4) | no | yes |
| V19 | `cue:fired` | the GM room | J4 | yes | no |
| V20 | `cue:completed` | the GM room | J4 | no handler | no |
| V21 | `cue:error` | the GM room | J4 | yes | no |
| V22 | `service:state` (ten domains: `music`, `video`, `health`, `bluetooth`, `audio`, `lighting`, `sound`, `gameclock`, `cueengine`, `held`) | the GM room, debounced 50 ms per domain | J4 (J9, J2) | yes | reads `gameclock` only |
| V23 | `gm:identified` | the connecting socket | J7 | no (not in the tablet's list) | no |

Sources for the handler columns: GM conclusion 11 (19 of 22 types handled, `offline:queue:processed`, `batch:ack` and `cue:completed` unhandled), CT section 1.1 (the scoreboard's handler table), RS section 4.3. The tablet handles `session:update` twice, once in the router and once in `MonitoringDisplay` (RS section 4.1).


## 5. The component-by-job matrix

One row per component. Codes as in section 1: **D** decides, **H** holds or shows a copy, **R** carries out or delivers, **·** not involved, **!** section 6 lists the cell. The cells follow the entries in section 3; where a cell is not obvious, the row's entry carries its citation.

| Component | J1 pack | J2 record | J3 answer, remember | J4 equipment | J5 life of a game | J6 design safely | J7 roles | J8 any setup | J9 truth | J10 trust |
|---|---|---|---|---|---|---|---|---|---|---|
| Backend | D,R! | D,R! | D,R! | D,R! | D! | R! | D! | D! | D! | R! |
| GM scanner, networked | H! | D,H! | D,R! | R,H! | D,R! | · | R! | D! | H! | R |
| GM scanner, standalone | H! | D! | D! | · | D! | · | · | D! | H! | · |
| Web player scanner | H! | D! | D,R! | R | H! | · | R! | D! | D! | · |
| Hardware player scanner (ESP32) | H,R! | · | D,R! | R | H! | · | R! | D! | D! | · |
| TV scoreboard | H,D! | H! | · | H! | D! | · | R | · | D! | · |
| Pi 4 scoreboard | H,D! | H! | · | · | D! | · | R | R! | D! | · |
| Config tool | R! | · | · | R! | · | D! | D! | R! | · | R |
| Pack data and its sync tools | D! | · | R | H | · | R | · | H | · | R |
| Tests, CI and the rung-1 rig | R | · | · | R! | · | R | · | R | · | D! |
| VLC | · | · | · | D | · | · | · | · | · | · |
| MPD (music) | · | · | · | D | · | · | · | · | · | · |
| Audio system (PipeWire, `pw-play`) | · | · | · | D | · | · | · | · | · | · |
| Home Assistant and its container | · | · | · | D | · | · | · | · | · | · |
| Bluetooth (BlueZ) | · | · | · | D | · | · | · | · | · | · |
| The TV's browser (Chromium kiosk) | · | · | · | D! | · | · | R! | · | · | · |

### 5.1 Reading the matrix by column

Counts are of cells containing the letter, from the table above (computed by script from the table, section 8).

| Job | Components that decide (D) | Hold a copy (H) | Carry out (R) | Involved (any letter) | Flagged (!) | Who decides |
|---|---|---|---|---|---|---|
| J1 | 4 | 6 | 4 | 10 | 9 | Backend; TV scoreboard; Pi 4 scoreboard; Pack data and its sync tools |
| J2 | 4 | 3 | 1 | 6 | 6 | Backend; GM scanner, networked; GM scanner, standalone; Web player scanner |
| J3 | 5 | 0 | 5 | 6 | 5 | Backend; GM scanner, networked; GM scanner, standalone; Web player scanner; Hardware player scanner (ESP32) |
| J4 | 7 | 3 | 6 | 14 | 6 | Backend; VLC; MPD (music); Audio system (PipeWire, `pw-play`); Home Assistant and its container; Bluetooth (BlueZ); The TV's browser (Chromium kiosk) |
| J5 | 5 | 2 | 1 | 7 | 7 | Backend; GM scanner, networked; GM scanner, standalone; TV scoreboard; Pi 4 scoreboard |
| J6 | 1 | 0 | 3 | 4 | 2 | Config tool |
| J7 | 2 | 0 | 6 | 8 | 6 | Backend; Config tool |
| J8 | 5 | 1 | 3 | 9 | 7 | Backend; GM scanner, networked; GM scanner, standalone; Web player scanner; Hardware player scanner (ESP32) |
| J9 | 5 | 2 | 0 | 7 | 7 | Backend; Web player scanner; Hardware player scanner (ESP32); TV scoreboard; Pi 4 scoreboard |
| J10 | 1 | 0 | 4 | 5 | 2 | Tests, CI and the rung-1 rig |

Reading across the table:

- **J3, J5, J8 and J9 each have five deciders, and J2 and J1 four.** A job with that many deciders is carried by parts that each make their own call. J2 and J3 are split between the backend and the clients that judge for themselves; J5 between the backend, two tablet modes and two scoreboard deployments; J8 between five parts that each pick their own mode; J9 between the backend and four clients that each draw their own word.
- **J4 has seven deciders, and six of them are programs outside the engine.** The backend is the only decider of intent. That fits the job's wording, in which the outside programs decide what they are doing (EJ J4). The risk in J4 is in how the backend reads them, not in who decides.
- **J6 and J10 each have exactly one decider, and neither decider can reach the part it affects.** The config tool decides what is published but sends the engine nothing; the test layer decides green or red but shares the live machine's files (sections 4.6, 4.10).
- **J7 has two deciders that do not agree on a door.** The backend and the config tool each run their own login against one password file (CT conclusion 13).
- **No part is a decider for J5 by design.** The five D marks in J5 are each a part deciding its own piece of a life it was not told about.

### 5.2 Notes on cells a reader may question

- **Backend, J6 (R!).** The backend only runs the pack check the config tool calls and adopts a pack at start; it does not apply a change to a running game. The cell is flagged because nothing carries a published change from the tool to the engine (section 6, split 6).
- **Backend, J7 (D!).** The backend decides who a connection is, but the handshake guard covers only a socket that calls itself `gm` (`backend/src/websocket/socketServer.js:53`), and `sync:request` and `GET /api/state` need no credential (`server.js:75`; RS section 0).
- **GM scanner, standalone, J2 and J3 (D, D!).** The tablet is the only judge; the flaw is that the caller ignores the store's answer (`LocalStorage.js:302`; SP section 2 C9).
- **Web scanner, J2 (D!).** Its seen set is a game fact decided on a phone, with no link to a game (RS R59).
- **TV, J1 (H,D!).** The scoreboard holds a copy of `game.json` and also decides the evidence rule from it (`scoreboard.html:1231`).
- **Pack data, J1 (D!).** It is the authority for the game's definition. It is flagged because nine holders read it with no message joining them (section 6, split 1).
- **Tests, J4 (R!).** The tests act on live equipment; that is the harm, not a service to J4 (RS section 7).
- **The TV's browser, J4 and J7 (D!, R!).** The engine runs it and it is also a client of the engine; neither side's entry covers both (section 6, split 11).
- **The five other outside programs have no flags.** Each decides what it does. The faults sit in how the backend reads them (section 3.11, section 4.9).


## 6. Where a job is split across parts with nothing joining them, and where a part does another's job

### 6.1 Splits

Each split names the job, the parts that each hold a piece, what would have to join them (as a fact about the gap, not a design), the flaws that sit in it, and the evidence.

1. **J1, the pack, is held in nine places.** The backend's frozen snapshot and the live disk bytes under it; the tablet's loaded copy; the phone's nested file; the hardware scanner's SD token file and asset-manifest identity; the scoreboard's `game.json` fetch and the page's injected wording; the config tool's working tree and drafts; the Notion sync script's output; the two nested submodule copies; and the media in three folders (split 12). No message says the pack changed: the contract has no event for it, the tablet ignores the snapshot's `pack` and `profile` keys, the scoreboard sends no pack hash, and the config tool sends the engine nothing on publish (RS R15, section 4.2 "Pack, profile" row; GM conclusion 8; CT conclusions 3, 4; CT section 2). After a publish without a restart, the engine scores by the old rules, the scoreboard's evidence modes come from the new file, `/api/tokens` returns the new tokens, the tablet keeps its cached old pack, and the phone shows its own older file (RS section 3.1 "Which pack is running"). The scoring values are read from one block of `game.json` by both the engine and the tablet, but group-completion logic is written twice (CLAUDE.md root, "Scoring Business Logic", "CRITICAL"). Flaws: C12, C14, N1.
2. **J2, the game record, is decided in one part and re-decided in four.** The backend holds the record. The tablet re-decides the claim (mark before reply, `gameOps.js:329-331`), the points (`gameOps.js:319-323` via IN section 3 R1 step 4) and whether the game allows scans (via IN section 6 Q2). The scoreboard holds its own tables with its own write rules. The standalone tablet holds a second authority built from a hand-kept copy of the rules, which nothing imports (SP section 1). The phone's seen set decides a fact the record never sees (RS R59). What joins them today is the catch-up snapshot, built by different code from the live events for seven facts (RS section 4.2). Flaws: C1, C6, C9, C11.
3. **J3, the answer to an action, travels two ways and is remembered in four places.** A GM scan gets a socket result and a player scan gets an HTTP status; the phone and the hardware scanner read the same status differently (IN section 6 Q7). The queue of unanswered scans lives on the tablet, the phone, the hardware scanner and, by design, the engine's batch cache and an unreachable offline queue (RS R11, R12). No reply says which request it answers on every route, whether it is final or whether anything was stored (AN C7). Flaws: C7, C9, C13.
4. **J4, equipment state, reaches screens by two routes and is read by seven.** A service's state and its health arrive as separate pushes; the scoreboard reads one domain of ten; a player learns a video was not started only from a scan reply; the engine's picture of each program is parsed text with no age (RS R46, section 8 Q2, Q3; CT section 1.1). The restart rule is a different shape for four programs and absent for the TV's browser (EJ J4, "the supervisor"). Flaws: C2, C3, C5, C10, C11.
5. **J5, the life of a game, is carried in at least six places.** Boot and Reset System in the backend (two lists), the tablet's boundary inference, the scoreboard's, the phone's seen set and queue, the hardware scanner's queue and token list, the standalone tablet's six code paths. Nothing says what a boundary does to each fact and no boundary message is sent to a player device (RS section 8 Q6; SP section 2 C4). Flaws: C4, C5, C1, C6, C7.
6. **J6, design safely, splits authoring from adoption with only an import between them.** The config tool authors and publishes; the engine adopts at start; the clients re-read at their own moments. The tool imports the engine's cue vocabulary, grants and manifest builder and runs the engine's pack check as a child process (F7, F8): that is the one place a client part and the engine share code. No apply step, no preview engine, no statement of where one would run (RS R15; EJ J6; MD "Gap" at lines 40-41). Flaws: C12, C8.
7. **J7, roles, is enforced by the engine's credential check and bent by the client's word.** A socket that does not call itself `gm` is never asked for a credential; the scoreboard asserts `gm`; the phone and the hardware scanner carry no credential; `sync:request` and `GET /api/state` return the snapshot to anyone; the config tool runs a second login against the same password file; the floor on commands is a granted-function check while `transaction:submit` checks the tier (`socketServer.js:53`; `server.js:75`; IN section 6 Q11; CT conclusion 13). Flaw: C13.
8. **J8, any setup, is chosen four different ways by four parts and declared nowhere.** The tablet by a tap, the phone by its URL path, the hardware scanner not at all, the pack by no field; the engine's own equipment verdict comes from the profile, the environment flags and the probes, which nothing reconciles (SP section 1; RS section 5 "Is equipment X installed?"). Flaws: N1, C8, C15.
9. **J9, honest words, are drawn separately by each client.** Reachability has five answers (RS R54); health words render on the tablet only; the preflight result reaches no screen except as a stamp and ack text (RS R50); a standalone game reads as an outage on every player device (SP section 2 C10). Flaws: C10, C2, C3.
10. **J10, trust, is organised per part, and the joins between parts are tested in a few places.** Twelve test configurations by part (CT section 3.1); three contract tests pin joins (section 7); tests reach the live machine's files and programs (RS section 7). Flaws: C8, C14, C15, C16.
11. **The TV's browser is on both sides of the engine and no entry covers both.** The engine launches, shows, hides and kills it as an outside program (`displayDriver.js:53,77,127`), and the page in it is a client of the engine's socket under an observe credential (`gmAuth.js:54-66`). The engine's health word for it comes from the process; the mode is the engine's intent; the page ignores the snapshot's mode (RS section 3.1 "Display health and visibility"; CT conclusion 3).
12. **J1 media lives in three homes and nothing checks every named file is present.** `backend/public/videos` and `audio` (filled by hand copy or the config tool's upload), `aln-memory-scanner/assets/` with a checked-in manifest (the hardware scanner's media, in the phone scanner's repository), and the phone's service-worker cache (RS R17; CT conclusion 6; AN C15). The pack names files, not folders (CTX section 0, "Media bundle").
13. **The physical tag format is kept by hand in three places.** The tag writer writes a text record first and a `?token=` URL second; the hardware scanner reads the text record, the phone reads the URL parameter, the tablet reads through Web NFC (`ALN-TokenData/CLAUDE.md:92`; `aln-memory-scanner/js/app.js:539-541`; `ALNScanner/src/utils/nfcHandler.js:23`). The file shape the hardware scanner expects (a wrapper object) differs from the pack's own flat token file (SP section 4 parity row 4; AN C14).

### 6.2 A part doing another part's job

| # | Part | Does the job of | What it does | Cite |
|---|---|---|---|---|
| M1 | GM scanner, networked | Backend (J2, J3) | Computes and shows points, marks the claim, shows "complete" before the engine answers | `gameOps.js:319-323,329-331,376` |
| M2 | Web and hardware player scanners | Backend (J3), backend record (J2) | Decide whether a token exists and never send an unknown id; the phone decides new or revisited | `aln-memory-scanner/js/app.js:399-405,448-451` via CT section 1.2; `Application.h:525-548` via CT section 1.3 |
| M3 | TV and Pi 4 scoreboards | The pack's reader (J1), the clock (J2, J9) | Decide the evidence rule from a file they fetch; extrapolate the countdown from a local clock and keep it running after a disconnect | `scoreboard.html:1231`; CT section 1.1 |
| M4 | Backend routes | Credential issuing (J7) and device registry (J7) inside read paths | Mints the display's credential when serving the page, injects pack content into the page text, registers a device when `/health` is called with an id, and records a route default as the device's type | `resourceRoutes.js:204-213,225`; `healthRoutes.js:51-93`, `:54` |
| M5 | Config tool | The engine's own settings, media and playlist handling (J8, J4, J1) | Writes `backend/.env`, `routing.json` and the media folders directly; proxies playlist writes with a stored engine credential | `config-tool/lib/configManager.js:121-135`, `routes.js:266-287,421-442` via CT section 2 |
| M6 | Test harness and fixtures | Nothing: it harms J1 and J4 | Writes placeholder videos under real token names into the live media folder, adopts the live display and audio, kills the engine's helper programs | `generate-fixtures.js:99,129-155` via RS section 7; T1, T2 |
| M7 | Backend | Test isolation (J10) | Names its helpers' files in fixed places and kills by pattern machine-wide, so a second engine or a test run reaps the first's programs | `processMonitor.js:180`; `audioRoutingService.js:110`; RS section 7 |
| M8 | Phone scanner's repository | The hardware scanner's media store (J1) | Holds the images, audio and asset manifest the hardware scanner syncs, served by the backend's asset routes | `resourceRoutes.js:19-46,71-83` via CT conclusion 6; RS R17 |
| M9 | Backend scoreboard route | Audience screen delivery (J7) | Serves the page that decides evidence, paging and countdown on the audience's screen | `resourceRoutes.js:225`; `scoreboard.html:1115-1341` via CT section 1.1 |

## 7. Joins that exist today

Where one part's behaviour is checked against another's. These are the places a change in one part is caught by a test or a check in another. All are in the repository now (listed with `ls` and the file headers, 2026-11-01).

| Join | Parts it ties | What checks it | Cite |
|---|---|---|---|
| The tablet's event list and command names against the contract | GM scanner, backend contract | `MESSAGE_TYPES` must equal the contract's subscribe set; every `gm:command` action the controllers emit must be in the contract's enum | `backend/tests/contract/scanner/client-contract-conformance.test.js:12-20` (re-read) |
| The phone's and hardware scanner's request payloads against the contract | Phone, hardware scanner, backend contract | Payloads validated against the OpenAPI request schemas | `backend/tests/contract/scanner/request-schema-validation.test.js` (file exists; root CLAUDE.md "Scanner contract validation") |
| Pack files against their schemas | Pack data, backend, config tool | Schema tests for pack, tokens and installation profile; a session-bundle schema | `backend/tests/contract/pack/pack-schemas.test.js`; `token-data/tokens-schema.test.js`; `profile/installation-profile-schema.test.js`; `session-bundle.schema.test.js` |
| The scoreboard's socket events | Scoreboard, backend | Contract tests for `scoreboard:page` and display events; a unit test of the observe token | `backend/tests/contract/websocket/scoreboard-page-events.test.js`, `display-events.test.js`; `backend/tests/unit/middleware/observeToken.test.js` |
| The pack on the wire | Backend, tablet, hardware scanner | Per-file sha1 against the manifest on download; the manifest's freshness check | `ALN-TokenData/CLAUDE.md` ("Scoring Values", manifest); `AssetService.h:207-219` via CT section 1.3 |
| Handshake pack hash | Tablet, backend | The backend compares and logs a mismatch; nothing acts on it | `backend/src/websocket/socketServer.js:139` |
| Config tool and the engine's code | Config tool, backend | In-process imports and a child process; CI installs backend dependencies before the tool's tests | F7, F8; `.github/workflows/test.yml` via CT section 2 |
| The same suite on two packs | Engine, pack data | The Tier L matrix runs the production pack and the toy packs | `.github/workflows/test.yml:225-235` |
| Tablet against engine scoring | Tablet standalone, backend | One end-to-end flow compares team scores for the same tokens; its group case skips on the real pack | `backend/tests/e2e/flows/07c-gm-scanner-scoring-parity.test.js`; SP:147 |

Not joined by any check found in this sheet's sources: the hardware scanner's token-file shape against the pack's flat file (SP section 4 row 4); a hand-written fake against the real class (AN C16); the scoreboard page's use of the catch-up snapshot (it ignores display status; CT conclusion 3); the phone's nested token file against the active pack in production (CT conclusion 5); the media folders against the pack's named files (AN C15); the standalone tablet's group-completion logic against the engine's (SP section 1).

