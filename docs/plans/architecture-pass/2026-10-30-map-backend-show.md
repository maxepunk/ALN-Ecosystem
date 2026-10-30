# Map: backend show control, equipment and health

Reader output for the architecture pass. Read-only survey; no source file was changed.

- Code state: branch `claude/nice-curie-hescfv`. Task named commit `26fc2f2`; HEAD moved to `bdbf6df` during the run. `git diff --name-only 26fc2f2 HEAD | grep -c "^backend/src"` returned `0`, so the code read is the code at `26fc2f2`.
- Vocabulary: CONTEXT.md §0, §2, §4, §4b, §5. "Authority", "copy", "delivery path", "service domain", "dormant vs fault", "held item", "verdict", "paper/live" are used as defined there. Terms I needed that CONTEXT.md lacks are listed in section 7.
- Abbreviations in tables: SS = `service:state` push to the `gm` room, debounced 50 ms per domain (broadcasts.js:487-493). SF = `sync:full` snapshot (built by syncHelpers.js:36-159; sent on GM connect, `sync:request`, `GET /api/state`, after offline-queue processing, per syncHelpers.js:1-10 and broadcasts.js:352-367). DM = `display:mode` event, `io.emit` to every socket (broadcasts.js:462-467, eventWrapper.js:28-31). "Live update" = pushed when the fact changes. "Snapshot" = only a pull or a reconnect refreshes it.
- Line numbers are from `awk '{print FNR": "$0}'` over each file. "inference" marks anything I reasoned out and did not read.

## Conclusions

1. Scope: 38 files, 14,527 lines (`find`/`wc` in section 1). All read in full. No service, test or server was started.
2. The engine is the authority only for what it decides or spawns: game clock, cue state, video queue, display-mode intent, route and volume intent, held items, sounds it spawned. Outside programs are the authority for what physically happens: VLC position and track, MPD state, PipeWire sinks and sink-inputs, BlueZ devices, Home Assistant scenes, the Chromium window. Every outside fact is held as a copy, and no copy carries an age or a staleness mark.
3. Copies are refreshed three ways: event streams (dbus-monitor for VLC, `pactl subscribe`, dbus-monitor on the system bus for BlueZ, MPD idle, HA WebSocket), a 15 s probe that covers only six services (serviceHealthRegistry.js:236-244), or an on-demand command. Nothing re-reads a copy after one of its event streams dies.
4. DEFECT (production path): adminEvents.js:77-90 calls `performSystemReset` without `musicService`. In systemReset.js that skips `musicService.reset()` (:122), the music `service:state` listeners (broadcasts.js:497) and the music-to-cue forwarding (cueEngineWiring.js:141). After a GM `system:reset`, music pushes and music-triggered cues stop until restart (inference on consequence; the omission is read). Test helpers pass it (tests/helpers/integration-test-server.js:116), so tests do not see it.
5. After a system reset `display` stays `down: Reset`. `registry.reset()` downs it (serviceHealthRegistry.js:288-291); `displayControlService.init` reports nothing when Chromium is already alive (displayDriver.js:258-260); `display` has no revalidation entry (serviceHealthRegistry.js:236-244). `display:scoreboard` is gated on `display` (commandExecutor.js:52,208-215), so it is refused until a `service:check display` or a kiosk restart (inference; every step is read).
6. A health change pushes only the `health` domain (broadcasts.js:536-538). It never pushes the service's own domain. Fields such as `video.connected`, `bluetooth.available`, `lighting.connected`, `music.connected` are read through the registry (or, for music, a private flag) at the moment some other event triggers a push. Registry `report()` emits only when status changes (serviceHealthRegistry.js:97-105), so message and `lastChecked` never ride a push.
7. Only one private connection flag exists outside the registry: `musicService.connected` (musicService.js:73,86,172,215,231). It is set beside the registry report, but a dormant latch ignores the report and leaves the flag true. The kiosk driver keeps `visible`/`launched`/`terminating` (displayDriver.js:35-49); these are process facts, not health flags.
8. The operator door of dormancy cannot be reached. `setOutOfService`/`putInService` have no caller (grep, section 4). `service:out-of-service`, `service:in-service`, `service:restart`, `preflight:run` appear only in `REQUIRED_PAYLOAD_FIELDS` and grants.js; the executor switch has no case, so they return "Unknown action" (commandExecutor.js:963-968). `validateCommand` has no caller. Preflight rows carry empty `verbs` (preflightService.js:111). The T3/T4 work is not in the code.
9. Dormancy changes the registry and the cue engine only. It does not stop anything: it is computed after every service has started (app.js:326 after :211-301), so VLC, MPD, the kiosk, the HA WebSocket and `pactl subscribe` run on a venue where the profile says they are not installed. CONTEXT.md §5 says a dormant stack service's process is not started; the code does not do that yet.
10. Red that is always red: a host with the lighting token empty or `LIGHTING_ENABLED=false` never reports (lightingService.js:42-50,103-105), so `lighting` stays `down: Not yet checked`. Same for `music` with `ENABLE_MUSIC_PLAYBACK=false` (app.js:226-238) and for `vlc`/`display` with `ENABLE_VIDEO_PLAYBACK=false` (app.js:280-301 skips `displayControlService.init`, so the "video playback disabled" report at displayControlService.js:101-103 is unreachable at boot). Only the profile door or the (unreachable) operator door can make these grey.
11. Display: `setScoreboard` returns `success: true` and emits `SCOREBOARD` even when `showScoreboard()` returned false (displayControlService.js:233-244). The mode is the engine's intent; nothing reads back the window state or what VLC is doing.
12. "Is a video playing" has six answers (section 6). A paused video is "not playing" for `isPlaying`, `getCurrentVideo`, `canAcceptVideo` and the cue video-conflict check, but `processQueue` guards on `isPlaying()` while `addToQueue` guards on `currentItem`, so the two disagree while a video is paused (videoQueueService.js:71,90).
13. Two hold lists exist. Held cues live in `HeldItemsStore` (heldItemsStore.js, used only by cueEngineService.js:51). Held videos live in a plain array `_heldVideos` with its own counter (videoQueueService.js:16,27,915-930). The `HeldItemsStore` header and backend/CLAUDE.md:488 say it is the unified store for both types; its `video` branch has no caller, and its try-all `releaseAll`/`discardAll` have no caller either (the executor runs its own loops, commandExecutor.js:787-818). Ids share the wire format `held-cue-N`/`held-video-N` but come from two counters.
14. CONTEXT.md §4 says a held cue auto-discards after 10 s. Only `video_busy` cue holds get the timer (cueEngineService.js:861-868); `service_down` holds (:745-752) and re-holds (:1066) have none. Held videos never expire. Nothing listens for a service recovering to release a held cue; the GM must release it. Neither list is persisted; neither is cleared at game session end; `reset()` clears both with no event, so no held push follows from them (cueEngineService.js:93-96, videoQueueService.js:1065; systemReset.js contains no push call, so I infer none follows).
15. Running compound cues are not persisted (toPersistence covers standing cues only, cueEngineService.js:1107-1111). A restart loses them. Game session end calls `suspend()` only (sessionService.js:522), so a running compound cue stays in `activeCues` with no tick to advance it (inference). A cue waiting on video has no timeout; it completes only on a matching `video:completed` (timelineRuntime.js:453-509).
16. Standing-cue sets (`firedClockCues`, `spentOnceCues`, `disabledCues`) are cleared only by `_reset()` (cueEngineService.js:55-97), reached from system reset. `createSession` and `endSession` do not touch them (sessionService.js:200-260,503-559). A once-cue spent in one session stays spent in the next unless a system reset runs between (inference; whether the GM flow always resets was not checked).
17. Music copy: `init()` and the reconnect path never read MPD (musicService.js:95-108,176-191). The copy starts at `stopped`/`70`/no track and corrects only on the first MPD idle event or after a command (`_refreshAfterCommand`, :276-283). After an orchestrator restart with MPD still playing, the GM sees `stopped` (inference). Shuffle and loop are not read from MPD at all (:316-339).
18. Audio: `routing.json` `routes` (including `fallback`) is never read; only `ducking` is (app.js:265-271, systemReset.js:199-205). `config.audio.defaultOutput` has no reader. `applyRoutingWithFallback` has no caller. `sinkExists` reads the sink cache without refreshing, and the cache is set to null on every sink event (audioRoutingService.js:231-239,801-812), so it can answer "no such sink" for a sink that exists (inference; validateCommand has no caller today).
19. Ducking is a refcount driven by four lifecycle events (broadcasts.js:386-439). `video:failed` after `video:started`, and `clearQueue()` on a playing item, emit no `video:completed`, so music can stay ducked (inference from videoQueueService.js:417-433,842-875). The ducking engine's state is lost on `reset()` (duckingEngine.js:211-216).
20. Bluetooth: the BlueZ device monitor starts only if the adapter is up at `init()` (bluetoothService.js:59-67); `checkHealth` never starts it later. `service:check bluetooth` calls `isAvailable()`, which does not report to the registry (commandExecutor.js:889, bluetoothService.js:115-122), while the 15 s probe calls `checkHealth()`. The GM's "Check Now" on Bluetooth therefore cannot change the health row.
21. Lighting health has three writers that disagree: HTTP probe (lightingService.js:114-116), WebSocket `auth_ok` (:207) and WebSocket close (:254). After HA returns, scenes are not refetched (`getScenes` runs only at `init` and on `lighting:scenes:refresh`).
22. VLC can be reported healthy by a signal from another MPRIS player: the dbus-monitor match rule has no sender filter (mprisPlayerBase.js:203), and `_ownerBusName` is null after VLC exits (vlcMprisService.js:127), when every signal is processed (:257) and `_processStateChange` reports `vlc` healthy (:436-438). Inference on the cross-player case.
23. `ProcessMonitor` emits `gave-up` after five empty-output failures (processMonitor.js:141-144). No code listens (grep, section 4). `exited` is listened to for VLC and MPD only. The dbus-monitor, `pactl subscribe` and BlueZ monitors can die for good with no health change.
24. Contract drift: asyncapi `DomainStateMusic` says `playlists[]` is not in the push and `playlist` is string or null (asyncapi.yaml:2674,2677), while the contract's own sync:full music block types `playlist` as object or null (asyncapi.yaml:853). The code pushes `playlists` on every music push (broadcasts.js:497-503) and `playlist` is an object (musicService.js:379-387). SF `cueEngine` carries `loaded`; SS `cueengine` does not (syncHelpers.js:205-210 versus cueEngineService.js:169-175). SF `gameClock` omits `startTime`/`totalPausedMs`, which SS requires (syncHelpers.js:176-186, asyncapi.yaml:2736).
25. A stopped game clock keeps counting: `getElapsed()` after `stop()` uses wall time again and `gameStartTime` is not cleared (gameClockService.js:75-97). `getState().elapsed` grows after game end until `reset()`.
26. `soundService.fileExists` lacks the path-separator guard `play()` has (soundService.js:147 versus :58); the `play()` comment says "same guard".
27. Unverified here: any behavior against real VLC, MPD, PipeWire, BlueZ or HA; the GM scanner's own use of these fields; `sessionService` persistence listeners (out of scope); whether the GM "new session" flow always runs a system reset.

## 1. Module table

Scope command and count:

```
cd backend/src && { ls services/cueEngineService.js services/cueEngineWiring.js services/gameClockService.js \
  services/heldItemsStore.js services/videoQueueService.js services/vlcMprisService.js services/mprisPlayerBase.js \
  services/displayControlService.js services/commandExecutor.js services/audioRoutingService.js services/musicService.js \
  services/mpdConfigBuilder.js services/soundService.js services/bluetoothService.js services/lightingService.js \
  services/serviceHealthRegistry.js services/dormancyService.js services/profileService.js services/preflightService.js; \
  find services/cue services/audio -name '*.js'; \
  ls gameRules/resolution.js gameRules/endpointServices.js gameRules/packNeeds.js gameRules/dormancyWording.js; \
  find utils -name '*.js'; echo websocket/broadcasts.js; } | wc -l
```

Result: `38` (19 named services + 4 under `services/cue` and `services/audio` + 4 gameRules + 10 utils + 1 broadcasts.js). `find utils -name '*.js' | wc -l` gave `10`; `find services/cue services/audio -name '*.js' | wc -l` gave `4`. Total lines `14527` (`wc -l` over the same list).

| File | Lines | Role | Runtime facts it holds or writes |
|---|---|---|---|
| services/cueEngineService.js | 1181 | Cue engine facade: loads pack cues, fires simple and compound cues, holds blocked cues, applies dormancy | `cues` :60; `disabledCues` :66; `spentOnceCues` :68; `dormancyDisabledCues` :74; `_dormantCommands` :80; `active` :82; `firedClockCues` :84; `_restoredClockElapsed` :86; `_heldStore` (held cues) :51; delegates `activeCues` to `_timeline` :50,107; writes health `cueengine` :161,227,1168 |
| services/cueEngineWiring.js | 152 | Forwards game, video, sound, music, clock events to the cue engine; registers the `video:loading` pre-play hook | Holds none. Registers listeners through listenerRegistry :49-147; hook on videoQueueService :71-74; calls `gameClockService.handlePhaseTrigger` :44,72 |
| services/gameClockService.js | 316 | Game clock, overtime flag, phase table | `gameStartTime`, `pauseStartTime`, `totalPausedMs`, `interval`, `status` :21-25; `overtimeThreshold`, `overtimeFired` :26-27; `phases`, `currentPhaseIndex`, `_phaseTriggerFired` :28-30; writes health `gameclock` :17,279 |
| services/heldItemsStore.js | 264 | In-memory held-item list with auto-discard timers (class) | `_items`, `_autoDiscardTimers` :39-46; module counter `_globalHeldIdCounter` :27. Only caller: cueEngineService.js:51 |
| services/videoQueueService.js | 1074 | Video queue, one-at-a-time VLC playback, 1 s monitor loop, held videos, pre-play hooks | `queue` :24; `currentItem` :25; `playbackTimer` :26; `progressTimer` (set in `monitorVlcPlayback` :343,437); `_heldVideos` :27; `_prePlayHooks` :28; `heldIdCounter` :16; listens to registry :31 |
| services/vlcMprisService.js | 532 | VLC driver: spawns `cvlc`, MPRIS client, idle loop, cached state | `_previousDelta` :21; `_loopEnabled` :22; `_rawVolume` :23; `_vlcProcessMonitor` :24; inherits `state`, `volume`, `track`, `_ownerBusName` from base; writes health `vlc` :128,436-438 and via base |
| services/mprisPlayerBase.js | 401 | MPRIS base: `dbus-send` calls, `dbus-monitor` signal stream, debounce, owner filter | `state` :43; `volume` :44; `track` :45; `_playbackMonitor` :48; `_mprisSignalParser` :49; `_signalDebounceTimer`, `_pendingSignal` :50-51; `_ownerBusName`, `_resolvingOwner` :54-55; writes health through `_setConnected` :136-141. Only subclass: VlcMprisService |
| services/displayControlService.js | 435 | Display-mode state machine (IDLE_LOOP, SCOREBOARD, VIDEO) with a serialising lock | `currentMode`, `previousMode`, `pendingVideo` :31-35; `_initialized` :36; `_switchLock` :37; writes health `display` once, :102 |
| services/commandExecutor.js | 1061 | The one dispatch for GM commands and cue commands; dependency gate; `service:check`; `validateCommand` | Stateless. Maps `SERVICE_DEPENDENCIES` :38-77, `REQUIRED_PAYLOAD_FIELDS` :86-102. Changes state only by calling services |
| services/audioRoutingService.js | 1158 | Stream-to-sink routing table, sink cache, sink-input registry, volume intent, ducking host, `pactl subscribe` monitor | `_routingData` (routes, defaultSink, volumes) :69; `_sinkCache`, `_sinkCacheTime` :72-73; `_sinkInputRegistry` :77; `_duckingEngine` :82; `_sinkMonitor` :68; writes health `audio` :159,162,196 |
| services/musicService.js | 636 | MPD client, MPD process supervisor, playlist catalog | `connected` :73; `state` :74; `volume` :75; `track` :76; `playlist` :77; `_pausedByGameClock` :78; `_playlists` :70; `_mpd` client; `_procMon` :71; `_playlistWatcher`; writes health `music` through `_setConnected` :230-233 |
| services/mpdConfigBuilder.js | 57 | Pure text builder for the MPD config | None. Names the MPD output `aln-music` :44 and `/tmp/aln-mpd.*` defaults :19-25 |
| services/soundService.js | 163 | Runs `pw-play` child processes | `processes` Map pid to entry :20; `audioDir` :21; writes health `sound` :45,48,154 |
| services/bluetoothService.js | 886 | BlueZ driver through `bluetoothctl` and a system-bus `dbus-monitor` | `_scanProc` :44; `_pairProc` :45; `_discoveredAddresses` :46; `_cachedDeviceStates` :51; `_deviceDebounceTimers` :52; `_deviceMonitor`, `_deviceSignalParser` :49-50; writes health `bluetooth` :77,86,98,105,478 |
| services/lightingService.js | 522 | Home Assistant client (HTTP and WebSocket), Docker container start | `_scenes` :21; `_activeScene` :22; `_reconnectInterval` :23; `_containerStartedByUs` :24; `_ws`, `_wsReconnectTimer`, `_wsReconnectAttempts`, `_wsMessageId`, `_wsStopped` :27-31; writes health `lighting` :114,116,207,254,436 |
| services/serviceHealthRegistry.js | 300 | Nine-entry health registry, dormant latch, 15 s revalidation | `_services` Map :43; `_revalidationTimer` :44; emits `health:changed` :99,142,173 |
| services/dormancyService.js | 209 | Decides what is dormant; pushes the decision into registry and cue engine | `operatorLatches` Map :41 (no caller sets it); `compute` :90; `apply` :157; `recompute` :188 |
| services/profileService.js | 221 | Loads and freezes one installation profile | `activeProfile` :38; `activeProfileMtime` :39; `activated` :37; warn latches :36,40 |
| services/preflightService.js | 158 | One evaluator: resolve() rows, rollup, blocking list, limits | `last` :58 (last evaluation) |
| services/cue/standingEvaluator.js | 286 | Pure event and clock matching, condition operators, standing-cue persistence shapes | `warnedBadClockCues` Set :171 (module level). Event normaliser table :26-68 |
| services/cue/timelineRuntime.js | 666 | Running compound-cue store, drive modes, cascades, completion | `activeCues` Map :63. Entry shape :32-55,109-132 |
| services/audio/duckingEngine.js | 525 | Ducking refcount and restore state machine | `_rules` :72; `_instanceCounts` :81; `_preDuckVolumes` :88; `_opQueues` :97 |
| services/audio/pactlClient.js | 217 | Stateless `pactl` output parsers and exec wrapper | None |
| gameRules/resolution.js | 259 | `resolve(needs, profile, inventory)`: verdicts and rollup | None (pure) |
| gameRules/endpointServices.js | 147 | Equipment family to service map; `isInstalled`; `dormantServicesFor` | None (pure). `FAMILY_SERVICES` :36-42 |
| gameRules/packNeeds.js | 115 | `collectPackNeeds`: pack to typed need list | None (pure) |
| gameRules/dormancyWording.js | 39 | The two door sentences | None (pure). `DOOR_WORDING` :22-25 |
| utils/dbusSignalParser.js | 170 | Parses `dbus-monitor` text into signal objects | Per-instance `_currentHeader`, `_currentBody`, `_currentType` :30-32 |
| utils/displayDriver.js | 447 | Kiosk Chromium process, window show/hide through `xdotool`/`wmctrl`, `probe()` | Module state: `browserProcess` :34; `visible` :35; `launchPromise` :36; `launched` :49; `terminating` :50; `PID_FILE` :53; `SCOREBOARD_URL` :77. Writes health `display` :208,210,212,240,247,361,367,373,377 |
| utils/dockerHelper.js | 95 | `docker ps/start/stop` wrappers | None |
| utils/execHelper.js | 48 | Promise wrappers over `execFile` | None |
| utils/logger.js | 275 | Winston logger; writes `combined.log`, `error.log`, `exceptions.log`, `rejections.log` in `config.storage.logsDir` | Log files :86,93,102,108; creates logs dir :14 |
| utils/processMonitor.js | 220 | Restarting child-process monitor with PID file and line events | `_proc` :47; `_restartTimer` :48; `_failures` :49; `_stopped` :50; PID file |
| utils/responseBuilder.js | 118 | HTTP response helpers | None |
| utils/timezone.js | 98 | Derives a POSIX TZ string from `/usr/share/zoneinfo` for `/health` | `cached` :30 |
| utils/validators.js | 294 | Joi schemas; mode ids read lazily from the pack | None |
| utils/withTimeout.js | 35 | Promise timeout wrapper | None |
| websocket/broadcasts.js (in scope: 376-439, 445-467, 476-600) | 747 | Wires service events to `service:state`, `display:mode`, `cue:*` pushes, held-state push, ducking and routing wires | Module state `activeListeners` :14; `broadcastListenersActive` :17; `_pushTimers` :23 |

## 2. Runtime-fact table

Persistence in this table means node-persist under `config.storage.dataDir` (default `./data`; in-memory under test, config/index.js:50-53), written through sessionService unless a row says otherwise. "Game session end" is `sessionService.endSession` (sessionService.js:503-559). "New session" is `createSession` (:200-260). "System reset" is `performSystemReset` (systemReset.js:38-301). "Restart" is an orchestrator process restart.

| Fact | Authority | Copies | Writers | Change events | Delivery paths | Persistence | Cleared or rebuilt at |
|---|---|---|---|---|---|---|---|
| Game clock: status, start time, pause time, paused total | gameClockService fields :21-25. Elapsed is derived, never stored (:93-97) | `session.gameClock` (sessionService.js:339,468,486,722); SF `gameClock` (syncHelpers.js:168-191); SS `gameclock` payload | `start` :33-52 (sessionService.js:332); `pause` :54-62 (:463); `resume` :64-73 (:480); `stop` :75-91 (:517); `restore` :217-262 (:154); `reset` :276-280 (sessionService.js:754, systemReset.js:107) | `gameclock:started/paused/resumed/stopped` :50,60,71,89; `gameclock:tick` every 1 s :301 (not sent to clients) | SS `gameclock` on started/paused/resumed/stopped/phase:changed only (broadcasts.js:572-576): live at transitions, snapshot between (no tick push, comment :569-571). SF `gameClock`: snapshot; omits `startTime` and `totalPausedMs` (syncHelpers.js:176-186) | `startTime`, `pausedAt`, `totalPausedMs`, `overtimeThreshold`, `phaseId` via `toPersistence` :264-274; written by `_persistCurrentSession` only when status is not `stopped` (sessionService.js:721-723); not per tick | Game session end: `stop()` sets status only; `gameStartTime` stays, so `getElapsed()` keeps counting wall time (:75-97). New session: `start()` resets (:40-42). System reset: `reset()` (:276). Restart: `restore()` from the session (sessionService.js:151-159) |
| Game phase and overtime flag | gameClockService `currentPhaseIndex`, `phases` :28-29; `overtimeFired` :27 | SF `gameClock.phase`; SS `gameclock.phase` (:111); session `gameClock.phaseId` | `setPhases` :123-135 (sessionService.js:153,329); `handlePhaseTrigger` :150-160 (cueEngineWiring.js:44,72); `_recomputePhase` :186-202 (tick :312); `start` :48; `stop` :85; `restore` :247-259; `setOvertimeThreshold` :209-215 | `phase:changed` :194; `gameclock:overtime` :306 | SS `gameclock` on `phase:changed` (broadcasts.js:573): live. Overtime goes to sessionService (sessionService.js:56), out of scope | `phaseId` :272, `overtimeThreshold` :271. `_phaseTriggerFired` not persisted: a trigger fired during downtime is lost (comment :242-244) | `stop` clears phase :85-86; `reset` :276-278; restore re-seats from time starts only |
| Running compound cues: state, elapsed, drive mode, fired entries, captured video token | timelineRuntime `activeCues` :63 | `getActiveCues` summaries (timelineRuntime.js:170-182) in SS `cueengine.activeCues` and SF `cueEngine.activeCues` (syncHelpers.js:205-210); discrete `cue:fired/completed/error` | `createActiveCue` :83-136; `fireEntries` :205-276; `tickClock` :293-336; `handleVideoProgress` :351-406; `handleVideoLifecycle` :420-514; `stopCue` :525-548; `pauseCue` :555-577; `resumeCue` :584-606; `checkCompletion` :619-638. Callers in cueEngineService.js:493-527,538-593,834-928,934-1020 | `cue:fired` :765,898; `cue:started` :899; `cue:status` (many); `cue:completed` :520,808,916; `cue:error` | SS `cueengine` on fired/completed/started/status (broadcasts.js:582-584): live, about once a second per running cue because `tickClock` emits status each tick (timelineRuntime.js:307,327). Discrete `cue:fired/completed/error` to `gm` room (broadcasts.js:447-458). SF snapshot | None. `toPersistence` covers standing cues only (cueEngineService.js:1107-1111) | `loadCues` stops them (:123-128); `_reset` `clearAll` (:89-91; system reset). Game session end: `suspend()` only (sessionService.js:522), so they stay `running` with no tick (inference). Restart: lost |
| Standing-cue state: fired clock cues, GM-disabled cues, spent once-cues, engine active flag | cueEngineService `firedClockCues` :84, `disabledCues` :66, `spentOnceCues` :68, `active` :82 | session `cueEngine` (persisted); SS and SF `cueengine.cues[].enabled/disabledBy`, `disabledCues` (:221-256) | `handleClockTick` :472-483; `enableCue` :291-302; `disableCue` :304-308; `_markOnceSpent` :824-828; `activate/suspend` :419-427 (sessionService.js:168,336,464,481,522); `restore` :1125-1141; `_markPastClockCuesFired` :1149-1160 | `cue:status` enabled/disabled :300,307,827 | SS `cueengine` (live). SF snapshot | `firedClockCues`, `disabledCues`, `spentOnceCues`, `active` via `toPersistence` (standingEvaluator.js:237-244), written with the session (sessionService.js:726) | `_reset` only (cueEngineService.js:55-97; system reset). Not at game session end or new session (sessionService.js:200-260,503-559). Restart: `restore` (sessionService.js:164-174) |
| Cue-engine disable by dormancy and per-command dormant list | dormancyService decision pushed by `applyDormancy` into `dormancyDisabledCues` :74 and `_dormantCommands` :80 | SS/SF `cues[].enabled`, `disabledBy:'dormant'`, `dormantCommands` (:247-253) | `applyDormancy` :347-405 (dormancyService.js:171; called by `recompute` at app.js:326, sessionService.js:223, systemReset.js:285) | `cue:status` `dormancy-updated` :404 | SS `cueengine` (live) | None by design (:70-74) | Recomputed at boot, new session, system reset; `_reset` empties it :74 |
| Held cues | cueEngineService `_heldStore` (HeldItemsStore) :51 | SS `held` and SF `heldItems` (flat array), both merged with held videos (syncHelpers.js:257-274; broadcasts.js:589-592) | `holdItem` :745 (service down), :848 (video busy), :1066 (re-hold after a refused release); `release` :1054; `discard` :1085; auto-discard timer :861-868 (10 s, `video_busy` holds only); `reset` :93-96 | `cue:held` :753,858,1074; `cue:released` :1055; `cue:discarded` :1086 | SS `held` on those three events (broadcasts.js:594-596): live. SF `heldItems` snapshot. `reset()` emits nothing | None | `_reset` (system reset). Not at game session end |
| Held videos | videoQueueService `_heldVideos` array :27 (plain objects, own counter :16) | SS `held`, SF `heldItems`; the same item also sits in `queue` as pending (videoQueueService.js:915-930, 680-686) | `_holdVideo` :915-930 (from `processQueue` :119-125); `releaseHeld` :941-952; `discardHeld` :954-963; `reset` :1065 | `video:held` :929; `video:released` :949; `video:discarded` :962; `video:recoverable` :33 | SS `held` on the four events (broadcasts.js:598-600): live | None | `reset` (system reset). Never expires. Not at game session end |
| Video queue | videoQueueService `queue` :24 | SS `video.queue` (pending items only, :676-687) and SF `videoStatus`; held item twin above | `addToQueue` :53-83 (scanRoutes.js:99); `addVideoByFilename` :744-807 (commandExecutor.js:388); `reorderQueue` :814-836; `clearQueue` :842-875; `clearCompleted` :723-736; `clearPending` :621-637 (no caller found by grep); `processQueue` :89-143; `reset` :1063 | `queue:added` :68,799; `queue:cleared` :732; `queue:reordered` :835; `queue:pending-cleared` :634; `queue:reset` :864 | SS `video` (broadcasts.js:530-533): live. SF snapshot | None | `reset` (system reset). Restart: lost. Not at game session end |
| Current video and its progress (engine's item) | videoQueueService `currentItem` :25 for "which item". Position is derived from `playbackStart` and the wall clock (:665-674) | SS `video.currentVideo` {tokenId, filename, position, duration}; `video:progress` {progress, position, duration} internal only | `playVideo` :151-288 (`startPlayback`, `currentItem` set :159-160); `monitorVlcPlayback` :339-453; `completePlayback` :460-486; `skipCurrent` :492-520; `pauseCurrent` :526-548; `resumeCurrent` :557-589; `seekCurrent` :598-615 | `video:loading` :173; `video:started` :239; `video:progress` :396 (not pushed); `video:paused` :546; `video:resumed` :587; `video:completed` :479; `video:failed` :112,134,282,427; `video:idle` :99,871 | SS `video` on loading/started/completed/paused/resumed/idle/failed and on VLC `state:changed` (broadcasts.js:512-529). Progress is not pushed: position in the payload is a snapshot computed from wall time | None | `reset`; `clearQueue` nulls it without emitting completed (:856-861). Restart: lost, VLC may still play |
| VLC player state copy: playback state, track filename and length, volume, loop | VLC itself (outside program). Position is read live (vlcMprisService.js:237) | `state`, `track`, `volume`, `_rawVolume`, `_loopEnabled`, `_previousDelta` in vlcMprisService; SS `video.connected` | `_processStateChange` :432-478 (dbus-monitor signals); `checkConnection` resync of `state` only (mprisPlayerBase.js:158-177); `setLoop` :298-308; `reset` :510-516 (clears `track`, `state`) | `state:changed` {previous, current} :471; `playback:changed` (base :170, no listener found) | SS `video` on `state:changed` (broadcasts.js:512). `track` is not delivered by itself | None | `reset()` (system reset) sets stopped/null; only a Metadata signal refills `track`. Restart: empty until first signal |
| Display mode (IDLE_LOOP, SCOREBOARD, VIDEO), previous mode, pending video | displayControlService `currentMode` :31 (engine intent; no read-back of VLC or the window) | SF `displayStatus` (syncHelpers.js:125-130); DM payload; `display:status` command message | `_doSetIdleLoop` :158-188; `_doSetScoreboard` :205-251; `returnToVideo` :272-304; `_doPlayVideo` :322-360 (no caller in src found); pre-play hook :69-84; `_handleVideoComplete` :370-398; `reset` :403-425 | `display:mode:changed` :76,175,238,291,345 | DM to every socket (broadcasts.js:462-467): live; SF snapshot. Not a `service:state` domain | None | `reset` sets IDLE_LOOP without touching VLC (:416). Restart: IDLE_LOOP default |
| Kiosk browser: process alive, window visible | The Chromium process and X11 window (outside). Driver flags `browserProcess` :34, `visible` :35 are copies | `getStatus` {scoreboardVisible, browserPid} (displayDriver.js:385-392); registry entry `display` | `_doLaunch` :122-250; `showScoreboard` :278-299; `hideScoreboard` :311-328; exit handler :192-224; `cleanup` :399-437; `probe` :359-379 | process `exit`/`error` :186-224 | Only through registry `display` health (health domain) and display mode. `visible` has no delivery path | PID file `/tmp/aln-pm-scoreboard-chromium.pid` :53,229 | `displayControlService.reset` hides the window (:413). Process killed only at shutdown (server.js:197-198) |
| Audio sinks (cache) and sink-input registry | PipeWire (outside) | `_sinkCache` (TTL 5 s, nulled on sink events) :72-73,206-234; `_sinkInputRegistry` id to {index, appName, stream} :77,897; SS/SF `audio.availableSinks` (auto_null filtered :584-586) | `getAvailableSinks` :206-223; `_invalidateSinkCache` :231; monitor handlers :796-830; `_identifySinkInput` :873-920 | `sink:added`, `sink:removed` :804,813 | SS `audio` on sink events (broadcasts.js:549-550): live. SF snapshot. Registry entries are not delivered | None | `reset` clears both (:187-194); `init` refills the cache (:142). Registry is not rebuilt for sink-inputs that existed before start; `findSinkInput` falls back to `pactl list sink-inputs` (:443-450) |
| Audio routes (stream to sink) and default sink | audioRoutingService `_routingData.routes` :69 | SS/SF `audio.routes`, `defaultSink` (:310-322) | `setStreamRoute` :282-292 (commandExecutor.js:617); `init` loads persisted :120-123; `reset` :186 | `routing:changed` :291; `routing:applied` :389; `routing:fallback` :396 | SS `audio` (live) | `config:audioRouting` key (:42,288) | `reset` reverts to `{video:{sink:'hdmi'}}` in memory (:186) while the persisted copy stays; `init` reloads the persisted copy later in the same system reset (audioRoutingService.js:120-123, called from systemReset.js:252) |
| Stream volumes: persisted intent and live level | Intent: `_routingData.volumes` :53. Live level: the PipeWire sink-input (outside) | SS/SF `audio.volumes`; ducking `_preDuckVolumes` | `setStreamVolume` :534-552 (live and persisted); `_setStreamVolumeLive` :493-514 (ducking, no persist); `_identifySinkInput` re-applies intent to new sink-inputs :905-919 | none for volume itself (`ducking:changed` for ducks) | SS `audio.volumes` pushes only on routing/sink/ducking events (broadcasts.js:549): a `set-sink-input-volume` alone triggers no push (inference from the event list) | `config:audioRouting` :288,547 | `reset` empties `volumes` (:186); `init` reloads |
| Ducking: active sources per target, pre-duck captured volume, rules | DuckingEngine `_instanceCounts` :81, `_preDuckVolumes` :88, `_rules` :72 | SS/SF `audio.ducking` (:318); music's real volume in PipeWire | `handleEvent` :139-157 via `handleDuckingEvent` from broadcasts.js:388-428; `refreshPreDuckCapture` :170-176; `loadRules` :123-129 (app.js:270, systemReset.js:203) | `ducking:changed` / `ducking:failed` (audioRoutingService.js:93-96) | SS `audio` on `ducking:changed` (broadcasts.js:549): live | None | `reset` / `loadRules` clear counts and captures (:125-127,211-216). A duck in progress at reset is stranded (comment :46-49) |
| Music: MPD state, volume, track, position | MPD (outside program) | musicService `state` :74, `volume` :75, `track` :76; SS and SF `music` | `_handlePlayerEvent` :475-538; `_handleMixerEvent` :540-551; `_refreshAfterCommand` :276-283; `reset` :553-559; commands :285-314 | `playback:changed` :505; `track:changed` :521,529; `position:changed` :526; `volume:changed` :549 | SS `music` via `buildMusicState` (broadcasts.js:497-507): live, 50 ms debounce; the payload includes the playlist catalog. SF `music` snapshot | None (MPD keeps `/tmp/aln-mpd.state`, mpdConfigBuilder.js:22) | `init`/reconnect do not read MPD (:95-108,176-191). `reset()` forces defaults while MPD plays on. Restart: defaults until first idle event |
| Music playlist loaded, shuffle, loop, queue position; paused-by-game-clock | Playlist: the engine (`this.playlist` :77) because MPD `options` is not subscribed (:316-324). Shuffle/loop: MPD, copy in `playlist` | SS `music.playlist`; `_pausedByGameClock` :78 | `loadPlaylist` :352-389; `setShuffle` :325-331; `setLoop` :333-339; `_handlePlayerEvent` position :534-537; `pauseForGameClock`/`resumeFromGameClock` :430-442 (sessionService.js:465,482) | `playlist:changed` :329,337,388 | SS `music` (live) | None | `reset` :557-558 |
| Playlist catalog | File `backend/config/music-playlists.json` | `_playlists` Map :70 | `_loadPlaylistsFromDisk` :123-144; `fs.watch` reload :146-157; `writePlaylistFile` :418-423 | `playlists:reloaded` :154 | SS `music` and SF `music.playlists` | The file itself | Reloaded at `init` and on file change; not touched by reset |
| Sounds playing | soundService `processes` Map :20 (the engine spawned them) | SS/SF `sound.playing` (:134-142) | `play` :53-112 (commandExecutor.js:655); `stop` :114-128; close/error handlers :91-104; `reset` :151-155 | `sound:started` :107; `sound:completed` :94; `sound:stopped` :96; `sound:error` | SS `sound` (broadcasts.js:563-565): live. SF snapshot | None | `reset` kills and clears (:152). Restart: pw-play children are not killed at shutdown (server.js:185-198 does not call soundService) |
| Bluetooth devices: paired, connected, names | BlueZ (outside) | `_cachedDeviceStates` address to {connected, paired, name} :51; SS/SF `bluetooth.pairedDevices/connectedDevices` (:437-451) | `_preSeedDeviceCache` :525-541; `_processDevicePropertyChange` :587-620 (D-Bus signals only) | `device:connected/disconnected/paired/unpaired` :363,414,429,603,611 (the command paths emit without updating the cache) | SS `bluetooth` (broadcasts.js:542-543): live while the D-Bus monitor runs. SF snapshot | None (BlueZ keeps pairing) | `reset` empties the cache (:477); `init` re-seeds only if the adapter is up (:59-67) |
| Bluetooth scan and pair in progress | The engine's child processes `_scanProc` :44, `_pairProc` :45 | SS `bluetooth.scanning` | `startScan` :155-231; `stopScan` :245-257; `pairDevice` :300-344; `cleanup` :456-468 | `scan:started` :173; `scan:stopped` :228; `device:discovered` :206 | SS `bluetooth` (live). Discovered devices are not in the payload (EnvironmentRenderer.js:288-291, SR-4) | None | `cleanup`/`reset` |
| Lighting scenes list and active scene | Home Assistant (outside) | `_scenes` :21 (kept on fetch failure :322-326); `_activeScene` :22; SS/SF `lighting` | `getScenes` :299-327 (at `init` :59, `refreshScenes` :357-363); `activateScene` :373-391; `_handleStateChanged` :234-243 (HA WebSocket) | `scene:activated` :240,390; `scenes:refreshed` :362 | SS `lighting` (broadcasts.js:556-557): live. SF snapshot | None | `reset` empties both (:437-438). Not refetched when HA returns |
| Lighting connection (HA reachable) | HA (outside); health word is the engine's | registry `lighting`; SS `lighting.connected` = `isConnected()` :90-95 | `checkConnection` :102-130; WS `auth_ok` :207; WS close :254; `reset` :436 | `health:changed` | Health domain only. `lighting.connected` is not re-pushed on a health change | None | `reset`; `init` |
| Each service's health entry (status, message, lastChecked, door) | serviceHealthRegistry `_services` :43 | SS `health` and SF `serviceHealth` (snapshot copies, :217-223); read by `isHealthy`, `isDormant` and `getStatus` at 31 call sites outside the registry (a `grep -rnE` for those three call names over backend/src, comment lines and the registry file excluded; the count is the `wc -l` of that grep); preflight `serviceHealth` input (preflightService.js:98) | `report` :65-106; `markDormant` :116-149; `clearDormant` :157-179; `reset` :281-292; reporters listed in section 4 | `health:changed` :99,142,173 (status changes only) | SS `health` (broadcasts.js:536-538): live on status change; `lastChecked` and message changes between status changes are not pushed. SF snapshot | None | `reset` downs non-dormant entries and stops revalidation (:281-292); systemReset re-probes and restarts it (systemReset.js:218-298). Restart: all start `down: Not yet checked` (:46-53) |
| Dormant latch, door `profile` | Derived: `dormantServicesFor(manifest, profile)` (endpointServices.js:115-145) | Registry entry `door:'profile'`; cue engine `dormancyDisabledCues` | `dormancyService.apply` :157-181 via `recompute` :188-194 | `health:changed`, `cue:status` | SS `health` and `cueengine` | None; recomputed | Recomputed at boot (app.js:326), new session (sessionService.js:223), system reset (systemReset.js:285). Survives `registry.reset()` (:288-291) |
| Dormant latch, door `operator` | dormancyService `operatorLatches` :41 | Registry entry `door:'operator'` | `setOutOfService` :50-58; `putInService` :65-69. No caller in src (grep, section 4) | none today | none today | Deliberately none (dormancyService.js:11-16) | Cleared by restart; survives system reset in design (systemReset.js:278-283); unreachable today |
| Active installation profile | profileService `activeProfile` :38 (file `PROFILE_PATH` or `config/profiles/aln-full-kit.json`, :31,47-60) | SF `profile` {profileId, forPack} (syncHelpers.js:157); session stamp | `activateProfile` :105-122 (app.js:197); drift warn only (:138-149) | none | SF snapshot only | The file | Frozen for the process; restart to adopt |
| Preflight result | preflightService `last` :58 | `session.metadata.preflight` stamp (sessionService.js:224-226,295,805); `metadata.preflightOverride` (:312) | `evaluate` :83-129 (sessionService.js:225,294,804) | none (no domain push; T4) | Not delivered to GM clients by any event or endpoint in this scope (grep `preflight` in broadcasts.js and syncHelpers.js: none). Reaches clients only through session metadata and the `NO-GO:` ack text (commandExecutor.js:260-265) | Stamp (rows dropped) in the session | `_resetForTesting` only; `last` survives system reset |
| Pre-play hooks | videoQueueService `_prePlayHooks` :28 | none | `registerPrePlayHook` :43-45 (cueEngineWiring.js:71; displayControlService.js:69) | none | none | None | `reset` empties (:1066); re-registered in order by systemReset (:168-194) |
| Child-process supervision state | ProcessMonitor `_proc`, `_failures`, `_restartTimer` (processMonitor.js:47-50) | PID files in `/tmp` (section 3) | `start` :55-157; `stop` :160-173 | `line`, `exited`, `restarted`, `gave-up` | None | PID files | `stop()` |
| Health revalidation timer | registry `_revalidationTimer` :44 | none | `startRevalidation` :233-262 (app.js:333, systemReset.js:291); `stopRevalidation` :267 | none | none | None | Stopped by `reset()` and shutdown (server.js:186) |
| HA container started by us | lightingService `_containerStartedByUs` :24 | none | `_ensureContainerRunning` :451-481; `cleanup` :412-423 | none | none | None | `reset` clears the flag without stopping the container (:439) |

## 3. Outside programs

Evidence for completeness. Command run over the in-scope files (the 38 minus `websocket/broadcasts.js`, which spawns nothing):

```
grep -nE "spawn\(|execFile\(|execFileSync\(|execFileAsync\(|execFileWithStderr\(|exec\(|execSync|axios\.|new WebSocket\(|fetch\(|http\.request|https\.request|_dbusCall\(|_execFile\(|new ProcessMonitor\(|mpd2\.connect|dockerHelper\.|_dockerExec|run\('" <scope files> | grep -v "^\S*:[0-9]*:\s*\(//\|\*\)" | wc -l
```

Result: `77` hits. A separate grep over `websocket/broadcasts.js` (`grep -nE "spawn\(|execFile|exec\(|execSync|axios|WebSocket\(|fetch\(|child_process|dbus|pactl" websocket/broadcasts.js`) matched only comment lines (:378,380,381); that file drives no program itself and reaches `pactl` through `audioRoutingService` calls at :388-428. Each hit maps to an entry below. Hits in `execHelper.js`, `pactlClient.js`, `dockerHelper.js` are the wrappers the entries use. The four `run('xdotool'/'wmctrl', ...)` calls are displayDriver.js:104,289,290,319. Tests were not grepped.

### 3.1 VLC (`cvlc`)

- Start: `ProcessMonitor` spawns `cvlc` with `--no-loop -A pulse --fullscreen --video-on-top --no-video-title-show --no-video-deco --no-osd` plus Pi hardware flags (vlcMprisService.js:51-82,113-122,141). Only if `config.features.vlcSelfSpawn` (default true, config/index.js:98); otherwise it adopts an external player (:111-144). `DISPLAY` defaults to `:0` (:119). Before spawning it logs any existing VLC via `pgrep -a vlc` (:95). Only called when `videoPlayback` is on (app.js:280-292).
- Commands: `dbus-send --session --type=method_call --print-reply --dest=org.mpris.MediaPlayer2.vlc /org/mpris/MediaPlayer2 <method>`, 5 s timeout (mprisPlayerBase.js:67-87). Methods: `OpenUri`, `Play`, `Pause`, `Stop` (`_transport` :125-128), `SetPosition` (vlcMprisService.js:285), `Properties.Get/Set` for `Volume`, `LoopStatus`, `PlaybackStatus`, `Position` (:237,270,305).
- State read: three ways. Parsed text from `dbus-monitor --session --monitor "type='signal',interface='org.freedesktop.DBus.Properties',path='/org/mpris/MediaPlayer2'"` (mprisPlayerBase.js:203-222), fed through `DbusSignalParser`, 100 ms debounce, merged (:252-308), then `_processStateChange` sets `state`, `volume`, `track` (vlcMprisService.js:432-478). Parsed text from `dbus-send` for `PlaybackStatus` (a 15 s resync of `state` only, :158-177) and `Position` (live, :237). Track length and filename come from the signal text by regex (`xesam:url`, `mpris:length`, :488-502).
- Copies and staleness: `state`, `track`, `volume`, `_loopEnabled`, `_rawVolume`. The 15 s resync fixes `state` but never `track` or volume. If the monitor dies or a signal is dropped, `track` stays wrong with no notice. `getStatus()` mixes the cached `state`/`track` with a live `Position` (:231-259). The queue item's reported position is wall-clock arithmetic and is rebased on pause/seek by the engine (videoQueueService.js:537,565,610), never read back from VLC for the GM.
- Exit or restart: VLC exit sets `_ownerBusName = null` and reports `vlc` down (vlcMprisService.js:125-129). The monitor restarts after a fixed 3 s (`backoffMultiplier: 1`, :120-121), waits for D-Bus, re-resolves the owner (:132-139). `ProcessMonitor` gives up after five failures with no output (processMonitor.js:141-144), but VLC writes stderr, which counts as output (:116-121,136-138). `system reset` does not kill VLC (:510-516). A queue item playing when VLC dies ends through the 1 s monitor's thrown error or its fallback timer (videoQueueService.js:417-433,447-452).
- Health: `checkConnection` reads `PlaybackStatus` and reports `healthy` or `down` with "D-Bus connected" or "D-Bus unreachable" (mprisPlayerBase.js:136-177). Also reported healthy by any MPRIS signal that reaches `_processStateChange` while the registry says unhealthy (vlcMprisService.js:436-438). Probed by revalidation (registry :237), `service:check` (commandExecutor.js:886), `_ensureConnection` before every transport (:147-151), systemReset (:266).
- Touches: bus name `org.mpris.MediaPlayer2.vlc`; object path `/org/mpris/MediaPlayer2`; interface `org.mpris.MediaPlayer2.Player`; session bus; PID file `/tmp/aln-pm-vlc.pid` (:117) and `/tmp/aln-pm-vlc-dbus-monitor.pid` (mprisPlayerBase.js:209, label lower-cased); X display `:0`; video files `backend/public/videos/<file>` as `file://` URIs (vlcMprisService.js:191-200); `/proc/device-tree/model` read (:75); PipeWire sink-input named VLC (audioRoutingService.js:36).

### 3.2 Kiosk Chromium (scoreboard) with `xdotool`, `wmctrl`, `pkill`

- Start: `spawn(CHROMIUM_BIN or 'chromium-browser', ['--kiosk', ... SCOREBOARD_URL])`, `detached:false`, `stdio:'ignore'` (displayDriver.js:165-184), launched once from `displayControlService.init` (:91) or on first `showScoreboard` (:278-280). Before launch it kills an orphan by PID file (`process.kill(pid,'SIGKILL')` after checking `/proc/<pid>/cmdline`, :127-135) and then `pkill -9 -f 'chromium.*--kiosk'` (:147).
- Commands: window control by `xdotool search --name <marker>`, `xdotool windowactivate --sync`, `wmctrl -i -r <id> -b add,fullscreen`, `xdotool windowminimize` (:104,289,290,319), 5 s timeout, `DISPLAY` from env. The window id is looked up fresh each time (:102-115).
- State read: none from the browser. The driver tracks `visible`, `launched` and the process handle itself (:34-49). The page is a normal websocket client (URL `https://<first non-internal IPv4>:<PORT>/scoreboard?kiosk=true&deviceId=SCOREBOARD_HDMI`, :77); its own data arrives by the same `service:state`/`sync:full` rooms (out of scope).
- Copies and staleness: `visible` is a copy of window state. If someone minimises or closes the window by hand, `visible` is wrong until the next show/hide or process exit. `showScoreboard()` returning false leaves `visible` unset, but `displayControlService` still reports SCOREBOARD (displayControlService.js:233-244).
- Exit or restart: the `exit` handler reports `display` down if visible, healthy if it closed cleanly while hidden, down if it crashed while hidden (displayDriver.js:192-224); nothing relaunches until the next `showScoreboard`. Shutdown: SIGTERM then SIGKILL (:399-437, server.js:197-198).
- Health: reported by the driver on launch, exit, and `probe()` (read-only, :359-379). Not on the revalidation timer (serviceHealthRegistry.js:29-31,243). `probe()` is reached only through `service:check` (commandExecutor.js:899).
- Touches: X display `:0`; window title marker `ALN-SCOREBOARD` (`config.display.scoreboardWindowMarker`, config/index.js:114); PID file `/tmp/aln-pm-scoreboard-chromium.pid`; the orchestrator's own HTTPS port; `--ignore-certificate-errors` (:171).

### 3.3 `dbus-monitor` and `dbus-send` on the session bus

Covered with VLC (3.1): `dbus-monitor --session` (mprisPlayerBase.js:205-210), `dbus-send` for calls (:86) and for `GetNameOwner` on `org.freedesktop.DBus` to learn VLC's unique bus name (:326-330). The unique name filters out other players' signals (:257-265). Until the owner is resolved, all MPRIS signals are processed (:256). `gave-up` has no listener.

### 3.4 `dbus-monitor` on the system bus (BlueZ)

- Start: `ProcessMonitor` runs `dbus-monitor --system --monitor "type='signal',sender='org.bluez',interface='org.freedesktop.DBus.Properties',member='PropertiesChanged'"` (bluetoothService.js:495-514), only if the adapter was available at `init` (:59-67). PID file `/tmp/aln-pm-bluez-dbus-monitor.pid` (:501).
- Commands: none; read-only monitor.
- State read: parsed text through `DbusSignalParser`; `Device1` property changes, 500 ms debounce per device, delta on `Connected` and `Paired` (:565-620).
- Copies and staleness: `_cachedDeviceStates`. Seeded once by `bluetoothctl devices Paired` plus `info` per device (:525-541, :844-882). Command paths (`connectDevice`, `disconnectDevice`, `unpairDevice`) emit events but do not update the cache (:351-430), so the cache moves only on the signal. If the monitor dies, nothing notices.
- Exit or restart: `ProcessMonitor` restarts after a 5 s base delay, multiplied by 2 for each consecutive failure with no output (processMonitor.js:136-155), and gives up after five such failures; no `exited`/`gave-up` listener.
- Health: not derived from this monitor. See 3.8.

### 3.5 MPD (`mpd`) and the `mpd2` client

- Start: `musicService.spawnMpd()` writes `/tmp/aln-mpd.conf` (`buildMpdConfig`) and runs `ProcessMonitor` with `mpd --no-daemon /tmp/aln-mpd.conf`, PID file `/tmp/aln-pm-mpd.pid` (musicService.js:565-620). Skipped when `ENABLE_MUSIC_PLAYBACK=false` (app.js:226). After a fixed 1 s sleep the client connects (`mpd2.connect({path:'/tmp/aln-mpd.sock'})`, :101,181).
- Commands: MPD protocol text over the Unix socket: `play`, `pause 1`, `stop`, `next`, `previous`, `setvol N`, `seekcur N`, `random N`, `repeat N`, `crossfade N`, `clear`, `add "<file>"`, `listallinfo`, `ping` (musicService.js:285-389, 194, 404). Each round trip is capped at 3 s; on timeout the client is dropped and health goes down (:245-261).
- State read: parsed text (`status`, `currentsong` as `key: value` lines, :465-473, 488-531) triggered by MPD `idle` events `system-player` and `system-mixer` (:456-457), and by a re-read after each command (:276-283). `options` (random/repeat) and `playlist` subsystems are not subscribed (:450-455).
- Copies and staleness: `state`, `volume`, `track`, `playlist` (partly), `_pausedByGameClock`. Not read at `init`/reconnect (:95-108,176-191). If the idle stream desyncs, commands still refresh (comment :263-275). Shuffle and loop live only in the engine's `playlist` object.
- Exit or restart: `exited` drops `_mpd` and reports `music` down (:609-618); `ProcessMonitor` restarts MPD (5 s base, doubling per empty failure); the 15 s `checkConnection` reconnects the client (:176-191). Shutdown: `cleanup()` then `stopMpd()` (server.js:195-196). `mpdConfigBuilder` sets a state file and `restore_paused "yes"` (mpdConfigBuilder.js:38,52), so MPD itself restores some state after restart; the engine does not read it back.
- Health: `ping` through `_setConnected` (musicService.js:193-211, 230-233). Probed by revalidation and `service:check`.
- Touches: socket `/tmp/aln-mpd.sock`; config `/tmp/aln-mpd.conf`; MPD files `/tmp/aln-mpd.db/.log/.state`, `/tmp/aln-mpd-internal.pid`, `/tmp/aln-mpd-playlists` (musicService.js:589-598, mpdConfigBuilder.js:19-25); music dir `backend/public/music` (app.js:219); playlist file `backend/config/music-playlists.json` (app.js:224); PipeWire output named `aln-music` (mpdConfigBuilder.js:44).

### 3.6 PipeWire / PulseAudio through `pactl` (plus `pgrep`/`pkill`)

- Start: not started by the engine. `pactl subscribe` is a long-lived child under `ProcessMonitor`, PID file `/tmp/aln-pm-pactl-subscribe.pid` (audioRoutingService.js:784-833). At `init` it first runs `pgrep -f 'pactl subscribe'` and `pkill -f 'pactl subscribe'` for stale monitors (:597-608).
- Commands (5 s timeout, pactlClient.js:29): `pactl info` (:158), `pactl list sinks short` (:215), `pactl list sink-inputs` (:444,567,877), `pactl move-sink-input <idx> <sink>` (:460), `pactl set-sink-input-volume <idx> N%` (:509,909), `pactl list cards short` (:938), `pactl set-card-profile <card> output:hdmi-stereo` (:948); and from bluetoothService `pactl list sinks short`, `pactl list cards` (bluetoothService.js:92,376).
- State read: parsed text. Tab-delimited sink list (pactlClient.js:51-76); `Event 'x' on sink #N` lines from `subscribe` (:85-94); sink-input sections matched by `application.name`, `application.process.binary`, `media.name` (:112-181); volume by regex on the first `Volume:` percent (:190-207).
- Copies and staleness: sink cache with 5 s TTL and invalidate-on-event; sink-input registry filled from `new` events and emptied by `remove` events (audioRoutingService.js:818-823). If `subscribe` misses a `remove`, the registry keeps a dead index and the fast path returns it (:431-440) without verifying. Sinks present before start are not in the registry; the fallback poll finds them (:443-450). The persisted volume is re-applied to each new sink-input (:905-919). Routing is applied by command and on `video:started` (broadcasts.js:392) and when a Bluetooth sink appears while the video route is bluetooth (audioRoutingService.js:1104-1131); music and sound routes are never re-applied on a restart of MPD or a new `pw-play` (inference from callers: `applyRouting` is called only for `video`).
- Exit or restart: `ProcessMonitor` restarts `pactl subscribe` (5 s base, doubling per empty failure). The sink registry and cache are not rebuilt on restart. `cleanup()` stops the monitor (:170-178).
- Health: `pactl info` succeeds = `healthy` "PipeWire reachable" (audioRoutingService.js:156-165). It says nothing about whether an HDMI sink exists.
- Touches: PipeWire/PulseAudio socket of the orchestrator's user; WirePlumber drop-in `/etc/wireplumber/main.lua.d/51-aln-vlc-no-restore.lua` (checked for existence only, :617-630); sinks `bluez_output.*` and names containing `hdmi` (classification :246-254); sink-input identities `VLC`, `aln-music`, `pw-play` (:35-39).

### 3.7 `pw-play`

- Start: `spawn('pw-play', ['--target', sink, '--volume', v/100, file], {stdio:['ignore','pipe','pipe']})` per sound (soundService.js:70-75). Existence check by `which pw-play` (:44).
- Commands: none after start; stop is `process.kill()` (SIGTERM) (:118,125).
- State read: process `close` code (0 completed; null killed; else error), `error` event (:91-104). No output parsing.
- Copies and staleness: `processes` Map keyed by pid; accurate as long as `close` fires. A spawn failure with no pid is never stored (:80-82).
- Exit or restart: no restart. Orchestrator shutdown does not kill sounds (server.js:185-198 has no `soundService` call).
- Health: `which pw-play` only (soundService.js:42-51). A failing player or a dead PipeWire does not change `sound` health. The `audio` health covers PipeWire.
- Touches: `backend/public/audio/<file>` (:21,64); sink-input name `pw-play`.

### 3.8 BlueZ through `bluetoothctl`

- Start: one-shot `execFile` calls (timeout `connectTimeout`, 10 s default, bluetoothService.js:834-836) and two long-lived spawns: `bluetoothctl --timeout N scan on` (:165-170) and an interactive `bluetoothctl --agent NoInputNoOutput` for scan, pair, trust (:699).
- Commands: `show`, `devices Paired/Connected`, `info <mac>`, `connect`, `disconnect`, `remove`; stdin lines `scan on`, `pair <mac>`, `trust <mac>`, `scan off`, `exit` (:117,284,326,355,411,426,811,767,775,730). MAC validated by regex (:21,821-825).
- State read: parsed text. Scan lines by regex (:33,187-209); pairing by matching phrases ("Discovery started", "Pairing successful", "AlreadyExists", "Failed to pair", "trust succeeded", :748-795); adapter by `Powered: yes` (:118). A2DP check from `pactl list cards` (:373-399).
- Copies and staleness: see 3.4.
- Exit or restart: scan and pair children are killed by `cleanup`; no restart. Pair has a hard timeout of connectTimeout+12 s (:696,707-714).
- Health: `bluetoothctl show` shows `Powered: yes`; if devices are connected it also checks `pactl list sinks short` for `bluez_output`, but a connected device with no sink still reports `healthy` (a log warn only, :95-103).
- Touches: system bus `org.bluez`; adapter; PipeWire BT sinks.

### 3.9 Home Assistant (HTTP and WebSocket)

- Start: external. The engine may start the Docker container (3.10) when `HA_DOCKER_MANAGE` is not false (lightingService.js:451-481). Skipped without a token or with `LIGHTING_ENABLED=false` (:42-50).
- Commands: `GET <HA>/api/` (probe, :110), `GET <HA>/api/states` (scene list, :307), `POST <HA>/api/services/scene/turn_on {entity_id}` (:382), all with a Bearer token and a 5 s timeout. WebSocket to `<HA>/api/websocket`: `auth`, `subscribe_events state_changed` (:158-209).
- State read: JSON. Scene list filtered to `scene.*` entities (:312-317). The WebSocket sets `_activeScene` when a `scene.*` entity goes to `scening` (:237-241). A scene activated outside the engine is seen only through that event.
- Copies and staleness: `_scenes` (refetched only at init and on `lighting:scenes:refresh`), `_activeScene`. Not refetched when HA reconnects.
- Exit or restart: WebSocket close reports `down` and retries at 5 s times attempt, capped 30 s (:249-266). `auth_invalid` stops reconnecting for good (:211-215). An HTTP reconnect poll runs every 30 s while unhealthy (:500-507).
- Health: HTTP probe (`healthy` "Connected to Home Assistant" or `down` "Home Assistant unreachable", :114-116), WebSocket `auth_ok` (healthy, :207), WebSocket close (down, :254). Probed by revalidation (registry :242) and `service:check`.
- Touches: `HOME_ASSISTANT_URL` (default `http://localhost:8123`), `HOME_ASSISTANT_TOKEN` (config/index.js:139-140).

### 3.10 Docker

- Start: `docker ps -a --filter name=^<name>$`, `docker ps --filter ... status=running`, `docker start <name>`, `docker stop -t N <name>` through `execFile`, 30 s timeout (dockerHelper.js:19-93). Container name `HA_DOCKER_CONTAINER` (default `homeassistant`).
- State read: stdout non-empty means exists or running. No Docker health event stream.
- Exit or restart: the engine stops the container at shutdown only if it started it (`_containerStartedByUs`, lightingService.js:412-423). Skipped when `NODE_ENV=test` (:452).
- Health: none of its own; failures are warned and the lighting probe decides.

### 3.11 Reads of the machine that are not programs the engine drives

`/proc/device-tree/model` (vlcMprisService.js:75), `/proc/<pid>/cmdline` (processMonitor.js:185, displayDriver.js:130), `/usr/share/zoneinfo` (timezone.js:25), `fs.watch` on `config/music-playlists.json` (musicService.js:150), `fs.promises.access` on the WirePlumber rule (audioRoutingService.js:620). None feed health.

## 4. Health and state

### 4.1 The nine services

Registry ids: `vlc, music, sound, bluetooth, audio, lighting, gameclock, cueengine, display` (serviceHealthRegistry.js:32). All nine appear below.

| Service | Health reporters (file:line) | Probes | Health path to the GM | Own state path (service domain) | Does a health change push the own domain? |
|---|---|---|---|---|---|
| vlc | `_setConnected` mprisPlayerBase.js:136-141 (from `checkConnection` :158-177); exit handler vlcMprisService.js:128; MPRIS signal recovery :436-438; `reset` mprisPlayerBase.js:384 | Revalidation :237; `service:check` commandExecutor.js:886; `_ensureConnection` mprisPlayerBase.js:147-151; systemReset.js:266 | `health` domain (broadcasts.js:536-538); SF `serviceHealth` (syncHelpers.js:102) | `video` domain, built by `videoQueueService.getState()` (videoQueueService.js:645-690); `connected` is `registry.isHealthy('vlc')` read at push time (mprisPlayerBase.js:187). Pushed on VLC `state:changed`, video lifecycle, queue events (broadcasts.js:511-533) | No. No listener ties `health:changed` to the video domain. `video.connected` is refreshed by the next video event or by SF |
| music | `_setConnected` musicService.js:230-233 from init :105,107, `checkConnection` :184,195,208, `_send` timeout :256, MPD exit :617 | Revalidation :238; `service:check` commandExecutor.js:887 | `health` domain; SF | `music` domain via `buildMusicState` (syncHelpers.js:225-246), `connected` is the private flag `this.connected` (musicService.js:86). Pushed on playback/volume/track/position/playlist/playlists:reloaded (broadcasts.js:505) | No. `_setConnected` emits nothing (musicService.js:230-233) |
| sound | `checkHealth` soundService.js:45,48; `reset` :154 | Revalidation :239; `service:check` commandExecutor.js:891; systemReset.js:226 | `health` domain; SF | `sound` domain `{playing[]}` (soundService.js:134-142); no `connected` field. Pushed on sound events (broadcasts.js:563) | Not applicable: no health field in the domain |
| bluetooth | `checkHealth` bluetoothService.js:77,86,98,105; `reset` :478 | Revalidation :240 (`checkHealth`); `service:check` commandExecutor.js:889 calls `isAvailable()`, which does not report; systemReset via `init` (systemReset.js:245) | `health` domain; SF | `bluetooth` domain; `available` is `registry.isHealthy('bluetooth')` (bluetoothService.js:446). Pushed on device and scan events (broadcasts.js:542-543) | No |
| audio | `checkHealth` audioRoutingService.js:159,162; `reset` :196 | Revalidation :241; `service:check` commandExecutor.js:890; `init` :149 | `health` domain; SF | `audio` domain (`getState()` :310-322); no `connected` field. Pushed on routing, sink, ducking events (broadcasts.js:549) | Not applicable |
| lighting | `checkConnection` lightingService.js:114,116; WS `auth_ok` :207; WS close :254; `reset` :436. `checkConnection` returns without reporting when the token is empty (:103-105) | Revalidation :242; reconnect poll 30 s :500-507; `service:check` commandExecutor.js:888 | `health` domain; SF | `lighting` domain; `connected` is `isConnected()` (lightingService.js:90-95, 335). Pushed on `scene:activated` and `scenes:refreshed` only (broadcasts.js:556) | No |
| gameclock | gameClockService.js:17 (constructor), :279 (`reset`); systemReset.js:221 | None (registry comment :243). `service:check` returns `true` without reporting (commandExecutor.js:892) | `health` domain; SF | `gameclock` domain (`getState()` :99-113); no health field | Not applicable |
| cueengine | `loadCues` cueEngineService.js:161; `checkHealth` :227-229; `reset` :1168 | Not in revalidation. `service:check` commandExecutor.js:893 | `health` domain; SF | `cueengine` domain (`getState()` :169-175); no health field | Not applicable |
| display | displayDriver.js:208,210,212 (exit), :240,247 (launch), :361,367,373,377 (`probe`); displayControlService.js:102 (only when `videoPlayback` is off, unreachable at boot, see Conclusion 10) | None on a timer. `service:check` commandExecutor.js:899 | `health` domain; SF | No service domain. Mode goes by the `display:mode` event (broadcasts.js:462-467) and SF `displayStatus` | No |

Findings from the table:

- The only listeners of `health:changed` in the backend and in ALNScanner/src (grep below) are broadcasts.js:536 and videoQueueService.js:31 (which emits `video:recoverable` when `vlc` turns healthy and a video is held). No service pushes its own domain on a health change.
- `report()` skips the emit when only the message changes (serviceHealthRegistry.js:97), so pushed `health` entries keep an old `message` and `lastChecked` until the status moves or an SF refresh.
- Dormant entries keep a message from `doorWording` (dormancyService.js:162) and the `door`.
- `registry.reset()` is called by `performSystemReset` (systemReset.js:132) after services reset. It downs every non-dormant entry including `display` and `music`. Recovery: `gameclock` (systemReset.js:221), `sound` (:226), `cueengine` via `loadCues` (:237), `bluetooth` (:245), `audio` (:252), `lighting` (:259), `vlc` (:266), `music` only by the next 15 s revalidation tick, `display` by nothing (Conclusion 5).

### 4.2 Private connection or health flags outside the registry

Grep:

```
grep -nE "this\.(_?connected|_?healthy|_?available|_?alive|_?ready|_?online|_?up|_?down)\b|^\s*(let|var) (connected|healthy|available|visible|launched)\b|\bvisible =|\blaunched =" services/*.js services/cue/*.js services/audio/*.js utils/*.js
```

Result: `musicService.js:73,86,120,172,215,231` (flag `connected`), and `utils/displayDriver.js:35,49,189,215,216,248,291,296,314,320,325,429` (`visible`, `launched`). Nothing else matches. Related private state that is a connection fact without being called one: `lightingService._ws` / `_wsStopped` (lightingService.js:27-31), `bluetoothService._deviceMonitor` and `_cachedDeviceStates` (:49-51), `audioRoutingService._sinkMonitor` (:68), `displayControlService._initialized` (:36). Root CLAUDE.md names `musicService.js:73` and `:231` as the exception; the grep confirms it and adds the kiosk driver, which holds process facts rather than a health flag. The musicService flag disagrees with the registry when a dormant latch drops the report: `_setConnected(true)` sets `connected = true` and the registry ignores the `healthy` report (serviceHealthRegistry.js:81-87), so `music.connected` reads true while `health.music` reads dormant.

### 4.3 Callers of the dormancy setters, and listeners of `gave-up`

```
grep -rn "setOutOfService\|putInService\|dormancyService\|preflightService\|\.recompute()" --include=*.js backend/src
```

Hits outside the two modules: `sessionService.js:223` (`recompute`), `:225,294,804` (`evaluate`), `systemReset.js:285`, `app.js:326`. No call to `setOutOfService` or `putInService`.

```
grep -rn "out-of-service\|service:restart\|preflight:run" --include=*.js backend/src
```

Hits: commandExecutor.js:98-101 (field table), grants.js:80-83 (comments). No `case` in the executor switch.

```
grep -rn "gave-up\|'restarted'\|'exited'" --include=*.js backend/src | grep -v utils/processMonitor.js
```

Hits: `vlcMprisService.js:125` (`exited`), `:132` (`restarted`), `musicService.js:609` (`exited`). No `gave-up` listener.

```
grep -rn "health:changed" backend/src ALNScanner/src --include=*.js
```

Hits: videoQueueService.js:31; serviceHealthRegistry.js:99,142,173 (emitters); broadcasts.js:536.

### 4.4 Probe asymmetry

The 15 s revalidation covers six ids (vlc, music, sound, bluetooth, audio, lighting); `service:check` covers eight; the two lists use different functions for `bluetooth` and call `isAvailable()` (no report) from `service:check`. Neither covers `display` automatically. Startup: revalidation starts after the dormancy pass (app.js:333-340); each call checks `isDormant` first (serviceHealthRegistry.js:251).

## 5. commandExecutor

### 5.1 One dispatch

- `executeCommand({action, payload, source, trigger, deviceId, deviceType, actor})` (commandExecutor.js:120-985) is the only place a show action runs. Callers: adminEvents.js:108-115 for `gm:command` (`source:'gm'`, `actor` from the socket's verified token), and the cue engine through two call sites: simple cues in `fireCue` (cueEngineService.js:783-788) and timeline entries in `TimelineRuntime.fireEntries` (timelineRuntime.js:243-248), both with `source:'cue'` and `trigger:'cue:<id>'`. `scoreboardControlService` and `systemReset` do not call it. `system:reset` is not dispatched here: the executor throws if asked (commandExecutor.js:570-573) and adminEvents.js:53-105 handles it with a mutex.
- Order of checks inside `executeCommand`: (1) off-vocabulary refusal for non-`gm` sources, only `CUE_ACTIONS` allowed (:136-143; the set is in cueValidation.js:91-115 and excludes `bluetooth:*`, `cue:*`, `held:*`, `service:*`, `session:*`, `display:status`, `lighting:scenes:refresh`); (2) operator-floor check for `gm` source (:152-163, grants.js:61-103); (3) lighting role to `sceneId` normalisation (:172-184, profile binding then pack fallback, :997-1011); (4) required fields (:187-191); (5) dormant gate (:200-207); (6) health gate (:208-215); (7) the `switch` (:227-969).
- Result shape `{success, message, data?, source}`. Exceptions are caught and returned as `success:false` (:977-984). A cue treats `success:false` as a failed command and emits `cue:error` (cueEngineService.js:793-798; timelineRuntime.js:253-258). adminEvents sends back `{action, success, message}` only; `data` (including `service:check` per-service results and `display:status`) never reaches the client (adminEvents.js:117-122).
- Differences by source: only `gm` goes through the operator floor; only `gm` fires `cue:fire` with `source:'gm'` and trigger `manual` (:677-678). `deviceId` is undefined for cue source, so `video:queue:add` from a cue queues with `requestedBy` "ADMIN" (videoQueueService.js:773).

### 5.2 `SERVICE_DEPENDENCIES` (commandExecutor.js:38-77)

| Service | Actions gated on it |
|---|---|
| vlc | `video:play`, `video:pause`, `video:stop`, `video:skip`, `video:seek`, `video:queue:add`, `display:idle-loop`, `display:return-to-video` |
| display | `display:scoreboard` |
| sound | `sound:play`, `sound:stop` |
| lighting | `lighting:scene:activate`, `lighting:scenes:refresh` |
| bluetooth | `bluetooth:pair`, `bluetooth:unpair`, `bluetooth:connect`, `bluetooth:disconnect`, `bluetooth:scan:start`, `bluetooth:scan:stop` |
| audio | `audio:route:set`, `audio:volume:set` |
| music | `music:play`, `music:pause`, `music:stop`, `music:next`, `music:previous`, `music:setVolume`, `music:setShuffle`, `music:setLoop`, `music:loadPlaylist`, `music:seek` |

Ungated by design (:45-46, :49-51, :54): `video:queue:reorder`, `video:queue:clear`, `display:status`, `service:check`. Ungated by omission: all `session:*`, `score:*`, `transaction:*`, `scoreboard:page:*`, `cue:*`, `held:*`. `gameclock` and `cueengine` are not dependencies of any action. The same map drives `cueEngineService.applyDormancy` and the `fireCue` hold decision through `_serviceFor` (cueEngineService.js:323-327,358,738).

The gate treats dormant first: `"<service> is <door wording>"` (:200-207); then `healthy` only: `"<service> is <status>: <message>"` (:208-215). The same dormant-first order appears in `fireCue` (a dormant dependency is skipped, not held, cueEngineService.js:738-743), `releaseCue` (:1046-1048), `canAcceptVideo` and `processQueue` (videoQueueService.js:107,889). `display:status` returns the `displayControlService.getStatus()` mode.

### 5.3 `validateCommand` (commandExecutor.js:1013-1059)

Checks (1) `isHealthy(requiredService)` and pushes `{type:'service', status}`; it does not check dormancy, so a dormant service appears as an error of type `service` with status `dormant`; (2) resource existence for five actions: `sound:play` (`soundService.fileExists`, whose guard differs from `play()`, soundService.js:144-149 vs :58), `video:queue:add` (`videoFileExists`, basename in `backend/public/videos`, videoQueueService.js:907-911), `lighting:scene:activate` (cached `_scenes`, role normalised silently, :1032-1047), `audio:route:set` (`sinkExists`, cache only, audioRoutingService.js:236-239), `music:loadPlaylist` (`getPlaylist`). It has no caller in `backend/src` (grep). preflightService.js:17-19 says the resource arm is T4's. backend/CLAUDE.md describes it as used for pre-show verification; the code does not call it.

### 5.4 `service:check` probes (commandExecutor.js:884-950)

Table `HEALTH_CHECKS`: `vlc` -> `vlcMprisService.checkConnection()`; `music` -> `musicService.checkConnection()`; `lighting` -> `lightingService.checkConnection()`; `bluetooth` -> `bluetoothService.isAvailable()`; `audio` -> `audioRoutingService.checkHealth()`; `sound` -> `soundService.checkHealth()`; `gameclock` -> `true`; `cueengine` -> `cueEngineService.checkHealth()`; `display` -> `displayDriver.probe()`. Behaviour:

- Dormant services are not probed; the message names the door and "not probed" (:907-914, :933-936).
- Every check except `bluetooth` and `gameclock` reports to the registry as a side effect. The `bluetooth` and `gameclock` probes return a boolean only, so the registry entry (and the pushed health row) does not move.
- `lighting.checkConnection()` returns `undefined` when there is no token (lightingService.js:103-105), which reads as `down` in the message.
- `music.checkConnection()` returns `false` without reporting when the first connect fails (musicService.js:186-187).
- The reply to the GM is the message only (`Health check: <id> = healthy/down`, or `N/M services healthy`).

### 5.5 Held-item commands and dispatch by id prefix

`held:release`, `held:discard` route by id prefix: `held-cue-` to the cue engine, `held-video-` to the video queue, else "Unknown held item type" (:753-766,775-781). The prefix is the wire format, kept by `HeldItemsStore.holdItem` (heldItemsStore.js:78-83) and hand-built in `_holdVideo` (videoQueueService.js:917). `held:release-all` runs two plain loops, cue holds then video holds, with no try/catch around either call (:793-799). `releaseCue` throws when a blocking service is still down (cueEngineService.js:1046-1051) and `releaseHeld` throws when VLC is down (videoQueueService.js:944-946); either throw leaves the command at that item and returns `success:false` through the outer catch (:977-984). The F-SHOW-16 try-all behaviour lives in `HeldItemsStore.releaseAll`/`discardAll` (heldItemsStore.js:180-209), which have no caller (`grep -rn "releaseAll\|discardAll" backend/src` outside the store: no hits). Inference: with one held cue whose service is still down, "Release All" stops at it and later items stay held. `held:discard-all` loops both lists without release checks (:807-818).

### 5.6 Cue-only differences in the cue engine around the executor

- `fireCue` runs dormancy, disabled, cycle, already-running, depth, and service-health checks before the executor sees a command (cueEngineService.js:686-758). The executor repeats the health and dormancy gate per command, so a cue whose service goes down mid-timeline fails individual entries with `cue:error` rather than holding.
- `cue:fire` called through the executor with `source:'gm'` returns three outcomes: held (success with a "Cue held" message), refused (failure with the reason), fired (:683-693).

## 6. Questions with several answers

Format per question: the places that answer, then whether they can disagree.

### 6.1 Is VLC usable?

| Where | Answer | file:line |
|---|---|---|
| Registry entry `vlc` | `healthy` / `down` / `dormant` | serviceHealthRegistry.js:193,201 |
| `vlcService.isConnected()` | registry healthy, dormant counts as false | vlcMprisService.js:422-424 |
| `vlcService.getState().connected` | registry healthy | mprisPlayerBase.js:185-192 |
| `videoQueueService.canAcceptVideo()` | `vlc_dormant` / `vlc_down` / `video_busy` / available | videoQueueService.js:882-905 |
| `processQueue` | dormant fails the item, unhealthy holds it | videoQueueService.js:107-125 |
| `releaseHeld` | healthy only | videoQueueService.js:944 |
| Executor gate | dormant message, then not-healthy message | commandExecutor.js:200-215 |
| `fireCue` | dormant skipped, unhealthy holds the cue | cueEngineService.js:738-743 |
| `displayControlService` | `vlcService.isConnected()` before idle-loop, stop, playVideo | displayControlService.js:171,228,340 |
| VLC itself | answers a D-Bus `Get PlaybackStatus` | mprisPlayerBase.js:160 |
| Preflight row `service:vlc` | verdict from the registry snapshot | resolution.js:164-192, preflightService.js:98 |
| Scanner HTTP | `409 rejected` mapped from `canAcceptVideo` | scanRoutes.js:97-103 |

Can they disagree? Every in-engine answer reads one registry entry, so they agree with each other at a moment in time. They disagree with VLC itself for up to 15 s (the probe interval) after VLC dies or returns, and for longer if no probe runs (`vlc` recovers earlier through any MPRIS signal, vlcMprisService.js:436-438, including a signal from another player when `_ownerBusName` is null, inference). Second disagreement: the registry says `healthy` while the cached `track`/`state` are stale after a dropped signal. A third: `isConnected()` is false for dormant and for down, so a dormant VLC and a dead VLC are indistinguishable to `displayControlService` (it skips the VLC call and still flips the mode).

### 6.2 Is the display healthy?

| Where | Answer | file:line |
|---|---|---|
| Registry entry `display` | reported by the kiosk driver only | displayDriver.js:208-247,361-377 |
| `displayDriver.probe()` | process handle, `visible` flag, host `videoPlayback` | displayDriver.js:359-379 |
| Executor gate for `display:scoreboard` | registry `display` | commandExecutor.js:52,200-215 |
| `displayControlService.getStatus().currentMode` | engine intent | displayControlService.js:121-128 |
| `showScoreboard()` return value | window found and raised | displayDriver.js:278-299 |
| Registry `vlc` | gates `display:idle-loop` and `display:return-to-video` | commandExecutor.js:47,53 |
| `displayDriver.isScoreboardVisible()` | `visible` flag (no reader found outside the driver and `getStatus`) | displayDriver.js:334-336 |
| The physical screen | what the GM can see | (outside) |

Can they disagree? Yes, in at least four ways. (a) `showScoreboard()` false leaves the driver's `visible` false while the mode is SCOREBOARD and the ack is success (displayControlService.js:233-244). (b) After a system reset `display` is `down: Reset` with a live, correct kiosk (Conclusion 5). (c) A kiosk that closed cleanly while hidden reports `healthy` with no process (displayDriver.js:209-210, 370-375). (d) The window state is a flag; a hand-minimised window is invisible to the engine.

### 6.3 Is equipment X installed?

| Where | Answer | file:line |
|---|---|---|
| Profile file `endpoints.<family>` | the declaration | profileService.js:129-154 |
| `familyInstalled(profile, familyId)` / `isInstalled` | per-family rule (`installed:true`; any sink `installed:true`; `count>=1`; `expected===true`) | endpointServices.js:65-68,92-104 |
| `dormantServicesFor` | services of uninstalled families, plus `audio` when no sink and no display | endpointServices.js:115-145 |
| `resolve()` endpoint verdict | `runs` / `no-go` / `dormant` | resolution.js:92-113 |
| `resolve()` lighting-role and surface-channel verdicts | follow the family | resolution.js:61-91,135-151 |
| Registry dormant latch with `door` | the applied decision | dormancyService.js:157-170, serviceHealthRegistry.js:116-149 |
| Cue engine `dormancyDisabledCues` | cues silenced by it | cueEngineService.js:347-405 |
| Config and env | `LIGHTING_ENABLED`, `HOME_ASSISTANT_TOKEN`, `ENABLE_VIDEO_PLAYBACK`, `ENABLE_MUSIC_PLAYBACK`, `VLC_SELF_SPAWN` | config/index.js:91-98,138-140; app.js:226,280 |
| Probe result | the equipment answers or does not | section 4 |

Can they disagree? Yes. The profile says what is installed; env flags say what the host will run; probes say what answers. Nothing reconciles them. Cases: profile says lighting installed but token empty gives `down: Not yet checked` forever (Conclusion 10). Profile says lighting not installed but HA is up gives grey in the registry while `lightingService` still connects, subscribes and pushes `lighting` domain changes. A pack that declares no `hardware.endpoints` for a family never marks it dormant regardless of profile (endpointServices.js:127-134, inference on pack content). Profile read happens once at boot and is frozen; an edit warns once and changes nothing (profileService.js:138-149). `bluetooth` is never profile-dormant (endpointServices.js:17-21). Operator door can name any of the nine ids but cannot be set (Conclusion 8). `resolve()` for a `service` need quotes the registry snapshot only when `live` is true (preflightService.js:98).

### 6.4 Is a video playing?

| Where | Answer | file:line |
|---|---|---|
| `videoQueueService.isPlaying()` | `currentItem.status === 'playing'` | videoQueueService.js:969-971 |
| `videoQueueService.getState().status` | `idle` / `loading` / `playing` / `paused` / `error` | videoQueueService.js:645-675 |
| `getCurrentVideo()` | null unless `playing` (paused returns null) | videoQueueService.js:977-991 |
| `canAcceptVideo()` | `video_busy` only while `isPlaying()` | videoQueueService.js:901-903 |
| `displayControlService.currentMode === 'VIDEO'` | engine intent | displayControlService.js:31 |
| `displayControlService.returnToVideo` check | `currentItem.isPlaying()` | displayControlService.js:278 |
| VLC `state` (cached) | `playing` also during the idle loop | vlcMprisService.js:441-444; idle loop :316-363 |
| VLC `PlaybackStatus` (live) | the player's own | mprisPlayerBase.js:160 |
| Cue engine conflict check | `isPlaying()` | cueEngineService.js:844 |
| Scan response | `videoPlaying` from `isPlaying()` | transactionService.js:517-523 |
| Timeline runtime | `capturedVideoTokenId` plus `driveMode` per cue | timelineRuntime.js:231-238,366 |
| `processQueue` guard | `currentItem.isPlaying()` | videoQueueService.js:90 |
| `addToQueue` guard | `!currentItem` | videoQueueService.js:71 |

Can they disagree? Yes. (a) Idle loop: VLC `state` is `playing`, the queue is idle. (b) Paused video: `isPlaying()` false, `getCurrentVideo()` null, `canAcceptVideo` available, cue conflict check clear, but `status` is `paused` and the mode is VIDEO. (c) `clearQueue()` on a playing item nulls `currentItem` and does not stop VLC (videoQueueService.js:842-875): the engine says idle while VLC still plays; `video:idle` then triggers `returnToIdleLoop`, which replaces the file (the `video:idle` listener, displayControlService.js:59-61, runs `_handleVideoComplete` :370-398 and then `_doSetIdleLoop` :158-188). (d) `processQueue` while a video is paused: `isPlaying()` is false so it proceeds to start the next pending item and overwrites `currentItem` (`playVideo` :159-160); `addToQueue` avoids this by testing `!currentItem`, but `releaseHeld` (:951) and the post-failure retry (:141,286) call `processQueue` directly (inference). (e) Position: the GM's progress is wall-clock arithmetic, VLC's is its own.

### 6.5 Is a token claimed? (scope note)

Not in this scope (claims live in the transaction and session services). The only show-control touch is that a GM scan never triggers video (root CLAUDE.md), and the video path is gated by `canAcceptVideo` above.

### 6.6 Is a cue enabled / will it fire?

| Where | Answer | file:line |
|---|---|---|
| `isCueDisabled(cueId)` | any of three sets | cueEngineService.js:191-195 |
| `disabledByOf(cueId)` | `dormant` > `gm` > `once` | cueEngineService.js:205-210 |
| `_disabledUnion()` | input to the standing evaluator | cueEngineService.js:213-219 |
| `fireCue` | checks the sets separately in a different order: dormancy first (:695), then `disabledCues`/`spentOnceCues` (:701) | cueEngineService.js:695-704 |
| `getCueSummaries().enabled` | `!isCueDisabled` | cueEngineService.js:247 |
| `enableCue` | refuses dormancy-disabled; clears GM and once | cueEngineService.js:291-302 |
| Dormant per-command list | mixed cue still fires, skips dormant commands | cueEngineService.js:769-781 |

They agree on the sets; `enableCue` re-arms a spent once-cue (R17) which the summary shows as `enabled` again. The wire has no field for "held right now": a held cue shows as enabled.

### 6.7 Is the game clock running? and what time is it?

| Where | Answer | file:line |
|---|---|---|
| `gameClockService.status` | `stopped/running/paused` | gameClockService.js:25 |
| `getElapsed()` | wall-clock arithmetic; keeps growing after `stop()` | gameClockService.js:93-97 |
| Session `gameClock` | persisted start data | sessionService.js:339,722 |
| SF `gameClock.elapsed` | snapshot at build time | syncHelpers.js:176-186 |
| SS `gameclock.elapsed` | snapshot at push time | gameClockService.js:99-113 |
| Cue engine `handleClockTick` | the tick count | cueEngineWiring.js:49-52 |
| Compound cue `elapsed` | per-cue, continuous across segments | timelineRuntime.js:36 |
| Registry `gameclock` | always `healthy` except after a registry reset | gameClockService.js:17,279 |

They can disagree after game end (`status: stopped` but `elapsed` grows) and across reconnect (SF omits start data).

## 7. Terms CONTEXT.md lacks, and checks not done

Terms I used that CONTEXT.md does not define (named plainly):

- Outside program: a process or service the engine drives or observes that the engine does not own (VLC, MPD, PipeWire, BlueZ, Home Assistant, the kiosk Chromium, Docker).
- Snapshot versus live update: for a delivery path, whether the client is told when the fact changes or must pull or reconnect.
- Probe: one active check of an outside program (D-Bus read, `ping`, `pactl info`, HTTP get).
- Revalidation: the 15 s timer that runs probes for six services.
- Latch: the sticky dormant state in the registry that ignores `report()`.
- Health report: a service telling the registry `healthy` or `down`.
- Pre-play hook: an async function run before a queued video starts.
- Drive mode: which clock moves a compound cue (clock, pre-video, boundary, video, post-video).
- Disable provenance: why a cue is off (gm, once, dormant).
- Duck, ducking rule: automatic reduction of one stream's volume while another stream plays.
- Stream (video, music, sound), route, sink, sink-input: PipeWire concepts the audio service uses as nouns.
- Kiosk: the persistent Chromium window that shows the scoreboard on the TV.
- Idle-loop restore: returning VLC to the idle loop file after the queue drains.

Checks not done: any live run; whether the GM scanner reads `video.connected`, `bluetooth.available`, `lighting.connected` or `music.connected` at all; `sessionService` persistence listeners (which decide when the session file is written); `scanRoutes` beyond the `canAcceptVideo` call; whether the "new session" flow always performs a system reset (Conclusion 16). The directory `docs/plans/architecture-pass/` already existed (other map files were present); I wrote only this file.
