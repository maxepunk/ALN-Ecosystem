# Today's backend modules against the engine's ten jobs

**Status: reader sheet for the architecture pass, step 1, relationships level (the modules inside the backend). Nothing here is decided.** Every target shape stays a candidate for step 3. The sheet maps what exists in `backend/src` today: what each module does, which jobs it holds part of, how deep it is, and what it depends on.

- **Date:** 2026-11-01.
- **Tree:** `/home/user/ALN-Ecosystem`, branch `claude/nice-curie-hescfv`, HEAD `b9dc5444`. `git status --short backend/src` showed no local changes. The stale clones beside the repository were not read. `backend/.env` was not opened. Nothing was executed except read commands and one Node script that parses `require` calls (appendix A). The engine, the tests and the devices were not run.
- **Sources.** The ten jobs: `docs/plans/architecture-pass/2026-10-31-engine-jobs.md` (cited `EJ`). The code itself, `backend/src`, every file read for its header and exports, and the load-bearing ones read in body. The design vocabulary is `mattpocock-skills/1.3.1/skills/engineering/codebase-design/SKILL.md`: module, interface, implementation, depth, seam, adapter, leverage, locality. Domain words (authority, copy, delivery path, dormant) are `CONTEXT.md` section 4b and section 5. Where `backend/CLAUDE.md` and the code disagreed, I followed the code. A claim taken from `backend/CLAUDE.md` is cited as such.
- **Citation form.** `path:line` is a line of `backend/src` (or the path given), re-read in this tree today. A claim that comes from a script run says so and names the script.

## 0. How to read this sheet

**What "serves a job" means here.** A module serves a job when its own code decides something for that job or holds state for it. Calling a module that does the work does not count. The job tags are my placement, taken from EJ's job definitions (EJ section 2). P marks the job a module mainly exists for. Some modules have no P (the logger). Nothing is tagged J6 as a main job, and J10 has one (a test adapter), because those two jobs live mostly outside `backend/src` (section 3).

**Depth words.** I use the glossary. Deep means a caller learns a small interface and gets a lot of behaviour, including hidden rules. Shallow means the interface is nearly the field list, or a dispatch table, or a pass-through. Mixed means a deep core behind an interface that is wide or leaks internals; the cell says which. These are judgements from reading the interface and body, not measurements. The deletion test helped in two places and the cell says so.

**What the dependency columns are.** For every file, the `require` calls to other files in `backend/src`, split into T (at module load, top of file) and L (inside a function, which is how this codebase breaks cycles). "outside" lists npm packages. Node built-ins are left out. The logger and the config are shown as `+log` and `+cfg` to keep the cells short. The L flag is a rule of thumb: any `require` on an indented line. I spot-checked it on the cycle edges in section 5.1 and it held. A `require` is not the only dependency: modules also reach each other through events, through service bags passed as parameters and through direct field access. Those are in sections 5.6, 5.7 and 5.10.

**Counts.** 90 files, 26,916 lines (`find backend/src -type f | wc -l` and `wc -l`). All 90 are `.js`. Every file has a row in section 2.

## 1. The ten jobs, in one line each

As EJ section 2 words them.

| Job | In one line |
|---|---|
| J1 | Run any game from its pack, and every part of the kit runs the same version of it. |
| J2 | Keep one true record of the game and show it truly on every screen, also after reconnecting. |
| J3 | Answer every scan and GM command once, clearly, and remember what happened. |
| J4 | Run the show's equipment and know its true state. |
| J5 | Move each game through its life (setup, start, pause, end, reset, restart, next game). |
| J6 | Let designers build, change and try games safely. |
| J7 | Give each person what their role needs, and let each do only what the role allows. |
| J8 | Run wherever the venue and the game need (this kit, with or without an engine, other kits later). |
| J9 | Tell the truth about what it knows (unknown, old, broken, not installed). |
| J10 | Stay trustworthy as it changes (tests prove the show path, joins are checked, tests never touch a live show). |

## 2. The module sheet, all 90 files

One row per file, in the order `find` lists them within each folder. Folders are grouped. The numbering runs 1 to 90.

#### Root files

| # | File (lines) | Jobs (P = primary) | Interface: what callers must know | Depth | Depends on (T = at load, L = inside a function) |
|---|---|---|---|---|---|
| 1 | `app.js` (351) | J8 P, J1, J5 | `app` (Express) and `initializeServices()`. The caller must run it once, before the server starts; the boot order is written inline (persistence, pack, profile, tokens, session, equipment, music, cues, VLC, dormancy, revalidation, app.js:178-340) and the order is part of the interface. Also sets private fields on musicService (app.js:219-225) and reads `PACK_PATH`/`ENABLE_MUSIC_PLAYBACK` itself (app.js:131, 226). | shallow | T: +cfg, +log, routes/adminRoutes, routes/healthRoutes, routes/musicRoutes, routes/packRoutes, routes/resourceRoutes, routes/scanRoutes, routes/sessionRoutes, routes/stateRoutes, services/audioRoutingService, services/bluetoothService, services/cueEngineService, services/displayControlService, services/gameClockService, services/lightingService, services/musicService, services/offlineQueueService, services/persistenceService, services/serviceHealthRegistry, services/sessionService, services/soundService, services/transactionService, services/videoQueueService, services/vlcMprisService; L: services/cueEngineWiring, services/dormancyService, services/packService, services/profileService, services/tokenService, websocket/listenerRegistry; outside: express, cors, helmet, express-rate-limit |
| 2 | `index.js` (7) | J8 P | Requires server.js. Nothing else. | shallow | T: server |
| 3 | `server.js` (485) | J8 P, J5, J2, J7 | `createServer`, `startServer`, `cleanup`, a `ServerState` machine. Also holds the socket handlers (`sync:request`, `gm:command`, `transaction:submit`, `disconnect`; server.js:61-130), the listener setup (server.js:138-160) and the shutdown order, which saves the session as it stands (server.js:163-217). | mixed | T: +cfg, +log, app, services/audioRoutingService, services/bluetoothService, services/cueEngineService, services/discoveryService, services/displayControlService, services/gameClockService, services/heartbeatMonitorService, services/lightingService, services/musicService, services/offlineQueueService, services/serviceHealthRegistry, services/sessionService, services/soundService, services/transactionService, services/videoQueueService, services/vlcMprisService, websocket/adminEvents, websocket/broadcasts, websocket/deviceTracking, websocket/eventWrapper, websocket/gmAuth, websocket/socketServer, websocket/syncHelpers; L: utils/displayDriver |

#### backend/src/config/

| # | File (lines) | Jobs (P = primary) | Interface: what callers must know | Depth | Depends on (T = at load, L = inside a function) |
|---|---|---|---|---|---|
| 4 | `config/index.js` (189) | J8 P, J7 | One plain object of env-derived sections, read at require time and validated once (config/index.js:163-188). Callers must know section names. It is not the only reader of the environment: 16 other files read `process.env` directly (list in section 5.9). Insecure defaults: admin password `admin`, JWT secret `change-this-secret-in-production` (config/index.js:67-68). | shallow (a data bag, on purpose) | outside: dotenv |

#### backend/src/gameRules/

| # | File (lines) | Jobs (P = primary) | Interface: what callers must know | Depth | Depends on (T = at load, L = inside a function) |
|---|---|---|---|---|---|
| 5 | `gameRules/cueValidation.js` (421) | J1 P, J6, J7 | `validateCuesBlock(cues, gameConfig, tokens)` returns problems; exports the cue vocabulary tables (`CUE_TRIGGER_EVENTS`, `CUE_ACTIONS`, ...). Pure, no I/O. Imported by packService (gate), commandExecutor (the cue-source floor), resourceRoutes (`/api/vocabulary`) and the config tool. | deep | none |
| 6 | `gameRules/cueVocabulary.js` (56) | J1 P, J4 | `GAME_EVENT_NORMALIZERS`: how a game event's payload is flattened for cue conditions. Kept equal to `CUE_TRIGGER_EVENTS` and the pack schema by tripwire tests (cueValidation.js header, lines 12-17). | shallow (a table) | none |
| 7 | `gameRules/dormancyWording.js` (39) | J9 P, J4 | `doorWording(door)` returns the one sentence for a dormant service's door. Five importers; deleting it would put the sentence back in five places. | shallow, earns its keep | none |
| 8 | `gameRules/duplicatePolicy.js` (123) | J3 P, J2, J1 | `checkDuplicate({transaction, transactions, scannedTokensByDevice, gameConfig})`, `findOriginalTransaction`, `isConsumingClaim`. Pure. The caller passes the session's data in; the rule never reads it. | deep | T: gameRules/modeSemantics |
| 9 | `gameRules/endpointServices.js` (147) | J9 P, J4, J8 | `dormantServicesFor(manifest, profile)`, `servicesForFamily`, `familyInstalled`. Pure. Holds the map from the five equipment families to the service ids they drive, so it names this kit's families. | deep (small) | none |
| 10 | `gameRules/formatting.js` (50) | J1 P, J3 | `parseMoneyFormat(format)`, `formatMoney(value, spec)`. Pure. The scanner's own formatter must match it (drift tripwire, header). | deep (small) | none |
| 11 | `gameRules/grants.js` (111) | J7 P | `computeGrants({tier, deviceClass})`, `requiredFloorFunction(action)`, the class and tier tables. Pure set algebra. Called at token mint (auth.js) and at command time (adminEvents, commandExecutor). | deep | none |
| 12 | `gameRules/modeSemantics.js` (251) | J1 P, J2, J3 | `resolveMode(gameConfig, modeId)`, `wireModeIds`, `defaultModeId`, label normalizers. Pure; the caller fetches `gameConfig` from packService and passes it. Carries a baked legacy ALN mode table (`LEGACY_ALN_MODES`) and a warn hook for packs without a modes block. | deep | none |
| 13 | `gameRules/packNeeds.js` (115) | J9 P, J1, J8 | `collectPackNeeds({game, cues, manifest})` returns the typed list of what the pack needs from the venue. Pure. | deep | none |
| 14 | `gameRules/resolution.js` (259) | J9 P, J8, J4 | `resolve(needs, profile, inventory)` returns verdicts and a roll-up. Pure; the caller gathers the live facts (the inventory) and owns all I/O. | deep | T: gameRules/dormancyWording, gameRules/endpointServices |
| 15 | `gameRules/scoring.js` (305) | J2 P, J1 | `pointsFor`, `isGroupComplete`, `groupBonusAmount`, `computeTeamScores` and helpers over plain token and transaction fields. Pure. The GM scanner standalone scoring must match these functions. | deep | T: gameRules/modeSemantics |

#### backend/src/middleware/

| # | File (lines) | Jobs (P = primary) | Interface: what callers must know | Depth | Depends on (T = at load, L = inside a function) |
|---|---|---|---|---|---|
| 16 | `middleware/auth.js` (370) | J7 P, J5, J1 | Mint and verify operator tokens and observe tokens; Express guards `requireAdmin`, `requireFunction(fn)`, `optionalAdmin`. Hidden rules a caller must know: a token is valid only while it sits in an in-memory Set (auth.js:92-96), so an engine restart invalidates every token; two stores (operator, observe); a cleanup timer starts at load outside tests (auth.js:346); the mint reads the active pack hash. | mixed | T: +cfg, +log, gameRules/grants, services/packService; outside: jsonwebtoken |

#### backend/src/models/

| # | File (lines) | Jobs (P = primary) | Interface: what callers must know | Depth | Depends on (T = at load, L = inside a function) |
|---|---|---|---|---|---|
| 17 | `models/deviceConnection.js` (243) | J2 P, J7 | Class with fields, Joi validation and connection predicates (`isGM`, `hasTimedOut`, `updateHeartbeat`). The interface is nearly the field list. | shallow | T: utils/validators |
| 18 | `models/session.js` (426) | J2 P, J3, J5 | `Session` (426 lines): status transitions (`start`, `pause`, `complete`), `addTransaction`, `addPlayerScan`, device list, per-device claimed tokens, `toJSON`/`fromJSON` with legacy defaults. Its fields are written from outside (sessionService writes `metadata.preflight`, `gameClock`, `cueEngine`; sessionService.js:224, 295, 339, 726), so the real interface is the field set. | mixed | T: models/teamScore, utils/validators; outside: uuid |
| 19 | `models/teamScore.js` (265) | J2 P | `TeamScore`: `addPoints`, `addBonus`, `adjustScore`, `completeGroup`, `reset`. Mutated in place by transactionService. | shallow | T: utils/validators |
| 20 | `models/token.js` (112) | J1 P | `Token` with `hasVideo`, `isGrouped`, `getVideoDuration`, `toJSON`. | shallow | T: utils/validators |
| 21 | `models/transaction.js` (195) | J3 P, J2 | `Transaction`: `accept`, `reject`, `markAsDuplicate`, `fromScanRequest`. Defaults a missing mode to `blackmarket` on hydration (a stable legacy literal). | shallow | T: utils/validators; outside: uuid |
| 22 | `models/videoQueueItem.js` (243) | J4 P | `VideoQueueItem`: small playback state machine (`startPlayback`, `pausePlayback`, `completePlayback`, `failPlayback`) plus predicates. | shallow | T: utils/validators; outside: uuid |

#### backend/src/routes/

| # | File (lines) | Jobs (P = primary) | Interface: what callers must know | Depth | Depends on (T = at load, L = inside a function) |
|---|---|---|---|---|---|
| 23 | `routes/adminRoutes.js` (111) | J7 P | `POST /api/admin/auth` (password for token), `GET /api/admin/logs` (operator only). | shallow | T: +cfg, +log, middleware/auth; outside: express |
| 24 | `routes/healthRoutes.js` (115) | J9 P, J2, J8, J1, J7 | `GET /health`; with `?deviceId=&type=` it also registers the caller as a device in the session. `type` defaults to `player` and anything else is refused (healthRoutes.js:54, 64), so a hardware scanner is recorded as a phone scanner. Returns pack and profile identity and the POSIX timezone. | shallow | T: +log, models/deviceConnection, services/sessionService, utils/timezone; L: services/packService, services/profileService; outside: express |
| 25 | `routes/musicRoutes.js` (89) | J4 P, J6 | `createMusicRouter({musicService})` (the only route module that takes its service by parameter): tracks, playlists get, playlists put (`show-control` function). Also re-exports a musicService parser (musicRoutes.js:89). | shallow | T: middleware/auth, services/musicService; outside: express |
| 26 | `routes/packRoutes.js` (48) | J1 P | `GET /api/pack/manifest`, `GET /api/pack/files/*` (whitelist). packService does the work. | shallow | T: +log, services/packService, utils/responseBuilder; outside: express |
| 27 | `routes/resourceRoutes.js` (230) | J1 P, J7, J4, J8, J6 | Six unrelated endpoints: tokens (reads disk each call), asset manifest (own mtime cache) and image/audio files for the hardware scanner, `/api/vocabulary`, and the scoreboard page, which it renders with the window marker, pack strings and theme and mints an observe token into (resourceRoutes.js:178-230). | mixed | T: +log, services/tokenService, utils/responseBuilder; L: +cfg, gameRules/cueValidation, middleware/auth, services/packService; outside: express |
| 28 | `routes/scanRoutes.js` (422) | J3 P, J2, J4, J7 | `POST /api/scan`, `POST /api/scan/batch`. Inline it decides token lookup, "any session exists", video eligibility and the `player:scan` broadcast; it reaches into `transactionService.tokens` (scanRoutes.js:29, 61) and keeps a module-level `processedBatches` Map with a `setInterval` started at load (scanRoutes.js:183-196). | shallow adapter holding business logic | T: +log, services/sessionService, services/transactionService, services/videoQueueService, utils/validators; L: websocket/eventWrapper; outside: express |
| 29 | `routes/sessionRoutes.js` (59) | J2 P | `GET /api/session` (read-only). | shallow | T: +log, services/sessionService; outside: express |
| 30 | `routes/stateRoutes.js` (77) | J2 P, J9, J7 | `GET /api/state` returns `buildSyncFullPayload` with an ETag. No auth guard on the route or its mount (app.js:116). | shallow | T: +log, services/audioRoutingService, services/bluetoothService, services/cueEngineService, services/gameClockService, services/lightingService, services/musicService, services/sessionService, services/soundService, services/transactionService, services/videoQueueService, websocket/syncHelpers; outside: express |

#### backend/src/services/

| # | File (lines) | Jobs (P = primary) | Interface: what callers must know | Depth | Depends on (T = at load, L = inside a function) |
|---|---|---|---|---|---|
| 31 | `services/audio/duckingEngine.js` (525) | J4 P | `new DuckingEngine(port)` where the port has `getVolume`, `setVolumeLive`, `getUserVolume`; `loadRules`, `handleEvent(source, lifecycle)`, `refreshPreDuckCapture`. No pactl knowledge. The one engine with a real port. | deep | T: +log |
| 32 | `services/audio/pactlClient.js` (217) | J4 P | Seven functions: `execFile` plus pure parsers for sinks, sink inputs and pactl events. Pure parts are easy to test; callers still choose which parser. | mixed | T: utils/execHelper |
| 33 | `services/audioRoutingService.js` (1163) | J4 P, J2, J9, J5, J10 | ~45 members: sink list, per-stream route and volume, `applyRouting`, `handleDuckingEvent`, `getState`, sink monitor, a WirePlumber rule check, plus test-facing getters and setters (`_activeDuckingSources`, `_preDuckVolumes`; lines 679-708). It is the composition root for the ducking engine. Reports health to the registry; persists routes through persistenceService. | mixed | T: +log, services/audio/duckingEngine, services/audio/pactlClient, services/persistenceService, services/serviceHealthRegistry, utils/processMonitor |
| 34 | `services/bluetoothService.js` (886) | J4 P, J9, J2, J10 | ~20 methods: scan, pair (interactive `bluetoothctl` session), connect, disconnect, `getState`, a D-Bus device monitor. Deep behind scan and pair; the interface is wide because each step is its own method. Reports health. | mixed | T: +cfg, +log, services/serviceHealthRegistry, utils/dbusSignalParser, utils/execHelper, utils/processMonitor; outside: child_process |
| 35 | `services/commandExecutor.js` (1061) | J3 P, J4, J5, J2, J7, J9 | `executeCommand({action, payload, source, trigger, deviceId, deviceType, actor})` returns `{success, message, data?}`; `validateCommand`. Callers must know 64 action names, each action's payload shape and which service must be healthy (`SERVICE_DEPENDENCIES`). Most cases forward to one service method. First check is the cue-source floor (only `CUE_ACTIONS`). Lazy-requires cueEngineService (line 223) to break a cycle. | shallow (a dispatch table) | T: +cfg, +log, gameRules/cueValidation, gameRules/dormancyWording, gameRules/grants, services/audioRoutingService, services/bluetoothService, services/displayControlService, services/lightingService, services/musicService, services/packService, services/profileService, services/scoreboardControlService, services/serviceHealthRegistry, services/sessionService, services/soundService, services/transactionService, services/videoQueueService; L: services/cueEngineService, services/vlcMprisService, utils/displayDriver |
| 36 | `services/cue/standingEvaluator.js` (286) | J4 P, J1 | Pure functions: `normalizeEvent`, `evaluateConditions`, `findMatchingEventCues`, `findMatchingClockCues`, `toPersistence`/`fromPersistence`; the `EVENT_NORMALIZERS` table for engine events. | deep | T: +log, gameRules/cueVocabulary |
| 37 | `services/cue/timelineRuntime.js` (666) | J4 P | `TimelineRuntime` class: `createActiveCue`, `fireEntries`, `tickClock`, `handleVideoProgress`, `handleVideoLifecycle`, `pauseCue`/`resumeCue`/`stopCue`. Callbacks (`onStatus`, `getCueDef`, `onError`) are passed in on each call. | deep | T: +log |
| 38 | `services/cueEngineService.js` (1181) | J4 P, J1, J5, J9, J2 | Facade of ~45 members over standingEvaluator, timelineRuntime and heldItemsStore: `loadCues`, `fireCue`, `handleGameEvent`, `handleClockTick`, `activate`/`suspend`, `applyDormancy`, hold/release, `toPersistence`/`restore`. Imports commandExecutor at load (line 27), requires videoQueueService and gameClockService lazily (lines 390-1043). | mixed | T: +log, gameRules/dormancyWording, services/commandExecutor, services/cue/standingEvaluator, services/cue/timelineRuntime, services/heldItemsStore, services/serviceHealthRegistry; L: services/gameClockService, services/videoQueueService |
| 39 | `services/cueEngineWiring.js` (152) | J4 P, J5 | `setupCueEngineForwarding(bag of 8 services)` registers 15 listener call sites and one pre-play hook. It calls an underscored method, `cueEngineService._tickActiveCompoundCues` (cueEngineWiring.js:51). Called from app.js:252 and again from systemReset.js:169. | shallow | T: +log |
| 40 | `services/discoveryService.js` (145) | J8 P | Class (not a singleton): `start(httpPort)` broadcasts the engine's address over UDP; `stop`. | shallow | T: +cfg; outside: dgram |
| 41 | `services/displayControlService.js` (435) | J4 P, J9, J2 | Mode machine: `init({vlcService, videoQueueService})`, `setIdleLoop`, `setScoreboard`, `returnToVideo`, `playVideo`, `getStatus`. Serializes through an internal lock. Registers a pre-play hook on videoQueueService and reads `videoQueueService.currentItem` directly (displayControlService.js:278). | mixed | T: +cfg, +log, services/serviceHealthRegistry, utils/displayDriver; L: services/packService |
| 42 | `services/dormancyService.js` (209) | J9 P, J4, J8 | `compute`, `apply`, `recompute`, `setOutOfService`, `putInService`, `getOperatorLatches`. Holds the operator latches in a module-level Map; pushes one decision into the registry and into cueEngineService (line 171). Must be recomputed at boot, session create and reset by callers. | mixed | T: +log, gameRules/dormancyWording, gameRules/endpointServices, services/serviceHealthRegistry; L: services/cueEngineService, services/packService, services/profileService |
| 43 | `services/gameClockService.js` (316) | J4 P, J2, J5, J1 | `start`/`pause`/`resume`/`stop`, `getElapsed`, `getState`, `setPhases`, `handlePhaseTrigger`, `restore`/`toPersistence`, overtime threshold. Phase rules and overtime are set by the caller from the pack. | deep | T: +log, services/serviceHealthRegistry; L: services/packService |
| 44 | `services/heartbeatMonitorService.js` (136) | J2 P, J9 | `init(io)`, `start`, `stop`: polls the session's device list for timed-out HTTP devices and calls `disconnectDevice`. Holds the socket.io server. | shallow | T: +log, models/deviceConnection, services/sessionService, websocket/deviceHelpers |
| 45 | `services/heldItemsStore.js` (264) | J4 P, J9 | `HeldItemsStore`: `getAll`, `find`, `release`, `discard`, `releaseAll(fn)`, `setAutoDiscard`. Used by cueEngineService only; videoQueueService keeps its own held list (videoQueueService.js:915). | deep (small) | T: +log |
| 46 | `services/lightingService.js` (522) | J4 P, J9, J2 | Home Assistant adapter: `activateScene`, `getScenes`, `refreshScenes`, `getState`, `checkConnection`, a WebSocket client for scene changes, Docker start/stop of the HA container. | mixed | T: +cfg, +log, services/serviceHealthRegistry, utils/dockerHelper; outside: axios, ws |
| 47 | `services/mpdConfigBuilder.js` (57) | J4 P, J8, J10 | `buildMpdConfig(opts)` returns MPD config text. Defaults are fixed `/tmp/aln-mpd.*` paths (lines 20-25). | shallow | none |
| 48 | `services/mprisPlayerBase.js` (401) | J4 P, J9, J10 | Base class for a D-Bus MPRIS player: `_dbusCall`, `_transport`, `startPlaybackMonitor`, `checkConnection`, `getState`; subclasses override `_processStateChange`, `_parseMetadata`. One subclass (vlcMprisService). | mixed | T: +log, services/serviceHealthRegistry, utils/dbusSignalParser, utils/execHelper, utils/processMonitor |
| 49 | `services/musicService.js` (636) | J4 P, J9, J2, J5, J10 | MPD adapter: transport (`play`..`seek`), `setVolume`, `loadPlaylist`, playlist file read/write, `pauseForGameClock`/`resumeFromGameClock`, `spawnMpd`/`stopMpd`, `getState`. Every mpd2 call is bounded by `withTimeout`. Keeps its own `this.connected` beside the registry (musicService.js:73, 231). | mixed | T: utils/withTimeout; L: +cfg, +log, services/mpdConfigBuilder, services/serviceHealthRegistry, utils/processMonitor; outside: mpd2 |
| 50 | `services/offlineQueueService.js` (294) | J3 P, J5 | `enqueueGmTransaction`, `processQueue`, `setOfflineStatus`, `getStatus`. `isOffline` is set only by tests (header, offlineQueueService.js:15; no other caller under backend/src). | shallow | T: +log, services/persistenceService, services/sessionService, services/transactionService; outside: uuid |
| 51 | `services/packService.js` (1484) | J1 P, J6, J9, J8 | `activatePack()` once at boot; then 12 getters over the frozen snapshot (`getGameConfig`, `getScoringRules`, `getClockRules`, `getCues`, `getStrings`, `getTheme`, `getSurfaces`, `getManifest`, `getActivePackInfo`, `resolvePackFile`, ...). Hides the whole activation gate (~400 lines), normalisation and shims. Has a live-disk fallback path when not yet activated. | deep | T: +log, gameRules/cueValidation, gameRules/formatting, gameRules/modeSemantics; L: +cfg, services/cue/standingEvaluator |
| 52 | `services/persistenceService.js` (368) | J5 P, J3 | ~22 methods: generic `save/load/delete/keys` over the storage, plus `saveSession`, `archiveSession`, `saveTokens`, `backupSession`. Most bodies forward one call to the storage; the keys (`session:current`, `offlineQueue`, ...) are conventions each caller must know. | shallow (mostly pass-through) | T: +cfg, +log, storage/index |
| 53 | `services/preflightService.js` (158) | J9 P, J5, J8 | `evaluate({live})` returns rows, a roll-up and the blocking list; `getLast`; `PreflightNoGoError`. Reads pack, profile and (when live) the registry snapshot. | deep | T: gameRules/packNeeds, gameRules/resolution, services/serviceHealthRegistry; L: services/packService, services/profileService |
| 54 | `services/profileService.js` (221) | J8 P, J4, J9, J1 | `activateProfile()` once; `getProfile`, `getLightingBinding(role)`, `getSurfaceChannelFile(channel)`, `getProfileInfo`. A broken profile degrades with a warning and never stops boot. Path from `PROFILE_PATH` (profileService.js:48). | mixed | T: +log |
| 55 | `services/scoreboardControlService.js` (58) | J2 P, J4 | `next`, `prev`, `jumpToOwner(owner)` each emit `scoreboard:page:requested`. Holds no page state: each scoreboard keeps its own. | shallow (pass-through) | T: +log |
| 56 | `services/serviceHealthRegistry.js` (300) | J9 P, J4, J2, J5 | `report(id, healthy/down, message)`, `markDormant`/`clearDormant`, `isHealthy`, `getSnapshot`, `startRevalidation(services, ms)`, `reset`; emits `health:changed`. 20 importers. The nine service ids are a fixed list in the file (serviceHealthRegistry.js:28). | deep | T: +log |
| 57 | `services/session/persistenceListeners.js` (198) | J2 P, J3, J5 | `setupScoreListeners(service)`, `setupPersistenceListeners(service)`: take sessionService as a parameter and reach into its fields. Lazy-requires transactionService (lines 26, 72); requires `websocket/listenerRegistry` at load. | shallow | T: +log, websocket/listenerRegistry; L: services/transactionService |
| 58 | `services/session/sessionRegistry.js` (135) | J2 P | `addTeamToSession`, `addTransaction`, `addPlayerScan`, `updateDevice`, `removeDevice`, each taking sessionService as the first argument. | shallow | T: +log; L: models/teamScore |
| 59 | `services/sessionService.js` (857) | J5 P, J2, J3, J1, J9 | The current session and its life: `init` (restore), `createSession`, `startGame`, `updateSessionStatus`, `endSession`, `reset`, `restampAfterRestore`, `saveCurrentSession`, device and team helpers. Each lifecycle move cascades into game clock, cue engine, music, preflight, dormancy and persistence by in-function requires (17 sites). Imports `websocket/listenerRegistry`. | mixed | T: +cfg, +log, models/session, services/gameClockService, services/persistenceService, services/session/persistenceListeners, services/session/sessionRegistry, websocket/listenerRegistry; L: models/teamScore, services/cueEngineService, services/dormancyService, services/musicService, services/packService, services/preflightService |
| 60 | `services/soundService.js` (163) | J4 P, J9, J2 | `play({file, target?, volume?})`, `stop({file?})`, `getState`, `fileExists`, `checkHealth`. Spawns `pw-play` directly with its own `child_process` handling; audio dir fixed to `public/audio` (soundService.js:21). | mixed | T: +cfg, +log, services/serviceHealthRegistry, utils/execHelper; outside: child_process |
| 61 | `services/systemReset.js` (305) | J5 P, J2, J4, J7 | `performSystemReset(io, bag of services)`: archive, end, tear down broadcast listeners, reset ~13 services, rotate observe tokens, re-register broadcast and cross-service listeners, re-wire cue forwarding, reload ducking rules, re-probe health, re-assert dormancy. The caller must pass every service; a missing one is silently skipped. | mixed | T: +log, middleware/auth, services/persistenceService, services/serviceHealthRegistry, websocket/broadcasts, websocket/listenerRegistry; L: services/audioRoutingService, services/bluetoothService, services/cueEngineWiring, services/dormancyService, services/lightingService, services/musicService, services/packService, services/soundService, services/vlcMprisService |
| 62 | `services/tokenService.js` (203) | J1 P | `loadTokens()`, `loadRawTokens()` (re-reads the file each call), `calculateTokenValue`, `extractGroupName`. Reads `PACK_PATH` itself (tokenService.js:84); falls back to the old scanner repo path. | shallow | T: +cfg, +log; L: services/packService |
| 63 | `services/transactionService.js` (897) | J3 P, J2, J1, J5, J4 | `processScan`, `createManualTransaction`, `deleteTransaction`, `adjustTeamScore`, `resetScores`, `rebuildScoresFromTransactions`, token Map access (`getToken`, `tokens`), `reset`. Decisions come from gameRules; this module mutates scores in place and emits `transaction:accepted`. Asks videoQueueService whether a video is playing (line 517) and builds scan replies via `websocket/scanResponse`. | mixed | T: +cfg, +log, gameRules/duplicatePolicy, gameRules/modeSemantics, gameRules/scoring, models/teamScore, models/token, models/transaction, services/packService, services/sessionService, services/videoQueueService, websocket/listenerRegistry, websocket/scanResponse |
| 64 | `services/videoQueueService.js` (1074) | J4 P, J3, J2, J9, J5 | Queue and playback: `addToQueue`, `addVideoByFilename`, `processQueue`, `skipCurrent`/`pauseCurrent`/`resumeCurrent`/`seekCurrent`, `clearQueue`, `canAcceptVideo`, `isPlaying`, held-video list, `registerPrePlayHook`, `getState`. Reads `vlcService.state` and `.track` fields directly (lines 302-312); media path built as `public/videos` in two places (lines 184, 908). | mixed | T: +cfg, +log, gameRules/dormancyWording, models/videoQueueItem, services/serviceHealthRegistry, services/vlcMprisService; L: services/transactionService |
| 65 | `services/vlcMprisService.js` (532) | J4 P, J9, J8, J1, J10 | The VLC adapter: `playVideo`, `pause`/`resume`/`stop`/`seek`, `setVolume`, idle loop (`initializeIdleLoop`, `returnToIdleLoop`), `getStatus`, state fields. Starts VLC itself unless `VLC_SELF_SPAWN=false`; reads `VLC_HW_ACCEL`, `FEATURE_IDLE_LOOP`, `DISPLAY` from the environment (lines 71, 119, 317); PID file `/tmp/aln-pm-vlc.pid`. | mixed | T: +cfg, +log, services/mprisPlayerBase, services/serviceHealthRegistry, utils/processMonitor; L: services/packService, services/profileService; outside: child_process |

#### backend/src/storage/

| # | File (lines) | Jobs (P = primary) | Interface: what callers must know | Depth | Depends on (T = at load, L = inside a function) |
|---|---|---|---|---|---|
| 66 | `storage/FileStorage.js` (222) | J5 P | `StorageInterface` implementation over node-persist: `init`, `save`, `load`, `delete`, `keys`, `values`, `clear`, `cleanup`, `reset`. | deep (small) | T: +log, storage/StorageInterface; outside: node-persist |
| 67 | `storage/MemoryStorage.js` (143) | J10 P, J5 | The same eleven methods over a Map. Chosen whenever `NODE_ENV=test`. | deep (small) | T: storage/StorageInterface |
| 68 | `storage/StorageInterface.js` (104) | J5 P, J10 | Eleven abstract async methods. The only declared adapter seam in the tree with two adapters. | shallow (abstract base) | none |
| 69 | `storage/index.js` (43) | J5 P, J10 | `createStorage({type, dataDir})`. Under `NODE_ENV=test` it returns memory storage unless told otherwise (storage/index.js:28), and persistenceService makes the same test check again for its log line (persistenceService.js:40). | shallow | T: storage/FileStorage, storage/MemoryStorage, storage/StorageInterface |

#### backend/src/utils/

| # | File (lines) | Jobs (P = primary) | Interface: what callers must know | Depth | Depends on (T = at load, L = inside a function) |
|---|---|---|---|---|---|
| 70 | `utils/dbusSignalParser.js` (170) | J4 P | `feedLine(line)`, `flush`; emits parsed D-Bus signals. Composed with ProcessMonitor by vlc, bluetooth and the MPRIS base. | deep | T: +log |
| 71 | `utils/displayDriver.js` (447) | J4 P, J9, J8, J10 | Module-level functions over one Chromium process: `ensureBrowserRunning`, `showScoreboard`, `hideScoreboard`, `isScoreboardVisible`, `probe`, `getStatus`, `cleanup`. Reports the `display` health itself (reaches up to the registry). Own spawn and PID file (displayDriver.js:53), `pkill -9 -f chromium.*--kiosk` fallback (line 147), `CHROMIUM_BIN` default `chromium-browser` (line 165), URL with `deviceId=SCOREBOARD_HDMI` (line 77); X11 tools only. | mixed | T: +cfg, +log, services/serviceHealthRegistry; outside: child_process |
| 72 | `utils/dockerHelper.js` (95) | J4 P, J8 | `containerExists`, `isContainerRunning`, `startContainer`, `stopContainer` over the Docker CLI. Used only by lightingService. | shallow | T: utils/execHelper |
| 73 | `utils/execHelper.js` (48) | J4 P | `execFileAsync(cmd, args, timeout)`, `execFileWithStderr`. One promise wrapper over `execFile`. | shallow (by design) | outside: child_process |
| 74 | `utils/logger.js` (275) | J10 | Winston logger singleton with Error-aware formatting and a closed-pipe guard. Imported by 56 files. The post-game validator parses its log file. | deep (infrastructure) | T: +cfg; outside: winston |
| 75 | `utils/processMonitor.js` (220) | J4 P, J10 | `ProcessMonitor({command, args, label, pidFile, ...})`: `start`, `stop` (sync), `isRunning`; emits `line`. Restarts with backoff, kills orphans by PID file after verifying `/proc/<pid>/cmdline`. Five consumers (vlc, mpd, pactl subscribe, BlueZ monitor, MPRIS monitor). | deep | T: +log; outside: child_process |
| 76 | `utils/responseBuilder.js` (118) | J3 P | `success(res, data)`, `error(res, code, msg, status)`, `errors.*`. Used by packRoutes and resourceRoutes only; other routes build replies inline. | shallow | none |
| 77 | `utils/timezone.js` (98) | J8 P | `getPosixTimezone()`: derives the machine's POSIX TZ string from zoneinfo, falls back to `UTC0`. Served in `/health` for the hardware scanner. | deep (small) | T: +log |
| 78 | `utils/validators.js` (294) | J3 P, J1, J7 | Joi schemas for entities, HTTP bodies and socket messages, `validate(value, schema)`, `ValidationError`. Mode ids are validated against the active pack at call time through in-function requires of modeSemantics and packService (validators.js:22-23), so utils reaches up into services. | shallow (a bag of schemas) | L: gameRules/modeSemantics, services/packService; outside: joi |
| 79 | `utils/withTimeout.js` (35) | J4 P, J9 | `withTimeout(promise, ms, label)`, `TimeoutError`. One user today (musicService). | deep (small) | none |

#### backend/src/websocket/

| # | File (lines) | Jobs (P = primary) | Interface: what callers must know | Depth | Depends on (T = at load, L = inside a function) |
|---|---|---|---|---|---|
| 80 | `websocket/adminEvents.js` (322) | J3 P, J7, J5, J2 | `handleGmCommand(socket, data, io)`, `handleTransactionSubmit`. Checks the socket is a GM, handles `system:reset` itself (floor check, mutex, builds the service bag; adminEvents.js:53-110) and forwards everything else to commandExecutor. The service bag it passes to the reset omits musicService (adminEvents.js:81-92). | mixed | T: +cfg, +log, gameRules/grants, services/audioRoutingService, services/bluetoothService, services/commandExecutor, services/displayControlService, services/lightingService, services/offlineQueueService, services/sessionService, services/transactionService, services/videoQueueService, services/vlcMprisService, websocket/eventWrapper; L: services/cueEngineService, services/gameClockService, services/soundService, services/systemReset, utils/validators |
| 81 | `websocket/broadcasts.js` (747) | J2 P, J4, J9, J7, J5 | `setupBroadcastListeners(io, bag of 13 services)`, `cleanupBroadcastListeners`. Maps service events to socket rooms and `service:state` pushes (41 listener call sites, several inside loops over event lists) (50 ms debounce per domain); also builds the transaction row for `transaction:new` (lines 183-230), initialises session devices (line 633), and wires video/sound events to audio ducking and routing (lines 386-430), which is service-to-service coordination, not delivery. | mixed | T: +log, services/scoreboardControlService, services/serviceHealthRegistry, websocket/eventWrapper, websocket/listenerRegistry, websocket/syncHelpers; L: services/sessionService |
| 82 | `websocket/deviceHelpers.js` (55) | J2 P, J9 | `disconnectDevice(io, device, reason)`: marks the device in the session and emits `device:disconnected`. Imported by a service (heartbeatMonitorService). | shallow | T: +log, services/sessionService, websocket/eventWrapper |
| 83 | `websocket/deviceTracking.js` (47) | J2 P | `handleDisconnect(socket, io)` for a socket drop. | shallow | T: +log, services/sessionService, websocket/deviceHelpers |
| 84 | `websocket/environmentHelpers.js` (75) | J2 P, J9 | `buildEnvironmentState({bluetoothService, audioRoutingService, lightingService})`: calls each `getState()` with fallback defaults. | shallow | T: +log |
| 85 | `websocket/eventWrapper.js` (48) | J3 P, J2 | `wrapEvent`, `emitWrapped`, `emitToRoom`: the `{event, data, timestamp}` envelope. Six importers, including a route. | shallow | T: +log |
| 86 | `websocket/gmAuth.js` (219) | J7 P, J2, J8 | `handleGmIdentify(socket, data, io)`: after the handshake it registers the device, joins rooms (`gm`, `session:<id>`, `team:<id>`, `device:<id>`), enforces the GM-station limit and sends `sync:full`. Same payload for operators and displays; displays differ only in not being registered as devices. | mixed | T: +log, models/deviceConnection, services/audioRoutingService, services/bluetoothService, services/cueEngineService, services/gameClockService, services/lightingService, services/musicService, services/sessionService, services/soundService, services/transactionService, services/videoQueueService, websocket/eventWrapper, websocket/syncHelpers |
| 87 | `websocket/listenerRegistry.js` (125) | J5 P, J10 | `addTrackedListener(emitter, event, handler, context)`, `cleanup()`. It registers always but tracks and removes only when `NODE_ENV=test` (listenerRegistry.js:13, 44-48). Imported by sessionService, persistenceListeners, transactionService, cueEngineWiring, systemReset and broadcasts. | shallow | T: +log |
| 88 | `websocket/scanResponse.js` (108) | J3 P, J1 | `buildScanResponse({transaction, token, ...})`, `responseMessage`: the wire reply for a GM scan, with pack-formatted money. Lives under websocket/ but is called by transactionService. | deep | T: gameRules/formatting, services/packService |
| 89 | `websocket/socketServer.js` (163) | J7 P, J8, J1 | `createSocketServer(httpServer)`: CORS (a LAN regex), ping settings and the handshake middleware (`io.use`, socketServer.js:49-152). Only `deviceType === "gm"` sockets are authenticated (line 53); every other socket passes through `next()` (line 152). A station named `SCOREBOARD_*` skips the duplicate-id check (line 85). Logs a pack-hash mismatch and does nothing else. | mixed | T: +cfg, +log, middleware/auth; L: services/packService, services/sessionService; outside: socket.io |
| 90 | `websocket/syncHelpers.js` (276) | J2 P, J9, J1 | `buildSyncFullPayload({10 services, deviceFilter})` plus per-domain builders. The caller must pass every service or its part of the snapshot is silently empty. Imports displayControlService directly while the other services are injected. Includes pack and profile identity. | mixed | T: +log, services/displayControlService, services/serviceHealthRegistry, websocket/environmentHelpers; L: services/packService, services/profileService |

## 3. Job by job: every module that holds part of it

Each entry starts with the people, then lists the modules (generated from the sheet in section 2, so the lists and the table cannot disagree), then says where the decisions sit today and whether the job has locality.

### J1. Run any game from its pack

The designer publishes a pack and expects the engine to play it, the TV to show it and every tablet to load the same one.

Main job of 9 modules: `gameRules/cueValidation`, `gameRules/cueVocabulary`, `gameRules/formatting`, `gameRules/modeSemantics`, `models/token`, `routes/packRoutes`, `routes/resourceRoutes`, `services/packService`, `services/tokenService`.

Holds part of it, 17 modules: `app`, `gameRules/duplicatePolicy`, `gameRules/packNeeds`, `gameRules/scoring`, `middleware/auth`, `routes/healthRoutes`, `services/cue/standingEvaluator`, `services/cueEngineService`, `services/gameClockService`, `services/profileService`, `services/sessionService`, `services/transactionService`, `services/vlcMprisService`, `utils/validators`, `websocket/scanResponse`, `websocket/socketServer`, `websocket/syncHelpers`.

Total 26 of 90.

Where the decisions sit. The rules are in good shape: `gameRules/modeSemantics`, `scoring`, `duplicatePolicy`, `formatting` and `packService` are all deep, and the engine asks them what a mode does rather than naming ALN's modes. The weak part is how the pack reaches the running engine. `packService.activatePack()` is one call at boot (app.js:192), and tokens reach the engine by five routes:

- the activation gate reads tokens itself (`packService.js:295-337`);
- `tokenService.loadTokens()` reads them again at boot (app.js:201) and `transactionService.tokens` holds the copy;
- `GET /api/tokens` re-reads the file on every call (`resourceRoutes.js:53-57`, `tokenService.loadRawTokens`);
- app.js:131-139 serves the injected pack's token file by path;
- app.js:202 saves a token copy through `persistenceService.saveTokens`, and nothing under `backend/src` reads it back (`grep "\.loadTokens("` finds only `tokenService.loadTokens` at app.js:201).

Scoring values are baked into each token at load (`tokenService.calculateTokenValue`, tokenService.js:50-68), so a later pack change cannot reach them. The clock rules are fetched at five call sites (`sessionService.js:65, 153, 327`, `gameClockService.js:108`, `syncHelpers.js:171`). `grep "pack:changed"` finds no event, so no module can tell a consumer the pack changed. The one alternate-pack seam is the `PACK_PATH` variable, read in three files (`packService.js:167`, `tokenService.js:84`, app.js:131).

Locality. Rules: good, in 9 main-job modules. Delivery of a pack change to running parts: none exists, which is EJ's C12 seen from the module side.

### J2. Keep one true record of the game, and show it truly everywhere

The GM presses a button on one tablet and expects every tablet and the TV to show the same game.

Main job of 15 modules: `gameRules/scoring`, `models/deviceConnection`, `models/session`, `models/teamScore`, `routes/sessionRoutes`, `routes/stateRoutes`, `services/heartbeatMonitorService`, `services/scoreboardControlService`, `services/session/persistenceListeners`, `services/session/sessionRegistry`, `websocket/broadcasts`, `websocket/deviceHelpers`, `websocket/deviceTracking`, `websocket/environmentHelpers`, `websocket/syncHelpers`.

Holds part of it, 23 modules: `gameRules/duplicatePolicy`, `gameRules/modeSemantics`, `models/transaction`, `routes/healthRoutes`, `routes/scanRoutes`, `server`, `services/audioRoutingService`, `services/bluetoothService`, `services/commandExecutor`, `services/cueEngineService`, `services/displayControlService`, `services/gameClockService`, `services/lightingService`, `services/musicService`, `services/serviceHealthRegistry`, `services/sessionService`, `services/soundService`, `services/systemReset`, `services/transactionService`, `services/videoQueueService`, `websocket/adminEvents`, `websocket/eventWrapper`, `websocket/gmAuth`.

Total 38 of 90.

Where the decisions sit. For the networked game the record is `sessionService` holding a `Session`; scores live in `session.scores` and `transactionService` mutates them in place; claims are `session.metadata.scannedTokensByDevice` plus the transaction list, read by `duplicatePolicy`. The device list in the session is written by three modules through `sessionService.updateDevice`: `healthRoutes` (HTTP devices, healthRoutes.js:88), `gmAuth` (GM stations, gmAuth.js:120) and `deviceHelpers` (disconnects, deviceHelpers.js:29, which `heartbeatMonitorService` and `deviceTracking` both call). Equipment facts are decided by each service (`getState()`), and health by `serviceHealthRegistry`.

The delivery path is the spread part. Live changes go through `websocket/broadcasts.js` (41 listener call sites). A reconnecting tablet gets `syncHelpers.buildSyncFullPayload`, called from `gmAuth`, `server.js` (`sync:request`), `stateRoutes` and three places in `broadcasts` (`backend/CLAUDE.md` lists seven callers including the integration test server). The row for one transaction is built twice, in `broadcasts.js:183-230` and in `syncHelpers.js:63-79`. The scoreboard's evidence page position is held nowhere on the engine: `scoreboardControlService` only forwards the request (scoreboardControlService.js:30-58). `transactionService` keeps a second "recent transactions" list (`transactionService.js:29, 496-505`) that no other file under `backend/src` reads.

Locality. Few modules decide (sessionService, transactionService, the registry, each service's `getState`). Copies are built in two code paths for the same fact, one for live and one for catch-up. That is the structure behind EJ's C6.

### J3. Answer every action, and remember what happened

The GM taps a token or a command and needs a plain answer. A player scans and the phone needs to know if the scan was kept.

Main job of 11 modules: `gameRules/duplicatePolicy`, `models/transaction`, `routes/scanRoutes`, `services/commandExecutor`, `services/offlineQueueService`, `services/transactionService`, `utils/responseBuilder`, `utils/validators`, `websocket/adminEvents`, `websocket/eventWrapper`, `websocket/scanResponse`.

Holds part of it, 7 modules: `gameRules/formatting`, `gameRules/modeSemantics`, `models/session`, `services/persistenceService`, `services/session/persistenceListeners`, `services/sessionService`, `services/videoQueueService`.

Total 18 of 90.

Where the decisions sit. The answer side has three entrances with three reply shapes. Player scans: `routes/scanRoutes.js` replies with inline JSON (`accepted`, `rejected`, error codes). GM scans: `adminEvents.handleTransactionSubmit` replies with `transaction:result` or an `error` event with codes (adminEvents.js:150-250), after `transactionService.processScan` and `websocket/scanResponse`. GM commands: `commandExecutor` returns `{success, message}` and `adminEvents` wraps it as `gm:command:ack`. Only `packRoutes` and `resourceRoutes` use `utils/responseBuilder`; the other routes write replies by hand.

The remembering side sits mostly in one place: `sessionService` plus `session/persistenceListeners` persist what `transaction:accepted` carries. Two things are not in that place. Batch idempotency for player scans is a `Map` inside `scanRoutes.js` (line 183), lost at restart. The GM offline queue is `offlineQueueService`, whose `isOffline` flag is set only by tests (header at offlineQueueService.js:15, and `setOfflineStatus` has no other caller under `backend/src`). `grep` finds no module that writes a structured record of the night at game end.

Locality. Remembering is concentrated. Answering is spread over three entrances that each do their own validation and wording.

### J4. Run the show's equipment, and know its true state

The GM taps a video or a lighting scene and expects it to happen. The audience sees the TV and hears the speakers.

Main job of 26 modules: `models/videoQueueItem`, `routes/musicRoutes`, `services/audio/duckingEngine`, `services/audio/pactlClient`, `services/audioRoutingService`, `services/bluetoothService`, `services/cue/standingEvaluator`, `services/cue/timelineRuntime`, `services/cueEngineService`, `services/cueEngineWiring`, `services/displayControlService`, `services/gameClockService`, `services/heldItemsStore`, `services/lightingService`, `services/mpdConfigBuilder`, `services/mprisPlayerBase`, `services/musicService`, `services/soundService`, `services/videoQueueService`, `services/vlcMprisService`, `utils/dbusSignalParser`, `utils/displayDriver`, `utils/dockerHelper`, `utils/execHelper`, `utils/processMonitor`, `utils/withTimeout`.

Holds part of it, 14 modules: `gameRules/cueVocabulary`, `gameRules/dormancyWording`, `gameRules/endpointServices`, `gameRules/resolution`, `routes/resourceRoutes`, `routes/scanRoutes`, `services/commandExecutor`, `services/dormancyService`, `services/profileService`, `services/scoreboardControlService`, `services/serviceHealthRegistry`, `services/systemReset`, `services/transactionService`, `websocket/broadcasts`.

Total 40 of 90.

Where the decisions sit. Each outside program has one adapter class: VLC (`vlcMprisService`), MPD (`musicService`), PipeWire (`audioRoutingService` with `pactlClient`, and `soundService` for `pw-play`), Bluetooth (`bluetoothService`), Home Assistant (`lightingService`) and the TV's browser (`utils/displayDriver`). Above them sit the orchestrators: `videoQueueService`, `displayControlService`, `cueEngineService` with its three parts, `commandExecutor`, `gameClockService`, and `broadcasts.js` for ducking and routing (5.5). The supervision of outside programs has two shapes. `utils/processMonitor` supervises five processes (vlc, mpd, `pactl subscribe`, the BlueZ monitor, the MPRIS monitor: constructed at vlcMprisService.js:113, musicService.js:603, audioRoutingService.js:794, bluetoothService.js:497, mprisPlayerBase.js:205). `displayDriver`, `soundService` and the `bluetoothctl` scan spawn their processes themselves (displayDriver.js:165, soundService.js:75, bluetoothService.js:165, 699), and Home Assistant is started and stopped through Docker (`lightingService` and `dockerHelper`).

"Is a video playing" has several answerers: `videoQueueService.isPlaying` (line 969), `videoQueueService` reading `vlcService.state` (line 302), `displayControlService` reading `videoQueueService.currentItem` (line 278), `cueEngineService` (line 844), `transactionService` for the scan reply (line 517) and `scanRoutes` through `canAcceptVideo` (line 97). Held items have two stores: `heldItemsStore` for cues and a separate list in `videoQueueService` (line 915). Connection state has two homes: the registry and `musicService.connected` (musicService.js:73).

Locality. Each program's mechanics are local to its adapter, which is good. The questions the show asks across programs (is video playing, what is held, what is down) are spread.

### J5. Move each game through its life cleanly

The GM creates, starts, pauses, ends and resets games, and the engine restarts at least once a season.

Main job of 7 modules: `services/persistenceService`, `services/sessionService`, `services/systemReset`, `storage/FileStorage`, `storage/StorageInterface`, `storage/index`, `websocket/listenerRegistry`.

Holds part of it, 19 modules: `app`, `middleware/auth`, `models/session`, `server`, `services/audioRoutingService`, `services/commandExecutor`, `services/cueEngineService`, `services/cueEngineWiring`, `services/gameClockService`, `services/musicService`, `services/offlineQueueService`, `services/preflightService`, `services/serviceHealthRegistry`, `services/session/persistenceListeners`, `services/transactionService`, `services/videoQueueService`, `storage/MemoryStorage`, `websocket/adminEvents`, `websocket/broadcasts`.

Total 26 of 90.

Where the decisions sit. One moment, one code path, is the intent. Today each moment has its own location:

- boot: `app.initializeServices` (app.js:178-340, about 25 ordered steps) and `server.startServer`;
- create: `sessionService.createSession` (195-284), which also recomputes dormancy and stamps preflight;
- start: `sessionService.startGame` (284-368), which runs preflight, sets clock rules, starts the clock, activates the cue engine;
- pause and resume: `sessionService.updateSessionStatus` (444-500), which cascades into clock, cue engine and music;
- end: `sessionService.endSession` (503-560);
- Reset All Scores: `transactionService.resetScores` (571) plus the `scores:reset` listener in `session/persistenceListeners.js` (line 28);
- Reset System: `systemReset.performSystemReset` (38-300), started from `adminEvents.js:53-110`, and it re-wires listeners that `broadcasts`, `cueEngineWiring` and `sessionService` registered at boot;
- restart: `sessionService.init` (104-190), `offlineQueueService.init`, and `auth.js`, whose tokens are lost because they live in memory (auth.js:92-96);
- shutdown: `server.shutdown` (163-217), which saves the session as it stands.

Thirteen services each have their own `reset()`; `systemReset` calls them in a fixed order (systemReset.js:85-132). `listenerRegistry` removes the cross-service listeners only when `NODE_ENV=test` (listenerRegistry.js:13, 44-48).

Locality. Weak. The lifecycle moves are in `sessionService` (which calls into five other modules from inside functions), `systemReset`, `app.js` and `server.js`. Four lists of wiring steps exist: `app.js:252-261`, `systemReset.js:138-200`, `server.js:138-160` and the integration test server (outside `src`).

### J6. Let designers build, change and try games safely

The designer edits a draft, publishes it through the engine's own check, applies it between games and rehearses on a second engine.

Main job of 0 modules: none.

Holds part of it, 4 modules: `gameRules/cueValidation`, `routes/musicRoutes`, `routes/resourceRoutes`, `services/packService`.

Total 4 of 90.

Where the decisions sit. Nothing in `backend/src` has J6 as its main job, because hot-apply, the preview engine and the draft store are planned, not built (EJ J6). The four modules that touch it: `packService` (the activation gate is the engine's publish check), `gameRules/cueValidation` (the config tool imports it, per its header), `routes/resourceRoutes` (`/api/vocabulary` feeds the tool's editors, resourceRoutes.js:168) and `routes/musicRoutes` (the playlist file can be written live, `PUT /api/music/playlists`). There is no path to apply a pack to a running engine (J1 above), and a second engine on the same machine collides with the first on fixed names (5.9).

Locality. Not applicable yet. The ground it will stand on is the pack module (deep) and the naming problem (not deep).

### J7. Give each person what their role needs, and let each do only what the role allows

The GM may start, pause, end and change scores. The audience sees the scoreboard and nothing else. A player sees what they scan.

Main job of 5 modules: `gameRules/grants`, `middleware/auth`, `routes/adminRoutes`, `websocket/gmAuth`, `websocket/socketServer`.

Holds part of it, 13 modules: `config/index`, `gameRules/cueValidation`, `models/deviceConnection`, `routes/healthRoutes`, `routes/resourceRoutes`, `routes/scanRoutes`, `routes/stateRoutes`, `server`, `services/commandExecutor`, `services/systemReset`, `utils/validators`, `websocket/adminEvents`, `websocket/broadcasts`.

Total 18 of 90.

Where the decisions sit. The identity rules are in good modules: `gameRules/grants` (pure), `middleware/auth` (mint and verify), `websocket/socketServer` (handshake). The decisions about who may read are not in one place. The handshake authenticates only sockets that claim `deviceType: "gm"` (socketServer.js:53), and every other socket passes through `next()` (line 152). A station whose id starts with `SCOREBOARD_` skips the duplicate-id check (line 85). The `sync:full` payload is the same for operators and displays (`gmAuth.js` builds the same payload for every connecting socket; displays differ only in not being registered as devices). `GET /api/state` has no guard on the route or its mount (app.js:116) and returns the same payload. `GET /health` takes `deviceId` and `type` from the query string and registers the caller (healthRoutes.js:54-80). `routes/scanRoutes` and `routes/healthRoutes` accept players with no credential by design. The operator floor is checked in three places: `commandExecutor` (the cue-source check and the floor-function check, commandExecutor.js:153), `adminEvents` inline for `system:reset` (adminEvents.js:54), and `requireFunction` on routes. Tokens live in two in-memory stores, and `verifyToken` needs the token to be in the store (auth.js:92-96), so an engine restart invalidates every token.

Locality. Mint and grants are local. Who may read what has no home: it is a line in each entrance.

### J8. Run wherever the venue and the game need

The installer fits the engine to a room with a profile. A future operator starts a second kit.

Main job of 7 modules: `app`, `config/index`, `index`, `server`, `services/discoveryService`, `services/profileService`, `utils/timezone`.

Holds part of it, 14 modules: `gameRules/endpointServices`, `gameRules/packNeeds`, `gameRules/resolution`, `routes/healthRoutes`, `routes/resourceRoutes`, `services/dormancyService`, `services/mpdConfigBuilder`, `services/packService`, `services/preflightService`, `services/vlcMprisService`, `utils/displayDriver`, `utils/dockerHelper`, `websocket/gmAuth`, `websocket/socketServer`.

Total 21 of 90.

Where the decisions sit. The profile is read once by `profileService.activateProfile` (app.js:197) and compared with the pack's needs by `gameRules/resolution` and `preflightService`. Kit-specific things live in many files: the nine service ids in `serviceHealthRegistry.js:28`, the five equipment families in `gameRules/endpointServices`, the `deviceId=SCOREBOARD_HDMI` in the kiosk URL (displayDriver.js:77), `chromium-browser` as the default browser name (displayDriver.js:165), 16 fixed `/tmp` path literals (5.9), media folders under `public/` (5.9) and X11-only window tools. The environment is read in 16 files besides `config` (5.9).

Locality. The profile and resolution are local and deep. Kit names are spread over at least 12 files with no list.

### J9. Tell the truth about what it knows

The GM must be able to trust red to mean act now, and the installer reads the preflight as go or no-go.

Main job of 8 modules: `gameRules/dormancyWording`, `gameRules/endpointServices`, `gameRules/packNeeds`, `gameRules/resolution`, `routes/healthRoutes`, `services/dormancyService`, `services/preflightService`, `services/serviceHealthRegistry`.

Holds part of it, 23 modules: `routes/stateRoutes`, `services/audioRoutingService`, `services/bluetoothService`, `services/commandExecutor`, `services/cueEngineService`, `services/displayControlService`, `services/heartbeatMonitorService`, `services/heldItemsStore`, `services/lightingService`, `services/mprisPlayerBase`, `services/musicService`, `services/packService`, `services/profileService`, `services/sessionService`, `services/soundService`, `services/videoQueueService`, `services/vlcMprisService`, `utils/displayDriver`, `utils/withTimeout`, `websocket/broadcasts`, `websocket/deviceHelpers`, `websocket/environmentHelpers`, `websocket/syncHelpers`.

Total 31 of 90.

Where the decisions sit. `serviceHealthRegistry` is the model module here: 20 importers, three health words, a sticky dormant state with a door, and a revalidation timer (`startRevalidation`, app.js:333). `gameRules/resolution` and `packNeeds` do the same job for the needs side, and `preflightService.evaluate` joins them. Every adapter reports through `registry.report`. Two things sit outside it: `musicService.connected` (line 73) and `videoQueueService` listening to `health:changed` to recover held videos (videoQueueService.js:31). No module attaches an age or a "known, unknown, old" flag to a fact, so the registry's `lastChecked` is the nearest thing; `sync:full` copies it (`getSnapshot`), while the music state, for one, carries no timestamp (musicService.js:84-93).

Locality. Good for health words. The truth about the age of a value has no module, and the registry cannot say it for facts it does not hold.

### J10. Stay trustworthy as it changes

The owner decides when the new engine is ready. The people building it need a green run to mean something, and no test may touch a live show.

Main job of 1 modules: `storage/MemoryStorage`.

Holds part of it, 12 modules: `services/audioRoutingService`, `services/bluetoothService`, `services/mpdConfigBuilder`, `services/mprisPlayerBase`, `services/musicService`, `services/vlcMprisService`, `storage/StorageInterface`, `storage/index`, `utils/displayDriver`, `utils/logger`, `utils/processMonitor`, `websocket/listenerRegistry`.

Total 13 of 90.

Where the decisions sit. This job lives mostly outside `backend/src` (tests, deployment). Inside, three things matter. The storage seam has a memory adapter built for tests (`storage/`), so tests never touch files. `listenerRegistry` and `persistenceService` branch on `NODE_ENV`. And the isolation breaks where names are fixed: PID files and sockets under `/tmp/aln-*` in eight files, `pkill` by pattern in `audioRoutingService.js:599-603` and `displayDriver.js:147`, and one default browser name. Those modules are tagged J10 for that reason.

Locality. None in `src`. The naming layer that would give it one is not a module today.

## 4. Modules that serve three or more jobs

A `P` after a job id marks the module's main job. Counts include the main job.

Stateful and wiring modules (the ones where locality is at stake), most jobs first:

- `services/commandExecutor`: J3P, J4, J5, J2, J7, J9 (6 jobs)
- `routes/healthRoutes`: J9P, J2, J8, J1, J7 (5 jobs)
- `routes/resourceRoutes`: J1P, J7, J4, J8, J6 (5 jobs)
- `services/audioRoutingService`: J4P, J2, J9, J5, J10 (5 jobs)
- `services/cueEngineService`: J4P, J1, J5, J9, J2 (5 jobs)
- `services/musicService`: J4P, J9, J2, J5, J10 (5 jobs)
- `services/sessionService`: J5P, J2, J3, J1, J9 (5 jobs)
- `services/transactionService`: J3P, J2, J1, J5, J4 (5 jobs)
- `services/videoQueueService`: J4P, J3, J2, J9, J5 (5 jobs)
- `services/vlcMprisService`: J4P, J9, J8, J1, J10 (5 jobs)
- `websocket/broadcasts`: J2P, J4, J9, J7, J5 (5 jobs)
- `routes/scanRoutes`: J3P, J2, J4, J7 (4 jobs)
- `server`: J8P, J5, J2, J7 (4 jobs)
- `services/bluetoothService`: J4P, J9, J2, J10 (4 jobs)
- `services/gameClockService`: J4P, J2, J5, J1 (4 jobs)
- `services/packService`: J1P, J6, J9, J8 (4 jobs)
- `services/profileService`: J8P, J4, J9, J1 (4 jobs)
- `services/serviceHealthRegistry`: J9P, J4, J2, J5 (4 jobs)
- `services/systemReset`: J5P, J2, J4, J7 (4 jobs)
- `utils/displayDriver`: J4P, J9, J8, J10 (4 jobs)
- `websocket/adminEvents`: J3P, J7, J5, J2 (4 jobs)
- `app`: J8P, J1, J5 (3 jobs)
- `middleware/auth`: J7P, J5, J1 (3 jobs)
- `models/session`: J2P, J3, J5 (3 jobs)
- `routes/stateRoutes`: J2P, J9, J7 (3 jobs)
- `services/displayControlService`: J4P, J9, J2 (3 jobs)
- `services/dormancyService`: J9P, J4, J8 (3 jobs)
- `services/lightingService`: J4P, J9, J2 (3 jobs)
- `services/mpdConfigBuilder`: J4P, J8, J10 (3 jobs)
- `services/mprisPlayerBase`: J4P, J9, J10 (3 jobs)
- `services/preflightService`: J9P, J5, J8 (3 jobs)
- `services/session/persistenceListeners`: J2P, J3, J5 (3 jobs)
- `services/soundService`: J4P, J9, J2 (3 jobs)
- `utils/validators`: J3P, J1, J7 (3 jobs)
- `websocket/gmAuth`: J7P, J2, J8 (3 jobs)
- `websocket/socketServer`: J7P, J8, J1 (3 jobs)
- `websocket/syncHelpers`: J2P, J9, J1 (3 jobs)

Pure rule modules in `gameRules/` (one rule definition reused by several jobs, which is leverage rather than spread):

- `gameRules/cueValidation`: J1P, J6, J7 (3 jobs)
- `gameRules/duplicatePolicy`: J3P, J2, J1 (3 jobs)
- `gameRules/endpointServices`: J9P, J4, J8 (3 jobs)
- `gameRules/modeSemantics`: J1P, J2, J3 (3 jobs)
- `gameRules/packNeeds`: J9P, J1, J8 (3 jobs)
- `gameRules/resolution`: J9P, J8, J4 (3 jobs)

How to read it. A module in the first list that also has a wide interface (`commandExecutor`, `sessionService`, `broadcasts`, `cueEngineService`, `videoQueueService`, `transactionService`) is where a change for one job has to be checked against four others. `commandExecutor` tops the list with six jobs: it answers a command (J3), drives equipment (J4), runs session lifecycle (J5), calls score and transaction changes (J2), holds the cue floor (J7) and gates on health (J9). Its depth is low, since most of its 64 cases forward to one service method, so its interface is the union of the interfaces it forwards to.

`routes/healthRoutes` is on the list for a different reason. It looks like a health check and also registers devices (J2, J7), reports pack and profile identity (J1, J8) and carries the timezone (J8). The default `type: 'player'` that records a hardware scanner as a phone scanner lives here.

## 5. Dependencies and wiring that run against the grain

"Against the grain" means a lower-level module reaching into a higher one, a cycle, or a module doing a job that belongs to a neighbour. The layers I used, bottom to top: `gameRules`, `utils` and `models` and `storage`, `config`, `services`, `middleware`, `websocket`, `routes`, entry files (`app.js`, `server.js`). The edge counts below come from the script in appendix A.

**Clean in the other direction.** No file in `gameRules/` requires anything outside `gameRules/` (4 edges inside, none out). `models/` requires only `utils/validators` and each other. `storage/` requires only itself and the logger. These three are the cleanest part of the tree. Top-level `require`s alone contain no cycle.

### 5.1 A seven-module cycle that only shows up through in-function requires

The script found one strongly connected group once in-function requires are counted: `sessionService`, `session/persistenceListeners`, `transactionService`, `videoQueueService`, `cueEngineService`, `commandExecutor` and `dormancyService`. `backend/CLAUDE.md` names only the pair `commandExecutor` and `cueEngineService`. The loop is wider and passes through the record (`sessionService`).

- `sessionService` requires `persistenceListeners` (T, sessionService.js:14), which requires `transactionService` (L, persistenceListeners.js:26, 72), which requires `sessionService` (T, transactionService.js:12).
- `transactionService` requires `videoQueueService` (T, transactionService.js:13), which requires `transactionService` back (L, videoQueueService.js:746, to look up a token by video file).
- `sessionService` requires `cueEngineService` (L, five sites: lines 165, 335, 457, 522, 726), which requires `commandExecutor` (T, cueEngineService.js:27), which requires `sessionService`, `transactionService` and `videoQueueService` (T, commandExecutor.js:15-17) and `cueEngineService` back (L, line 223).
- `sessionService` requires `dormancyService` (L, line 223), which requires `cueEngineService` (L, dormancyService.js:171).
- `cueEngineService` requires `videoQueueService` (L, lines 843-1043).

Events add a second loop that is not in the require graph: `transactionService` listens to `sessionService` (`session:updated`, transactionService.js:67) and `sessionService` listens to `transactionService` (`persistenceListeners.js:28, 75, 131, 164`).

The meaning: the module that holds the record (J2, J5) calls into the show (J4) from five places, and the show calls back into the record. A change to either has no clean order.

### 5.2 Services reaching up into `websocket/` (7 edges)

- `sessionService.js:12`, `services/session/persistenceListeners.js`, `transactionService.js:24` and `systemReset.js:23` require `websocket/listenerRegistry` (a lifecycle helper, not a transport thing).
- `transactionService.js:22` requires `websocket/scanResponse` to build its replies.
- `heartbeatMonitorService.js:17` requires `websocket/deviceHelpers`, which mutates the session and emits to sockets.
- `systemReset.js:24` requires `websocket/broadcasts` to tear down and rebuild the broadcast listeners.

### 5.3 Other upward edges

- `systemReset` (service) requires `middleware/auth` to rotate observe tokens (systemReset.js:25).
- `middleware/auth` requires `services/packService` for the pack hash in tokens (auth.js:10).
- `utils/displayDriver` requires `services/serviceHealthRegistry` (displayDriver.js:31) to report health. `utils/validators` requires `modeSemantics` and `packService` inside a function (validators.js:22-23) so that wire validation depends on the active pack.
- `routes/stateRoutes` requires `websocket/syncHelpers` (top) and `routes/scanRoutes` requires `websocket/eventWrapper` (L, lines 110, 335, 394). Routes and sockets share the payload builders.

### 5.4 Routes that hold game logic

`routes/scanRoutes.js` decides token existence, "a session exists" (status is ignored by decision A6 in `backend/CLAUDE.md`), video eligibility and the room broadcast of `player:scan`, and holds module state with a timer started at require time (scanRoutes.js:183-196). `routes/resourceRoutes.js` renders the scoreboard page, mints an observe token into it and reads the asset manifest with its own cache. `routes/healthRoutes.js` registers devices. These three routes are thicker than the services they call.

### 5.5 `websocket/` doing service-to-service work

`broadcasts.js:386-430` forwards `video:*` and `sound:*` events to `audioRoutingService.handleDuckingEvent` and `applyRouting`. That is coordination between equipment, not delivery to a screen. It sits there, gated by `ENABLE_AUDIO_WIRES` (line 386), so a reset that tears down broadcast listeners also tears down ducking, and a test that disables broadcasts disables ducking. `adminEvents.js:53-110` runs `system:reset` itself, with its own floor check and mutex, outside `commandExecutor`.

### 5.6 Reaching into another module's fields or private methods

- `scanRoutes.js:29, 61` reads `transactionService.tokens` (a Map the constructor comments "Expose for testing", transactionService.js:30).
- `displayControlService.js:278` reads `videoQueueService.currentItem`.
- `videoQueueService.js:302-312` reads `vlcService.state` and `.track`.
- `app.js:219-225` writes `musicService._musicDir`, `_playlistFile`, `_configFile`.
- `cueEngineWiring.js:51` calls `cueEngineService._tickActiveCompoundCues`.
- `sessionService.js:224, 295, 339, 726` writes fields of `session` (`metadata.preflight`, `gameClock`, `cueEngine`).
- `audioRoutingService.js:679-708` exposes getters and setters on private ducking fields for tests.

### 5.7 Several composition roots and hand-passed service bags

Wiring is written by hand in `app.js:178-340` (31 internal dependencies), `server.js` (27), `systemReset.js` (15) and `adminEvents.js` (19). The same bag of 8 to 13 services is built at `app.js:252-261`, `server.js:77-88, 139-153`, `systemReset.js:138-152, 170-`, `adminEvents.js:81-92`, `gmAuth.js` (10 services into `buildSyncFullPayload`), `stateRoutes.js:34-45` and three times in `broadcasts.js`. A member left out is skipped quietly. The proof is in the tree today: the bag in `adminEvents.js:81-92` has no `musicService`, so `systemReset.js:121` skips `musicService.reset()` and `systemReset.js:138-152` hands `setupBroadcastListeners` an undefined music service. This is the same shape as the bug `backend/CLAUDE.md` says has come back four times.

### 5.8 Singletons imported at load, with a few injected exceptions

Every service is `module.exports = new X()` and consumers require the singleton, so a substitute has to come through module mocking. The exceptions are the places where a dependency is passed in: `createMusicRouter({musicService})` (app.js:118), `displayControlService.init({vlcService, videoQueueService})` (app.js:297), `new DuckingEngine(port)`, `dormancyService.apply(result, {registry})`, the callbacks passed into `timelineRuntime`, and `startRevalidation(services, ms)` (app.js:333). These are the modules that are easy to use on their own.

### 5.9 The environment and fixed names

- `process.env` is read in 16 files besides `config/index.js`: `app.js`, `server.js`, `storage/index.js`, `middleware/auth.js`, `routes/healthRoutes.js`, `services/vlcMprisService.js` (`VLC_HW_ACCEL`, `FEATURE_IDLE_LOOP`, `DISPLAY`), `profileService.js` (`PROFILE_PATH`), `discoveryService.js`, `packService.js` and `tokenService.js` (`PACK_PATH`), `lightingService.js`, `persistenceService.js`, `websocket/listenerRegistry.js`, `websocket/broadcasts.js` (`ENABLE_AUDIO_WIRES`), `utils/displayDriver.js` (`DISPLAY`, `PORT`, `CHROMIUM_BIN`) and `utils/logger.js`. Eight of them test `NODE_ENV`; the rest read a setting `config` does not hold.
- 16 fixed `/tmp` literals in 8 files: `vlcMprisService.js:117`, `audioRoutingService.js:798`, `musicService.js:47, 48, 50, 607`, `bluetoothService.js:501`, `mprisPlayerBase.js:209`, `mpdConfigBuilder.js:20-25`, `app.js:225`, `displayDriver.js:53`.
- Two kills by pattern across the machine: `pkill -f 'pactl subscribe'` (audioRoutingService.js:599-603) and `pkill -9 -f 'chromium.*--kiosk'` (displayDriver.js:147). `vlcMprisService.js:95` runs `pgrep -a vlc` and only warns.
- Media folders: `public/videos` is built in four places (`videoQueueService.js:184, 908`, `vlcMprisService.js:199, 405`), `public/audio` in `soundService.js:21` and `public/music` in `app.js:219`. `config.video.directory` (`config/index.js:46`) has no reader (`grep "config.video"` finds none).

### 5.10 Event edges that the require graph cannot see

Listeners across modules, from `grep`: `broadcasts.js` listens to 13 services; `cueEngineWiring.js` listens to `gameClockService`, `transactionService`, `videoQueueService`, `sessionService`, `soundService`, `cueEngineService`, `musicService` (15 call sites); `sessionService` and `persistenceListeners` listen to `gameClockService` and `transactionService`; `transactionService` listens to `sessionService`; `videoQueueService` listens to the health registry (line 31) and to `vlcService` (line 329); `displayControlService` listens to `videoQueueService` (`video:idle`, line 60). Two pre-play hooks run on `videoQueueService.processQueue`, registered by `displayControlService` (line 69) and `cueEngineWiring` (line 71), and their order matters (`systemReset.js` comment at the re-registration).

## 6. The seams that exist today, and how many adapters each has

A seam is real when something varies across it. The glossary rule: one adapter is a hypothetical seam, two is real. I count adapters in `backend/src` (what ships), and name a test double when one exists.

| Seam | Where its interface lives | Adapters in `src` | Verdict |
|---|---|---|---|
| Storage of the game's saved state | `storage/StorageInterface.js` (11 methods), made by `storage/index.createStorage` | 2: `FileStorage` (node-persist), `MemoryStorage` (tests). | Real. The only declared interface with two adapters. The memory choice is made in three places (`config.storage.type`, `storage/index.js:28`, `persistenceService.js:40`). Four other kinds of disk state bypass it: music playlists (`musicService.js:412-426`), `routing.json` (app.js:265), the pack, the profile. |
| Video player (VLC) | None declared. `MprisPlayerBase` is a base class. `videoQueueService`, `displayControlService` and `commandExecutor` call `vlcMprisService` methods and read its `state` and `track` fields. | 1: VLC (the base class has one subclass). | Hypothetical. A second player has no slot to fill. |
| Music player (MPD) | None. `musicService` is the adapter and the interface. Its constructor takes paths and a timeout. | 1: MPD over `mpd2`. | Hypothetical. The paths are a seam; the player is not. |
| Audio routing and volume (PipeWire) | `audioRoutingService` (no declared interface), `pactlClient` (parsers), and the 3-function port of `DuckingEngine`. | 1 for each: `pactl` for routing, `pw-play` in `soundService`. The ducking port has one production adapter (`audioRoutingService`) and a jest fake in `backend/tests/unit/services/audio/duckingEngine.test.js`. | The ducking port is the one in-process seam with a real second user, and it is a test double. Routing and sound are hypothetical. |
| Bluetooth | None. `bluetoothService` wraps `bluetoothctl` and `dbus-monitor`. | 1. | Hypothetical. |
| Lighting (Home Assistant) | None. `lightingService` wraps REST, a WebSocket and Docker. | 1. | Hypothetical. |
| The TV's browser | None. `utils/displayDriver` is module-level functions over one Chromium process, using X11 window tools. | 1. | Hypothetical. It also does its own spawn and kill (5.9). |
| Running an outside program | `utils/processMonitor` (restart with backoff, PID file). `utils/execHelper.execFileAsync` for one-shot commands. | `ProcessMonitor` has 5 constructors. Spawns outside it: `displayDriver`, `soundService`, `bluetoothService` scan, the Docker start. `execFileAsync` has 5 importing modules plus a per-class `_execFile` (audioRoutingService.js:987, bluetoothService.js:834). | Real for the five monitored processes. Four other processes have their own supervision. |
| Service health | `serviceHealthRegistry.report(id, status)`; the registry pulls `checkHealth` from the services map passed to `startRevalidation`. | 9 reporters: `vlc`, `music`, `sound`, `bluetooth`, `audio`, `lighting`, `gameclock`, `cueengine`, `display` (serviceHealthRegistry.js:28). | Real, with 9 users. The id list is fixed in the registry. |
| Service state to screens | The `getState()` method plus a change event, pushed by `broadcasts.pushServiceState` (ten domains). No declared interface. | Ten domains follow the convention. | Real by convention. Nothing checks that a service follows it. |
| Commands | `commandExecutor.executeCommand({action, payload, source, actor})`. | 2 callers: `adminEvents` (`source: 'gm'`) and `cueEngineService` (`source: 'cue'`). | Real. The one seam where a real second source changes the rules (the cue floor). |
| Pack and profile | `packService` getters over a frozen snapshot, `profileService` getters. Both read a directory or file. | 1 each (a directory on disk; `PACK_PATH` and `PROFILE_PATH` point it elsewhere). | Hypothetical for storage of packs. The getter interface is deep and stable. |
| Network transport | `websocket/eventWrapper` (envelope), `socketServer`, Express routes. | 2 transports (HTTP, WebSocket) calling the same services. | Real. But the two transports reach services differently (5.4, 5.5). |

## 7. What this suggests for step 3 (candidates, nothing decided)

1. The deepest modules are the pure ones: `gameRules/*`, `packService`, `serviceHealthRegistry`, `duckingEngine`, `standingEvaluator`, `timelineRuntime`, `processMonitor`. They pass the deletion test, because their rules would come back in many callers. They are also where tests are easiest.
2. The shallowest modules with many callers are the hand-wired ones: `commandExecutor` (a table that forwards), `cueEngineWiring` (a list of listeners), `persistenceService` (mostly pass-through), `scoreboardControlService` (one `emit`), `session/*` (functions that take the service as an argument). Step 3 can ask which of these should dissolve into a neighbour and which hide a decision worth a deep module.
3. The record (J2, J5) calls into the show (J4) from five places and is called back (5.1). A candidate shape is a lifecycle module that owns the moves and is the only caller of `reset()` and of the clock, cue engine and music cascades.
4. Equipment has seven adapters, one each, and no interface above them (section 6). Step 3 can decide whether the first declared interface describes the program (a supervised process) or the capability (play a video, set a volume).
5. Delivery is two code paths per fact (live listener and snapshot builder). A candidate is one builder per fact used by both.
6. Names that must be per engine are fixed in 8 modules plus two machine-wide kills (5.9). One naming module would serve J6 (a preview engine) and J10 (tests) together, as EJ J10 says.
7. Pack changes have no path to a running engine (J1 above). That is a gap in the module set, not in any module.
8. Wiring bags are rebuilt at about ten sites (5.7). One composition root with one list would remove a class of bug that already left `musicService` out of the reset.

## 8. Completion check

- **Raw listing against rows.** `find backend/src -type f | wc -l` gives 90. The sheet has 90 rows, numbered 1 to 90, one per file. The generator that built the table stopped with an error if any file in the listing had no row or any row had no file; it did not.
- **Every job lists its modules.** J1 26, J2 38, J3 18, J4 40, J5 26, J6 4, J7 18, J8 21, J9 31, J10 13 modules (main plus part). J6 has no main-job module and J10 has one; section 3 says why.
- **Dependencies.** Listed from the `require` calls with the script in appendix A. 90 of 90 files parsed. Internal edges are counted top-level and in-function. The cycle check ran twice, over top-level edges only (no cycle) and over all edges (one group of 7).
- **Modules at three or more jobs.** 43 (section 4), 37 stateful and 6 pure rule modules.
- **Seams.** 13 listed in section 6 with adapter counts.
- **Not done.** No module was run. The depth words are judgements. The L flag is a rule of thumb. `packService.js` was read at its exports and activation path, not line by line through its roughly 400-line gate. The components sheet notes that `audioRoutingService.js` changed after the earlier maps; I read it in its current form.

## Appendix A. The command that listed the dependencies

Run from `backend/src`. It walks every file, extracts `require('...')` with a regular expression, resolves relative paths against the tree, marks a require as L when its line is indented, and then runs Tarjan's strongly connected components over the edges (once with T only, once with T and L).

```js
const fs=require('fs'),path=require('path');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const root=process.cwd(), out={};
for(const f of walk(root).sort()){
  const src=fs.readFileSync(f,'utf8'), deps=new Set(), lazy=new Set(), ext=new Set();
  src.split('\n').forEach((ln,i)=>{ let m; const r=/require\(\s*['"]([^'"]+)['"]\s*\)/g;
    while((m=r.exec(ln))){ const p=m[1];
      if(!p.startsWith('.')){ ext.add(p); continue; }
      let t=path.relative(root,path.resolve(path.dirname(f),p));
      if(!t.endsWith('.js')) t+= fs.existsSync(path.join(root,t+'.js')) ? '.js' : '/index.js';
      /^\s+/.test(ln) ? lazy.add(t+':'+(i+1)) : deps.add(t); } });
  out[path.relative(root,f)]={deps:[...deps],lazy:[...lazy],ext:[...ext]}; }
// then Tarjan SCC over out[*].deps (T only) and out[*].deps + out[*].lazy (T and L)
```

Equivalent quick check by hand: `grep -rnE "require\(['\"]\.{1,2}/" backend/src`. Other commands used: `find backend/src -type f | sort`, `wc -l`, `grep -rn "process.env"`, `grep -rn "'/tmp"`, `grep -rnE "pkill|pgrep"`, `grep -rn "removeAllListeners"`, `grep -rn "setOfflineStatus"`, `grep -rn "pack:changed"`, `sed -n` for the cited ranges, and `git rev-parse --short HEAD`.
