# Refute-by-default check 1 of the cause analysis

- **Date:** 2026-10-30.
- **Checked:** `docs/plans/architecture-pass/2026-10-30-cause-analysis.md`, causes C1, C3, C5, C7, C9, C11, C13 and C15, and the set-aside entries A-44, C-52, D-86, B-99, B-80, C-45, B-84 and B-97.
- **The tree:** `/home/user/ALN-Ecosystem`, branch `claude/nice-curie-hescfv`, code as of `12baf920`, ALNScanner at `e83723c`. The checkout's HEAD is `367a948a`. The only code that differs from the base is `backend/src/services/audioRoutingService.js` lines 611-630 (green's WirePlumber follow-up), so every line of that file above 630 sits 5 lines higher at HEAD; those citations were read at `12baf920` with `git show`. Two record files also moved after the base: `DEPLOYMENT_GUIDE.md` (the `pm2 restart all` row is line 2797 at the base, 2790 at HEAD) and `backend/.env.example` (B-99's fix landed in `089dd527`).
- **Method:** nothing was run. Each verdict rests on lines read in the tree, or on blue's records read with `git show origin/production-2026-07:<path>`.

**How to read the table.** The claim kinds are the task's: **1** a finding's code citation and status; **2** the finding belongs under its cause; **3** an "other place" has the same design cause; **4** the statement is a design cause, not the symptom restated; **5** a candidate proving test would fail on today's engine. "set-aside" rows test the reason section 3 gives. A row whose claim cell reads "1, 2" carries both claims with one verdict and counts twice. Verdicts: **holds**; **refuted** (the claim is wrong; for a placement, the correction names where the finding goes); **corrected** (partly right; the correction says what changes). A line number that is off by a line or two is noted in the evidence cell and does not change a verdict.

**Counts (per claim):** holds 285, corrected 34, refuted 28; missed faults 4.

**The four corrections with the most weight.**
1. A reload does clear the claimed-token list today (C1, A-05 / C-04 and A-06 / C-30): the first message after a reload is read as a new game, so the list is emptied and refilled from the backend. The fault is the tablet that stays connected. The same path wipes the offline queue (C4's C-05), so the "fix" is an accident of a fault.
2. Reset System does not stop music cues in production (C5, B-01): only the music panel goes dead. The listener registry removes nothing outside tests, so no test layer runs the reset the show runs (missed fault M4).
3. The tree carries the wrong Bluetooth role blue fixed on its host (C15, A-88): two documents in the tree say `a2dp_sink`.
4. Nine placements move: B-60, B-45 and B-78 within the backend to C11 or C3; A-62 and A-66 to C14; A-67, B-55 and C-36 to C4; D-11 to C10; D-34 to C15; four leave the causes (B-08, A-35, B-91, A-26's dead path).

## 1. Verdict table

### C1. Every tablet keeps its own copy of each game fact

| # | Target | Claim | Verdict | Correction | Evidence |
|---|---|---|---|---|---|
| C1-1 | A-05 / C-04 | 1 | corrected | The citations hold, but "even after a reload, until a browser key is deleted by hand" does not. After a reload the tablet's session id starts empty, so the first snapshot is read as a new game: the claimed list is emptied, then refilled from this station's claims as the backend now holds them, which no longer include the deleted token. Every tablet that stays connected keeps refusing the token until it reloads. The reload "cure" is the same path that wipes the offline queue (C4's C-05). Section 1's C1 summary ("a reload does not help") needs the same change. | `ALNScanner/src/core/unifiedDataManager.js:50` (id starts null); `src/network/messageRouters.js:94` (boundary check runs first); `src/network/networkedSession.js:246-259`; `src/core/unifiedDataManager.js:542-554` (clears the list in place); refill `messageRouters.js:97-99` → `src/core/storage/NetworkedStorage.js:453-460`; this device's claims only, `backend/src/websocket/gmAuth.js:150-152`; delete frees the registry entry, `backend/src/services/transactionService.js:696-700` |
| C1-2 | A-05 / C-04 | 2 | holds | — | the copy is marked by broadcast (`NetworkedStorage.js:378-381`) and not unmarked by the delete (`:394-403`) |
| C1-3 | A-06 / C-30 | 1 | corrected | Holds for a tablet that lost its connection without reloading: the reconnect snapshot keeps the session id, so there is no boundary and the union keeps the stale claims. Refuted for a tablet that was off: on return it reloads, and its first snapshot rebuilds the list from the backend's empty one (see C1-1). | union `NetworkedStorage.js:453-460` (comment `:454-457`); boundary only on a changed id `networkedSession.js:246-250`; connected path `:437-438` via `unifiedDataManager.js:919-925`; confirm text `gameOps.js:492` |
| C1-4 | A-06 / C-30 | 2 | holds | — | as C1-2 |
| C1-5 | A-24 / C-29 | 1, 2 | holds | — | `NetworkedStorage.js:357-359` marks nothing; `gmAuth.js:150-152,177-182` sends this device's claims only; union `messageRouters.js:97-99`; after a reload the boundary empties the saved list first (C1-1), so others' claims heard before the reload are lost too |
| C1-6 | C-31 | 1 | corrected | The mark stays only on a generic `error` event (no session, bad data, queue full, auth) or a timeout. A paused-game refusal does not keep it: it arrives as `transaction:result` with status `error`, which the queue treats as final, and the app unmarks the token (and the scan is lost, C9's C-07). The finding contradicts itself on this point; the inbound map has it right. | paused reply `backend/src/websocket/adminEvents.js:247-259`; final `ALNScanner/src/network/networkedQueueManager.js:89-100`; unmark `src/app/app.js:256-263`; generic error rejects `networkedQueueManager.js:308-315` and is kept `:103-109`; `docs/plans/architecture-pass/2026-10-30-map-inbound.md:250-251` |
| C1-7 | C-31 | 2 | holds | — | an optimistic mark on the tablet's copy, `gameOps.js:326-331` |
| C1-8 | A-50 | 1, 2 | holds | — | shared Set `unifiedDataManager.js:136-146`; warnings at `NetworkedStorage.js:79-80,454-457` (cited one line later) |
| C1-9 | A-25 / C-01 | 1, 2 | holds | — | merge `unifiedDataManager.js:954-957` via `messageRouters.js:197-202`; replace `MonitoringDisplay.js:223-227`; Session Details reads `scores` and `connectedDevices` (`gameAdmin.js:396-397`), which `session:update` never carries (`backend/src/websocket/broadcasts.js:75-83,120-128`) |
| C1-10 | B-13 | 1 | corrected | The broadcast does carry one team's row (holds), but no delete changes another team's score under today's rules: completion and bonus are computed per team from that team's own claims. Other teams' tablet scores go stale only if their stored score had already drifted from their transactions. The fault is latent: the message drops `allTeamScores`, which the backend builds. | per-team rule `backend/src/gameRules/scoring.js:84-87,270-288`; rebuild applies per-team rows `transactionService.js:817-894`; built and dropped `transactionService.js:737` vs `broadcasts.js:256-261` |
| C1-11 | B-13 | 2 | holds | — | the backend's delivery list (C1 statement, last clause) |
| C1-12 | B-19 | 1, 2 | holds | — | `transactionService.js:357-368`; `services/session/sessionRegistry.js:26-30` |
| C1-13 | B-25 | 1 | corrected | The x1 half holds: an x1 group completes with no `group:completed`, so no toast and no cue (a pack's event-only x1 group would fire nothing). The delete half's symptom does not: the rebuilt `completedGroups` rides the delete message's `updatedTeamScore`, which the tablet and the TV apply; `group:completed` itself only toasts or logs, so no screen keeps a stale "complete". | `transactionService.js:433-436`; rebuild sets the list `:840`, sent at `:735` (`models/teamScore.js:199`); tablet `messageRouters.js:51-53` → `unifiedDataManager.js:806-814`; TV `backend/public/scoreboard.html:1680-1681`; event consumers `app.js:204-209`, `scoreboard.html:1654-1657` |
| C1-14 | B-25 | 2 | holds | — | the x1 half is an event someone did not wire (C1 statement, last clause) |
| C1-15 | B-60 | 1 | corrected | "A held cue still shows as enabled" holds: the cue summary has no held field and the hold appears only in the separate held list. "Enable re-arms a spent once-cue" is the stated design (R17), not a fault. | summary `backend/src/services/cueEngineService.js:232-254`; held store `:270-276`; enable `:284-300` ("re-arm a spent once-cue (R17)") |
| C1-16 | B-60 | 2 | refuted | Belongs to **C11**: two stores answer "what state is this cue in" (the disabled sets and the held store) and nothing joins them, the same shape as B-40. No tablet copy or missing event is involved. | `cueEngineService.js:190-210` vs `:270-276` |
| C1-17 | A-19 / A-59 | 1, 2 | holds | — | `ALNScanner/src/ui/renderers/EnvironmentRenderer.js:255-275` writes every push into the slider with no drag guard; the music slider has one (`MusicRenderer.js:21`) |
| C1-18 | A-20 | 1, 2 | holds | — | `EnvironmentRenderer.js:89-93` builds once; an empty connected list stores `{}` (`:118-124`) and is never rebuilt |
| C1-19 | A-29 | 1 | corrected | Status can now be stated: the Quick Fire grid is fixed (rebuilt whenever its signature changes, an empty first build included); the Standing Cues list still builds once, and an empty first build is never rebuilt. | `ALNScanner/src/ui/renderers/CueRenderer.js:45-49` (signature), `:52-56` (build once), `:150-153` (empty → `{}`), `:223-247` (updates existing rows only) |
| C1-20 | A-29 | 2 | holds | — | a screen copy built by its own rule |
| C1-21 | A-33 | 1, 2 | holds | — | banner lives in the template (`SessionRenderer.js:263`), reset by any template swap (`:39-43`); `renderOvertime` keeps no state (`:164-176`) |
| C1-22 | A-21 | 1, 2 | holds | — | painted only in `save()` (`ALNScanner/src/ui/settings.js:48-58`), not in `load()` (`:33-41`); default `index.html:76` |
| C1-23 | other place: `NetworkedStorage.js:29-33,357-369,410,411-446,466-479` | 3 | holds | — | one update method and rule per copy (replace, append, per-team set, reset, append) |
| C1-24 | other place: `LocalStorage.js:97-107,324-326` | 3 | refuted | The removal on delete exists, and standalone has no backend: the Set is the authority's own index of its transactions, not a copy of another component's fact. Its pattern (a derived value stored beside its source and kept by separate paths) is **C11**'s (backend reader's B-c10). | delete unmarks `ALNScanner/src/core/storage/LocalStorage.js:458-466`; rebuilt on load `:97-107`; cleared on reset `:274-276` |
| C1-25 | other place: `teamRegistry.js:30,160-190` | 3 | holds | Same cause. Note: the same lines are C11's finding C-24; list them once. | `ALNScanner/src/core/teamRegistry.js:160-161` (ignored on null), `:164-190` (clear and refill); fed only from `MonitoringDisplay.js:225-226,333-334` |
| C1-26 | other place: `MonitoringDisplay.js:22,265-270,353-358` | 3 | holds | Same cause. Note: these are C6's finding C-23's lines; list them once. | `MonitoringDisplay.js:264-272,351-355` |
| C1-27 | other place: `networkedQueueManager.js:132-149` | 3 | holds | — | pending claims pruned by their own rule, on the snapshot only |
| C1-28 | other place: `aln-memory-scanner/js/app.js:18,196-214,448-450` | 3 | refuted | No engine fact is copied: "new or revisited" is decided by the device alone. That is **C9** (D-10), which already lists `app.js:448-451`. | `aln-memory-scanner/js/app.js:448-451`; C9 other places, last-but-one bullet |
| C1-29 | other place: `orchestratorIntegration.js:187,373`; `config.h:64-67` | 3 | refuted | These are each device's outbound queue of scans not yet stored, not copies of an engine fact. Their faults are reply rules (**C7**'s D-12) and silent loss (D-11, which this check moves to **C10**). | `aln-memory-scanner/js/orchestratorIntegration.js:169-173,187,373`; `arduino-cyd-player-scanner/ALNScanner_v5/config.h:64-67` |
| C1-30 | other place: `scoreboard.html:863-870`, handlers `:1645-1790` | 3 | holds | — | state `backend/public/scoreboard.html:863-878`; per-message handlers `:1645-1800`; boundary `:1477-1485` |
| C1-31 | other place: `broadcasts.js:256-261`; `transactionService.js:357-368` | 3 | holds | — | as C1-10 and C1-12 |
| C1-32 | statement | 4 | holds | — | names the design (copies kept by one handler per message), not a symptom |
| C1-33 | test: delete, rescan on a second tablet, reload (A-05 / C-04) | 5 | holds | Fails today on its first half (no reload); its second half (after a reload) passes today, see C1-1. | `gameOps.js:253-256` refuses from the stale Set |
| C1-34 | test: disconnect, reset all scores, reconnect (A-06 / C-30) | 5 | holds | — | no boundary on reconnect; union keeps the claims (`networkedSession.js:246-250`; `NetworkedStorage.js:453-460`) |
| C1-35 | test: delete changes the other team's bonus (B-13) | 5 | refuted | The setup cannot be built: no delete changes another team's bonus today (C1-10). A test that fails today asserts the message itself: after a delete every tablet receives every team's row. | `scoring.js:270-288`; `broadcasts.js:256-261`; `transactionService.js:737` |
| C1-36 | test: general error does not lock the token (C-31) | 5 | holds | — | generic error → kept, no unmark (`networkedQueueManager.js:103-109,308-315`) |
| C1-37 | test: fail if the claimed list is reassigned (A-50) | 5 | refuted | Nothing reassigns the list during a game today, so the test passes; it is a regression guard. The only reassignments are the constructors, the facade adopting the strategy's Set, and `dispose()`. | `unifiedDataManager.js:43,142-146,445`; `NetworkedStorage.js:31`; `LocalStorage.js:40` |

### C3. The engine's picture of each outside program is an unread cache

| # | Target | Claim | Verdict | Correction | Evidence |
|---|---|---|---|---|---|
| C3-1 | A-68 | 1, 2 | holds | — | `backend/src/utils/dbusSignalParser.js:39-56` emits at the next header; `flush()` `:58` has no caller in `backend/src` |
| C3-2 | A-61 | 1, 2 | holds | — | `backend/src/services/videoQueueService.js:353-371`: two polls of the cached state complete the video |
| C3-3 | A-65 / B-48 | 1, 2 | holds | — | `mprisPlayerBase.js:203` (no sender filter), `:257-264` (filter only once the owner is known, then drop), `:348-354`; owner cleared on exit `vlcMprisService.js:127`; any signal marks VLC healthy `:436-438` |
| C3-4 | A-48 | 1, 2 | holds | — | `backend/src/services/cue/timelineRuntime.js:430,455` ignore lifecycle events until `videoStarted` (`:381-383`); progress only when a length is known `videoQueueService.js:394` (cited `:396`) |
| C3-5 | A-62 | 1 | holds | — | `timelineRuntime.js:473-475` reads `data.skipped`; `videoQueueService.js:479` emits the queue item; nothing sets `skipped` |
| C3-6 | A-62 | 2 | refuted | Belongs to **C14**: the reader waits for a field no producer sets, the same mechanism as A-63, which C14 holds. The queue knows the position (it polls it). | `videoQueueService.js:353-401` (position polled), `:479`; `timelineRuntime.js:473` |
| C3-7 | A-66 | 1 | holds | — | `timelineRuntime.js:125,233-234` (reads `entry.payload?.tokenId`), `:465` (arrow function used as a condition) |
| C3-8 | A-66 | 2 | refuted | Two of its three parts are not cache faults. The inert correlation is a name join kept by hand on each side (**C14**): it reads `tokenId`, while the pack's video entries carry `videoFile`. The dead arrow function is a **one-off** slip (set aside, plain fix). Only "a queued file's duration is 0 until play" is C3's. | `timelineRuntime.js:233-234`; `ALN-TokenData/cues.json:114-117,187-190`; `timelineRuntime.js:465` |
| C3-9 | A-67 | 1 | holds | — | post-video entries advance on clock ticks only, `timelineRuntime.js:473-500`; ticks from `gameclock:tick` only, `backend/src/services/cueEngineWiring.js:48-51` |
| C3-10 | A-67 | 2 | refuted | The game clock is the engine's own fact, not an outside program's. Whether a running cue advances while the clock is paused or not yet started is a boundary rule: **C4**. | as C3-9 |
| C3-11 | B-45 | 1 | holds | — | duck and restore only on queue events, `broadcasts.js:387-410`; `clearQueue` emits `queue:reset` and `video:idle` only, `videoQueueService.js:842-875` |
| C3-12 | B-45 | 2 | refuted | Ducking does not read the program cache. It keeps its own count of active videos, fed by four queue events that the clear and failure paths never send: one more answerer to "is a video playing" (B-39's question), so **C11**. | `broadcasts.js:387-410`; `videoQueueService.js:842-875`; failure path `:282-287` |
| C3-13 | A-55 / B-43 / B-93 | 1 | corrected | Code holds: `init()` and the reconnect read no state; only commands re-read. The scenario needs one change: after an engine restart MPD itself restarts (the old process is killed) and comes back paused on the restored track, so music is not playing. The panel shows "stopped, volume 70, no track" against a paused, loaded player. | `backend/src/services/musicService.js:95-108,177-186,276-283`; `backend/src/utils/processMonitor.js:60-61`; `backend/src/services/mpdConfigBuilder.js:38,52` (`restore_paused "yes"`) |
| C3-14 | A-55 / B-43 / B-93 | 2 | holds | — | the picture starts from a default and is not re-read |
| C3-15 | B-94 / A-71 | 1 | corrected | B-94 holds. A-71 is an ordering slip inside a design that already stores the wanted volume: `setStreamVolume` applies the live volume first and stores only after, and the live step throws when the stream is absent, so the store never happens. Stored volumes are re-applied when a stream appears. | `musicService.js:291-300`; `audioRoutingService.js:503-504` (throw), `:534-537` (store after), `:873-917` (re-apply), all at `12baf920` |
| C3-16 | B-94 / A-71 | 2 | corrected | These are writes, not reads: the engine sets a value on the program instead of keeping a wanted value and applying it when the program can take it. C3's statement covers reading only; widen it to "reads and drives", or give writes a row of their own. | as C3-15 |
| C3-17 | A-54 / B-47 | 1, 2 | holds | — | `backend/src/services/lightingService.js:102-130` (recovery only clears the timer); `refreshScenes` `:357` called only from `commandExecutor.js:634`; writers `:114,116,207,254` (and `:436`) |
| C3-18 | A-56 | 1, 2 | holds | — | `audioRoutingService.js:796-826` at `12baf920`: no `change` handling for sink-inputs |
| C3-19 | A-57 | 1, 2 | holds | — | `audioRoutingService.js:319` (`this._sinkCache \|\| []`), invalidated `:801,811`, at `12baf920` |
| C3-20 | A-70 | 1 | holds | — | `applyRouting` called from `broadcasts.js:392`, `commandExecutor.js:616`, `audioRoutingService.js:1120` (base); a new stream gets its stored volume but never its route, `:873-917` |
| C3-21 | A-70 | 2 | corrected | A write, as C3-16: routing is applied at chosen moments, never reconciled with the streams that exist. | as C3-20 |
| C3-22 | B-46 | 1, 2 | holds | Note: its Check Now half is C11's B-59. | `backend/src/services/bluetoothService.js:59-67`; `commandExecutor.js:889` (`isAvailable()` reports nothing, `bluetoothService.js:115-122`) |
| C3-23 | B-49 | 1, 2 | holds | — | `processMonitor.js:141-144` emits `gave-up`, no listener in `src`; `exited` heard only at `vlcMprisService.js:125`, `musicService.js:609` |
| C3-24 | B-38 | 1, 2 | holds | — | `backend/src/services/displayControlService.js:231-244`: a false `shown` only logs |
| C3-25 | B-58 | 1, 2 | holds | — | `backend/src/utils/displayDriver.js:165-184` (raw `spawn`), flags `:34-50`, `:209-210` |
| C3-26 | B-91 | 1 | holds | — | `displayDriver.js:80-87` own `execFile` wrapper |
| C3-27 | B-91 | 2 | refuted | **Set aside**: no game symptom; a second exec wrapper is a maintenance note, set aside on the same ground as C-45 (a plain refactor, best done with B-58). | as C3-26 |
| C3-28 | B-87 | 1, 2 | holds | — | `backend/src/services/preflightService.js:83` synchronous; callers `sessionService.js:225,294,804` |
| C3-29 | other place: `bluetoothService.js:504`, `mprisPlayerBase.js:212` | 3 | holds | — | both construct `DbusSignalParser` |
| C3-30 | other place: `audioRoutingService.js:445,568,797,1040-1052` | 3 | holds | Note: `:445` and `:568` are fresh `pactl list` reads used as fallbacks; `:797` is the stream that feeds the caches. | at `12baf920` |
| C3-31 | other place: `musicService.js:240-260` | 3 | holds | — | `_send` with a timeout as the only desync signal |
| C3-32 | other place: `displayDriver.js:104` | 3 | refuted | Not a cache: the window is looked up fresh on every show and hide. The cached copy is the `visible` flag (B-58). | `displayDriver.js:97` ("Searches fresh every time — no caching"), `:102-117` |
| C3-33 | other place: five supervised streams | 3 | holds | — | `mprisPlayerBase.js:205`, `vlcMprisService.js:113`, `audioRoutingService.js:789` (base), `musicService.js:603`, `bluetoothService.js:497`; `exited` at two, `gave-up` at none |
| C3-34 | other place: `lightingService.js:100-106` | 3 | refuted | Same lines and same fault as C11's B-37 ("a host with no lighting token stays red forever"): no reader exists at all, a question of which source says equipment exists. **C11**. | `lightingService.js:102-105`; C11 row B-36 / B-37 |
| C3-35 | other place: `soundService.js:42-51` | 3 | refuted | A health word that means "the binary exists" (`which pw-play`), the same as A-98 and A-100: **C10**. | `backend/src/services/soundService.js:42-51` |
| C3-36 | other place: `timelineRuntime.js:381-383,430,455,540,562`; `cueEngineWiring.js:80-83,109-112` | 3 | holds | — | `hadVideoStarted` at `:540,562`; events forwarded unchanged `cueEngineWiring.js:80-84,107-111` |
| C3-37 | statement | 4 | corrected | A design cause, but "nothing re-reads the program" is too strong. The 15-second health probe re-reads VLC's play state (not track or volume) and announces a change on an event nothing hears for VLC (missed fault M1). MPD's probe is a ping, lighting's an API ping, Bluetooth's an adapter check. Track, volume, scenes, devices and sink-inputs are never re-read. | `backend/src/services/serviceHealthRegistry.js:236-244`; `mprisPlayerBase.js:158-176`; `musicService.js:188-195`; `lightingService.js:108-117`; `bluetoothService.js:73-78` |
| C3-38 | test: "started" within half a second in any signal order (A-68) | 5 | holds | — | the slow order waits for the next header (`dbusSignalParser.js:39-56`) |
| C3-39 | test: cached "stopped" while playing does not complete (A-61) | 5 | holds | — | `videoQueueService.js:353-371` |
| C3-40 | test: 2-second video cue completes (A-48) | 5 | holds | Timing-dependent: it fails whenever completion precedes the first 1-second progress tick. | `videoQueueService.js:339,394`; `timelineRuntime.js:455` |
| C3-41 | test: skip at 12 s measures later steps from 12 s (A-62) | 5 | holds | — | `timelineRuntime.js:473-480` falls back to the full length |
| C3-42 | test: clear the queue while playing restores music (B-45) | 5 | holds | — | no `video:completed` from `clearQueue` (`videoQueueService.js:842-875`) |
| C3-43 | test: restart shows the real track (B-43) | 5 | holds | Expect a paused, loaded track, not a playing one (C3-13). | `musicService.js:95-108` |
| C3-44 | test: VLC row stays red while another player signals (B-48) | 5 | holds | VLC respawns after 3 s; the test must look inside that window or stop the respawn. | `vlcMprisService.js:113-129,436-438`; `mprisPlayerBase.js:257` |
| C3-45 | test: MPD fails five times, Music row red (B-49) | 5 | refuted | Passes today: each MPD exit already turns the Music row red with a reason. Use a child with no `exited` listener: kill `pactl subscribe` five times, and the Audio row stays "healthy: PipeWire reachable" while sink events stop. | `musicService.js:609-618`; `audioRoutingService.js:156-165,789` (base); `processMonitor.js:141-144` |

### C5. Boot and Reset System are two hand-kept sequences

| # | Target | Claim | Verdict | Correction | Evidence |
|---|---|---|---|---|---|
| C5-1 | B-01 | 1 | corrected | The music panel half holds: the reset removes the boot-time music push and does not re-add it, because it is called without `musicService` and the push is registered only when one is passed. The cue half does not hold in production: the cross-service listener registry removes nothing outside tests, music is never reset in production, and its `reset()` drops no listeners anyway, so boot's music-to-cue forwarding keeps working. (It does stop in tests, see M4.) | `backend/src/services/systemReset.js:79,122-124,149`; `broadcasts.js:497,712-725`; `adminEvents.js:77-90`; `backend/src/websocket/listenerRegistry.js:13,24,44-47`; `musicService.js:553-559`; `cueEngineWiring.js:140-146` |
| C5-2 | B-01 | 2 | holds | — | a list (`adminEvents.js:77-90`) shorter than boot's (`server.js:139-153`) |
| C5-3 | A-53 / B-02 / C-37 / D-30 | 1, 2 | holds | — | boot `app.js:206` → `sessionService.js:177-184` before `server.js:296`; reset `systemReset.js:138` before `:160-163`; `buildSyncFullPayload` reads `session.transactions` before its first `await` (`syncHelpers.js:48-63`), so the broadcast listener (`broadcasts.js:312-326`) snapshots before `persistenceListeners.js:44` clears; `messageRouters.js:105-111`; `scoreboard.html:1759-1777` |
| C5-4 | B-03 | 1, 2 | holds | Add: `cue:completed` forwarding doubles too. Every one of these services' `reset()` keeps its listeners; only `cleanup()` drops them. | `listenerRegistry.js:44-47`; `gameClockService.js:276-285`; `soundService.js:151-160`; `cueEngineService.js:1166-1174`; `videoQueueService.js:1050-1070`; re-registered `systemReset.js:168-180`, `cueEngineWiring.js:131-133` |
| C5-5 | B-53 | 1, 2 | holds | — | `serviceHealthRegistry.js:283-291`; revalidation has no `display` `:236-244`; boot reports healthy on launch (`displayDriver.js:247`), a reset finds the kiosk running and launches nothing |
| C5-6 | B-55 | 1 | corrected | The VLC service's own record is re-read at the end of the reset, so it says "playing" again. What stays wrong: the video queue is emptied to idle while VLC plays on, the track stays empty until the next signal, and the GM is told nothing (the re-read speaks on an event nothing hears for VLC, M1). | `systemReset.js:264-274` → `mprisPlayerBase.js:158-176`; `vlcMprisService.js:509-515`; `mprisPlayerBase.js:382-390`; `videoQueueService.js:1050-1070` |
| C5-7 | B-55 | 2 | refuted | **C4**: the reset clears the engine's copies of a program it deliberately keeps running ("process preserved across resets"). At boot the defaults are right because VLC starts fresh, so this is a boundary rule, not a difference between the two sequences. | `vlcMprisService.js:505-515` |
| C5-8 | C-36 | 1 | holds | — | `ALNScanner/src/app/domains/gameAdmin.js:307-343` clears nothing; copies clear only at `networkedSession.js:246-259`; the reset ends with a log line (`systemReset.js:300`) |
| C5-9 | C-36 | 2 | refuted | **C4**: the tablet infers the boundary from a new session id and the reset announces none, which is C4's statement word for word ("the TV and the GM infer one from a changed session id"). | as C5-8 |
| C5-10 | other place: three hand-built service lists | 3 | holds | — | `server.js:139-153`; `systemReset.js:138-152`; `adminEvents.js:77-90` |
| C5-11 | other place: cue forwarding at boot and after reset | 3 | holds | — | `app.js:252-261`; `systemReset.js:168-180` |
| C5-12 | other place: `systemReset.js:228-241` | 3 | corrected | Reloading cues from the frozen snapshot and not re-activating the pack or profile are the ruled activation rule, not a fault. The missing end-of-reset snapshot is C4's (with C-36). | `systemReset.js:231-233`; `CONTEXT.md` §2, "Activation" ("fixed for the life of the process") |
| C5-13 | other place: heartbeat monitor | 3 | holds | — | started `server.js:156-157`; absent from `systemReset.js` |
| C5-14 | other place: `sessionService.js:178-184` | 3 | holds | — | `sessionService.js:177-184` |
| C5-15 | statement | 4 | corrected | A design cause. "Cue forwarding is doubled" holds; "music is never rebuilt" holds for the panel's push only, since boot's music cue forwarding survives a production reset (C5-1). | as C5-1 and C5-4 |
| C5-16 | test: music panel and music cue after a reset (B-01) | 5 | holds | Fails today on the panel half only; the cue half passes today and cannot prove a fix. | as C5-1 |
| C5-17 | test: Reset System, then Reset All Scores (A-53 …) | 5 | holds | — | as C5-3; the TV joins the `gm` room that receives the snapshot (`gmAuth.js:102-103`) |
| C5-18 | test: one video cue fires once after a reset (B-03) | 5 | holds | — | `video:started` forwarded twice; a plain cue has no running-guard (`cueEngineService.js:713-716` guards only running compound cues) |
| C5-19 | test: Display row healthy after a reset (B-53) | 5 | holds | — | as C5-5 |
| C5-20 | test: every tablet shows an empty game after a reset (C-36) | 5 | holds | — | as C5-8 |

### C7. A reply does not say which request, whether final, or whether stored

| # | Target | Claim | Verdict | Correction | Evidence |
|---|---|---|---|---|---|
| C7-1 | B-64 / C-32 | 1, 2 | holds | — | generic `error` at `adminEvents.js:153,166,177,227,238,307` (all but `:177` echo `clientTxId`); typed at `:207,250,292`; reject `networkedQueueManager.js:308-315` → kept `:103-109,219-228`; toast `app.js:198-202` |
| C7-2 | B-65 / C-33 | 1, 2 | holds | — | `adminEvents.js:118-122`; match on action only `ALNScanner/src/admin/utils/CommandSender.js:44` (cited `:43`) |
| C7-3 | C-34 | 1, 2 | holds | — | `CommandSender.js:29-66`; state via `messageRouters.js:170-175` |
| C7-4 | B-69 / C-35 | 1, 2 | holds | — | serial re-probes `systemReset.js:220-274` (lighting `init()` may start a Docker container); 5 s wait `gameAdmin.js:310-314` |
| C7-5 | B-57 / C-55 | 1, 2 | holds | — | no `preflight` in `broadcasts.js` or `syncHelpers.js`; `preflightService.js:111` (`verbs: []`); prefix match `gameAdmin.js:26,79-84` |
| C7-6 | B-09 | 1 | corrected | "If the save fails, no tablet ever receives the transaction" is too strong: the transaction is already in the in-memory session before the save, so the next snapshot carries it. Live tablets miss it until a snapshot, and it is lost if the engine restarts before a later save. | claimed `transactionService.js:233`; `persistenceListeners.js:97,108-112,122-128`; snapshot `syncHelpers.js:63` |
| C7-7 | B-09 | 2 | holds | — | the reply goes out before the write it reports (`adminEvents.js:292`) |
| C7-8 | B-08 | 1 | holds | — | `transactionService.js:179-190,212-223` return before the claim |
| C7-9 | B-08 | 2 | refuted | **Set aside** as a question for the owner. The reply is typed and correct; what is missing is a record of refused attempts, and whether the game record should hold them is a product choice none of the sixteen causes decides. The backend reader's own test offers "or the contract must say attempts are not recorded". | `adminEvents.js:292`; backend sheet row B-08 |
| C7-10 | B-22 / D-13 / D-14 | 1, 2 | holds | — | `backend/src/routes/scanRoutes.js:317-352`; floor `:176-178` vs `:262-280`, none on the live route; web deletes on 200 `orchestratorIntegration.js:296-322`; ESP32 `OrchestratorService.h:541-545`; 1970 stamp `Application.h:661-674` |
| C7-11 | B-21 / D-15 | 1, 2 | holds | — | `scanRoutes.js:181-196` (memory, one hour); no dedupe on store `backend/src/models/session.js:202-212` |
| C7-12 | B-16 / D-35 | 1, 2 | holds | — | `scanRoutes.js:392-416`; only join `gmAuth.js:102`; `backend/contracts/asyncapi.yaml:2068-2075` names the GM |
| C7-13 | D-12 | 1, 2 | holds | — | `orchestratorIntegration.js:333-356`; `OrchestratorService.h:541-568`; `ScanResponse.h:72-75`; rate limiter `backend/src/app.js:108-110` |
| C7-14 | D-11 | 1 | holds | — | `orchestratorIntegration.js:169-173`; `OrchestratorService.h:263-265,1243-1247`; `config.h:64` |
| C7-15 | D-11 | 2 | refuted | No reply is involved: each device drops its own oldest queued scan at a fixed cap and tells nobody. A loss shown as normal: **C10**. | as C7-14 |
| C7-16 | other place: three persist paths logged only | 3 | holds | — | `persistenceListeners.js:122-128,155-160,187-192` |
| C7-17 | other place: ten generic `error` emits | 3 | holds | — | seven in `adminEvents.js`, three in `gmAuth.js:31,86,209` |
| C7-18 | other place: `transaction:new` has no `clientTxId` | 3 | holds | — | `broadcasts.js:191-211` |
| C7-19 | other place: unparseable body answered 200 | 3 | holds | — | `backend/src/app.js:155-167` |
| C7-20 | other place: by-action serialisation used only for add-team | 3 | holds | — | `ALNScanner/src/network/orchestratorClient.js:189-242`; sole caller `src/core/teamRegistry.js:301` |
| C7-21 | other place: queue replay by `clientTxId` | 3 | holds | — | `networkedQueueManager.js:100-111,299-337` |
| C7-22 | other place: `AUTH_` error clears the token | 3 | holds | — | `messageRouters.js:157-168`; `CommandSender.js:37-44` hears acks only |
| C7-23 | other place: two client reply policies | 3 | holds | — | `orchestratorIntegration.js:133-166`; `ScanResponse.h:51-75` |
| C7-24 | statement | 4 | holds | — | names the missing reply contract |
| C7-25 | test: undeclared mode fails once (B-64 / C-32) | 5 | holds | — | mode checked against the pack in the schema (`backend/src/utils/validators.js:178`) → generic `error` at `adminEvents.js:307` |
| C7-26 | test: two quick skips (B-65 / C-33) | 5 | holds | — | `ALNScanner/src/admin/VideoController.js:52-53` uses `CommandSender` |
| C7-27 | test: failed save (B-09) | 5 | holds | — | as C7-6 |
| C7-28 | test: batch with no game (B-22 / D-13) | 5 | holds | — | as C7-10 |
| C7-29 | test: batch replayed after a restart (B-21 / D-15) | 5 | holds | — | as C7-11 |
| C7-30 | test: batch answered 429 (D-12) | 5 | holds | — | as C7-13 |
| C7-31 | test: 8-second reset (B-69 / C-35) | 5 | holds | — | as C7-4 |

### C9. The tablet and the player devices decide facts the engine owns

| # | Target | Claim | Verdict | Correction | Evidence |
|---|---|---|---|---|---|
| C9-1 | C-07 | 1 | corrected | The optimistic screen holds. The paused case holds only when the tablet's own status copy still says active, because its gate refuses up front once it knows. The ended case does not "unmark and lose": the backend has no session after an end, answers a generic error, and the tablet keeps the mark and replays the scan on every snapshot (B-64's path). | `ALNScanner/src/app/domains/gameOps.js:233-241,320,338-346,376`; `src/ui/uiManager.js:466,473`; `backend/src/services/sessionService.js:550-552`; `adminEvents.js:236-243`; `networkedQueueManager.js:103-109,308-315` |
| C9-2 | C-07 | 2 | holds | — | the tablet's own points and verdict shown first |
| C9-3 | A-26 | 1 | corrected | Not reachable in production, so "latent", not "not verified": the backend answers "queued" only while an offline flag is set, and nothing outside tests sets it. | `adminEvents.js:203-224`; `backend/src/services/offlineQueueService.js:12-15,206-208` |
| C9-4 | A-26 | 2 | refuted | **C14**, with B-11: a half-built path that no production code reaches. | as C9-3 |
| C9-5 | A-34 | 1, 2 | holds | — | local refusal first, `gameOps.js:253-256`; the claimant is named only on the verdict path, `app.js:235-254` |
| C9-6 | A-02 / C-09 | 1, 2 | holds | — | gate inside the networked branch `gameOps.js:233-241`; refusal ignored and token marked `:358-361`; `LocalStorage.js:300-306` checks paused only |
| C9-7 | A-13 / C-42 | 1, 2 | holds | Note: it is also the literal-phase-word pattern in C11's last other place. | `ALNScanner/src/ui/renderers/GameAdminRenderer.js:51-96` |
| C9-8 | C-10 | 1, 2 | holds | — | `LocalStorage.js:394-438` (no event; `:429` sums transactions) vs `backend/src/gameRules/scoring.js:184-198` (distinct tokens) |
| C9-9 | A-36 / C-11 | 1, 2 | holds | — | `ALNScanner/src/ui/renderers/GameOpsRenderer.js:330`; no id minted at `gameOps.js:305-317` or `LocalStorage.js:300-330` |
| C9-10 | A-37 | 1, 2 | holds | Note: standalone reports are a documented gap ("Standalone mode: Not supported", `ALNScanner/CLAUDE.md`, Session Report). | `unifiedDataManager.js:337-339`; only networked messages fill `sessionState` (`:944-967`); `gameAdmin.js:219-227` |
| C9-11 | A-35 | 1 | corrected | The pill half is now verified: the header starts as a red "Disconnected" link to the wizard and only the connection manager repaints it, which standalone never creates. The wizard's side effects remain not verified. | `ALNScanner/index.html:58-61`; `src/network/connectionManager.js:373-394` |
| C9-12 | A-35 | 2 | refuted | **Set aside**: no fact the engine decides is involved; a one-off mode slip in the header (a plain fix). | as C9-11 |
| C9-13 | A-14 | 1, 2 | holds | Note: owner-accepted (blue REV:140); evidence of the mechanism, not a fix. | `NetworkedStorage.js:245-248`; `ALNScanner/src/core/gameActivityBuilder.js:80-82` |
| C9-14 | C-58 | 1, 2 | holds | — | `gameOps.js:246-247,262`; `src/core/tokenManager.js:276-302` |
| C9-15 | C-56 | 1, 2 | holds | — | `unifiedDataManager.js:301-331` (comment `:306`); `scoreboard.html:1092,1257-1277` |
| C9-16 | C-57 | 1, 2 | holds | Each side has its own pin test and nothing compares the two. | `ALNScanner/src/ui/renderers/dormancyWording.js:1-26`; tests `ALNScanner/tests/unit/ui/renderers/dormancyWording.test.js`, `backend/tests/unit/gameRules/dormancyWording.test.js` |
| C9-17 | D-09 / B-62 | 1 | corrected | Both devices do invent a team and the contract accepts it, but the engine discards it: neither scan route stores it, the GM broadcast omits it, and Game Activity and the report read only token, device and time from player scans. "The GM's Game Activity and the report read that field" is wrong; the team appears only in log lines. | `aln-memory-scanner/js/app.js:435`; `Application.h:560`; `validators.js:165` ("players haven't committed to teams yet"); logged `scanRoutes.js:51-56,287-292`; stored without it `:82-88,325-331`, `session.js:202-210`; broadcast `:111-119`; readers `gameActivityBuilder.js:20-45`, `sessionReportGenerator.js:330,340` |
| C9-18 | D-09 / B-62 | 2 | holds | — | the device decides a value the engine owns (or should not exist; C9 candidate (d)) |
| C9-19 | D-10 | 1, 2 | holds | — | `aln-memory-scanner/js/app.js:195-215,448-451`; no session word in `js/` |
| C9-20 | D-17 | 1 | corrected | The ESP32 half holds: offline it queues and shows the normal token screen. The web scanner does not show a normal screen: a queued scan shows "Scan queued - orchestrator unavailable". Online both say "no session". | `Application.h:579-596`; `orchestratorIntegration.js:97-101`; `aln-memory-scanner/js/scannerCore.js:88-90`; `app.js:424-425` |
| C9-21 | D-17 | 2 | holds | — | the device decides "recorded" |
| C9-22 | other place: group completion and points pairs | 3 | holds | — | `scoring.js:51,133`; `LocalStorage.js:394`; `ALNScanner/src/core/scoring.js:202` |
| C9-23 | other place: duplicate policy vs `gameOps.js:259` | 3 | corrected | Same cause; the tablet's duplicate check is at `gameOps.js:253-257`, not `:259`. | `gameOps.js:253-257` |
| C9-24 | other place: two `modeSemantics.js` | 3 | holds | — | `backend/src/gameRules/modeSemantics.js`; `ALNScanner/src/core/modeSemantics.js` |
| C9-25 | other place: networked gate, match and points; standalone re-implementation | 3 | holds | — | `gameOps.js:232-262,320`; `LocalStorage.js:300-335,394-438` |
| C9-26 | other place: points recomputed on screens | 3 | holds | — | `uiManager.js:473`; `GameOpsRenderer.js:299` |
| C9-27 | other place: ESP32 local token gate | 3 | holds | — | `Application.h:525-548,1245,1313,1473` |
| C9-28 | other place: web scanner's own normalising and token file | 3 | holds | — | `aln-memory-scanner/js/app.js:383-386,399-405,448-451` |
| C9-29 | other place: TV's own evidence filter | 3 | holds | — | `scoreboard.html:1254-1258` |
| C9-30 | statement | 4 | corrected | A design cause, with one clause to change: the player scanners do not "decide which team a scan belongs to" in any stored sense; they send a team the engine discards (C9-17). | as C9-17 |
| C9-31 | test: a refused scan never says "complete" (C-07) | 5 | holds | — | `uiManager.js:466` |
| C9-32 | test: standalone paused and ended scans refused (A-02 / C-09) | 5 | holds | — | as C9-6 |
| C9-33 | test: the claimant team is named (A-34) | 5 | holds | — | `gameOps.js:255` uses the default message |
| C9-34 | test: the stored team is a team of the game (D-09) | 5 | refuted | Cannot fail as written: nothing stores a team on a player scan, so "the stored scan's team" does not exist and the "or" branch is already met in storage. A test that fails today checks the request: player devices send no team, or the engine refuses one. | as C9-17 |
| C9-35 | test: a phone says "new" in the next game (D-10) | 5 | holds | — | as C9-19 |
| C9-36 | test: tablet and TV give the same owner order (C-56) | 5 | corrected | Fails today only for inputs with an owner-less transaction (the tablet skips it, the TV files it under "unknown owner") or two owners exposed at the same moment (alphabetical tie-break on the tablet, insertion order on the TV). With distinct owners and times both sort by latest exposure and agree, so the test must include those inputs. | `unifiedDataManager.js:319,327-330`; `scoreboard.html:1092,1259` |

### C11. One question has several answerers inside one component

| # | Target | Claim | Verdict | Correction | Evidence |
|---|---|---|---|---|---|
| C11-1 | B-39 | 1 | corrected | The scan path does not replace a paused video: adding to the queue runs it only when nothing is current. What a paused video does break: the "can accept a video" check reads it as free, so the player is told the video was triggered while it waits behind the paused one; and any queue run while paused (a held-video release) plays the next video over it. The clear-queue half holds. | `videoQueueService.js:71-77,89-91`; `:901,969-970`; `:951`; `:842-875` (no VLC stop) |
| C11-2 | B-39 | 2 | holds | — | seven answers to one question |
| C11-3 | B-40 | 1, 2 | holds | — | `videoQueueService.js:27,944-946`; `commandExecutor.js:787-805`; `heldItemsStore.js:180,204` unused |
| C11-4 | B-36 / B-37 | 1, 2 | holds | — | dormancy after the services start `app.js:326`, VLC spawned `:287`; `dormancyService.js:188-194`; `lightingService.js:102-105`; `displayControlService.js:171,228,340` |
| C11-5 | B-59 | 1 | corrected | Check Now covers all nine services, not eight; the rest holds (the timer covers six, the functions differ for Bluetooth, the clock's check reports nothing). | `commandExecutor.js:885-899`; `serviceHealthRegistry.js:236-244` |
| C11-6 | B-59 | 2 | holds | — | two probes per service |
| C11-7 | B-74 / B-75 | 1, 2 | holds | — | `displayDriver.js:359-378` (hidden and no process reads healthy), `:205-214`; gate `commandExecutor.js:52,208-215` |
| C11-8 | B-73 | 1, 2 | holds | — | `backend/src/gameRules/endpointServices.js:127-130` throws; the schema allows any family name (`ALN-TokenData/pack-manifest.schema.json:84-86`) although the code comment says it refuses them (`endpointServices.js:112`); create path `sessionService.js:223` |
| C11-9 | B-77 | 1, 2 | holds | — | dormant branch returns with no next run and no idle `videoQueueService.js:107-116`; failure branch re-runs the queue `:282-287` |
| C11-10 | B-78 | 1 | holds | — | `displayDriver.js:207-212` checks `visible` before `terminating`; `cleanup()` sets `terminating` but clears `visible` only after the kill (`:411-430`) |
| C11-11 | B-78 | 2 | refuted | **C3**, with B-58: it is the kiosk's own watcher answering "deliberate stop or crash" by its own rule, the separate supervision path B-58 names. | as C11-10 |
| C11-12 | B-79 | 1, 2 | holds | — | `backend/src/gameRules/resolution.js:41-51` |
| C11-13 | B-15 | 1, 2 | holds | — | `scanRoutes.js:325,354-357`; `sessionRegistry.js:92`; `cueEngineWiring.js:117-119` |
| C11-14 | B-52 | 1, 2 | holds | — | `soundService.js:147` vs `:58` |
| C11-15 | B-10 / B-23 | 1, 2 | holds | — | `session.js:185-189,243-246,256-266`; `removeDevice` has no caller; delete touches neither counter (`transactionService.js:654-751`) |
| C11-16 | C-25 | 1, 2 | holds | — | `gameOps.js:233-241`; `NetworkedStorage.js:291-296`; starts "disconnected" `unifiedDataManager.js:53-59`; `SessionRenderer.js:21` |
| C11-17 | C-26 | 1, 2 | holds | — | `unifiedDataManager.js:50,961`; `NetworkedStorage.js:33,83-96,485-488` |
| C11-18 | C-28 | 1, 2 | holds | — | `orchestratorClient.js:63`; `connectionManager.js:33,373`; `MonitoringDisplay.js:400-406`; `NetworkedStorage.js:40-42` |
| C11-19 | C-24 | 1, 2 | holds | — | `teamRegistry.js:160-190,295-316`; `GameOpsRenderer.js:50-59`; duplicate refused `sessionRegistry.js:26-30` |
| C11-20 | C-21 | 1, 2 | holds | — | `MonitoringDisplay.js:38,276-288`; `VideoRenderer.js:34,43-44`; `messageRouters.js:140-144` |
| C11-21 | A-08 | 1, 2 | holds | — | `ALNScanner/src/core/sessionReportGenerator.js:241-266` (sales plus adjustments, no bonus) |
| C11-22 | A-43 | 1, 2 | holds | — | `sessionReportGenerator.js:447-453` reads the local token file only |
| C11-23 | A-27 | 1, 2 | holds | — | `GameOpsRenderer.js:78` |
| C11-24 | A-18 | 1, 2 | holds | — | `MusicRenderer.js:114-120`; `EnvironmentRenderer.js:147-152`; `ALNScanner/src/utils/domEventBindings.js:34-40` |
| C11-25 | A-38 / A-46 | 1, 2 | holds | — | `unifiedDataManager.js:757` (star sum) vs `:784` (score ÷ 1000); `uiManager.js:300-307,345-353`; `sessionReportGenerator.js:63,509-515` |
| C11-26 | other place: three video gates | 3 | holds | — | `commandExecutor.js:199-215`; `videoQueueService.js:107,882-904`; `cueEngineService.js:738-743` |
| C11-27 | other place: lighting `isConnected()` | 3 | holds | — | `lightingService.js:90-95` vs `:103` |
| C11-28 | other place: three holders of "is dormant" | 3 | holds | — | `dormancyService.js:41`; registry latch; `cueEngineService.js:74` |
| C11-29 | other place: call-site counts | 3 | corrected | `cueEngineService.js` has four `isHealthy(`/`isDormant(` sites, not three; the other seven counts match. | grep over `backend/src/services` |
| C11-30 | other place: device type by route; a poll writes | 3 | holds | — | `backend/src/routes/healthRoutes.js:50-54,64-71,88` |
| C11-31 | other place: session counters | 3 | holds | — | `session.js:185-189,215-218,243-246,262-266`; `persistenceListeners.js:44-47` |
| C11-32 | other place: scoreboard reads backend, Team Details computes | 3 | holds | — | `NetworkedStorage.js:194-210`; `unifiedDataManager.js:685-741` |
| C11-33 | other place: the TV's own score table | 3 | holds | — | `scoreboard.html:869` |
| C11-34 | other place: phase and health words as literals | 3 | holds | — | `gameOps.js:235`; `LocalStorage.js:302`; `messageRouters.js:198`; `HealthRenderer.js:73-80` |
| C11-35 | statement | 4 | holds | — | names the design (several stored answers, no rule for which one to read) |
| C11-36 | test: a paused video is not replaced (B-39) | 5 | holds | — | `videoQueueService.js:90` |
| C11-37 | test: Release All after VLC returns (B-40) | 5 | refuted | Passes today: with VLC up, every held video releases (the release throws only while VLC is down). Press Release All while VLC is still down, with two held videos: the first throws and the loop stops, leaving the second neither released nor named. | `videoQueueService.js:944-946`; `commandExecutor.js:797-799` |
| C11-38 | test: no child process for a dormant family (B-36) | 5 | holds | — | VLC spawns at `app.js:287` before dormancy at `:326` |
| C11-39 | test: Check Now and timer run the same function (B-59) | 5 | holds | — | as C11-5 |
| C11-40 | test: counters after deletes (B-10 / B-23) | 5 | holds | — | as C11-15 |
| C11-41 | test: scans allowed as soon as the connection is up after a reload (C-25) | 5 | refuted | Passes today: the snapshot that sets the status arrives with the connection and is applied at once. The fault lives in the window before it, and on a connection whose snapshot is lost; the test must target those. | `gmAuth.js:177-182`; `messageRouters.js:118-120`; `unifiedDataManager.js:53-59` |
| C11-42 | test: two GMs add the same team (C-24) | 5 | holds | — | `sessionRegistry.js:26-30`; error returned to the second GM `teamRegistry.js:306-314` |
| C11-43 | test: report totals agree (A-08) | 5 | holds | Needs the toy or parity pack: the shipped pack has no group that pays a bonus. | `ALN-TokenData/game.json` (`groups`: one x1 group of one token); `backend/tests/e2e/fixtures/packs/toy-heist/game.json` (x3 and x2 groups) |

### C13. The engine does not know who is connected

| # | Target | Claim | Verdict | Correction | Evidence |
|---|---|---|---|---|---|
| C13-1 | B-04 / B-27 / D-27 / C-20 | 1, 2 | holds | — | `backend/src/websocket/socketServer.js:53`; `server.js:75-104`; `app.js:116`; guards only `adminRoutes.js:58`, `musicRoutes.js:40`; `healthRoutes.js:88`; tablet reads `connectionWizard.js:82,204-206,339`, `StateValidationService.js:125,148`, `connectionManager.js:66` |
| C13-2 | B-05 | 1, 2 | holds | — | `session.js:380-386`; `server.js:92-95` with an undefined `socket.deviceId` |
| C13-3 | B-89 / D-25 / D-26 | 1, 2 | holds | — | `syncHelpers.js:36-48,63-81`; every socket joins `gm` (`gmAuth.js:102-103`); `scoreboard.html:1745-1789,1493` |
| C13-4 | B-26 / D-28 / B-81 | 1, 2 | holds | — | `backend/src/routes/resourceRoutes.js:204-206`; `socketServer.js:85-86,118-124`; `scoreboard.html:1563`; no scoreboard path in `openapi.yaml` |
| C13-5 | B-90 / D-29 | 1, 2 | holds | — | `gmAuth.js:61-64`; one id per serve `resourceRoutes.js:205` |
| C13-6 | B-82 | 1, 2 | holds | — | planned; `gmAuth.js:55-66` |
| C13-7 | B-83 | 1, 2 | holds | — | planned; `backend/src/middleware/auth.js:13-14` |
| C13-8 | B-66 | 1, 2 | holds | — | `adminEvents.js:165`; `commandExecutor.js:152-163`; `socketServer.js:85` |
| C13-9 | B-70 / C-19 | 1, 2 | holds | — | `socketServer.js:85-104` (skipped with no game, `:89`); `connectionWizard.js:203-226`; `orchestratorClient.js:77-86` |
| C13-10 | B-71 / D-32 | 1 | corrected | Holds, and a typed poll would not help: `/health` accepts only "player" and refuses any other type. | `OrchestratorService.h:344`; `healthRoutes.js:54,64-71` |
| C13-11 | B-71 / D-32 | 2 | holds | — | identity taken from the route's default |
| C13-12 | D-33 | 1, 2 | holds | Note: its "only grows" half is C11's B-10. | `healthRoutes.js:73-93`; `removeDevice` `sessionService.js:679`, `sessionRegistry.js:119`, no caller |
| C13-13 | D-34 | 1 | holds | — | `setInsecure()` at `OrchestratorService.h:714,945,979` |
| C13-14 | D-34 | 2 | refuted | The reverse direction: the device cannot tell the engine from an impostor, because the kit's self-signed certificate is pinned and distributed nowhere. C13 is about the engine's view of its clients; the kit's certificate belongs with **C15** (its "kit network, DNS and certificate" capability). | as C13-13 |
| C13-15 | D-45 | 1, 2 | holds | Note: in the config tool, not the engine; same mechanism. | `config-tool/server.js:22,76-77,129-135`; `config-tool/lib/toolAuth.js:31-32,100-109` |
| C13-16 | other place: emits to every socket | 3 | corrected | Seven emits, not eight: six in `broadcasts.js` and one in `deviceHelpers.js`. | `broadcasts.js:75,120,166,223,464,604`; `backend/src/websocket/deviceHelpers.js:32` |
| C13-17 | other place: handshake and poll trust the client's type | 3 | holds | — | `server.js:123`; `healthRoutes.js:50-76` |
| C13-18 | other place: `/api/tokens` to anyone | 3 | holds | — | `resourceRoutes.js:53-65` |
| C13-19 | other place: web `PLAYER_<ms>` id | 3 | holds | — | `orchestratorIntegration.js:20-29,420-425` |
| C13-20 | other place: three display ids, two open reads | 3 | holds | — | `scoreboard.html:742-768,1231,1493` |
| C13-21 | other place: station names from an open list | 3 | holds | — | `connectionWizard.js:204-227` |
| C13-22 | statement | 4 | corrected | A design cause, but role is no longer the client's word once a socket offers a credential: tier and functions come from the verified token, transactions check the tier, commands check verified functions, and displays are told apart by verified tier. The client's word still decides whether a credential is asked for at all, and the station id. | `socketServer.js:53,64-72,105-124`; `adminEvents.js:50,165`; `commandExecutor.js:152-163`; `gmAuth.js:53-61` |
| C13-23 | test: no-token socket, `sync:request` (B-04) | 5 | holds | — | `server.js:75-104` |
| C13-24 | test: `GET /api/state` with no token (B-27 / D-27) | 5 | holds | — | `app.js:116` |
| C13-25 | test: a TV receives only its role's events (D-25, D-26) | 5 | holds | — | as C13-3 |
| C13-26 | test: two TVs show as two displays (B-90 / D-29) | 5 | holds | — | as C13-5 |
| C13-27 | test: same name with no game (B-70 / C-19) | 5 | holds | — | as C13-9 |
| C13-28 | test: an ESP32 poll says esp32 (B-71 / D-32) | 5 | holds | — | as C13-10 |
| C13-29 | test: `?deviceId=GM_001` (B-81) | 5 | refuted | Passes today: the scoreboard credential is minted for "SCOREBOARD" whatever the URL says, the socket's id comes from the verified token, and displays get no device record, so nothing is recorded or disconnected as GM_001. It guards the planned per-display mint, which is not built. | `resourceRoutes.js:204-206`; `socketServer.js:120-122`; `gmAuth.js:61-64`; `backend/src/websocket/deviceTracking.js:15-26` |

### C15. The deployed game is several separately versioned parts

| # | Target | Claim | Verdict | Correction | Evidence |
|---|---|---|---|---|---|
| C15-1 | A-90 | 1, 2 | holds | — | `backend/package.json:71-78`; `.gitmodules` (`branch = main`) |
| C15-2 | A-91 | 1, 2 | holds | — | `.gitmodules` (`update = merge` on all four) |
| C15-3 | A-92 | 1, 2 | holds | — | `backend/public/gm-scanner -> ../../ALNScanner/dist`; `backend/package.json:8-9`; `DEPLOYMENT_GUIDE.md:2797` at `12baf920` (2790 at HEAD) |
| C15-4 | A-93 | 1, 2 | holds | — | `backend/scripts/build-scanner.sh:24-29` |
| C15-5 | A-95 | 1, 2 | holds | — | `CONTEXT.md:55` ("Asset channel"); `.gitignore:10` (`backend/public/videos/*.mp4`) |
| C15-6 | A-96 | 1 | corrected | Checkable, and present: the installer exists only on blue's branch, and the current tree has neither an installer nor any check for the hook. | `git show origin/production-2026-07:scripts/install-production-push-guard.sh` (exists); no such file under `scripts/` in the tree |
| C15-7 | A-96 | 2 | holds | — | an unversioned part with its own hand step |
| C15-8 | A-97 | 1, 2 | holds | — | not checkable without the Notion sync; pruning report-only per root `CLAUDE.md` |
| C15-9 | A-88 | 1 | corrected | The tree does carry the rule, in its wrong form: two documents give `bluez5.roles = [ a2dp_sink ]`, the role blue found wrong (a speaker needs `a2dp_source`). The deployable folder holds only the VLC rule. Status present: a machine built from the tree's documents gets the wrong role. | `docs/ARCHIVE/2026-02-to-05-completed-plans/2026-02-09-environment-control-phase0.md:229`; `docs/proposals/environment-control-phase0-prd.md:166`; `docs/wireplumber/` (two VLC files only); blue `git show origin/production-2026-07:docs/plans/2026-09-15-alnscanner-wiring-fixes-plan.md` line 283 |
| C15-10 | A-88 | 2 | holds | — | a host file no step compares with the tree |
| C15-11 | other place: `.gitmodules` | 3 | holds | — | as C15-1, C15-2 |
| C15-12 | other place: build script and symlinks | 3 | holds | — | `backend/package.json:8,71-78`; `backend/public/player-scanner -> ../../aln-memory-scanner` |
| C15-13 | other place: `DEPLOYMENT_GUIDE.md:2797` | 3 | holds | Line 2790 at HEAD. | as C15-3 |
| C15-14 | statement | 4 | corrected | A design cause, but "nothing compares them afterwards" is too strong for the pack: activation refuses a pack whose declared schema version the engine does not read. Nothing compares submodule pins, the built scanner, media on disk, host rules or hooks. | `backend/src/services/packService.js:38-45,725-726,759-760` |
| C15-15 | test: rollback status check (A-91) | 5 | holds | — | no such check in the tree |
| C15-16 | test: page shows the build id (A-92) | 5 | holds | — | no build id served |
| C15-17 | test: build compares the lock file (A-93) | 5 | holds | — | `build-scanner.sh:24-29` checks only the folder |
| C15-18 | test: pre-show check lists missing media (A-95) | 5 | holds | — | the gate never checks venue files (`CONTEXT.md` §2, "The gate"); `validateCommand` has no caller (B-35) |
| C15-19 | test: a fresh clone refuses a wrong-branch push (A-96) | 5 | holds | — | as C15-6 |

### Set-aside entries

| # | Target | Claim | Verdict | Correction | Evidence |
|---|---|---|---|---|---|
| S-1 | A-44 | set-aside | holds | — | `_cell()` `ALNScanner/src/core/sessionReportGenerator.js:426-431` at every table sink (`:178,238,330`); pipe test `ALNScanner/tests/unit/core/sessionReportGenerator.test.js:338-346` |
| S-2 | C-52 | set-aside | holds | — | `ALNScanner/src/ui/renderers/HealthRenderer.js:73-80,109-116,141,194`; pattern listed at C11's last other place |
| S-3 | D-86 | set-aside | holds | — | `ALNScanner/tests/unit/ui/renderers/HealthRenderer.test.js`: 22 lines mention `dormant` |
| S-4 | B-99 | set-aside | holds | The fix has since landed at HEAD (`089dd527`). | `git show 12baf920:backend/.env.example` has neither variable; HEAD lines 176-180 have both |
| S-5 | B-80 | set-aside | refuted | Not a one-off: the same cause (a lookup keyed by a client- or tag-supplied string in a plain object, so a key such as `constructor` reads a prototype member) occurs in at least three other places: the claim registry keyed by the station id, the tablet's token lookup keyed by the scanned id, and the web scanner's token lookup (missed fault M2). Keep it a plain fix, but one that covers every such lookup. | `commandExecutor.js:916`; `session.js:381-386,406-411`; `transactionService.js:696-713`; `ALNScanner/src/core/tokenManager.js:282`; `aln-memory-scanner/js/app.js:399` |
| S-6 | C-45 | set-aside | holds | — | `MonitoringDisplay.js:118-131`; its element exists (`ALNScanner/index.html:467`) |
| S-7 | B-84 | set-aside | holds | Note: its profile-check fixture and credentials-test items are the same faults C16 keeps as D-80 and D-81; cross-reference them. | backend sheet row B-84 ("Not an engine fault") |
| S-8 | B-97 | set-aside | holds | — | `git show 12baf920:backend/CLAUDE.md` line 522 names `standingCues`, absent from `backend/src`; `backend/tests/contract/websocket/service-domain-state.test.js:30` calls `getState()` |

## 2. Missed faults

No reader sheet records these; each was met while checking the rows above.

| # | What happens during a game | Evidence | Nearest cause |
|---|---|---|---|
| M1 | When the engine's picture of VLC is wrong (a dropped or late signal), the 15-second health probe re-reads VLC's play state and quietly corrects the engine's record, but announces it on an event nothing listens to for VLC. The GM's video panel and the queue's wait for "playing" are never told; they move only on the next real signal. | probe `serviceHealthRegistry.js:236-244` → `mprisPlayerBase.js:158-176` (emits `playback:changed`, `:170`); listeners for `playback:changed` are on the music service only (`broadcasts.js:505-507`, `cueEngineWiring.js:142-146`); the panel push and the queue's wait hear only `state:changed` (`broadcasts.js:512`, `videoQueueService.js:329`), emitted only at `vlcMprisService.js:471` | C3 |
| M2 | A GM station named `constructor` or `__proto__` reads a prototype member as its claimed-token list, so its sync and its claims break; a tag or QR code whose text is `constructor` is treated as a known token on the tablet and the web scanner. The same slip as B-80, in three more places. | `backend/src/models/session.js:381-386,406-411` and `backend/src/services/transactionService.js:696-713` (plain object keyed by the station id, `session.js:66`); `ALNScanner/src/core/tokenManager.js:282`; `aln-memory-scanner/js/app.js:399` | set-aside (plain fix with B-80) |
| M3 | The tree's own documents carry the Bluetooth role blue found wrong. A machine set up from them pairs a speaker that connects with no audio profile, and no deployable copy of the right rule exists. | `docs/ARCHIVE/2026-02-to-05-completed-plans/2026-02-09-environment-control-phase0.md:229`; `docs/proposals/environment-control-phase0-prd.md:166`; `docs/wireplumber/` holds only the VLC rule | C15 |
| M4 | No test layer runs the Reset System the show runs. The cross-service listener registry tracks and removes listeners only when `NODE_ENV` is `test`, which the unit, contract, integration and end-to-end engines all use. Under test, the reset removes and re-adds cue forwarding once; in production it removes nothing, so video, clock, sound and cue-completion forwarding double (B-03) and music cue forwarding survives (C5-1). A green reset test cannot catch either. | `backend/src/websocket/listenerRegistry.js:13,24,44-47`; E2E engine runs `NODE_ENV=test` (`broadcasts.js:381-383`); `systemReset.js:80,168-180` | C16 |

## 3. Placement moves at a glance

For the merge into section 6 of the cause analysis:

- To **C11**: B-60 (from C1), B-45 (from C3).
- To **C3**: B-78 (from C11).
- To **C14**: A-62, A-66's correlation half (from C3); A-26's dead path (from C9).
- To **C4**: A-67 (from C3); B-55, C-36 (from C5); also C5's other place `systemReset.js:228-241` for its missing end-of-reset snapshot.
- To **C10**: D-11 (from C7); C3's other place `soundService.js:42-51`.
- To **C15**: D-34 (from C13).
- To **C9**: C1's other place `aln-memory-scanner/js/app.js` (already listed there).
- Out of the causes (set aside): B-08 (owner question), A-35 (one-off), B-91 (no game symptom), A-66's dead arrow function (one-off).
- C3's statement should cover writes as well as reads, or B-94 / A-71 and A-70 need a row of their own.
- B-80 leaves "one-off": its plain fix must cover M2's places.
