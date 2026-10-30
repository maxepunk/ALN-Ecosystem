# Cause analysis check 2 (refute by default)

Phase 1, step 1 of the architecture pass: the check over part of `2026-10-30-cause-analysis.md`.

- **Date:** 2026-10-30.
- **Share checked:** causes C2, C4, C6, C8, C10, C12, C14, C16; set-aside entries B-96, D-77, B-98, B-100, D-19, D-42, B-92, C-17.
- **The tree:** `/home/user/ALN-Ecosystem`, branch `claude/nice-curie-hescfv`, ALNScanner at `e83723c`, the other three submodules at their pins and clean. The checkout stands at `367a948a`, not `12baf920`. `git diff --stat 12baf920 HEAD` touches one engine file, `backend/src/services/audioRoutingService.js`: green's boot-check fix replaced lines 611-630, and every line after it moves down 5. Citations into that file were read from `git show 12baf920:backend/src/services/audioRoutingService.js`. Every other file is the same at both commits.
- **Method:** read only, nothing run. Blue's records were read with `git show origin/production-2026-07:<path>` and `git show <blue commit>`. `backend/.env` was not opened; only `git ls-files` ran on it. Nothing under `.worktrees/` or the top-level stale copies was read.
- **Verdict words:** *holds* (confirmed in the current tree or the cited record); *refuted* (the claim is false); *corrected* (the claim is partly right, or right with a wrong citation or the wrong cause). Claim kinds: 1 citation and status; 2 the finding belongs under this cause; 3 an "other place" has the same cause; 4 the statement is a design cause, not the symptom; 5 the proving test would fail on today's engine; S the set-aside reason. A row marked "1, 2" covers both claims with one verdict; the counts in the last section count claims, not rows.

## C2. A service's health and its own state are two facts on two delivery paths

| Target | Claim | Verdict | Correction | Evidence |
|---|---|---|---|---|
| C2 statement | 4 | holds | Note: the statement carries a second mechanism in its last two sentences, the hand-written list of events that push a service's state. That mechanism alone, with no health change, explains the tablet half of A-17 / B-56 and A-102. | `backend/src/websocket/broadcasts.js:536-538` (health pushes only the health domain), `:505`, `:542`, `:549`, `:556` (per-domain event lists) |
| A-11 | 1, 2 | holds | When Home Assistant comes back, the engine only logs and stops retrying; nothing re-sends the lighting state. | `broadcasts.js:536-538`, `:556`; `backend/src/services/lightingService.js:119-129` (health change logs only), `:90-95` and `:335` (`connected` read from the registry at push time); `refreshScenes` has one caller, the GM command, `backend/src/services/commandExecutor.js:634` |
| A-12 / B-33 / C-43 | 1, 2 | holds | The tablet moves the progress bar on its own timer, so it keeps moving when no music push arrives. | `backend/src/services/musicService.js:230-233`; `broadcasts.js:505`; `backend/src/services/mprisPlayerBase.js:187`; `backend/src/services/bluetoothService.js:446`; `lightingService.js:333-338`; `backend/src/services/serviceHealthRegistry.js:97-105`; `ALNScanner/src/network/messageRouters.js:170-175`; `ALNScanner/src/admin/MonitoringDisplay.js:88-186`; `ALNScanner/src/ui/renderers/MusicRenderer.js:348` (250 ms tick) |
| A-72 | 1 | holds | On this tree no music push follows MPD's death (only the health row is pushed), so the stale "playing" reaches tablets through the next snapshot, not a push. | `musicService.js:609-618` resets the client and `connected` only; `state` and `track` keep their values (`:74-77`); snapshot `backend/src/websocket/syncHelpers.js:225-246` |
| A-72 | 2 | corrected | Belongs to C3. The engine's cached picture of MPD outlives MPD. One record carrying health and state, C2's remedy, would still say "playing". Blue's fix was to reset the cached state when MPD exits. | blue `git show origin/production-2026-07:docs/plans/2026-09-15-alnscanner-wiring-fixes-plan.md`, lines 285 and 337-341 (FB spec: "reset `this.state = 'stopped'`, `this.track = null`" in the `exited` handler) |
| A-73 | 1 | holds | Confirmed: MPD restarts after 5 s, but the engine reconnects only at the next 15 s health sweep. Until then the command gate refuses every music command. | `musicService.js:603-618` (no `restarted` handler; only `backend/src/services/vlcMprisService.js:132` has one); `backend/src/utils/processMonitor.js:18`, `:149-154`; `musicService.js:166-191` (reconnect only inside `checkConnection`); `serviceHealthRegistry.js:233-259`; gate `commandExecutor.js:208-215` |
| A-73 | 2 | corrected | Belongs to C3. The fault is that the engine re-reads MPD only on a periodic sweep and ignores the supervisor's restart. A joined record would not shorten the wait. | blue PLAN line 285 ("trigger a reconnect from the supervisor's `restarted` event") and lines 337-341 |
| A-74 | 1 | holds | | `MusicRenderer.js:73` hard-codes `music--connected`; `:52-53` disable controls with no message |
| A-74 | 2 | corrected | Belongs to C10 (a failed state drawn with a normal look). Blue's reader filed it there (A-c9). The merge moved it to C2 without recording the move in its joins note. | `2026-10-30-causes-blue.md:104` (cause A-c9), `:221`; `2026-10-30-cause-analysis.md:1087` ("A-c9→C10 (A-16 kept; A-46 moved…)"; A-74 not mentioned) |
| B-34 | 1 | holds | Music connects at boot before the dormancy pass, so a dormant music service still sets its own flag to true. | `musicService.js:73,86,230-233`; latch `serviceHealthRegistry.js:81-87`; `backend/src/app.js:231` then `:326` |
| B-34 | 2 | corrected | Two halves. A private "connected" flag beside the registry is a second answer to "is music connected": C11, where its reader filed it (B-c6). Only "setting the flag pushes nothing" is C2's. | `2026-10-30-causes-backend.md:66` (cause B-c6); root `CLAUDE.md` names `musicService.js:73`/`:231` as the one service that still keeps its own flag |
| A-17 / B-56 | 1 | holds | Read at `12baf920` (lines unchanged at HEAD). | `audioRoutingService.js:534-552` (`setStreamVolume` emits nothing); `broadcasts.js:549` (no volume event) |
| A-17 / B-56 | 2 | corrected | Two halves, neither caused by health and state travelling apart. The tablet half comes from the hand-written push list alone (C2 holds it only under its statement's second clause). The "at the sound server" half is C3's A-56: the engine never hears a stream volume changed outside it, so even a volume event in the push list would not reach the slider. B-56's own proving test is that case. | `2026-10-30-causes-backend.md:88` (test: "with `pactl` outside the engine"); `audioRoutingService.js:796-826` at `12baf920` (handles sink and sink-input new/remove and card change; no sink-input `change`); cause analysis C3 row A-56 (`2026-10-30-cause-analysis.md:169`) |
| A-102 | 1, 2 | holds | | `broadcasts.js:495-570` |
| Other place `broadcasts.js:541-558` | 3 | holds | | `:542`, `:549`, `:556`: no health and no volume event |
| Other place `musicService.js:73,86,120,231` | 3 | holds | Its main fault is C11's (see B-34). | `musicService.js:73`, `:86`, `:120`, `:231` |
| Other place `mprisPlayerBase.js:137-141,187` | 3 | holds | | `mprisPlayerBase.js:136-141`, `:187` |
| Other place `bluetoothService.js:77-105,446` | 3 | holds | | `bluetoothService.js:74-109`, `:446` |
| Other place `cueEngineService.js:1168`, `gameClockService.js:17,279` | 3 | holds | Health is written apart from the state beside it: the cue engine reads "down" after a reset and "healthy" after a load; the clock always reads "healthy". No game-visible fault is shown at these lines. | `backend/src/services/cueEngineService.js:161`, `:227`, `:1168`; `backend/src/services/gameClockService.js:17`, `:279`; `backend/src/services/systemReset.js:221` |
| Other place `broadcasts.js:376-413` | 3 | refuted | This is service-to-service wiring: video and sound events trigger ducking and routing. It carries no health and delivers no state to a screen. It belongs with C3's A-70 only. | `broadcasts.js:372-411` ("INTER-SERVICE COORDINATION (not broadcasts)") |
| Other place `EnvironmentRenderer.js:89-93` | 3 | holds | Scene tiles are built once from the lighting record and never redrawn on a health change. | `ALNScanner/src/ui/renderers/EnvironmentRenderer.js:90-94` |
| Other place `HealthRenderer.js:73-86` | 3 | corrected | Not C2. The fault at these lines is a summary drawn from health alone without the profile's load result: C10's B-72 / C-48, which C10 already cites here. | `ALNScanner/src/ui/renderers/HealthRenderer.js:73-86`, `:123-124` |
| Other place `MusicRenderer.js:114-116` | 3 | holds | | `MusicRenderer.js:114-120` |
| Other place `MonitoringDisplay.js:296-308` | 3 | refuted | "Return to Video" joins the display mode (a discrete event) and the video status. Neither is a service's health, and the button is recomputed whenever either arrives. | `MonitoringDisplay.js:113-116`, `:275-289`, `:298-307` |
| Test: stop and restart MPD | 5 | holds | Fails today: only the health row is pushed; reconnect waits for the sweep. | `broadcasts.js:536-538`; `musicService.js:609-618`; `serviceHealthRegistry.js:246` |
| Test: stop and start Home Assistant | 5 | holds | Fails today. | `lightingService.js:119-129`; `commandExecutor.js:634` |
| Test: change Music volume on tablet 1 | 5 | corrected | Name the audio panel's per-stream slider. The Music panel's own slider already reaches other tablets: MPD reports the new volume and the music push list carries `volume:changed`, so a test on that slider passes today. | per-stream path `ALNScanner/src/admin/AudioController.js:42` → `commandExecutor.js:957` → `audioRoutingService.js:534-552` (silent); Music slider path `musicService.js:291-300`, `:540-551` → `broadcasts.js:505` |
| Test: latch music dormant, then connect MPD | 5 | holds | Fails today. | `app.js:231` before `:326`; `serviceHealthRegistry.js:81-87`; `musicService.js:231` |
| Test: a service event no push list covers | 5 | corrected | The fault it guards (a volume change) emits no event at all, so a check over emitted events cannot see it. It needs a state check: compare `getState()` before and after every setter and command. As written it would trip today only on `ducking:failed` and `routing:error`, whose effect on state is not verified. | `audioRoutingService.js:534-552`; at `12baf920` `:95` (`ducking:failed`), `:1126` (`routing:error`); `broadcasts.js:549` |

## C4. No fact or copy declares what happens to it at a game boundary

| Target | Claim | Verdict | Correction | Evidence |
|---|---|---|---|---|
| C4 statement | 4 | holds | Note: its list of boundaries leaves out the socket reconnect, the moment B-24 / C-59 and C-27 turn on. | `2026-10-30-cause-analysis.md:207` |
| B-61 / D-31 | 1, 2 | holds | The restore even skips the clock and cue engine for an ended game (`status !== 'ended'`) yet still makes that game current. | `backend/src/services/sessionService.js:108-111`, `:151`, `:164`, `:530-534`; `backend/src/routes/scanRoutes.js:36-50` (comment `:42` assumes an ended game is null) |
| A-01 / C-39 | 1, 2 | holds | | `sessionService.js:549-554`; `syncHelpers.js:49`, `:63` (no game, no transactions), `:133`; `messageRouters.js:121-123`, `:198`; `ALNScanner/src/core/unifiedDataManager.js:337-339`, `:944-951`; `backend/public/scoreboard.html:1752-1779` |
| B-17 / C-38 | 1, 2 | holds | Only `_reset` clears the spent and fired sets. Starting, suspending and creating a game do not; the GM's re-enable clears one cue. | `cueEngineService.js:55-97` (`:68`, `:84`), `:298`, `:419-427`, `:1166-1167`; `sessionService.js:200-260`, `:503-556`; `ALNScanner/src/admin/SessionManager.js:30-31`; `ALNScanner/src/app/domains/gameAdmin.js:307-343` |
| B-24 / C-59 | 1 | corrected | The restart half has no visible effect: after a restart every device is already "disconnected" in memory, and the name check reads memory. The refusal happens when a tablet reloads without closing its old socket (lost Wi-Fi, a sleeping tablet), until the server's ping timeout notices (25 s ping plus 60 s wait). A clean reload closes the socket and the server frees the name at once. | `sessionService.js:128-140`; `backend/src/websocket/socketServer.js:85-104`; `backend/src/config/index.js:76-77`; `backend/src/server.js:117-119` → `backend/src/websocket/deviceTracking.js:15-26` |
| B-24 / C-59 | 2 | corrected | Belongs to C13. A station is known by the name it types, and the server allows one live socket per name, so a station cannot replace its own stale socket. A lifetime table would not change that. | `socketServer.js:82-104` |
| B-32 | 1, 2 | holds | Every GM token must be in the in-memory set, so a restart empties it. | `backend/src/middleware/auth.js:13-14`, `:94`; `systemReset.js:129` |
| B-41 | 1, 2 | holds | | `cueEngineService.js:745-752` (no timer), `:861-868` (10 s only for a busy video), `:93-96`; `backend/src/services/heldItemsStore.js:214-219`, `:258`; `backend/src/services/videoQueueService.js:1065` |
| B-42 | 1, 2 | holds | "A cue waiting on a video never times out": not verified. | `cueEngineService.js:1107-1111`, `:424-427`; `sessionService.js:518-522` |
| B-54 | 1, 2 | holds | | `server.js:185-198` (no `soundService` cleanup); `lightingService.js:439` |
| B-51 | 1, 2 | holds | Its reader's cause, B-c10, names "no stated end state", which is C4's. | `gameClockService.js:75-97` (comment `:77-78`) |
| B-18 | 1 | holds | | `sessionService.js:317` (active), `:327-329` (pack read), `:332` (clock start) |
| B-18 | 2 | corrected | Belongs to C11, where its reader filed it (B-c6). Session status and clock status are two answers to "is the game running", set by separate steps. A lifetime table neither orders nor rolls back those steps. | `2026-10-30-causes-backend.md:50` |
| B-85 / C-49 | 1, 2 | holds | | `syncHelpers.js:63-81`; `backend/src/models/transaction.js:127`; `messageRouters.js:94` |
| C-05 | 1, 2 | holds | On reload the first snapshot runs the boundary check before it records the game, so the queue is wiped. | `unifiedDataManager.js:50`; `messageRouters.js:94` before `:120`; `ALNScanner/src/network/networkedSession.js:250-258`; `ALNScanner/src/network/networkedQueueManager.js:34`, `:401-405` |
| C-16 | 1 | holds | Nothing writes the two keys the clean-up removes; the real mode key is `gameSessionMode`. | `ALNScanner/src/services/StateValidationService.js:90-96`, `:182`, `:185`; `ALNScanner/src/app/sessionModeManager.js:107` |
| C-16 | 2 | corrected | Two halves. The wrong-key half is C14 (a key name kept by hand on two sides, failing silently). Only "auto-reconnect needs a game" is C4. | as above |
| C-18 | 1, 2 | holds | | `ALNScanner/src/core/storage/NetworkedStorage.js:60` (no `removeItem` for it in `ALNScanner/src`); `ALNScanner/src/ui/settings.js:52`; `ALNScanner/src/ui/connectionWizard.js:384` |
| C-27 | 1 | corrected | The stale reference is real, but nothing in networked mode uses it. Every NetworkedStorage method that touches the socket is called only inside a standalone branch, networked scans go through the queue manager's own live socket, and nothing reads `dataManager.isReady()`. No effect during a game. | `ALNScanner/src/app/app.js:541-542`; `ALNScanner/src/network/orchestratorClient.js:88`; callers only under `isStandalone()`: `ALNScanner/src/app/domains/gameOps.js:494`, `:556`, `:600`, `gameAdmin.js:35`, `:119`, `:186`; networked scan `gameOps.js:337-346` |
| C-27 | 2 | corrected | Belongs to C14: the same unwired networked command path as A-28 / A-41 / C-12. | C14 row A-28 / A-41 / C-12 |
| C-40 | 1, 2 | holds | | `unifiedDataManager.js:542-560` (comment `:557-558`), `:954-957`; `MonitoringDisplay.js:22` |
| C-41 | 1, 2 | holds | | `ALNScanner/src/core/storage/LocalStorage.js:79-86` |
| Other place `sessionService.js:503-556` | 3 | holds | | read in full |
| Other place `heldItemsStore.js:214-219,258`, `videoQueueService.js:1051-1070` | 3 | holds | `releaseAll` and `discardAll` have no caller either. | `cueEngineService.js:95` (the only `reset()` call); `heldItemsStore.js:180`, `:204` |
| Other place `musicService.js:433-440` | 3 | corrected | Same cause, wrong detail: the "paused by the clock" flag also clears on a system reset. It is never cleared at game end or a new game. | `musicService.js:433`, `:440`, `:558` |
| Other place `auth.js:13-14`, `scanRoutes.js:183` | 3 | holds | | |
| Other place `persistenceListeners.js:44-47` | 3 | holds | Keeping player scans is an explicit decision; the cue sets are simply outside the reset. | `backend/src/services/session/persistenceListeners.js:40-47` |
| Other place `broadcasts.js:214-222,247,265,299-302` | 3 | holds | | |
| Other place `gmAuth.js:117-140`, `sessionRoutes.js:18-24` | 3 | holds | | `backend/src/websocket/gmAuth.js:117-143`; `backend/src/routes/sessionRoutes.js:18-24` |
| Other place `networkedSession.js:246-259`, `scoreboard.html:1473-1486,1687-1730` | 3 | holds | | `networkedSession.js:250`; `scoreboard.html:1474`, `:1692`, `:1699`, `:1746-1749` |
| Other place `aln-memory-scanner/js/app.js:195-215` | 3 | corrected | "No word 'session' in `aln-memory-scanner/js/`" is false. What holds: the seen list is saved and loaded with no game id, and nothing ever clears it. | `aln-memory-scanner/js/app.js:435` (`sessionStorage`); `aln-memory-scanner/js/orchestratorIntegration.js:19`, `:152`, `:158`; `app.js:18`, `:195-215` |
| Test: end, restart, scan | 5 | holds | Fails today. | `sessionService.js:108-111`; `scanRoutes.js:43-50`; `sessionRoutes.js:18-24` |
| Test: end, reconnect, scoreboard | 5 | holds | Fails today. | as A-01 / C-39 |
| Test: once-only cue across games | 5 | holds | Fails today. | as B-17 / C-38 |
| Test: held cue across games | 5 | holds | Fails today. | as B-41 |
| Test: offline scan, reload | 5 | holds | Fails today. | as C-05 |
| Test: reload a GM tablet mid-game | 5 | corrected | A clean reload closes the socket and is accepted at once, so this likely passes today (not run). The test must drop the tablet's network, or kill the browser without a close, before reloading, then expect acceptance within five seconds. | `deviceTracking.js:15-26`; `socketServer.js:89-104`; `config/index.js:76-77` |

## C6. The connect snapshot and the live message for the same fact are built by different code and applied by different rules

| Target | Claim | Verdict | Correction | Evidence |
|---|---|---|---|---|
| C6 statement | 4 | holds | | |
| B-30 | 1, 2 | holds | The two transaction mappings are written twice but carry the same keys today; the session record and the player scan really differ (`id` and `deviceType` in the stored scan; `scanId`, `videoQueued`, `memoryType` in the live one). | `syncHelpers.js:133` vs `broadcasts.js:75-83`, `:120-128`; `syncHelpers.js:63-81` vs `broadcasts.js:192-211`; `backend/src/models/session.js` `addPlayerScan` vs `scanRoutes.js:111-119` |
| B-31 | 1, 2 | holds | Two senders include every device ever seen; four send connected devices only. | `gmAuth.js:165-184`; `server.js:77-99`; `broadcasts.js:98` (no filter), `:312-325`, `:353-367`; `backend/src/routes/stateRoutes.js:34-45` (no filter) |
| B-95 | 1, 2 | holds | | `backend/tests/contract/websocket/sync-full-completeness.test.js`, `backend/tests/integration/music-sync-full-callers.test.js` exist |
| B-68 | 1 | holds | | `gmAuth.js:155`; no `connectionStateRecovery` in `backend/src` |
| B-68 | 2 | corrected | Belongs to C14: a contract field that nothing feeds and no client reads. It is not a difference between snapshot and live message. | `backend/contracts/asyncapi.yaml:884`; no reader of `reconnection` in `ALNScanner/src`, `backend/public` or `aln-memory-scanner/js` |
| C-02 | 1, 2 | holds | | `NetworkedStorage.js:357-359`, `:365-369`, `:410`, `:453-460`; `unifiedDataManager.js:801-811`; `messageRouters.js:96-123` |
| A-22 | 1, 2 | holds | On reload the boundary's "data cleared" event redraws the badge before the snapshot fills the list, and filling it fires no event. | `unifiedDataManager.js:233-238`; `ALNScanner/src/main.js:131-185` (`:149-150`); `messageRouters.js:105-110` |
| A-30 / C-46 | 1, 2 | holds | In this tree the "rebuild" is the session panel's redraw, which writes `--:--` into the clock; a subscriber is never given the current value. | `ALNScanner/src/core/stateStore.js:18-43`, `:50-75`, `:87-90`; `MonitoringDisplay.js:332`; `ALNScanner/src/ui/renderers/SessionRenderer.js:260`, `:284` |
| A-32 / C-44 | 1, 2 | holds | | `messageRouters.js:132-134`, `:140-144`, `:173`; `MonitoringDisplay.js:88-95`, `:105-116`, `:183-188`; `syncHelpers.js:168-191` |
| C-23 | 1, 2 | holds | Minor: a new game's snapshot does replace the list; it is game end and the tablet's own disconnect that leave it as it was. | `MonitoringDisplay.js:22`, `:265-270`, `:341-343`, `:351-355`; `broadcasts.js:98` |
| D-01 | 1, 2 | holds | | `syncHelpers.js:125-146`; `scoreboard.html:1741-1789`, `:1800`, `:1051-1068` |
| D-23 | 1 | holds | | `gmAuth.js:179-184`; `scoreboard.html:1585-1591` |
| D-23 | 2 | corrected | No game-visible fault: two equal snapshots replace the same state twice. Set it aside, or file it under C14 (the connect handshake kept by hand on both sides) if kept. | as above |
| Other place `sessionRoutes.js:36-49` | 3 | holds | | |
| Other place `healthRoutes.js:41,45` vs `syncHelpers.js:151,157`, `auth.js:37` | 3 | refuted | All three call the same two getters, so the pack and profile identity has one builder, not three. | `backend/src/routes/healthRoutes.js:41`, `:45`; `syncHelpers.js:151`, `:157`; `auth.js:35-40` |
| Other place `syncHelpers.js:181-185` | 3 | holds | | |
| Other place `broadcasts.js:297-330` | 3 | holds | | |
| Other place `messageRouters.js:92-99,125-144` | 3 | holds | | |
| Other place `MonitoringDisplay.js:194-199` | 3 | corrected | Same as D-23: the second request comes from the panel's constructor on top of the server's automatic snapshot. No game-visible fault. | `MonitoringDisplay.js:44`; `gmAuth.js:179` |
| Other place `scoreboard.html:1741-1790` | 3 | holds | | |
| Test: same keys, snapshot and live | 5 | holds | Fails today on the session record and the player scan (the transaction mapping alone would pass). | as B-30 |
| Test: six senders agree | 5 | holds | Fails today whenever a disconnected device is in the game. | as B-31 |
| Test: reload shows the History badge | 5 | holds | Fails today. | as A-22 |
| Test: rebuild the panel while the clock runs | 5 | corrected | With the clock running, the snapshot's elapsed time differs from the stored value and the tablet's own tick re-finds the clock element every second, so the test passes today. Run it with the clock paused or stopped. | `SessionRenderer.js:150-156`; `stateStore.js:54-61`; the clock domain is never pushed on a tick (`broadcasts.js:569-575`) |
| Test: reload the kiosk during a video | 5 | holds | Fails today. | as D-01 |
| Test: add a field to the clock state | 5 | holds | Fails today. | `MonitoringDisplay.js:180-188` |

## C8. The engine assumes it owns the machine, and the tests assume they may use it

| Target | Claim | Verdict | Correction | Evidence |
|---|---|---|---|---|
| C8 statement | 4 | holds | | |
| A-75 / D-64 / B-63 / D-52 | 1 | corrected | The shared fixed process files are present, but in this tree a unit run cannot kill the live video player through them. The leftover-reaper kills only when the process's command line contains `cvlc`, and `cvlc` hands over to `vlc` (A-64). What a unit run on the show box can reach: the real VLC signal monitor, whose reaper kills the live engine's monitor; and the mocked pid that is then written over the live process files. Blue's test killed VLC because blue's tree already had the corrected match (W9 P0.3). Not run. | fixed paths `vlcMprisService.js:117`, `musicService.js:607`, `audioRoutingService.js:793` (`12baf920`), `bluetoothService.js:501`, `mprisPlayerBase.js:209`, `backend/src/utils/displayDriver.js:53`; reap `processMonitor.js:61`, `:180-192`, `:195-198`; `vlcMprisService.js:114`; `backend/tests/unit/services/vlcMprisService.test.js:15-16`, `:952`; blue commit `0fef6f7c` ("cvlc execs to vlc"); blue PLAN W10 P2 |
| A-75 / D-64 / B-63 / D-52 | 2 | holds | | |
| D-72 | 1, 2 | holds | Also on every system reset, which re-runs the audio service's start. | `audioRoutingService.js:106-110`, `:597-608` (`12baf920`); `systemReset.js:251-255`; `broadcasts.js:386`, `:413` |
| D-73 | 1, 2 | holds | | `displayDriver.js:146-153` |
| D-74 | 1, 2 | holds | | `musicService.js:47-50`, `:607`; `backend/src/services/mpdConfigBuilder.js:20-25`; `app.js:225` |
| A-64 / D-70 | 1, 2 | holds | | `processMonitor.js:185-186`; `vlcMprisService.js:113-122`; blue commit `0fef6f7c` |
| A-49 / D-71 | 1 | corrected | Status is "gone in blue's form", not "present": one player per run, because the engine adopts the harness's player and each test worker has its own message bus with no fallback to the machine's. What remains is D-56. | `backend/tests/e2e/setup/test-server.js:104-109`; `backend/tests/e2e/setup/session-env.js:58-59`, `:90-96`; `backend/tests/e2e/setup/vlc-service.js:70-105` |
| A-49 / D-71 | 2 | holds | | |
| D-56 | 1, 2 | holds | | `vlc-service.js:95-105`, `:151` (pid kept in memory only) |
| A-76 / D-53 / D-68 | 1, 2 | holds | Eight contract suites call the full start. | `backend/tests/contract/http/state.test.js:22-25` and seven siblings; no `cleanupInitializedServices`; `audioRoutingService.js:938-948` (`12baf920`) |
| A-77 / D-67 | 1, 2 | holds | | `backend/jest.config.base.js:48`; no leak guard in `backend` |
| A-78 | 1, 2 | holds | A hazard only; no such guard exists. | |
| A-79 / D-54 / D-69 | 1, 2 | holds | | no `DISPLAY_DRIVER` in `backend/src`; `systemReset.js:188-193` → `backend/src/services/displayControlService.js:90-94`; `backend/tests/helpers/integration-test-server.js:212-218`; `backend/tests/integration/docker-lifecycle.test.js:1-20` |
| D-49 | 1, 2 | holds | | `session-env.js:99-101`, `:201`, `:208-214` |
| D-50 | 1, 2 | holds | | pins `backend/tests/e2e/flows/07d-03-admin-show-control.test.js:62,82`, `22-player-video-lifecycle.test.js:101,199,252`, `30-full-game-session-multi-device.test.js:121-122`, `admin-state-reactivity.test.js:44`; `session-env.js:218-231`; `backend/tests/e2e/setup/ha-service.js:20`, `:76`; `backend/tests/e2e/setup/sound-service.js:21-24` |
| D-63 | 1, 2 | holds | | `backend/tests/rung1/provision.js:82-114`; `session-env.js:99-101`, `:201` |
| D-51 | 1, 2 | holds | | `backend/tests/rung1/generate-fixtures.js:99`, `:129-132`, `:152-155` |
| D-46 | 1, 2 | holds | | `.github/workflows/test.yml:291-297`; `test-server.js:103` |
| D-55 | 1, 2 | holds | | `test-server.js:102`, `:110` |
| D-43 | 1, 2 | holds | | `config-tool/lib/routes.js:17`; `config-tool/tests/e2e/smoke.spec.js:40-47` (no `ORCHESTRATOR_URL` set) |
| D-57 | 1 | corrected | Wrong path: the file is `backend/tests/e2e/setup/ssl-cert-helper.js`; lines 231 and 257 match. | `backend/tests/e2e/setup/ssl-cert-helper.js:231`, `:257` |
| D-57 | 2 | corrected | Set aside. It weakens certificate checks inside the test process only; it touches nothing on the machine or the live show. | as above |
| D-58 | 1, 2 | holds | The safety check looks for `node src/server.js`, a narrow pattern. | `backend/tests/rung1/up.sh:47-51`; `backend/tests/rung1/down.sh:12`, `:23-27`; `backend/tests/rung1/engine.sh:31-42` |
| D-59 | 1, 2 | holds | | `backend/src/utils/logger.js:12`, `:85-110`; `test-server.js:35`, `:246-247` |
| D-60 | 1, 2 | holds | | `git ls-files backend/.env` lists it (not opened); `jest.config.base.js:32` |
| D-61 | 1, 2 | holds | | `smoke.spec.js:21`; `ALNScanner/playwright.config.js:61-65` |
| D-65 / D-66 | 1, 2 | holds | | `jest.config.base.js:11-44`; `test-server.js:81-88`, `:246-247`; `session-env.js:58-59` |
| D-76 | 1, 2 | holds | Symlink behaviour not run. | `test-server.js:81-88`, `:512-516` |
| D-75 | 1, 2 | holds | | `backend/src` has only `ENABLE_AUDIO_WIRES` |
| A-80 | 1 | holds | | `backend/tests/e2e/flows/21-player-scanner-networked-scanning.test.js:368` |
| A-80 | 2 | corrected | Belongs to C16, or set aside as a one-off. It is a test-isolation fault inside one flow (it rescans a video the previous test left playing), and blue fixed it in the test. Nothing in it shares the machine with the live show. | blue PLAN W10 CLOSED paragraph ("Fix in the test") |
| A-87 | 1, 2 | holds | | `docker-lifecycle.test.js:1-20` |
| B-101 | 1, 2 | holds | Weak fit: the timer half keeps a test process alive; the file half is A-75's. | `serviceHealthRegistry.js:246` (no `unref`) |
| Other place `vlcMprisService.js:95` | 3 | holds | It only logs what it finds. | `vlcMprisService.js:94-100` |
| Other place `config/index.js:142`, `ha-service.js:20` | 3 | holds | | |
| Other place `desktop-control.sh:14-17`, `check-health.sh:44,51` | 3 | holds | Both checks in the health script are also wrong outright (missed M-1, M-2). | `backend/scripts/desktop-control.sh:14-17`; `backend/scripts/check-health.sh:44`, `:51` |
| Other place `displayDriver.js:104,289,290,319` | 3 | holds | | |
| Other place `engine.sh:34-38`, `provision.js:212-224` | 3 | holds | | |
| Other place `jest.config.base.js:11-32`, `:30-36` | 3 | holds | The switches at `:11-18` and `:42-44` apply only when unset; the token at `:32` is the one forced value. | |
| Other place `test_memory_display_css.js:18` | 3 | holds | "Needs a running orchestrator": not verified. | `backend/tests/visual/test_memory_display_css.js:18` |
| Test: unit suite, live player survives | 5 | corrected | In this tree the live player survives (see A-75 above), so the test passes today. Assert instead that every live child (MPD, the signal monitors, the sound-server listener, the kiosk) survives and every `/tmp/aln-pm-*.pid` is unchanged. Fixing A-64 alone would bring back blue's kill of the live player. | as A-75 correction |
| Test: second engine on the host | 5 | holds | Fails today on the sound-server listener, the kiosk and MPD. | `audioRoutingService.js:597-608`; `displayDriver.js:146-153`; `processMonitor.js:180-192` with `musicService.js:604-607` |
| Test: SIGKILL, restart, one player | 5 | holds | Fails today. | as A-64 |
| Test: contract suite leaves no children | 5 | holds | Fails today. | as A-76 |
| Test: integration suite, no browser, HA unchanged | 5 | holds | Fails today. | as A-79 |
| Test: process-killing helpers take no arguments | 5 | refuted | It would pass today: the engine's kill helpers already take no arguments, and the guard A-78 warns about does not exist (A-77). It constrains a future guard; it is not a test that fails on today's engine. | `processMonitor.js:180`; `audioRoutingService.js:597`; `displayDriver.js:122` |

## C10. When a fact is unknown, failed, stale or partial, the screen shows a plausible normal value

| Target | Claim | Verdict | Correction | Evidence |
|---|---|---|---|---|
| C10 statement | 4 | corrected | The headline's first half ("the screen shows a plausible normal value") is the symptom. Lead with the design choices the statement then lists: no fact carries whether it is known, unknown or stale; snapshot builders swallow errors and send defaults; the times that exist are never read; "healthy" means "answers". | `2026-10-30-cause-analysis.md:501`, `:505` |
| B-72 / C-48 | 1, 2 | holds | | `backend/src/gameRules/endpointServices.js:115-117`; `backend/src/services/dormancyService.js:188-194`; `backend/src/services/profileService.js:67-98`; `HealthRenderer.js:73-86`, `:123-124`; no `.profile` read in `ALNScanner/src` |
| B-86 | 1, 2 | holds | | `profileService.js:79-96` checks only kind and schema version |
| B-76 / C-47 | 1, 2 | holds | The tablet's Quick Fire tiles do badge a mixed cue; the standing-cue rows do not. | `cueEngineService.js:773-781`, `:808`; `ALNScanner/src/ui/renderers/CueRenderer.js:121-137` (tile badge), `:156-176`, `:212-220` (rows) |
| A-16 / C-03 | 1 | corrected | Holds except "the dot". The lines cited redraw `#orchestrator-status`, which is not in the page (A-28). The header indicator `#connectionStatus` does turn "disconnected" when the socket reports the drop. | `serviceHealthRegistry.js:97-105`; no `lastChecked` reader in `ALNScanner/src` or `backend/public`; `ALNScanner/src/utils/domEventBindings.js:20-32`; `MonitoringDisplay.js:400-407`; `ALNScanner/index.html:58`; `ALNScanner/src/network/connectionManager.js:44-46`, `:235-239`, `:373-392` |
| A-16 / C-03 | 2 | holds | | |
| A-101 | 1, 2 | holds | | `syncHelpers.js:187-190`; `backend/src/websocket/environmentHelpers.js:18-29`, `:41-60` |
| A-58 | 1 | refuted | Gone in this tree. The one caller already passes `this._sinkCache \|\| []`, and the cache only ever holds null or the parser's array. The undefined value came from blue's `this._lastGoodSinks`. | `audioRoutingService.js:319`, `:72`, `:187`, `:216`, `:232` (`12baf920`); `backend/src/services/audio/pactlClient.js` `parseSinkList` returns `[]` or an array; blue commit `2badc7d5` diff |
| A-58 | 2 | corrected | Set aside as gone. | as above |
| A-10 / A-60 | 1, 2 | holds | | `EnvironmentRenderer.js:164-176`, `:183-194` |
| A-98 | 1, 2 | holds | | `mprisPlayerBase.js:158-176` |
| A-100 | 1, 2 | holds | | `lightingService.js:107-116`; `bluetoothService.js:95-105` |
| A-99 | 1, 2 | holds | Now verified (the row said "not re-read"). | `HealthRenderer.js:79-82` (collapsed unless something needs attention), `:148`, `:211-215` (Check Now only on a down row) |
| C-22 | 1, 2 | holds | | `SessionRenderer.js:150-156`; `ALNScanner/src/ui/renderers/HeldItemsRenderer.js:46`, `:80-82` |
| D-16 | 1, 2 | holds | The ESP32's health check retries six times with back-off before it gives up. | `arduino-cyd-player-scanner/ALNScanner_v5/services/OrchestratorService.h:341-356`, `:1018-1050`, `:1291-1310`; `aln-memory-scanner/js/orchestratorIntegration.js:426-433`, `:463-471` |
| D-21 | 1, 2 | holds | | `scoreboard.html:1578-1606` |
| D-22 | 1, 2 | holds | | `scoreboard.html:974-1000`, `:1608-1617` |
| A-89 | 1, 2 | holds | | `ALN-TokenData/tokens.json`: `cas002`, `cas003`, `tay003` have a null `SF_MemoryType`; no engine warning for it in `backend/src` |
| Other place `serviceHealthRegistry.js:51,94,133,168` | 3 | holds | | |
| Other place `mprisPlayerBase.js:137-141` | 3 | holds | | |
| Other place `EnvironmentRenderer.js:174,191` | 3 | holds | | |
| Other place `HeldItemsRenderer.js:82` | 3 | holds | | |
| Other place `orchestratorIntegration.js:463-471`, `config.h:42` | 3 | holds | | `arduino-cyd-player-scanner/ALNScanner_v5/config.h:42` |
| Other place `scoreboard.html:996,1594` | 3 | holds | | |
| Other place `preflightService.js:83` | 3 | corrected | Line 83 is only the function's signature. The evidence is in the resolver: a need it cannot verify reads "runs" at paper depth. | `backend/src/gameRules/resolution.js:27`, `:154-157` |
| Test: mistyped profile path | 5 | holds | Fails today. | as B-72 |
| Test: mixed cue with lighting dormant | 5 | holds | Fails today; use a standing cue (Quick Fire tiles already badge). | as B-76 |
| Test: Check Now on a down service | 5 | holds | Fails today. | as A-16 |
| Test: cut the tablet's connection | 5 | holds | Fails today on the panels. "The dot" should name the header indicator and the time socket.io takes to notice a silent drop. | as A-16 / C-03 correction |
| Test: kill the engine, player scanners | 5 | holds | Fails today. | as D-16 |
| Test: TV clock after losing the engine | 5 | holds | Fails today. | as D-22 |
| Test: lights offline | 5 | holds | Fails today. | as A-100 |
| Test: untyped token warning | 5 | holds | Fails today. | as A-89 |

## C12. The pack and the files the config tool edits are read at scattered moments; nothing says the pack changed

| Target | Claim | Verdict | Correction | Evidence |
|---|---|---|---|---|
| C12 statement | 4 | holds | | |
| B-07 / D-04 | 1, 2 | holds | The engine does warn once in its log that the pack on disk differs. | `backend/src/routes/resourceRoutes.js:53-65` → `backend/src/services/tokenService.js:75-125` (disk read per call); `backend/src/services/packService.js:1450-1460`; `backend/src/routes/packRoutes.js:34-45`; `app.js:201-203`; `packService.js` `getManifest` (frozen copy plus one warning) |
| B-28 / D-38 | 1 | corrected | Claim holds, citation does not. `config-tool/lib/routes.js:397-442` is the music proxy, and `toolAuth.js:83-96` is the login token fetch. The publish route is elsewhere and calls nothing on the engine; the tool's only message after a publish is "Pack published". | `config-tool/lib/routes.js:184-195`; `config-tool/lib/publish.js` (no fetch or engine call); `config-tool/public/js/app.js:203`; no pack event in `backend/contracts/asyncapi.yaml`; `packService.js:1230-1240` |
| B-28 / D-38 | 2 | holds | | |
| B-20 / C-08 / D-18 | 1, 2 | holds | | `socketServer.js:139-148`; `sessionService.js:116-126`; `ALNScanner/src/core/packLoader.js:23-26`; `ALNScanner/src/core/tokenManager.js:52`; `orchestratorClient.js:97-101`; no `payload.pack` read in `ALNScanner/src`; `orchestratorIntegration.js:432-433`; `OrchestratorService.h:370-386` (reads `timezone` only) |
| D-02 | 1, 2 | holds | | `scoreboard.html:1559-1566` |
| D-03 | 1, 2 | holds | | `scoreboard.html:1229-1255`, `:1491-1505`; `resourceRoutes.js:207-213`; `packService.js:1334` |
| D-05 / A-94 | 1, 2 | holds | | `aln-memory-scanner/js/app.js:61-87`; `backend/src/app.js:131-142`; `backend/public/player-scanner` → `../../aln-memory-scanner`; the two `tokens.json` sha1s differ (`d3d9ead…` vs `d456847…`) |
| D-06 | 1, 2 | holds | | `resourceRoutes.js:19-48`, `:71-83`; `arduino-cyd-player-scanner/ALNScanner_v5/services/AssetService.h:145-158` |
| D-07 | 1 | holds | | `config.h:90`; `arduino-cyd-player-scanner/ALNScanner_v5/services/TokenService.h:223-228` |
| D-07 | 2 | corrected | Belongs to C14, with C10 for the silent refusal. A size limit is kept on the device that no pack check knows about. It is not about when the pack is read. | as above |
| D-08 | 1, 2 | holds | The in-place write is a separate robustness slip. | `arduino-cyd-player-scanner/ALNScanner_v5/Application.h:978-982` (tokens at boot only), `:1497-1509` (the serial command re-syncs assets only); `TokenService.h:243-251` |
| B-29 | 1, 2 | holds | | `backend/src/gameRules/scoring.js:206-208`; `sessionService.js:215-216`; `auth.js:35-40` |
| A-45 | 1, 2 | holds | | `ALNScanner/src/core/sessionReportGenerator.js:285-293` |
| B-88 | 1, 2 | holds | Weak fit; it disappears if the engine serves a frozen copy. The Python builder's symlink behaviour was not verified. | `packService.js:1457-1458` |
| D-39 | 1, 2 | holds | | `config-tool/README.md:54`; `systemReset.js:231-239` |
| D-40 / B-44 | 1, 2 | holds | | `app.js:262-275`; `systemReset.js:196-209`; `config/index.js:133` (no reader); `applyRoutingWithFallback` at `audioRoutingService.js:715` (`12baf920`) has no caller; `:236-239`; `backend/config/environment/routing.json` keys `routes`, `ducking` |
| D-41 | 1, 2 | holds | | `config-tool/lib/toolAuth.js:98-109`; `config/index.js:10` |
| D-44 | 1 | holds | | `toolAuth.js:83-96`; `routes.js:421-441` |
| D-44 | 2 | corrected | Belongs to C4, with C10 for the unexplained refusal. The tool fetches its engine credential once at login and never again, a lifetime its author chose. It is not a pack or file read moment. | as above |
| Other place `auth.js:35-40` | 3 | holds | | |
| Other place `app.js:243-247`, `dormancyService.js:189`, `resourceRoutes.js:207-214`, `tokenService.js:152-166`, `sessionService.js:326-329`, `packService.js:186,233,308` | 3 | holds | `dormancyService.js:189` reads the frozen manifest. | `packService.js` `getManifest` |
| Other place `tokenService.js:99-100` | 3 | holds | | |
| Other place `configManager.js:30,39` | 3 | holds | | `config-tool/lib/configManager.js:30`, `:39` |
| Other place `aln-memory-scanner/js/app.js:98-125` | 3 | holds | | |
| Other place `musicService.js:150`, `README.md:52-55` | 3 | holds | | |
| Test: edit a rating on disk | 5 | holds | Fails today. | as B-07 |
| Test: publish through the tool | 5 | holds | Fails today: the engine is not told and the tool does not say a restart is needed. | `config-tool/public/js/app.js:203` |
| Test: tablet on another pack | 5 | holds | Fails today. | as B-20 |
| Test: player scanner token file equals the pack's | 5 | holds | Fails today. | as D-05 |
| Test: swap a pack mid-game | 5 | holds | In this tree a swap needs a restart, since a pack is activated once per process. | `packService.js:1230-1240`; `sessionService.js:116-126` (warn only) |

## C14. Names, shapes and descriptions that join two places are kept by hand, and nothing checks the sides agree

| Target | Claim | Verdict | Correction | Evidence |
|---|---|---|---|---|
| C14 statement | 4 | holds | | |
| A-03 / A-04 / C-06 | 1, 2 | holds | | `ALNScanner/src/ui/renderers/GameOpsRenderer.js:221`; the facade has no `backendScores` (only `unifiedDataManager.js:553` reaches the strategy's); `getTeamCompletedGroups` only at `unifiedDataManager.js:569-575` and `ALNScanner/tests/app/app.test.js:57`; `:685-741` |
| A-07 / C-15 | 1, 2 | holds | | `ALNScanner/src/core/gameActivityBuilder.js:55-64`; `tokenManager.js:284`, `:296`; `unifiedDataManager.js:313-317` |
| A-23 | 1, 2 | holds | | `GameOpsRenderer.js:352`; `syncHelpers.js:63-81` (no `rfid`) |
| A-63 | 1, 2 | holds | | `backend/src/services/cue/standingEvaluator.js:29`; `videoQueueService.js:479`; `backend/src/services/cue/timelineRuntime.js:357` |
| A-09 / A-69 | 1, 2 | holds | | `audioRoutingService.js:45-49`, `:310-316` (`12baf920`) |
| A-28 / A-41 / C-12 | 1, 2 | holds | The team registry's score fields were not re-checked. | `ALNScanner/src/ui/renderers/VideoRenderer.js:17`; `MonitoringDisplay.js:402`; neither id in `ALNScanner/index.html`; `NetworkedStorage.js:51`, `:137-155` (callers only in standalone branches, see C-27); `ALNScanner/src/ui/uiManager.js:411` (no caller) |
| A-15 | 1, 2 | holds | | `ALNScanner/index.html:407`; nothing in `ALNScanner/src` names `video-queue-container` |
| A-40 / A-42 / A-39 / C-14 | 1 | corrected | Claim holds, one citation does not. `broadcasts.js:98` is the snapshot sent after a game is created; the engine sends `offline:queue:processed` at `:346`, and in production it never fires (B-11). | `broadcasts.js:336-346`; `main.js:164`; `unifiedDataManager.js:161`; `orchestratorClient.js:40`, `:41`, `:46`; no handler outside the list in `ALNScanner/src` |
| A-40 / A-42 / A-39 / C-14 | 2 | holds | | |
| A-31 | 1, 2 | holds | | `ALNScanner/src/app/adminController.js:109-122` (no outside caller) |
| C-13 | 1, 2 | holds | | `adminController.js:94-104`; `SessionManager.js:56`, `:64`; `ALNScanner/src/admin/VideoController.js:36`; `networkedSession.js:183-187`; `MonitoringDisplay.js:391-394` |
| A-47 / B-06 | 1, 2 | holds | | `gmAuth.js:188`; `asyncapi.yaml:295`; `orchestratorClient.js:41`; `commandExecutor.js:366`, `:542`; no GM sender for `transaction:create`, `music:seek`, `video:seek` |
| B-35 / C-53 | 1, 2 | holds | | `commandExecutor.js:98-101`, `:963-968`; `dormancyService.js:50`, `:65` and `validateCommand` (`commandExecutor.js:1013`) have no caller; no GM sender |
| B-11 | 1, 2 | holds | | `backend/src/websocket/adminEvents.js:199-203`; `setOfflineStatus` (`backend/src/services/offlineQueueService.js:206`) has no caller; header `:10-15` |
| B-12 | 1, 2 | holds | Checked: the video queue field, the recent-transactions reader, `archiveOldSessions`. The rest was not re-read. | `backend/src/models/session.js:48-49`; `backend/src/services/transactionService.js:550`; `sessionService.js:565` (no caller) |
| B-14 | 1, 2 | holds | | `backend/src/index.js:8`; `server.js:482-486` |
| D-78 | 1, 2 | holds | | `backend/src/services/persistenceService.js:354` (no caller) |
| D-37 | 1, 2 | holds | | `orchestratorIntegration.js:516-523` (no caller) |
| D-20 | 1, 2 | holds | | `aln-memory-scanner/config.html:389-410`; `server.js:273-275`, `:320-326` |
| D-24 | 1, 2 | holds | Library behaviour not run. | `scoreboard.html:1637-1640` |
| B-50 | 1, 2 | holds | | `syncHelpers.js:225-246`; `broadcasts.js:502`; `asyncapi.yaml:851-855` vs `:2672-2679` |
| B-67 / D-36 | 1, 2 | holds | | `socketServer.js:53`, `:151-152`; `healthRoutes.js:48-93`; `asyncapi.yaml:1710`; `backend/contracts/openapi.yaml:211-216`; no `/scoreboard` path in `openapi.yaml` |
| C-54 | 1, 2 | holds | | `gameOps.js:338-346`; `networkedQueueManager.js:45-47`; `asyncapi.yaml:930-968` (data block: `tokenId`, `teamId`, `deviceId`, `mode`, `summary`) |
| D-48 | 1, 2 | holds | | `backend/package.json:56`; `backend/tests/integration` has `offline-queue-sync.test.js` only |
| Other place `uiManager.js:227,277` | 3 | holds | | neither `modeText` nor `teamDisplay` in `ALNScanner/index.html` |
| Other place: events sent and never heard | 3 | holds | Spot-checked: `team:added`, `settings:saved`, `player-scans:synced` have no listener; `game-state:updated` has no sender. | grep over `ALNScanner/src` |
| Other place `gameOps.js:246-262`, `unifiedDataManager.js:313-316`, `gameActivityBuilder.js:55`, `gameOps.js:311-314` | 3 | holds | | `gameOps.js:246-262`, `:313-314` |
| Other place `timelineRuntime.js:357`, `standingEvaluator.js:28-29` | 3 | holds | | |
| Other place `dormancyService.js:50-69`, `commandExecutor.js:1013-1059`, `heldItemsStore.js:180-209`, `transactionService.js:550`, `session.js:48-49`, `config/index.js:133`, `offlineQueueService.js:12-14` | 3 | holds | | function-level callers checked as above |
| Other place `asyncapi.yaml:2068-2078` | 3 | holds | | `asyncapi.yaml:2071-2073` names the GM scanner as the batch uploader |
| Test: check every event and element id | 5 | holds | Fails today. | as A-28, A-40 |
| Test: Team Details with an adjustment | 5 | holds | Fails today. | as A-03 |
| Test: standing cue "unless token X" | 5 | holds | Fails today: the token id is undefined, so "not X" is always true. | `standingEvaluator.js:29` |
| Test: emitted events equal the contract list | 5 | holds | Fails today. | as A-47 / B-06 |
| Test: scan message with extra fields refused | 5 | holds | Fails today. | as C-54 |
| Test: every route in OpenAPI | 5 | holds | Fails today. | no `/scoreboard` |
| Test: every documented capability has both sides | 5 | holds | Fails today. | as B-35 / C-53 |

## C16. A green test run does not show the real path works

| Target | Claim | Verdict | Correction | Evidence |
|---|---|---|---|---|
| C16 statement | 4 | corrected | The headline's first clause restates the symptom. Lead with the design choices the statement lists: fakes written by hand with no check against the real classes; skips and absence-of-error checks that pass silently; coverage counted per file, not per path from authority to screen. | `2026-10-30-cause-analysis.md:795`, `:799` |
| A-51 | 1, 2 | holds | | `ALNScanner/tests/unit/ui/uiManager.test.js:32`, `:490`; `ALNScanner/tests/unit/ui/xssEscaping.test.js:29`, `:80`, `:147`; `ALNScanner/tests/unit/core/gameActivityBuilder.test.js:3-10`; `ALNScanner/tests/app/app.test.js:57` |
| A-52 | 1, 2 | holds | The switch itself is at `jest.config.base.js:42-44`; the cited `:30-36` is mostly the token and the comment. | `broadcasts.js:376-386`; `jest.config.base.js:33-44` |
| A-83 | 1, 2 | holds | | `backend/tests/e2e/helpers/page-objects/GMScannerPage.js:83`, `:1623`, `:1633`; `GameOpsRenderer.js:341`; flow 30 skips silently, `30-full-game-session-multi-device.test.js:807-819` |
| A-85 | 1 | corrected | `expectScanAccepted` is blue's addition and does not exist here. This tree's `waitForResult()` accepts any result screen, which supports the finding, so "not verified" can become "present at the helper level". | blue commit `75df9ddd`; `GMScannerPage.js:342-343` |
| A-85 | 2 | holds | | |
| A-84 | 1 | corrected | Not a present fault. Blue's failure arose after blue's W5 made routes concrete device names; this tree still reports aliases, so an alias-expecting test passes everywhere (the integration file itself was not read). It becomes a hazard when A-09 is fixed. | `audioRoutingService.js:45-49`, `:310-316` (`12baf920`); blue commit `2badc7d5` message |
| A-84 | 2 | holds | | |
| A-82 | 1, 2 | holds | | `ALN-TokenData/game.json` `groups`: one group, multiplier 1, one token |
| A-81 | 1, 2 | holds | | `backend/tests/e2e/helpers/capabilities.js:26` (per-orchestrator cache), `:151` |
| A-86 | 1, 2 | holds | | no `TZ` in `ALNScanner/package.json` or `ALNScanner/jest.config.js` |
| D-47 | 1 | corrected | Detail: `config-tool` is a plain folder of the parent repository, not a submodule, so GitHub never runs `config-tool/.github/workflows/test.yml` from this repository. The rest holds. | `git ls-tree HEAD config-tool` (a tree); no entry in `.gitmodules`; `.github/workflows/test.yml:19-306` |
| D-47 | 2 | holds | | |
| D-83 / C-51 | 1, 2 | holds | | `ALNScanner/tests/unit/network/networkedSession.test.js:1061` (nine `replace` calls); `messageRouters.js:136` |
| D-84 | 1, 2 | holds | | `backend/tests/unit/services/getState.test.js` (no music block); `backend/tests/contract/websocket/service-domain-state.test.js:29` |
| D-85 | 1, 2 | holds | | `ALNScanner/tests/unit/network/` has no router test |
| D-82 / C-50 | 1, 2 | holds | | `ALNScanner/tests/contract/` holds `sessionReport.contract.test.js` and `fixtures/` |
| D-87 | 1, 2 | holds | | no `toHaveScreenshot` in the three test trees |
| D-88 | 1, 2 | holds | | `backend/tests/rung1/audit-flows.js:166-173` |
| D-62 | 1, 2 | holds | Not-checkable, as recorded. | |
| D-79 | 1, 2 | holds | Not-checkable, as recorded. | |
| D-80 | 1, 2 | holds | Not-checkable, as recorded. | `backend/tests/contract/profile/installation-profile-schema.test.js:166-185` |
| D-81 | 1, 2 | holds | Not-checkable, as recorded. | `backend/tests/e2e/helpers/gm-command.js:9`, `:20` |
| Other place `GMScannerPage.js:1071-1075` | 3 | refuted | The History screen draws Game Activity, whose cards carry `token-card`, so this selector matches. | `ALNScanner/src/main.js:80-82`; `GameOpsRenderer.js:543` |
| Other place `jest.config.base.js:30-36` | 3 | holds | Precise switch at `:42-44`. | |
| Other place: the missing test path | 3 | holds | | D-48, in C14 |
| Test: fakes match the real class | 5 | corrected | Aimed the wrong way. The fault is a fake with a member the real class lacks (`backendScores` on the facade) or a different return shape (a flat `findToken`). "Fails if a fake lacks a method" checks the opposite direction; check extra members and return shapes too. | as A-51; `unifiedDataManager.js` has no `backendScores` |
| Test: the delete step fails with no card | 5 | holds | Fails today (the step skips silently). | `30-full-game-session-multi-device.test.js:807-819` |
| Test: a completable group runs | 5 | corrected | Name the production pack. The toy pack already has two completable groups, so the test as written can pass today on the toy leg. | `backend/tests/e2e/fixtures/packs/toy-heist/game.json` `groups` (Vault Plans x3 over three tokens, Getaway Route x2 over two) |
| Test: a manifest of test commands | 5 | holds | Fails today (a check of the suite). | as D-47 |
| Test: snapshot restores `sound` | 5 | corrected | The engine half passes today; the router already restores `sound`. Only the suite half (the restore test names all ten domains) fails, so this proves a test gap, not an engine fault. | `messageRouters.js:136` |
| Test: a baseline image per screen | 5 | holds | Fails today (a check of the suite). | as D-87 |
| Test: the rig audit covers ten domains | 5 | holds | Fails today. | as D-88 |

## Set aside, with reasons

| Target | Claim | Verdict | Correction | Evidence |
|---|---|---|---|---|
| B-96 | S | holds | Gone. Every health status list in both contracts reads `healthy, down, dormant`. | `backend/contracts/asyncapi.yaml:745`, `:2694-2700`; `backend/contracts/openapi.yaml:2026` |
| D-77 | S | holds | Gone. Minor: F1's code is at `logger.js:181-187`; the cited `:165-177` is its neighbour and comment. | commit `490c83fb` (F1 to F4 and H1); `backend/src/utils/logger.js:176-187` |
| B-98 | S | corrected | Two changes. Status: at `12baf920` the check reads one path, but at HEAD the fix has landed and reads either the 0.5 `.conf` or the 0.4 `.lua`. Reason: it is not a one-off. The engine fixes the names of outside programs to one OS release in other places too: the kiosk browser defaults to `chromium-browser`, the older OS's name, and the health script looks for the `cvlc` wrapper. Nothing checks those names against the machine. That is C15's family (the deployed game assumes one machine and nothing checks it agrees) or a new cause. | `audioRoutingService.js:617-630` (`12baf920`); commits `403cb179`, `6fdc0083`, merge `089dd527`; HEAD `audioRoutingService.js:617-635`; `displayDriver.js:164`; `backend/CLAUDE.md` Display Control section (Trixie must set `CHROMIUM_BIN`); `check-health.sh:51`; program document §7 (`docs/plans/2026-10-30-architecture-pass.md:240-246`) |
| B-100 | S | corrected | Fixed at HEAD for `scripts/requirements.txt`. The same bare `pip install` instruction remains, untouched by the follow-up, in the player scanner's setup script and README. Same cause as B-98. | `scripts/requirements.txt:1-4` (HEAD; commits `ad1855c7`, `fd0340de`); `aln-memory-scanner/scripts/setup.sh:168`; `aln-memory-scanner/README.md:48`; `aln-memory-scanner/PLAYTEST_QUICKSTART.md:27` |
| D-19 | S | holds | A one-off. The only script loaded from the internet by any kit page; the TV now loads Socket.IO from the engine. | `aln-memory-scanner/index.html:138`; `scoreboard.html:735-737`; no absolute `src`/`href` in `backend/public/scoreboard.html`, `ALNScanner/index.html`, `config-tool/public/*.html` |
| D-42 | S | holds | Not a fault: planned work. Minor: Rehearse is row C20 at direction line 98; the reason cites only Deploy. | `2026-10-30-map-direction.md:98`, `:100` |
| B-92 | S | corrected | Holds for three of its four parts (stations in the manifest, the DNS value, the merge order: planning statements, not-checkable). It fails for the checklist. `docs/preflight-checklist.md` is not a planning record; it calls itself the hardware-proven gate's instrument. It has no venue-profile row (its "profile" lines mean Home Assistant, `pactl` and A2DP profiles), so nothing in it checks that the venue profile loaded, and a missing profile (B-72) is not among its checks. That part joins C14: the checklist and the evaluator are two hand-kept lists, and nothing checks they agree. | `docs/preflight-checklist.md:14-17`, `:624`, `:719`, `:779`, `:809-811`; `2026-10-30-causes-backend.md:124` |
| C-17 | S | holds | Outside the engine. Its two contract items sit in C14's B-67 / D-36 row. | `ALNScanner/CLAUDE.md:742` vs `MonitoringDisplay.js:374-378`; `2026-10-30-cause-analysis.md:733` |

## Missed faults

Faults met while checking that no sheet records.

| Id | What happens during a game | Evidence | Where it belongs |
|---|---|---|---|
| M-1 | The operator health script always says "VLC process: Not found" while the show's video player runs, because it looks for a process named `cvlc`, and `cvlc` hands over to `vlc`. | `backend/scripts/check-health.sh:51` (`pgrep -x cvlc`); blue commit `0fef6f7c` ("cvlc execs to vlc"); the sheets list the line only as a machine-wide search (`2026-10-30-causes-clients-tests.md:121`) | C8, with A-64 (the same wrapper-name slip) |
| M-2 | The same script says "Orchestrator process: Running" when only the config tool runs, because its pattern `node.*server.js` also matches the tool's `node server.js`. | `check-health.sh:44`; `config-tool/package.json:7` | C8 (an answer taken from the whole machine) and C10 (a plausible "running" with no proof) |
| M-3 | Hazard for phase 2's order, not a present fault: fixing A-64 alone (making the leftover-reaper match `vlc`) brings back blue's 2026-09-15 incident, a unit test killing the live video player. The unit suites build a real process supervisor against the shared process files, with only `child_process` mocked. | `vlcMprisService.test.js:15-16`, `:952`; `processMonitor.js:61`, `:180-192`; blue PLAN W10 P2 | C8: land the per-run process-file folder (A-75) with or before the A-64 fix |

## Counts

Claims checked: 397 in 283 rows (each "1, 2" row counts as two). Holds 346, refuted 6, corrected 45; missed faults 3.

| Section | Holds | Corrected | Refuted |
|---|---|---|---|
| C2 | 22 | 8 | 2 |
| C4 | 41 | 9 | 0 |
| C6 | 31 | 4 | 1 |
| C8 | 65 | 6 | 1 |
| C10 | 41 | 4 | 1 |
| C12 | 41 | 3 | 0 |
| C14 | 59 | 1 | 0 |
| C16 | 41 | 7 | 1 |
| Set aside | 5 | 3 | 0 |

What changes most, in plain words:

- **C2 is narrower than written.** Of its findings, only the lighting and music panels that never hear an outage (A-11, A-12 / B-33 / C-43) come from health and state travelling apart; A-102 comes from the hand-written push lists the statement also names. MPD's stale "playing" (A-72) and the 20-second wait after an MPD crash (A-73) are C3's: the engine's picture of MPD is not reset or re-read. The greyed card with no offline line (A-74) is C10's. The music service's private flag (B-34) is mostly C11's. The volume finding (A-17 / B-56) splits between C2's hand-written push lists and C3's A-56.
- **Four proving tests would pass on today's engine as written.** They are the Music volume test (C2), the reload test (C4), the panel-rebuild test (C6) and the unit-suite test (C8). Each row says how to aim it so it fails today.
- **One live hazard is mis-described.** In this tree a unit run on the show box cannot kill the live video player, because of A-64's name mismatch. It can kill the live engine's VLC signal monitor and overwrite the live process files. Fixing A-64 alone would bring back blue's 2026-09-15 kill (missed M-3).
- **Two findings have no effect today.** A-58 is gone; C-27's stale socket is never used in networked mode.
- **Green's three follow-ups have landed on the branch since `12baf920`.** B-98 and B-100 are fixed at HEAD, but the cause they share (names and commands fixed to one OS release) remains elsewhere: the kiosk's default browser name, the health script's `cvlc`, the player scanner's `pip` lines. The refuted and corrected rows are the changes for section 6 of the cause analysis.
