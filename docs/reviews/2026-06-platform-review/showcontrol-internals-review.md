# Show-Control & Environment Service Internals Review (Wave 2)

Scope: internals of `audioRoutingService`, `cueEngineService`, `videoQueueService`,
`musicService`, `soundService`, `bluetoothService`, `lightingService`,
`displayControlService`, `gameClockService`, `scoreboardControlService`,
`vlcMprisService`/`mprisPlayerBase`, `serviceHealthRegistry`, `cueEngineWiring`,
`systemReset` — plus the `broadcasts.js` wiring that feeds them.
Wave-1 findings (F-GMCMD-*) are not re-reported except where deepened.
Reviewed at HEAD of working tree, 2026-06-10. All findings are static-trace evidence-based.

## Summary

| Severity | Count |
|----------|-------|
| P0 (confirmed bug) | 2 |
| P1 (likely defect, strong evidence) | 9 |
| P2 (debt / contract drift / dead code) | 13 |
| P3 (polish) | 6 |
| **Total** | **30** |

Doc-drift items: 5. Split-seam proposals: 3. Open questions: 6.

The dominant theme mirrors wave-1's conclusion: happy paths are solid; the bugs
live in **lifecycle seams** — restart-restore, stop/kill paths, overlapping duck
sources, and the clock→video drive-mode handoff. A secondary theme: **cue-engine
runtime state is the only stateful show-control domain with no persistence
story** (gameClock has `toPersistence()`/`restore()`; cue engine has nothing).

---

## P0 — Confirmed bugs

### F-SHOW-01 | P0 | All cue automation silently dies after an orchestrator restart mid-game
- **Files:** `backend/src/services/sessionService.js:288-295` (init restore), `:386-390` (startGame), `:520-528` (resume), `backend/src/services/cueEngineService.js:425-426,482-483` (`if (!this.active) return`)
- **Evidence:** `cueEngineService.activate()` is called from exactly two places: `startGame()` and `updateSessionStatus('active')` on resume (grep confirms; `app.js` and `systemReset.js` never call it). `sessionService.init()` restores the session AND restores the game clock to `running` (`gameClockService.restore`, sessionService.js:290) — but never reactivates the cue engine. After a restart with an active session: the clock ticks, `handleClockTick`/`handleGameEvent` early-return on `!this.active`, and every standing cue (event + clock), and the `gameclock:overtime` cue path, is dead until the GM happens to pause+resume. Compounding it, `setOvertimeThreshold` is only called in `startGame()` (sessionService.js:382-383) and `overtimeThreshold` is not in `toPersistence()` (gameClockService.js:119-125) — so overtime detection is also silently gone after restart even though the clock runs.
- **Effect:** the classic "worked in rehearsal, broke on game night after a crash-restart" failure: lights/sounds/clock cues stop with zero operator indication (health registry reports cueengine `healthy`).
- **Tag:** fix-now (activate on restore when session is active; persist/restore overtime threshold)

### F-SHOW-02 | P0 | Music stays ducked forever after `sound:stop` or a pw-play failure — `sound:stopped`/`sound:error` are not wired to the ducking engine
- **Files:** `backend/src/websocket/broadcasts.js:406-417` (only `sound:started`/`sound:completed` wired to `handleDuckingEvent`), `backend/src/services/soundService.js:83-95` (kill → exit code null → emits `sound:stopped`, not `sound:completed`; non-zero exit → `sound:stopped` reason `'error'`; spawn failure → `sound:error`)
- **Evidence:** any sound that ends by `sound:stop` (GM command or cue), by process kill, or by pw-play error never produces the `'completed'` ducking lifecycle event. `_activeDuckingSources['music']` keeps `'sound'` forever, so music remains at the duck volume (e.g. 40%) for the rest of the show; the only escapes are a later sound completing naturally, system:reset, or manual volume set (which `_setStreamVolumeLive` would then have ducking state misreport). The integration ducking tests (`tests/integration/audio-routing-phase3.test.js`) call `handleDuckingEvent` directly and never exercise the broadcast wiring, so this wiring gap is structurally untestable by the current suite — the exact "seam blindness" pattern from the discovery report.
- **Tag:** fix-now (wire `sound:stopped` and `sound:error` to `handleDuckingEvent('sound','completed')`; add a broadcast-wiring test)

---

## P1 — Likely defects

### F-SHOW-03 | P1 | Clock-cue catch-up storm on first reactivation after restart — `firedClockCues`, `disabledCues` (once-cues), and active-cue state are never persisted
- **Files:** `cueEngineService.js:105-129` (`_reset` — all runtime state in-memory), `:485-501` (`handleClockTick` fires every cue with `elapsed >= threshold` not in `firedClockCues`)
- **Evidence:** after a restart mid-game (elapsed restored to e.g. 3600s), the moment the engine is reactivated (today: GM pause→resume; after F-SHOW-01 fix: immediately), the next tick fires **every** clock cue with a threshold below 3600 simultaneously — hour-mark sounds, lighting scenes, videos. Same for `once` event cues (auto-disable lives in `disabledCues`, also lost). This is the flip side of F-SHOW-01: fixing 01 without a persistence/replay-policy story converts "silently dead" into "fires everything at once".
- **Tag:** fix-now together with F-SHOW-01 (persist `{firedClockCues, disabledCues, active}` on the session next to `gameClock`; or mark-without-firing on restore). Also gates owner decision B11 (phases) — phase transitions will hit the identical replay problem.

### F-SHOW-04 | P1 | Every video's final ~5% is truncated by the idle loop — completion fires at `position >= 0.95`
- **Files:** `videoQueueService.js:381-384` (`if (status.position >= 0.95) … completePlayback`), `:423-449` (completePlayback does NOT stop VLC), `displayControlService.js:56-58,334-361` (`video:idle` → `_doSetIdleLoop` → `vlcService.returnToIdleLoop()` replaces playback)
- **Evidence:** monitor completes the item at 95% of duration; `completePlayback` → `clearCompleted` → `processQueue` (empty) → `video:idle` → `returnToIdleLoop()` immediately loads `idle-loop.mp4` into VLC, cutting the still-playing video. 0.95 is a ratio: a 3-minute memory video loses ~9 seconds; a 10-minute endgame video loses 30. The grace-period stopped-state path (`:342-364`) would have caught the natural end ~2s after; the 0.95 check always wins.
- **Tag:** fix-now (time-based threshold, e.g. `position*duration >= duration - 1`, or rely solely on the stopped-state detection)

### F-SHOW-05 | P1 | Redundant ducking-stop events force music volume to hardcoded 100, clobbering the operator's set volume
- **Files:** `audioRoutingService.js:722-753` — `if (!this._activeDuckingSources[target]) continue` does not guard an **empty array**; restore value is `this._preDuckVolumes[target] ?? 100`
- **Evidence:** sequence "video starts (duck, preDuck=60 captured) → GM pauses video (ducking `'paused'` → restore 60, `delete _preDuckVolumes`, array left `[]`) → GM skips video (`video:completed` → ducking `'completed'`)": second stop finds the empty-but-truthy array, length 0 → restores to `100` (preDuck undefined). Music jumps from the user's 60 to 100. Any paused→completed or duplicate-completion sequence triggers it. The correct restore target is the persisted user volume (`_routingData.volumes[target]`), which the service already owns, not a hardcoded 100.
- **Tag:** fix-now (guard empty array / no-op when not ducked; restore to persisted user volume as fallback rather than 100)

### F-SHOW-06 | P1 | Duck/restore pactl writes are fire-and-forget and unserialized — a short sound can leave music stuck at duck volume
- **Files:** `audioRoutingService.js:815-824` (`_setVolumeForDucking` → `_setStreamVolumeLive(...)` with `.catch`, never awaited or queued), `:472-493` (each live set = `findSinkInput` (potential `pactl list sink-inputs` round-trip) + `pactl set-sink-input-volume`)
- **Evidence:** a 200ms cue sound produces duck-apply and restore within the latency window of two unordered pactl pipelines; if the apply's `findSinkInput` poll is slow, restore (fast registry hit) completes first and apply lands last → music left at duck volume while state says restored (`ducking:changed ducked:false` already emitted). The pre-duck **capture** race was fixed (awaited, `:678-682`); the **set** ordering race was not. Needs a per-target serialization queue (same pattern as `displayControlService._withLock`).
- **Tag:** fix-now / fix-in-phase-2 (fold into the ducking-engine extraction, see split seams)

### F-SHOW-07 | P1 | No per-instance refcount for same-source ducking — overlapping sounds un-duck early
- **Files:** `audioRoutingService.js:663-711` (`_activeDuckingSources[target]` holds stream **names**, deduped: `if (!includes(source)) push`), `soundService.js:53-104` (N concurrent pw-play processes supported)
- **Evidence:** sound A starts (duck), sound B starts (no-op, `'sound'` already in list), sound A completes → `'sound'` removed → full restore while B still plays. The engine models sources as booleans per stream, but soundService is explicitly multi-instance. Integration tests cover multi-**stream** (video+sound) but not multi-**instance** (sound+sound).
- **Tag:** fix-in-phase-2 (refcount per source, decrement on completed/stopped/error)

### F-SHOW-08 | P1 | `video:progress`/pause/resume crosstalk: events are forwarded to ALL active `hasVideo` cues — an unrelated video can hijack a compound cue with a deferred video entry
- **Files:** `cueEngineService.js:842-891` (`handleVideoProgressEvent`/`handleVideoLifecycleEvent` loop over all `activeCues` with `hasVideo`; comment claims "Safe because only one video can play at a time"), `:521-556` (conflict detection only runs **at cue start**, only when the cue is the one bringing a video)
- **Evidence:** the safety claim has a hole: a compound cue whose `video:queue:add` sits at a later position (e.g. `at: 30`) is active with `hasVideo=true, videoStarted=false` for 30s. Nothing blocks a player-scan video from starting in that window. Its `video:progress` events flip the cue's `videoStarted=true`, capture the **wrong** `videoDuration`, and start driving the cue's timeline off the unrelated video's position; its pause/resume likewise pause/resume the cue (`'paused'`/`'resumed'` branches have no `videoStarted` guard, unlike `'completed'` at `:883`). Fix is to correlate by tokenId/queueItem (already present in the event payloads) instead of broadcasting to all.
- **Tag:** fix-in-phase-2

### F-SHOW-09 | P1 | displayControl's pre-play hook mutates display mode OUTSIDE the `_withLock` serialization — race with `_handleVideoComplete` can idle-loop over a just-started video
- **Files:** `displayControlService.js:62-79` (pre-play hook: sets `previousMode`/`currentMode`, hides scoreboard — no lock), `:122-127,334-361` (`_withLock` serializes everything else; `_handleVideoComplete` runs `_doSetIdleLoop` under lock)
- **Evidence:** queue drains → `video:idle` → `_handleVideoComplete` acquires the lock and begins `_doSetIdleLoop` (async: hideScoreboard, `returnToIdleLoop`). A new scan arrives in that window → `playVideo()` runs the pre-play hooks immediately (videoQueueService.js:147-153, not lock-aware) → enters VIDEO mode and VLC starts the new video → the still-running locked `_doSetIdleLoop` then calls `returnToIdleLoop()`, replacing the new video with the idle loop while `currentMode` says VIDEO. The TOCTOU comment on `_handleVideoComplete` (:330-332) shows the lock discipline was understood — the hook just never adopted it.
- **Tag:** fix-now (wrap the hook body in `_withLock`)

### F-SHOW-10 | P1 | lightingService falls back to `tests/fixtures/scenes.json` in production — phantom scenes mask HA outages and poison pre-show verification
- **Files:** `lightingService.js:294-346` (`getScenes` catch → `_loadFallbackScenes` reading `../../tests/fixtures/scenes.json`; same when `refreshScenes` is invoked), `commandExecutor.js:763-765` (`validateCommand` uses `sceneExists` against this cache)
- **Evidence:** any transient HA fetch failure populates `_scenes` with test fixtures; the GM sees a normal-looking scene grid, `sceneExists` passes pre-show verification for scenes HA doesn't have, and `activateScene` then 500s (or worse, succeeds against a coincidentally-named entity). Production code should fail empty, not load test data. Directly undermines the B8 preflight-verification design.
- **Tag:** fix-now (gate fallback on NODE_ENV=test, or delete and fix the tests that rely on it)

### F-SHOW-11 | P1 | musicService idle handlers bypass the bounded-I/O chokepoint — a wedged mpd2 client hangs them forever
- **Files:** `musicService.js:427-430` (`_handlePlayerEvent`: `this._mpd.sendCommand('status'/'currentsong')` directly), `:475` (`_handleMixerEvent` same), vs `_send()` `:245-261` (the timeout/teardown chokepoint)
- **Evidence:** the file's own header comment and backend/CLAUDE.md state "Every mpd2 round-trip goes through `_send()` … a desynced client never rejects — it hangs forever. A timeout is the only reliable signal." The two idle handlers — the highest-frequency mpd2 round-trips in the system, and the ones most likely to race the FIFO desync they were written to defend against — are raw and unbounded. A wedge here doesn't tear the client down (no `_setConnected(false)`), it just silently freezes track/state updates while `_send`-based commands keep working against the same broken FIFO.
- **Tag:** fix-now (route both through `_send`, which also gives them the same-reference teardown)

---

## P2 — Debt, contract drift, dead code

### F-SHOW-12 | P2 | Clock→video drive-mode handoff is ill-defined: pre-video timeline entries fire on game-clock time, then `elapsed` jumps backward when video progress takes over
- **Files:** `cueEngineService.js:744-769` (`_tickActiveCompoundCues` skips only `hasVideo && videoStarted` — before the video starts, clock drives the timeline), `:842-862` (first `video:progress` flips to video-driven; `elapsed` becomes `position*duration` ≈ 0)
- **Evidence:** cue `[video:queue:add at 0, sound at 2]`: video load (pre-play hooks + VLC open) takes ~3s of clock time, during which the `at:2` sound fires at clock-relative 2s — i.e. before the video is even on screen — then `elapsed` snaps from 3 back to ~0 and `cue:status` progress regresses. Whether `at` positions before video start are clock-relative or video-relative is undefined in code and docs. This is the cue-authoring contract (matrix 2.22) and must be pinned before packs author timelines.
- **Tag:** needs-owner-decision (define semantics) + fix-in-phase-2

### F-SHOW-13 | P2 | Session end leaves the cue engine active and the GM clock panel stale
- **Files:** `sessionService.js:546-560` (`endSession`: stops clock, never `cueEngineService.suspend()`), `gameClockService.js:67-71` (`stop()` emits **no** event), `broadcasts.js:546-551` (gameclock domain pushed only on started/paused/resumed)
- **Evidence:** after `session:end`, event-triggered standing cues keep evaluating (e.g. `music:track:changed` cues fire during post-game cleanup music), and no `service:state gameclock` push occurs, so the GM panel keeps showing a running clock until reconnect. (`reset()` reports the registry but also emits nothing.)
- **Tag:** fix-now (suspend on end; emit a stopped event / push state)

### F-SHOW-14 | P2 | Dead code trio: `applyRoutingWithFallback` (62L, zero callers, certified by its own unit test), `videoQueueService.updateFromSession` (zero callers), `vlcMprisService.seek()` (zero callers)
- **Files:** `audioRoutingService.js:860-921`, `videoQueueService.js:944-947`, `vlcMprisService.js:267-276`; grep: only definitions + `tests/unit/services/audioRoutingService.test.js:1600` and the mock factory
- **Evidence:** `applyRoutingWithFallback` duplicates `applyRouting`'s resolution with a divergent `routes[stream].fallback` schema no config produces — second implementation of the same concern (duplication rubric). `updateFromSession` would, if ever called, restore a `playing` item as `currentItem` with no monitor and wedge the queue — delete rather than fix. `seek()` is fully implemented and deepens wave-1 F-GMCMD-21: the backend capability exists; only the commandExecutor action + contract entry are missing.
- **Tag:** fix-now (delete first two + their tests) / needs-owner-decision (seek: expose or delete)

### F-SHOW-15 | P2 | `cue:fired` contract drift: `source` is hardcoded `'cue'` even for GM manual fires; `trigger` is emitted as `null` against a required-string schema
- **Files:** `cueEngineService.js:333-337,604-608` (`source: 'cue'` literal; `trigger: trigger || null`), `commandExecutor.js:498-504` (GM `cue:fire` calls `fireCue(cueId)` with no trigger/source), `contracts/asyncapi.yaml:2223-2244` (requires `trigger` string; documents `source: 'gm'` for manual fires)
- Also: `bluetoothService.getState()` includes `available` (bluetoothService.js:446) not in the contract's bluetooth domain shape (asyncapi.yaml:2183) — additive, but the domain shapes are documentation-only prose, which is why drift accumulates silently.
- **Tag:** fix-in-phase-2 (thread source/trigger through `fireCue`; consider machine-checkable per-domain state schemas)

### F-SHOW-16 | P2 | Held-system edges: `held:release-all` aborts midway and lies; video-cue releases re-hold each other; `conflictTimers` keyed by cueId collide on double-hold
- **Files:** `commandExecutor.js:587-598` (sequential `await releaseCue` — first still-down service throws, remaining cues+videos never attempted, ack=failure with partial release), `cueEngineService.js:1057-1087` (releaseCue for `video_busy` → skip + re-fire; a second released video-cue finds the first one's video playing → re-held under a NEW held id with a fresh 10s auto-discard, while the ack said "All held items released"), `:538-551` (timer map keyed by `cueId` not held id: same cue held twice → first timer entry silently overwritten; `releaseCue` then clears the wrong timer)
- **Tag:** fix-in-phase-2

### F-SHOW-17 | P2 | Bluetooth device-state cache has no recovery path: monitor never starts if the adapter comes up after init, and direct pair/unpair don't update the cache
- **Files:** `bluetoothService.js:59-67` (`init()` starts monitor only if adapter available at that moment; `checkHealth()` on the 15s revalidation flips the registry healthy but never calls `startDeviceMonitor()`), `:422-430`/`:300-344` (unpairDevice/pairDevice emit events but only the D-Bus monitor writes `_cachedDeviceStates`), `:437-451` (`getState()` reads exclusively from that cache)
- **Evidence:** boot with the adapter off (or BlueZ slow) → registry recovers via revalidation, but `getState().pairedDevices` stays empty for the whole session; even with the monitor running, the GM panel's paired list depends on BlueZ emitting a PropertiesChanged for state it may consider unchanged.
- **Tag:** fix-in-phase-2 (start monitor on health recovery; update cache in the command paths)

### F-SHOW-18 | P2 | `sound:play` live path lacks the path-containment check that `fileExists` has — `file: "../../x.wav"` escapes `public/audio`
- **Files:** `soundService.js:53-56` (`path.resolve(this.audioDir, file)` + existsSync, no `startsWith(this.audioDir)` guard) vs `:136-141` (`fileExists` has the guard but is only called by `validateCommand`'s pre-show path, not by `executeCommand` `sound:play`, commandExecutor.js:468-487)
- **Effect:** authenticated-GM-only and audio-playback-only, so low impact — but it's an inconsistency between the two resolution paths of the same file.
- **Tag:** fix-now (one-line guard in `play()`)

### F-SHOW-19 | P2 | lightingService WebSocket lifecycle races: re-connect toggle lets the old socket's close handler schedule a duplicate connection; WS-down vs HTTP-healthy health flapping
- **Files:** `lightingService.js:150-156` (`_wsStopped = true; close(); _wsStopped = false` — the `close` event fires **async**, sees `_wsStopped=false`, and `_handleWsClose` schedules a reconnect alongside the connection `_connectWebSocket` is about to create), `:249-266` + `:102-130` (WS close reports `down`, then the 30s HTTP `checkConnection` and 15s revalidation report `healthy` while WS retries — registry/`health:changed` flaps, GM health panel flickers)
- **Tag:** fix-in-phase-2

### F-SHOW-20 | P2 | Progress unit inconsistency inside cueEngineService: `cue:status` emits 0–100, `getActiveCues()` (the wire-visible `cueengine` domain state) emits 0–1
- **Files:** `cueEngineService.js:753,787` (`progress = …*100`) vs `:1108-1119` (`progress: elapsed / effectiveDuration`)
- **Evidence:** `cue:status` is only a push trigger today (broadcasts.js:557), so the 0–100 payload is currently dropped — but the duplicated, differently-scaled computation is a trap for the first consumer of either. Pick one unit and one computation.
- **Tag:** fix-in-phase-2

### F-SHOW-21 | P2 | monitorVlcPlayback hygiene: emits `video:progress` every second while paused; never clears the previous `playbackTimer`; `resumeCurrent()` runs on a non-paused video
- **Files:** `videoQueueService.js:342,370-378` (paused passes the playing/paused check; position constant but progress events keep flowing into the cue engine and the GM), `:408-415` (sets `this.playbackTimer` without clearing an existing one — `resumeCurrent` → `monitorVlcPlayback` leaks the prior timer; benign only because `completePlayback` guards `queueItem !== currentItem`), `:510-536` (`resumeCurrent` has no paused-state check — `video:play` on a playing video re-runs monitoring and emits `video:resumed`, which also re-fires ducking `'started'`)
- **Tag:** fix-in-phase-2 (deepens wave-1 F-GMCMD-01: the missing paused state in `VideoQueueItem` is the root; the model has no `paused` status at all — `videoQueueItem.js` state set is pending/playing/completed/failed)

### F-SHOW-22 | P2 | Pre-play hook registration order differs between startup and system reset
- **Files:** `app.js:228-237` (cue forwarding — registers the `video:loading` cue hook — runs BEFORE `displayControlService.init` at `:272`), `systemReset.js:151-157` (displayControl re-init) vs `:172-184` (cue forwarding) — REVERSED
- **Evidence:** hooks run in registration order (`videoQueueService.js:147-153`). At startup, attention-sound cues fire before the display switches to VIDEO mode; after a system:reset, the display switches first. Observable behavioral difference in the pre-video sequence depending on whether the system was reset.
- **Tag:** fix-now (align the order; trivially, move displayControl init above cue wiring in systemReset)

### F-SHOW-23 | P2 | `audioRoutingService.init()` reports `healthy` unconditionally — even when PipeWire is unreachable
- **Files:** `audioRoutingService.js:121-126` (getAvailableSinks failure only warns; `registry.report('audio','healthy', …)` runs regardless), vs `checkHealth()` (:132-141) which probes properly
- **Effect:** up to 15s window (until revalidation) where `audio:route:set`/`audio:volume:set` pass the SERVICE_DEPENDENCIES gate and fail downstream. Same pattern hit music in the 0523game incident the codebase documents.
- **Tag:** fix-now (call `checkHealth()` at end of init instead)

### F-SHOW-24 | P2 | Triple-identity sink-input parsing implemented twice
- **Files:** `audioRoutingService.js:1232-1265` (`_parseSinkInputs`: application.name/binary/media.name matching, returns first match) vs `:1016-1048` (`_identifySinkInput`: same three regexes, section-split parsing, different precedence semantics)
- **Evidence:** two parsers for the same `pactl list sink-inputs` output with subtly different matching (substring-on-first-identity-with-content vs per-key stream resolution). A pactl output format change must be fixed in both. Extraction target for the PactlClient seam below.
- **Tag:** subsumed-by-platform-refactor

---

## P3 — Polish

- **F-SHOW-25 | P3 | `soundService.reset()` races its own close handlers** — `stop()` kills procs, `processes.clear()` runs synchronously, then async `close` handlers fire `sound:stopped` events after the reset (and after the registry was reported down). `soundService.js:143-147`.
- **F-SHOW-26 | P3 | Playlist watcher never starts if the file appears after init** — `_startPlaylistWatcher` returns when `!fs.existsSync` and is never retried (`musicService.js:146-157`); a venue creating `music-playlists.json` post-boot gets no hot reload until restart.
- **F-SHOW-27 | P3 | `_capturePreDuckVolume` can persist a `null`→100 default over a real volume** when the sink-input doesn't exist yet (music not started); a duck arriving before MPD's sink-input exists stores 100 as the restore target even though the user's persisted volume is known in `_routingData.volumes`. `audioRoutingService.js:833-850`.
- **F-SHOW-28 | P3 | `getCurrentVideo()` recomputes duration via queue lookup** (`videoQueueService.js:871-885` calls `getVideoDuration(tokenId)` which scans the queue by tokenId) instead of using `currentItem.duration` — wrong item if the same token is queued twice; also `getVideoDuration` throws rather than returning a default, making `getRemainingTime` throw-prone for items evicted by `clearCompleted`.
- **F-SHOW-29 | P3 | Idle-loop filename literal also lives in `vlcMprisService.js:315,332`** (and `FEATURE_IDLE_LOOP` env flag) — matrix 2.3 cites only displayControlService/videoQueueService; the pack `display.idleLoop` extraction has a third site (capability-matrix correction, not new classification).
- **F-SHOW-30 | P3 | `videoQueueService` constructor registers a permanent `registry.on('health:changed')` listener** (`:30-34`) outside listenerRegistry tracking; `serviceHealthRegistry.reset()` doesn't `removeAllListeners` so it survives reset (correct today, but it's the only cross-service listener in scope not visible to the leak-tracking infrastructure).

---

## Split-seam proposals

**1. `audioRoutingService` → routing vs ducking (confirms the Phase 2.3 plan, with concrete cut lines):**
- `PactlClient` (pure, no state): `_execFile`, `_parseSinkList`, `_parseSinkInputs`, `_extractVolumeForSinkInput`, `_parsePactlEvent`, `_identifySinkInput`'s section parser (merging the F-SHOW-24 duplicate). Unit-testable without process mocks.
- `RoutingService` (state: routing table + persistence + sink cache + sink monitor + volume intent): `applyRouting`, `setStreamRoute/Volume`, `_onSinkAdded`, HDMI card activation, WirePlumber check.
- `DuckingEngine` (state: rules, active sources, pre-duck): constructor takes a port `{getVolume(stream), setVolumeLive(stream, vol), getUserVolume(stream)}`. The F-SHOW-05/06/07 fixes (empty-array guard, per-target op serialization, per-instance refcount, restore-to-user-intent) belong in this extraction, not before it — doing them in-place doubles the work. Per decision B7, the extracted engine loads rules from the **venue** layer only.

**2. `cueEngineService` → standing-cue evaluator vs timeline runtime vs hold store:**
- Standing evaluator: `EVENT_NORMALIZERS`, `CONDITION_OPS`, `evaluateConditions`, clock triggers, enable/disable/once, `activate/suspend` — plus the NEW `toPersistence()/restore()` (F-SHOW-01/03) which only this half needs; ride `session.cueEngine` exactly like `session.gameClock`.
- Timeline runtime: `activeCues`, drive modes, `_fireTimelineEntries`, cascade stop/pause/resume, `_resolveRouting` — where the F-SHOW-08 correlation fix and F-SHOW-12 semantics decision land.
- Shared `HeldItemsStore`: `_holdCue/releaseCue/discardCue` (cueEngineService.js:1026-1101) and `_holdVideo/releaseHeld/discardHeld` (videoQueueService.js:809-857) are near-duplicate implementations with parallel id counters (`held-cue-N`/`held-video-N`) and a routing-by-id-prefix dispatcher in commandExecutor (:557-585). One store with a type field removes the prefix dispatch and the F-SHOW-16 edge class.

**3. EVENT_NORMALIZERS as the explicit cue-authoring contract:** `transaction:accepted`'s normalized fields (`memoryType`, `valueRating`, `groupId`, `hasGroupBonus`, cueEngineService.js:27-37) are game-rule vocabulary baked into the engine file. When the rules module is extracted (Phase 2 flagship), the normalizer for game events should be supplied by the game pack/rules module, with the engine owning only engine events (video/music/sound/clock/session). This is matrix 2.22's "document the vocabulary" plus a code seam.

## Decision-lens notes (docs/decisions/*)

- **B7 (ducking = venue):** code already loads ducking exclusively from `routing.json` — aligned. Caveat: `loadDuckingRules` clears all active duck state (`audioRoutingService.js:606-612`); if the config-tool venue editor ever hot-reloads routing.json mid-show, an active duck is dropped without restore. The future venue-reload path should drain, not clear.
- **B8 (lighting roles → venue mapping):** the binding points for role indirection are exactly three: `activateScene(sceneId)`, `sceneExists()` in `validateCommand`, and the `cues.json` literals. The design is helped by lighting being already cache-validated — but **hindered** by F-SHOW-10: fixture fallback means "preflight-verify every role is bound" can today pass against test data. Fix 10 before building the mapping page.
- **B11 (clock phases):** `gameClockService` is small and clean for a phase model, but three collisions: (1) F-SHOW-01/03 — phase transitions need restore/replay semantics or restarts will re-fire or skip `phase:changed`; (2) the overtime threshold is derived from `config.session.sessionTimeout` inside `sessionService.startGame` — the natural landing site for `game.json gameClock` params, currently buried in env config; (3) `parseClockTime` HH:MM:SS in the cue engine and the future phase trigger vocabulary should be one definition.
- **B12 (display surfaces):** the 3-mode machine with previousMode-restore is structurally sound for "built-in surfaces"; pre-work confirmed: F-SHOW-09 (lock the hook), F-SHOW-29 (third idle-loop literal), plus matrix 2.5's title-search coupling (already flagged).

## Doc drift

| ID | Claim | Reality |
|---|---|---|
| D-7 | backend/CLAUDE.md: "Every mpd2 round-trip goes through `_send()`" | Idle handlers `_handlePlayerEvent`/`_handleMixerEvent` call `sendCommand` raw and unbounded (musicService.js:427-430,475) — F-SHOW-11 |
| D-8 | backend/CLAUDE.md gotcha: "`cue:started` internal event broadcasts as `cue:status` with state 'running'" | `cue:status` is no longer a broadcast event at all — both are only `pushServiceState('cueengine')` triggers (broadcasts.js:557) |
| D-9 | backend/CLAUDE.md + matrix 2.15: ducking engine has "fade"; routing.json example carries `fadeMs` | `fadeMs` is parsed nowhere; JSDoc says "reserved for future use" (audioRoutingService.js:604). Volume changes are instant |
| D-10 | asyncapi.yaml CueFired: `source` enum documents `'gm'` for manual fires; `trigger` required string | `source` hardcoded `'cue'`; `trigger` emitted `null` for manual fires (F-SHOW-15) |
| D-11 | matrix 2.3 lists idle-loop literal sites | Third site `vlcMprisService.js:315,332` + `FEATURE_IDLE_LOOP` env flag omitted (F-SHOW-29) |

## Test gaps & quality notes

- **The ducking suite tests the engine, never the wiring.** `tests/integration/audio-routing-phase3.test.js` calls `handleDuckingEvent` directly (broadcast wires disabled via `ENABLE_AUDIO_WIRES=false` in all jest layers, broadcasts.js:370-379). The P0 F-SHOW-02 lives precisely in the untested wiring. Needed: a broadcast-wiring test asserting the sound lifecycle → ducking mapping, including `sound:stopped`/`sound:error`.
- **No restart-restore test for the cue engine.** `gameClockService.restore()` is unit-tested in isolation (gameClockService.test.js:174-200); nothing tests "session restored active → standing cue fires" (would have caught F-SHOW-01) or "restored clock → past clock cues do not re-fire" (F-SHOW-03).
- **Ducking edge gaps:** no test for same-source overlap (sound+sound), redundant completion (pause→skip, F-SHOW-05), or apply/restore ordering (F-SHOW-06). The existing multi-source tests (video+sound) pass because they use distinct stream names.
- **videoQueueService pause/resume is untested** — zero `pauseCurrent`/`resumeCurrent` tests; consistent with the model having no paused state (wave-1 F-GMCMD-01). The otherwise-strong suite (race regressions for the 2026-04-17 endgame cutoff, hold behavior, concurrent-entry) shows the team writes good lifecycle tests when the lifecycle exists.
- **Test-certified dead code:** `applyRoutingWithFallback` is exercised only by its own unit test and the shared mock factory (F-SHOW-14) — the wave-1 "tests certify the wrong thing" pattern, milder form.
- **`audioRoutingService.test.js` (187 tests) contains no ducking describe blocks** — all ducking coverage is in the integration layer; the pure functions (`_calculateEffectiveVolume`, source bookkeeping) have no unit tests, which is where the F-SHOW-05/07 edge cases would naturally live.

## Open questions for owner

1. **95% completion threshold (F-SHOW-04):** intentional safety margin or bug? If the former, switch to a time-based margin (`duration − 1s`) to bound truncation on long videos.
2. **Timeline `at` semantics before video start (F-SHOW-12):** clock-relative, video-relative (entries gated until video starts), or author's choice per entry? Must be pinned in the cue-authoring contract before packs exist.
3. **Cue runtime persistence (F-SHOW-01/03):** on restore, should past clock cues be (a) marked fired without firing (recommended), (b) replayed, or (c) operator-prompted? Same policy will govern B11 phase transitions.
4. **Session end vs cue engine (F-SHOW-13):** should event-triggered cues keep working after `session:end` (post-game atmosphere control) or suspend with the session?
5. **Ducking restore target (F-SHOW-05):** restore to captured pre-duck volume or to the persisted user volume in `_routingData.volumes`? (The latter is more robust to capture failures and restart-mid-duck.)
6. **`vlcMprisService.seek()` (F-SHOW-14, extends F-GMCMD-21):** backend seek is already implemented — approve the `video:seek` action + contract entry, or delete the method?
