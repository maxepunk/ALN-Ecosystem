# GM Command & State-Delivery Flow Review (Wiring Trace)

Scope: GM Scanner (`ALNScanner/`) admin controls ↔ backend `gm:command` execution ↔ `service:state` / broadcast delivery ↔ UI restore on reconnect.
Method: static end-to-end trace of every control chain (DOM handler → WS emit → adminEvents/commandExecutor → service → broadcast → StateStore/renderer → DOM). Every finding below has a concrete trace; no speculation included.

Reviewed at HEAD of working tree, 2026-06-09.

## Summary

| Severity | Count |
|----------|-------|
| P0 (confirmed bug — trace proves misbehavior) | 3 |
| P1 (likely defect — strong evidence, needs runtime confirmation) | 5 |
| P2 (structural debt) | 7 |
| P3 (polish) | 7 |
| **Total** | **22** |

Doc-drift items: 6 (section at end).

---

## Findings

### F-GMCMD-01 | P0 | Video pause is unrepresentable in the GM UI — Pause "succeeds" but the panel keeps showing Playing with an advancing progress bar

- **Files:** `backend/src/services/videoQueueService.js:566-601` (getState), `:488-505` (pauseCurrent), `ALNScanner/src/admin/MonitoringDisplay.js:104-114`, `ALNScanner/src/ui/renderers/VideoRenderer.js:55-90`
- **Trace:**
  1. GM taps Pause → `app.adminPauseVideo()` → `VideoController.pauseVideo()` → `gm:command video:pause` → `commandExecutor` → `videoQueueService.pauseCurrent()`.
  2. `pauseCurrent()` calls `vlcService.pause()` and emits `video:paused` — **it never changes `currentItem` state** (`grep pause backend/src/models/videoQueueItem.js` → no hits; the item state machine has no paused state).
  3. `video:paused` → `pushServiceState('video', videoQueueService)` (`broadcasts.js:492-498`) → `getState()` computes status solely from the queue item: `if (current.isPlaying()) status = 'playing'` — possible values are only `idle|playing|loading|error`. `vlcState.state` ('Paused') is fetched but **only `vlcState.connected` is used** (`videoQueueService.js:567,599`).
  4. GM Scanner: `mapVideoState` → `isPlaying: s.status === 'playing'` → `VideoRenderer` keeps the "Playing" badge/▶️ icon and the rAF interpolation **keeps advancing the progress bar** while VLC is paused. Worse, `getState()` computes `position` from wall-clock `Date.now() - playbackStart` (`:584-588`), so position drifts during the pause and jumps on resume.
- **Effect:** "Pause works but the panel says Playing" — exact "works but feels broken" symptom. There is no code path that can ever render a paused video.
- **Tag:** fix-now / runtime-defect

### F-GMCMD-02 | P0 | "No Bluetooth speaker — audio will use HDMI" warning can never display

- **Files:** `ALNScanner/index.html:447`, `ALNScanner/src/ui/renderers/EnvironmentRenderer.js:174,194`
- **Trace:** `#bt-warning` starts `display:none`. The only writers are both in `renderAudio()` and both **unconditionally hide it** (`if (this.btWarning) this.btWarning.style.display = 'none';` on the rebuild path at :174 and the differential path at :194). The backend emits `routing:fallback` (BT sink vanished → HDMI fallback, `audioRoutingService`) which pushes the `audio` domain → `renderAudio()` → hides the warning again. Grep confirms no other writer (a unit test even asserts it is hidden: `tests/unit/ui/renderers/EnvironmentRenderer.test.js:230`).
- **Effect:** When audio silently falls back to HDMI mid-show, the GM gets zero indication. The warning element + CSS are dead weight.
- **Tag:** fix-now / runtime-defect

### F-GMCMD-03 | P0 | Backend `error` events are never shown to the operator (AsyncAPI Decision #10 violation)

- **Files:** `ALNScanner/src/network/networkedSession.js:350-367`, `ALNScanner/src/app/app.js:137-192`, `backend/src/websocket/broadcasts.js:577-591`, `backend/contracts/asyncapi.yaml` (Error message, "clients MUST display")
- **Trace:** Backend service errors broadcast as `error` (`handleServiceError`, broadcasts.js:578). Scanner forwards them; `networkedSession._messageHandler` dispatches `backend:error` on the session (`:363`) with the comment "group:completed/backend:error are surfaced." But `app._wireNetworkedSessionEvents()` registers listeners for `session:ready`, `auth:required`, `group:completed`, `scoreboard:page`, `transaction:failed` — **no `backend:error` listener exists anywhere** (grep: only the dispatch site + unit tests). Transaction-correlated errors are separately surfaced via `transaction:failed` (queueManager), but generic service errors (session/video/offline service failures) vanish.
- **Tag:** fix-now / runtime-defect

### F-GMCMD-04 | P1 | Clicking a `<select>` admin control dispatches its command — opening the playlist picker restarts the playlist; selecting fires the command twice

- **Files:** `ALNScanner/src/utils/domEventBindings.js:238-246` (click), `:350-365` (change), `ALNScanner/src/ui/renderers/MusicRenderer.js` (`.music__playlist-picker` `data-action="admin.musicLoadPlaylist"`), `EnvironmentRenderer.js:~218` (`data-action="admin.setAudioRoute"` selects)
- **Trace:** The delegated `click` handler skips only `type === 'range' | 'checkbox' | 'radio'`. A `<select>` has `type 'select-one'`, so a plain click on the closed select (to open it) runs `handleAdminAction('musicLoadPlaylist', el)` with the **currently selected value** → `music:loadPlaylist` → `musicService.loadPlaylist()` which **replaces the MPD queue and restarts playback** (`commandExecutor.js:652-659`). Picking an option then fires `change` → the same command again (double fire). Same path applies to `admin.setAudioRoute` selects (re-applies the current route via `pactl` on every click).
- **Needs runtime confirmation** of click-event timing per browser, but Chrome (the target platform) fires `click` on the select on mouseup.
- **Effect:** "Music randomly restarts when I touch the picker."
- **Tag:** fix-now / runtime-defect

### F-GMCMD-05 | P1 | Bluetooth scan results are invisible and pair/unpair is unreachable — the UI invites a flow that cannot complete

- **Files:** `backend/src/services/bluetoothService.js:437-452` (getState: only `pairedDevices`/`connectedDevices`), `ALNScanner/src/ui/renderers/EnvironmentRenderer.js:249-258` (SR-4 comment), `ALNScanner/src/utils/domEventBindings.js:179-183` (dead `pairBtDevice` case), `ALNScanner/index.html:461`
- **Trace:** Scan button → `bluetooth:scan:start` → backend scans, emits `device:discovered` → `pushServiceState('bluetooth')` → `getState()` **contains no discovered devices**, so the device list never changes. The renderer comment admits this ("There is no discoveredDevices over service:state"), yet the empty-state copy says "Put your speaker in pairing mode and tap Scan." No renderer ever emits `data-action="admin.pairBtDevice"`, so the `bluetooth:pair`/`bluetooth:unpair` backend actions and `BluetoothController.pairDevice/unpairDevice` are unreachable. GM sees the spinner, then nothing, for any speaker not already paired via CLI.
- **Tag:** needs-owner-decision (deliberate SR-4 scope cut vs. UI copy/dead handlers contradiction) / fix-in-phase-2

### F-GMCMD-06 | P1 | "Now Showing" has two independent writers with conflicting semantics

- **Files:** `ALNScanner/src/ui/renderers/VideoRenderer.js:15-16,46-53` and `ALNScanner/src/admin/MonitoringDisplay.js:229-248`
- **Trace:** `#now-showing-value` / `#now-showing-icon` are written (a) by `VideoRenderer` from the `video` store domain (filename / "Idle Loop") and (b) by `MonitoringDisplay._handleDisplayMode` from `display:mode` events ("Scoreboard"/"Idle Loop"). With display mode = SCOREBOARD, any `video` domain push where `nowPlaying` transitions (e.g., a queued video completes behind the scoreboard, `null → file → null`) makes `VideoRenderer` overwrite "Scoreboard" with "Idle Loop"/a filename, with no event to repaint it. Two code paths, one DOM element, different state sources — the canonical duplicated-writer defect class.
- **Tag:** fix-now / runtime-defect

### F-GMCMD-07 | P1 | Lighting scene list can never update: `lighting:scenes:refresh` unreachable from UI AND the scene grid is built once and never rebuilt

- **Files:** `ALNScanner/src/utils/domEventBindings.js:200-206` (only `activateScene` case), `ALNScanner/src/admin/LightingController.js:34-37` (refreshScenes — zero callers), `ALNScanner/src/ui/renderers/EnvironmentRenderer.js:95-101` (`if (!this._sceneEls) { this._buildSceneGrid(...); return; }` — afterwards only the active class toggles)
- **Trace:** Backend supports `lighting:scenes:refresh` (commandExecutor.js:459-464) and emits `scenes:refreshed` → `service:state lighting`. But (1) no `data-action` maps to `refreshScenes`, so the GM can't trigger it; (2) even when the backend refreshes scenes itself (HA reconnect → `lightingService` re-fetch), `renderLighting` skips the rebuild because `_sceneEls` is already cached — new/removed scenes never appear until full page reload. `_sceneEls` is only reset on the `!connected` branch, so a refresh while connected is guaranteed stale.
- **Tag:** fix-in-phase-2 / runtime-defect

### F-GMCMD-08 | P1 | Video transport acks report success for no-ops — GM gets "success" with zero effect

- **Files:** `backend/src/services/commandExecutor.js:175-206`, `backend/src/services/videoQueueService.js:455-458,488-491,510-513`
- **Trace:** `skipCurrent()/pauseCurrent()/resumeCurrent()` return `false` when nothing is playing; `commandExecutor` **ignores the boolean** and always sets `resultMessage = 'Video skipped successfully'` etc. Also when `config.features.videoPlayback` is false, the service call is skipped entirely yet the ack still claims success. The scanner's `_adminVideoAction` only surfaces rejected acks, so the GM sees nothing happen after an apparently accepted command. (Contrast: VLC-down is correctly rejected by the SERVICE_DEPENDENCIES gate.)
- **Tag:** fix-now

### F-GMCMD-09 | P2 | SoundController is fully unwired — `sound:play`/`sound:stop` have no UI; a stuck sound can be seen but not stopped

- **Files:** `ALNScanner/src/admin/SoundController.js` (zero callers besides instantiation at `adminController.js:64`), `ALNScanner/src/utils/domEventBindings.js` (no sound case), `ALNScanner/src/admin/MonitoringDisplay.js:130-142` (`#sound-status` display-only)
- **Trace:** `handleAdminAction` has no `playSound`/`stopSound` cases and no renderer emits a sound `data-action`. The `sound` store subscription renders "Playing: file" into `#sound-status` with no stop button. Backend `sound:play`/`sound:stop` are reachable only via cues. Root `CLAUDE.md` admin-capability table lists "Sound playback" under Show Control; `ALNScanner/CLAUDE.md` documents "SoundController: Play/stop sounds" as a GM capability.
- **Tag:** fix-in-phase-2 / needs-owner-decision

### F-GMCMD-10 | P2 | Three parallel gm:command ack-correlation implementations; the one all admin modules use can cross-resolve concurrent same-action commands

- **Files:** `ALNScanner/src/admin/utils/CommandSender.js:38-69`, `ALNScanner/src/network/orchestratorClient.js:171-244` (WS-6 serialized variant, used only by `teamRegistry.js:337`), `ALNScanner/src/app/app.js:1207-1251` (third raw inline ack handler for `system:reset`)
- **Trace:** Acks correlate by `action` only (`{action, success, message}` — no request id). `OrchestratorClient.sendCommand` got the WS-6 same-action serialization fix; `CommandSender` (used by all 12 admin modules) did not: two in-flight `cue:fire` commands both register `message:received` handlers filtered on `action === 'cue:fire'`, and the **first ack resolves both promises** — the second cue's failure is reported as the first cue's success. `adminResetAndCreateNew` re-implements ack handling a third way against the raw socket.
- **Tag:** subsumed-by-platform-refactor (request-id correlation is the real fix) / fix-in-phase-2

### F-GMCMD-11 | P2 | `video:queue:reorder` has no UI exposure; queue list is display-only

- **Files:** `ALNScanner/src/admin/VideoController.js:70-77` (`reorderQueue` — zero callers), `ALNScanner/src/ui/renderers/VideoRenderer.js:99-118` (renders items with no reorder/remove controls)
- **Trace:** Backend implements `video:queue:reorder` (commandExecutor.js:220-230, intentionally ungated) and broadcasts `queue:reordered`; the contract includes the action; the controller method exists; but no DOM control invokes it. `ALNScanner/CLAUDE.md` claims "Queue management (reorder, clear)".
- **Tag:** fix-in-phase-2

### F-GMCMD-12 | P2 | `available-videos` datalist is never populated — `loadAvailableVideos()` does not exist

- **Files:** `ALNScanner/index.html:386-388` (`<datalist id="available-videos"><!-- Populated by loadAvailableVideos() -->`), grep across `ALNScanner/src` → zero hits for `loadAvailableVideos`
- **Trace:** The manual-add input promises autocomplete; the populating function was never implemented (consistent with `VideoController.js` comment: "No /api/videos list endpoint exists"). The GM must type exact filenames blind; `validateCommand()`'s `videoFileExists` check only runs in the cue pre-show path, not for the live `gm:command` (executeCommand throws on add only if the filename resolves to nothing — see `addVideoByFilename`, which accepts any filename as a "standalone video", so typos enqueue items that fail at playback).
- **Tag:** fix-in-phase-2 / needs-owner-decision (requires a contracted `GET /api/videos`)

### F-GMCMD-13 | P2 | Query-style actions (`display:status`, `service:check`) return data the ack can no longer carry; `display:status` and `transaction:create` have no UI exposure

- **Files:** `backend/src/services/commandExecutor.js:277-284` (display:status sets `resultData`), `:663-707` (service:check sets `resultData`), `backend/src/websocket/adminEvents.js:100-104` (ack = `{action, success, message}` — `result.data` dropped), `ALNScanner/src/admin/DisplayController.js:51-53` (getDisplayStatus — zero callers, JSDoc promises `{currentMode, previousMode, pendingVideo, timestamp}` which is now impossible)
- **Trace:** The ack simplification made `resultData` unreachable by design. `service:check` still works end-to-end because every health check `report()`s into `serviceHealthRegistry` → `health:changed` → `service:state` (verified for vlc/music/lighting/bluetooth/audio/sound/cueengine). `display:status` has no equivalent side-channel — it is a dead action: in the contract enum, implemented, but its only output is a message string nobody requests. `transaction:create` is implemented + contracted but has no GM scanner caller (AdminOperations has no method for it).
- **Tag:** needs-owner-decision (delete from contract or build the UI)

### F-GMCMD-14 | P2 | `gm:identified` is emitted by the backend but absent from the AsyncAPI contract and not consumed by the scanner

- **Files:** `backend/src/websocket/gmAuth.js:163` (`emitWrapped(socket, 'gm:identified', ...)`), `ALNScanner/src/network/orchestratorClient.js:24-47` (not in MESSAGE_TYPES), `backend/contracts/asyncapi.yaml` (no GmIdentified message)
- **Trace:** Orphan emission in both directions of the conformance lens: not in the contract's message set, and the scanner's explicit `MESSAGE_TYPES` allowlist drops it on the floor.
- **Tag:** fix-in-phase-2 (remove or contract it)

### F-GMCMD-15 | P2 | Pre-attempt service-health gating is inconsistent across panels

- **Files:** `ALNScanner/src/ui/renderers/MusicRenderer.js` (disables all controls on `!state.connected`), vs `index.html:366-371` video transport buttons, `EnvironmentRenderer` BT scan button, lighting tiles — never disabled on health state
- **Trace:** Backend rejects gated commands cleanly (`commandExecutor.js:83-92`) and `safeAdminAction` surfaces the rejection via `uiManager.showError` (`domEventBindings.js:21-32`) — so **after**-the-attempt feedback exists everywhere. But only Music communicates **before** the attempt; VLC-down leaves Play/Pause/Stop/Skip fully enabled (GM taps → error toast), even though the `health` domain state needed to disable them is already in the StateStore. The Health dashboard is the only pre-attempt signal, in a different panel.
- **Tag:** fix-in-phase-2

### F-GMCMD-16 | P3 | `AdminController.resume()` is dead code; reconnect refresh relies entirely on the server's auto `sync:full`

- **Files:** `ALNScanner/src/network/networkedSession.js:173-187` (`_connectedHandler` calls `initialize()`, never `resume()`), `ALNScanner/src/app/adminController.js:109-122`
- **Trace:** On reconnect, `initialize()` hits the already-initialized guard and returns; `monitoringDisplay.resume()` → `sync:request` is never invoked. The system still recovers because `gmAuth.js` auto-sends `sync:full` on every (re)connect and `networkedSession` repopulates the store + re-dispatches `display:mode` from `payload.displayStatus` (`networkedSession.js:274-279`). Single point of failure with a dead belt-and-braces path.
- **Tag:** fix-in-phase-2

### F-GMCMD-17 | P3 | `updateSystemDisplay()` targets `#orchestrator-status`, which no longer exists in index.html

- **Files:** `ALNScanner/src/admin/MonitoringDisplay.js:352-360`; element exists only in `index.html.backup:1913` and test fixtures
- **Trace:** The "orchestrator connection dot" feature is a silent no-op (null-guarded). The admin panel has no connection indicator beyond the header status link.
- **Tag:** fix-in-phase-2

### F-GMCMD-18 | P3 | Pending-queue items always show "0s" duration

- **Files:** `backend/src/services/videoQueueService.js:593-597` (queue entries are `{tokenId, filename}` only), `ALNScanner/src/ui/renderers/VideoRenderer.js:110` (`${Math.round(item.duration || 0)}s`)
- **Trace:** The renderer expects `item.duration`; `getState()` never includes it even though `VideoQueueItem.duration` exists. Every queue row reads "0s".
- **Tag:** fix-now (one-line backend addition)

### F-GMCMD-19 | P3 | `cue:completed` is subscribed and forwarded but has no consumer

- **Files:** `ALNScanner/src/network/orchestratorClient.js:44`, `ALNScanner/src/admin/MonitoringDisplay.js:175-211` (cases for `cue:fired`/`cue:error` only)
- **Trace:** Backend broadcasts `cue:completed` (broadcasts.js:429-432); the scanner forwards it as `message:received`; nothing handles it (the active-cue list updates via the `cueengine` domain instead). Fired/error get toasts; completion is silent. Doc drift (see D-2).
- **Tag:** fix-in-phase-2

### F-GMCMD-20 | P3 | "Check Now" probes exist only for already-down services — healthy services can't be probed pre-show

- **Files:** `ALNScanner/src/ui/renderers/HealthRenderer.js:95-100,150-157` (button rendered only when `isDown`), collapsed all-healthy mode renders no buttons at all
- **Trace:** Backend `service:check` supports any service (and check-all with empty payload), is intentionally ungated, and round-trips via registry → `service:state`. The UI exposes it only on down cards, so the root CLAUDE.md claim "'Check Now' probes, Pre-show verification" is only achievable when something is already broken.
- **Tag:** fix-in-phase-2

### F-GMCMD-21 | P3 | No seek control for video or music (standard media-control gap)

- **Files:** `backend/src/services/commandExecutor.js` (no `video:seek`/`music:seek` actions), `contracts/asyncapi.yaml` action enum (none), `MusicRenderer`/`VideoRenderer` progress bars are display-only
- **Trace:** Both panels render progress bars that look interactive but accept no input; neither contract nor executor defines a seek action. Pause/stop/skip/volume exist; seek does not. Recovering a mis-started 3-minute video mid-show requires skip-and-requeue.
- **Tag:** needs-owner-decision

### F-GMCMD-22 | P3 | `batch:ack` is in the GM scanner's MESSAGE_TYPES but never consumed by it

- **Files:** `ALNScanner/src/network/orchestratorClient.js:39`, `backend/src/routes/scanRoutes.js:362` (emitted to `device:${deviceId}` rooms for player-scanner batches)
- **Trace:** The event targets player-scanner device rooms; the GM scanner forwards it as `message:received` but no handler exists in MonitoringDisplay/networkedSession. Harmless, but it pads the allowlist that ALNScanner/CLAUDE.md warns must be curated.
- **Tag:** fix-in-phase-2

---

## Control Inventory (Appendix)

### GM Scanner UI controls → chain status

| Control (location) | Action chain | Status |
|---|---|---|
| Create New Session (SessionRenderer no-session) | app.adminCreateSession → session:create → session:update → SessionRenderer | OK |
| Start Game (SessionRenderer setup) | admin.startGame → session:start | OK |
| Pause / Resume / End Session (SessionRenderer) | app.adminPause/Resume/EndSession → session:pause/resume/end | OK |
| Download Report (SessionRenderer ended) | app.downloadSessionReport (local) | OK |
| Reset & New Session (SessionRenderer ended) | app.adminResetAndCreateNew → system:reset (raw socket, 3rd ack impl) | OK, F-10 |
| Add Team (team entry UI) | teamRegistry → orchestratorClient.sendCommand session:addTeam | OK |
| Idle Loop / Scoreboard / Return-to-Video toggles | app.adminSetIdleLoop/etc → display:* → display:mode broadcast → _handleDisplayMode | OK; restored on reconnect via sync:full displayStatus re-dispatch |
| Video Play | video:play → resumeCurrent | OK-ish: misleading ack on no-op (F-08) |
| Video Pause | video:pause → pauseCurrent | **broken at state delivery** (F-01) |
| Video Stop | video:stop → skipCurrent + clearQueue | OK; misleading ack on no-op (F-08) |
| Video Skip | video:skip → skipCurrent | OK; misleading ack (F-08) |
| Manual video input + datalist | datalist never populated (F-12) | broken at UI (autocomplete) |
| Add to Queue | video:queue:add → queue:added → service:state video | OK |
| Clear Entire Queue | video:queue:clear → queue:reset → service:state video | OK |
| Queue list display | service:state video → VideoRenderer.renderQueue | OK; "0s" durations (F-18); no reorder controls (F-11) |
| Now Showing display | dual writers (F-06) | conflicting |
| Quick Fire tiles | admin.fireCue → cue:fire → cue:fired toast + cueengine domain | OK |
| Standing cue Enable/Disable | admin.enable/disableCue → cue:enable/disable → cueengine domain | OK |
| Active cue Pause/Resume/Stop | admin.pause/resume/stopCue → cue:* → cueengine domain | OK |
| Held items Release/Discard (+All) | admin.*Held → held:* → held domain | OK (bulk buttons only when ≥2 items) |
| Music transports (prev/play/pause/next/stop) | admin.music* → music:* → music domain | OK; disabled when MPD down (good) |
| Music playlist picker | admin.musicLoadPlaylist (select) | **fires on click-to-open + double-fires on change** (F-04) |
| Music shuffle/loop/volume | admin.musicSetShuffle/Loop/Volume | OK (volume debounced, drag-protected) |
| Sound playback controls | — | **missing entirely** (F-09); #sound-status display-only |
| Audio routing selects (video/music/sound) | admin.setAudioRoute (select) | works, but click-to-open re-sends route (F-04) |
| Stream volume sliders | admin.setStreamVolume → audio:volume:set | OK (debounced, cached across rebuilds) |
| BT warning banner | — | can never show (F-02) |
| BT Scan / Stop Scan toggle | admin.startBtScan/stopBtScan → bluetooth:scan:* | OK (button toggles via `scanning`) |
| BT discovered devices | — | never rendered (F-05) |
| BT Pair / Unpair | dead domEventBindings cases | unreachable (F-05) |
| BT Connect / Disconnect | admin.connect/disconnectBtDevice | OK (paired devices only) |
| Lighting scene tiles | admin.activateScene → lighting:scene:activate → lighting domain | OK; grid never rebuilds on scene change (F-07) |
| Lighting scene refresh | — | unreachable (F-07) |
| Health dashboard + Check Now | admin.serviceCheck → service:check → registry.report → service:state health | OK; buttons only for down services (F-20) |
| Device count/list | sync:full devices + device:connected/disconnected | OK |
| Scoreboard Evidence Prev/Next/Jump | admin.scoreboard* → scoreboard:page:* → scoreboard:page echo toast | OK |
| Evidence owner dropdown | EvidencePickerRenderer ← DataManager events | OK |
| Team Scores board + Reset All Scores | app.adminResetScores → score:reset → scores:reset + sync:full | OK |
| Adjust Score (team details) | app.adjustTeamScore → score:adjust → score:adjusted → team-score:updated | OK |
| Delete Transaction (team details) | app.deleteTeamTransaction → transaction:delete → transaction:deleted | OK |
| Game Activity / View Full History | local render | OK |

### Backend gm:command actions → UI exposure

All 56 contract-enum actions are implemented in commandExecutor/adminEvents (enum and implementation match). Actions with **no UI exposure**: `transaction:create`, `display:status` (F-13), `sound:play`, `sound:stop` (F-09), `lighting:scenes:refresh` (F-07), `video:queue:reorder` (F-11), `bluetooth:pair`, `bluetooth:unpair` (F-05). All others have working UI entry points.

### sync:full field consumption (reconnect restore)

| Field | Consumed? | Restores |
|---|---|---|
| session | yes (`networkedSession` → UDM; MonitoringDisplay → SessionRenderer) | session panel |
| scores / recentTransactions / playerScans / deviceScannedTokens | yes | scoreboards, activity, dedupe |
| videoStatus | yes → store `video` (shape matches service:state) | video panel |
| devices | yes → device list | OK |
| serviceHealth | yes → store `health` | health dashboard |
| environment.bluetooth/audio/lighting | yes → store domains | env panels |
| gameClock | yes → store `gameclock` (status mapped to `state`; values `stopped/running/paused` match renderer) | clock + client tick |
| cueEngine | yes → store `cueengine` (`loaded` field unused — harmless) | cue panels |
| music (incl. playlists) | yes → store `music` | music panel |
| heldItems | yes → store `held` | held items |
| sound | yes → store `sound` | #sound-status |
| displayStatus | yes — re-dispatched as synthetic `display:mode` (`networkedSession.js:274-279`) | idle/scoreboard toggle |
| reconnection | sent, no consumer found | — (benign) |

No sync:full field is sent-but-unconsumed except `reconnection` and `cueEngine.loaded`.

---

## Doc Drift

| ID | Claim | Reality |
|---|---|---|
| D-1 | root + backend CLAUDE.md: sync:full `cueEngine: {cues, activeCues, standingCues}` | `syncHelpers.js:182-196` builds `{loaded, cues, activeCues, disabledCues}` — no `standingCues` |
| D-2 | ALNScanner/CLAUDE.md: MonitoringDisplay "handles discrete game events (cue:fired, cue:completed, display:mode) via _handleMessage()" | `cue:completed` has no case (F-19) |
| D-3 | root CLAUDE.md admin capabilities: "Sound playback"; ALNScanner/CLAUDE.md: "SoundController: Play/stop sounds" | No UI path exists (F-09) |
| D-4 | ALNScanner/CLAUDE.md GOTCHA: "refreshAllDisplays() re-renders the template, destroying dynamic DOM state" | Current impl (`MonitoringDisplay.js:334-338`) only calls `updateSystemDisplay()` + `sync:request`; no template re-render |
| D-5 | ALNScanner/CLAUDE.md heading "Admin Panel (Networked Mode Only)" | View tabs + session/scores/activity sections work in standalone (`viewController.init` shows tabs in both modes; only `data-requires="networked"` sections hide) |
| D-6 | ALNScanner/CLAUDE.md VideoController features: "Queue management (reorder, clear)" | Reorder has no UI (F-11) |

---

## Open Questions for Owner

1. **BT pairing scope (F-05):** Is pairing intentionally CLI-only (SR-4)? If so, the scan button copy, the dead `pairBtDevice/unpairBtDevice` handlers, and `BluetoothController.pairDevice/unpairDevice` should be removed; if not, `bluetoothService.getState()` needs a `discoveredDevices` field.
2. **Sound UI (F-09):** Should the GM be able to play/stop sounds manually, or is sound cue-only? Either build the panel or strip the controller + docs. A "stop" button on `#sound-status` seems like the minimum for stuck-sound recovery.
3. **`display:status` / `transaction:create` (F-13):** Delete from the contract enum, or build consumers? Both are currently unreachable dead surface.
4. **Video file picker (F-12):** Approve a contracted `GET /api/videos` so manual add/datalist can work, or remove the datalist and its stale comment?
5. **Seek (F-21):** Is seek wanted for video and/or music? Both progress bars look interactive but aren't.
6. **Ack correlation (F-10):** Is a `requestId` field on `gm:command`/`gm:command:ack` acceptable as a coordinated contract change, or should CommandSender adopt the WS-6 serialization interim fix?
