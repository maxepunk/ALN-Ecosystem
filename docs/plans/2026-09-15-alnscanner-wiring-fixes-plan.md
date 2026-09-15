# GM Scanner Wiring Fixes — Implementation Plan

**Source review:** `2026-09-15-alnscanner-wiring-review.md` (owner triage section is the scope authority).
**Branch policy:** every commit lands on `production-2026-07` in the repo it touches. `main` is never checked out, merged, or pushed from this device (pre-push guard enforces). Leaf first: ALNScanner commits → parent gitlink bump. `ALN-TokenData` is untouched.
**Execution model:** team lead defines packages, delegates each to one subagent with a hand-picked model, reviews with independent reviewers, integrates and verifies. Subagents commit their own package when green; the lead bumps the gitlink and runs the cross-repo verification.

## 1. Scope

In scope, in priority order from the owner triage:

| Pkg | Findings | Repo | Owner model | Why that model |
|-----|----------|------|-------------|----------------|
| W1 | A-3, A-4, A-9 — scanned-token guard reconciles; reset confirm text | ALNScanner | Opus | Shared-`Set`-reference semantics between facade and strategy; easy to break silently |
| W2 | A-1, A-2, E-1 — one backend-score accessor; completed groups on both strategies; `findToken` wrapper | ALNScanner | Opus | Three consumers with an implicit shape contract; both modes; test-mock drift to unwind |
| W3 | E-2 (+E-3, E-4 same file) — report bonus reconciliation, owner, escaping | ALNScanner | Sonnet | Pure function with a precise spec and existing test suite |
| W4 | B-2, B-3, B-5 — push a service's own domain on health change; lighting reloads scenes on recovery; music refreshes after reconnect; "Check Now" always pushes + shows `lastChecked` + toast | backend + ALNScanner | Opus (backend), Sonnet (client) | Backend touches 4 services + broadcaster with jest wire-gating gotchas; client half is two small renderer edits |
| W5 | B-1 — audio routes resolve alias → concrete sink name; renderer drops silent fallback | backend + ALNScanner | Opus (backend, bundled with W4), Sonnet (client, bundled with W6c) | Same backend agent already in `audioRoutingService` |
| W6 | B-7 + two-slider consolidation — volume broadcast, sink-input `change` monitoring, drag guard, remove MPD slider | backend + ALNScanner | Opus (backend, bundled with W4), Sonnet (client) | Backend: pactl monitor state machine; client: deletion + guard, mechanical |
| W7 | B-4, C-7 — video queue container visibility; device-ID header repaint | ALNScanner | Sonnet | Two one-function fixes with existing test files |
| W8 | C-1 guard — ended session survives until reset (lower priority, last, optional) | backend | Opus | Touches `sessionService`/`syncHelpers` with E2E assertions on `session: null` to check first |

Out of scope (owner decision): A-8 (accepted as useful), B-8 (scenes stable during game), C-2/C-6/C-11/C-12 (standalone), all Low items not listed above, dead-code sweep (D). These stay in the review for a later pass.

## 2. Waves and dependencies

```
Wave 1 (parallel, no file overlap)
  BE-1  (Opus)   W4-backend + W5-backend + W6-backend      backend/src/services/*, backend/src/websocket/broadcasts.js, backend/tests
  GS-1  (Opus)   W1                                         ALNScanner: NetworkedStorage, unifiedDataManager, messageRouters, gameOps (1 string)
  GS-2  (Sonnet) W3                                         ALNScanner: sessionReportGenerator + its test
  GS-3  (Sonnet) W7                                         ALNScanner: VideoRenderer, settings.js + tests
Wave 2 (after GS-1 and BE-1 are committed)
  GS-4  (Opus)   W2                                         ALNScanner: unifiedDataManager, both strategies, GameOpsRenderer, gameActivityBuilder + tests
  GS-5  (Sonnet) W4-client + W5-client + W6-client          ALNScanner: HealthRenderer, EnvironmentRenderer, MusicRenderer, domEventBindings, index.html + tests
Wave 3
  RV-1  (Opus, code-reviewer)  backend diff vs production-2026-07
  RV-2  (Opus, code-reviewer)  ALNScanner diff vs production-2026-07
  Fix-ups routed back to the owning agent by SendMessage
Wave 4 (lead)
  W8 decision + BE-2 (Opus) if approved; full verification; gitlink bump; docs
```

Why GS-4 waits for GS-1: both edit `unifiedDataManager.js` and `NetworkedStorage.js`. Why GS-5 waits for BE-1: it consumes the new `lastChecked` push and the resolved sink names, and the drag guard test needs the final `volume:changed` shape.

Agents work in the shared checkout on `production-2026-07`. Each agent runs only its own test files while developing (`npx jest <path>`); the lead runs full suites and coverage ratchets in Wave 4. No agent runs `npm run build`, E2E, PM2, or anything that touches VLC/MPD/PipeWire/HA.

## 3. Work packages

Every package is strict TDD: write the failing test that encodes the GM-visible behaviour, confirm it fails for the right reason, implement, confirm green, then run the package's neighbouring test files. Every package ends with one commit on `production-2026-07` in its repo, message `fix(<area>): <what the GM now sees correctly> (<finding ids>)`, ending with the attribution line.

### W1 — scanned-token guard reconciles (GS-1, Opus)

Files: `ALNScanner/src/core/storage/NetworkedStorage.js`, `src/core/unifiedDataManager.js`, `src/network/messageRouters.js`, `src/app/domains/gameOps.js:428`, `backend/tests/helpers/browser-mocks.js` (MockDataManager), tests in `tests/unit/core/storage/NetworkedStorage.test.js`, `tests/unit/core/unifiedDataManager.test.js`, `tests/unit/network/` (router tests; create `messageRouters.test.js` if absent).

Spec:
1. `NetworkedStorage.clearScannedTokens()`: `this.scannedTokens.clear()` **in place** (the Set reference is shared with the facade via `_syncScannedTokens`; never reassign), then `persistScannedTokens()`. `UnifiedDataManager.clearScannedTokens()` delegates to the active strategy. Add the same method to `MockDataManager` in `browser-mocks.js`.
2. `NetworkedStorage.setTransactions(txs)`: after replacing the cache, add every `tx.tokenId` to `scannedTokens` and persist (A-9; mirrors `addTransactionFromBroadcast`).
3. `gameOpsRouter` `transaction:deleted`: after `removeTransactionFromBroadcast`, if `payload.tokenId` and no remaining cached transaction has that `tokenId`, call `dataManager.unmarkTokenAsScanned(payload.tokenId)`.
4. `gameOpsRouter` `scores:reset`: call `dataManager.clearScannedTokens()` after `clearBackendScores()`.
5. `gameOps.js:428` confirm text → "Reset all team scores to zero? This also clears all transactions and makes every token scannable again."

Acceptance tests (GM-visible): (a) transaction:deleted for token X → `isTokenScanned('X')` false and localStorage key updated; a second cached transaction for X keeps it marked. (b) scores:reset → Set empty, persisted. (c) `setTransactions([{tokenId:'X'}])` → X marked. (d) Existing tests asserting the old confirm text updated.

Non-goals: A-6 event dispatch, C-1, anything in `LocalStorage.js`.

### W2 — Team Details and Game Activity read backend truth (GS-4, Opus)

Files: `unifiedDataManager.js`, `storage/NetworkedStorage.js`, `storage/LocalStorage.js`, `storage/IStorageStrategy.js` (doc the method), `src/ui/renderers/GameOpsRenderer.js:213`, `src/core/gameActivityBuilder.js:55-64`, `browser-mocks.js`, tests: `unifiedDataManager.test.js`, `NetworkedStorage.test.js`, `LocalStorage.test.js`, `tests/unit/ui/uiManager.test.js:31,441` (mock drift), `tests/unit/core/gameActivityBuilder.test.js:3-10` (mock drift), GameOpsRenderer test under `tests/unit/ui/renderers/` (create if absent).

Spec:
1. `UnifiedDataManager.getBackendTeamScore(teamId)` → `this._networkedStrategy?.backendScores?.get(teamId) ?? null`; null in standalone. `GameOpsRenderer.renderTeamDetails` uses it instead of `this.dataManager?.backendScores`.
2. `getTeamCompletedGroups(teamId)` on **both** strategies, returning the exact shape `getEnhancedTeamTransactions` (UDM ~:582-590) and `calculateTeamScoreWithBonuses` (~:687-690) consume: read those two consumers first and match `{name, normalizedName, multiplier}` (or whatever they destructure — do not guess). Networked: from `backendScores.get(teamId).completedGroups` (group ids with the `(xN)` suffix stripped, per backend `tokenService.js:124`), multiplier resolved via `tokenManager.getGroupInventory()`; normalise the same way the consumer normalises. Standalone: from the team record's `completedGroups` (LocalStorage `:403`).
3. `gameActivityBuilder`: `const lookedUpToken = tokenManager?.findToken(tx.tokenId)?.token;` keep the transaction-carried fallback for the not-found case.
4. Rebuild the uiManager test mock from the real `UnifiedDataManager` surface (no `backendScores` property; `getBackendTeamScore` stub). Fix the gameActivityBuilder mock to return `{ token, matchedId }`.
5. Add both new methods to `MockDataManager`.

Acceptance: (a) networked Team Details shows Base/Bonus/Total from the backend payload and renders the admin-adjustments section when `adminAdjustments.length > 0`. (b) A completed group appears under Completed Groups (not In Progress) in both modes. (c) Activity card for a GM-claimed token with no prior player scan shows the DB memory type, rating, summary button. (d) A `findToken` mock returning a flat token must now FAIL the wrapper test (revert-check).

Non-goals: A-7 rfid row, A-13 counts, scoreboard changes.

### W3 — session report totals reconcile (GS-2, Sonnet)

Files: `src/core/sessionReportGenerator.js`, `tests/unit/core/sessionReportGenerator.test.js`.

Spec:
1. `_buildScoringTimeline`: Final Totals per team = sales + adjustments + `score.bonusPoints`. Line format: `**Team:** $825,000 ($165,000 sales + $660,000 group bonuses [Server Logs, Party Photos] + $0 adjustments)`. If a team has `bonusPoints > 0` but the timeline has no rows, still emit the team line. No timeline rows for bonuses (no timestamp exists).
2. Reconciliation guard: if `salesTotal + adjTotal + bonusPoints !== score.score` for a team, append ` ⚠ differs from standings by $N` to that team's line. This makes any future drift visible in the document instead of silent.
3. E-3: `_getTokenOwner(tx)` prefers `tx.owner` when it is a non-empty string, falls back to the local DB. Update all call sites to pass the transaction (or `{tokenId, owner}`).
4. E-4: apply the existing pipe/newline escape helper to `teamId`, `owner`, `deviceId` in every table row.

Acceptance: fixture with `bonusPoints` + `completedGroups` produces equal numbers in Final Standings and Final Totals; fixture with a stale local owner and `tx.owner` set uses `tx.owner`; team name `A|B` renders as `A\|B`. Existing fixtures without `bonusPoints` still pass (treated as 0).

### W4 — service state follows service health (BE-1 backend, GS-5 client)

**Backend** files: `backend/src/services/serviceHealthRegistry.js`, `websocket/broadcasts.js`, `services/lightingService.js`, `services/musicService.js`, tests `tests/unit/services/serviceHealthRegistry.test.js`, `tests/unit/websocket/broadcasts.test.js` (+ `broadcasts-environment.test.js`), `lightingService.test.js`, `musicService.test.js`.

Spec:
1. `serviceHealthRegistry.report()` emits `health:checked { serviceId, status, message, lastChecked }` on **every** call, in addition to the existing `health:changed` on transitions. `lastChecked` is already stamped.
2. `broadcasts.js`: on `health:checked` → `pushServiceState('health', serviceHealthRegistry)` (debounce already coalesces). On `health:changed` → also push that service's own domain via a fixed map: `lighting → pushServiceState('lighting', lightingService)`, `music → pushMusicState()`, `bluetooth → bluetoothService`, `audio → audioRoutingService`, `sound → soundService`, `vlc → pushServiceState('video', videoQueueService)`. Ignore ids with no domain (`gameclock`, `cueengine` already push their own).
3. `lightingService.checkConnection()`: on the down→healthy transition, `await this.refreshScenes()` (emits `scenes:refreshed`), errors caught and logged. Also call it at the end of a successful `init()` if it is not already (verify; do not duplicate).
4. `musicService.checkConnection()` reconnect branch: after `_setConnected(true, 'MPD reconnected')`, run one status refresh (the same routine the `system-player` idle handler uses) so `state`/`track` are re-read; errors caught.
5. Respect the jest gate: `broadcasts.test.js` wire tests must follow the existing `ENABLE_AUDIO_WIRES` pattern (see memory `patterns_backend_testing`); do not use `NODE_ENV`.

Acceptance: (a) `report('lighting','down')` twice → two `health:checked`, one `health:changed`. (b) `health:changed` for `music` → a `service:state {domain:'music'}` push whose state has `connected` matching the registry. (c) lighting transition to healthy → `scenes:refreshed` emitted with the reloaded list. (d) music reconnect → status refresh invoked once.

**Client** files: `ALNScanner/src/ui/renderers/HealthRenderer.js`, `src/utils/domEventBindings.js:126-136`, `src/admin/AdminOperations.js:58` (read the resolved ack shape), tests `tests/unit/ui/renderers/HealthRenderer.test.js`, `tests/unit/utils/` (domEventBindings test if present).

Spec: 6. HealthRenderer shows `lastChecked` per service as `checked HH:MM:SS` (absolute; no timer). 7. `serviceCheck` branch: on resolve, `uiManager.showToast?.(ack.message)` (verify `checkService` resolves with `{action, success, message}`; if it resolves with something else, adapt, do not invent). Failures keep the existing `showError` path.

Acceptance: a health push with unchanged status but a new `lastChecked` re-renders the timestamp; clicking Check Now surfaces the message.

### W5 — audio routes carry concrete sink names (BE-1 backend, GS-5 client)

**Backend** files: `audioRoutingService.js` (`getState()` :310-322, `getRoutingStatus()` :328-340), `backend/contracts/asyncapi.yaml` (audio domain prose — contract first), `tests/unit/services/audioRoutingService.test.js`.

Spec: add `_resolveRouteSink(alias)`: if `alias` is `hdmi`/`bluetooth`, return `this._buildAvailableSinksSnapshot(this._sinkCache).find(s => s.type === alias)?.name ?? alias`; else return it unchanged. Both `getState()` and `getRoutingStatus()` return resolved names in `routes`. Internal `_routingData` keeps aliases (persistence and fallback logic unchanged). Update the asyncapi prose for `routes` values before the code change.

Acceptance: with a cached HDMI sink `alsa_output.x.hdmi` and route `hdmi`, `getState().routes.video === 'alsa_output.x.hdmi'`; with no matching sink, the alias passes through; `setStreamRoute` unchanged.

**Client** file: `EnvironmentRenderer.js:166-195`. Spec: remove the silent `options[0]` fallback in both branches; when no option matches, insert or select a disabled placeholder `<option value="" disabled>Unknown sink</option>` and `Debug.log` the unmatched value. Acceptance: unmatched route shows the placeholder, never a real sink.

### W6 — one music volume, broadcast, drag-safe (BE-1 backend, GS-5 client)

Decision recorded 2026-09-15: single authority is the per-stream slider driven by the `audio` domain (`audio:volume:set`). The MPD slider (`music:setVolume` UI) is removed from the GM Scanner. The backend `music:setVolume` action stays in the contract for cues.

**Backend** files: `audioRoutingService.js` (`setStreamVolume` :534-552, `startSinkMonitor` :784-830), `broadcasts.js:549` push list, tests `audioRoutingService.test.js`, `broadcasts-environment.test.js`. Spec: 1. `setStreamVolume` emits `volume:changed { stream, volume }` after persisting. 2. `startSinkMonitor` handles `change` events on `sink-input` for tracked streams: re-read that sink-input's volume, update `_routingData.volumes[stream]` (and the pre-duck baseline only when not currently ducked), emit `volume:changed`. 3. Add `volume:changed` to the audio push list.

Acceptance: `setStreamVolume('sound', 30)` → `volume:changed` + an `audio` domain push; a simulated pactl `change` on the music sink-input updates the stored volume and emits.

**Client** files: `MusicRenderer.js` (remove the volume slider + its render code), `index.html` (its markup if static), `domEventBindings.js` (remove the `musicVolume` debounce/action), `src/admin/MusicController.js` (keep `setVolume`, document it as cue-only), `EnvironmentRenderer.js:262-278` (`_applyVolumes`), tests `MusicRenderer.test.js`, `EnvironmentRenderer.test.js`, `MonitoringDisplay-environment.test.js`. Spec: `_applyVolumes` skips a slider while its pointer is down (`pointerdown` → `_dragging[stream]=true`; `pointerup`/`lostpointercapture` → false, then apply the last pending value), same pattern as `MusicRenderer.js:151-160`. Remove the MPD slider and every reference. Update `ALNScanner/CLAUDE.md` (MusicController, EnvironmentRenderer, AudioController lines) in the same commit.

Acceptance: a `ducking` push during drag leaves `slider.value` untouched and applies after release; no element or handler for the MPD slider remains (grep clean); existing MusicRenderer tests for the slider deleted, not skipped.

### W7 — two small surfaces (GS-3, Sonnet)

Files: `VideoRenderer.js:228 _updateQueueCount`, `index.html:400`, `src/ui/settings.js:27-50`, tests `VideoRenderer.test.js`, `tests/unit/ui/settings.test.js`.

Spec: 1. `_updateQueueCount(count)` sets `#video-queue-container` `style.display = count > 0 ? '' : 'none'` (look it up once in the constructor with an `elements.queueWrapper` injection like the others). 2. `Settings`: extract `_paintDeviceId()` used by both `load()` and `save()`.

Acceptance: queue of 2 → container visible and rows present; queue 0 → hidden. `load()` with `deviceId=GM_Station_3` in localStorage paints the header.

### W8 — ended session survives until reset (BE-2, Opus; only if approved in Wave 4)

Files: `sessionService.js:450-453`, `syncHelpers.js:50`, `backend/tests/unit/services/sessionService.test.js`, `syncHelpers.test.js`, plus a grep of `backend/tests/integration` and `tests/e2e` for assertions on `session: null` after end.

Spec: `sessionService` keeps `_lastEndedSession = session` before nulling `currentSession`; `getCurrentSession()` unchanged; `getLastEndedSession()` new; cleared on `session:create` and `system:reset`. `buildSyncFullPayload` uses `getCurrentSession() ?? getLastEndedSession()` for `session`, `recentTransactions`, `playerScans` only (scores already come from `transactionService`). Pre-flight: list every existing test that asserts a null session after end and decide with the owner before changing them. If more than a handful, fall back to the client guard (skip the three wipes when `payload.session === null` and the client holds an `ended` session with the same id, in `sharedInfraRouter` and `MonitoringDisplay.updateAllDisplays`).

## 4. Reviews (Wave 3)

Two `feature-dev:code-reviewer` runs on Opus, one per repo, each given: the diff against `production-2026-07`, the review document rows for the package, and the instruction to check (a) the shared-Set reference in W1, (b) the `getTeamCompletedGroups` shape against both consumers, (c) jest wire-gating in `broadcasts` tests, (d) that every new `UnifiedDataManager` method exists on `MockDataManager`, (e) that deleted tests were deleted, not skipped, (f) no `main` references. Findings go back to the owning agent by name; the lead re-reads the fix.

## 5. Verification (Wave 4, lead)

Run in this order and record counts against the baseline taken before Wave 1:
1. `cd ALNScanner && npm test && npm run coverage:check` (expect ≥ 1374 + new tests; 2 TZ-sensitive tests need `TZ=UTC`).
2. `cd backend && npm test -- --coverage && npm run coverage:check` (baseline 2128).
3. `cd backend && npm run test:integration` (baseline 342; docker-lifecycle needs Docker).
4. `cd ALNScanner && npm run build` — mandatory before any E2E; `backend/public/gm-scanner` is a symlink to `dist`.
5. Pre-flight the Pi: no competing orchestrator/PM2/VLC, kill any wedged scoreboard Chromium (memory: `finding_scoreboard_chromium_wedge`). Then the narrow L3 set only: `00-smoke`, `07b`, `07d-02`, `admin-state-reactivity`. Grep the Playwright summary line; `tee` masks the exit code.
6. Real-infra checks on the box for W4/W5/W6, done by the lead with the owner watching: stop `mpd` mid-session → panel disables and progress stops; start it → panel re-enables without reload. Toggle HA reachability → lighting panel follows. Open the audio panel cold → dropdowns show the configured sink. Change music volume on one station → the other station's slider follows.
7. `cd ALNScanner && npm run test:e2e` (standalone L2, 50 baseline).

## 6. Commit and branch procedure

- Every agent: `git -C <repo> rev-parse --abbrev-ref HEAD` must print `production-2026-07` before the first edit; abort otherwise.
- Package commits in ALNScanner first (one per package). After Wave 4 is green: parent commit that (a) bumps the `ALNScanner` gitlink, (b) contains the backend changes, (c) updates docs. Backend changes may also be committed per package during Wave 1 on the parent branch; the gitlink bump is its own final commit.
- Push `production-2026-07` for ALNScanner then parent only when the owner says so. The guard refuses `main`; nothing here needs it.
- `.gitmodules` already tracks `production-2026-07`; no change.

## 7. Docs to update in the same commits (owning docs only)

- `ALNScanner/CLAUDE.md`: MusicController (volume is cue-only), EnvironmentRenderer/AudioController (single music-volume authority, drag guard), HealthRenderer (`lastChecked`), Team Details data source (`getBackendTeamScore`), storage strategy interface (`getTeamCompletedGroups`, `clearScannedTokens`), remove the "returns `[]` pending F-GMS-02" note.
- Root `CLAUDE.md`: `service:state` bullet gains "`health:changed` also pushes the affected service's own domain; `health:checked` pushes `health` on every probe".
- `backend/contracts/asyncapi.yaml`: audio `routes` values are concrete sink names (W5), before the code change.
- Memory: `tech_debt_dual_music_volume.md` → mark resolved with the decision; MEMORY.md review line → "fixes plan executed".
- Review doc: add an "Execution log" pointer to this plan; per-finding status flips to FIXED with the commit hash.

## 8. Effort and order of value

| Wave | Packages | Rough size |
|------|----------|------------|
| 1 | W1, W3, W7, BE-1 (W4+W5+W6 backend) | ~14 files, ~25 tests |
| 2 | W2, GS-5 (W4+W5+W6 client) | ~12 files, ~20 tests |
| 3 | 2 reviews + fix-ups | |
| 4 | W8 decision, verification, docs, gitlink | |

If time is short, Wave 1 + W2 alone close every "Fix" row in the owner triage except the slider consolidation.

## W9 — video-driven cue completion (v3, after adversarial plan review 2026-09-15)

Origin: flow 30 step 1.6.6. Review doc → "Follow-ups found during E2E verification". Nothing implemented; starts on the owner's go. v2 of this section was reviewed adversarially (RV-5); five blockers and four highs changed the design below.

### The situation (corrected)

- **Design intent (decision E5):** a compound cue's timeline is clock-driven except between "video actually starts" and "video ends", where it follows the video's position; it pauses at the video boundary so load time never consumes timeline; it resumes on the clock from the real end. Implicit assumption: at least one position tick arrives before the end.
- **How VLC state reaches the orchestrator:** a `dbus-monitor` child tails the bus; signals are parsed from text, filtered by the remembered owner of `org.mpris.MediaPlayer2.vlc`, merged over 100 ms, and applied by ONE writer (`vlcMprisService._processStateChange`). Only `Position` is read live (`getStatus()`, once per second while playing). Deliberate March 2026 perf choice; the cache cannot notice it is wrong.
- **The consequential consumer is the video monitor.** `monitorVlcPlayback` declares completion after two polls of cached non-playing state (`maxNonPlayingChecks = 1`, hard-coded at videoQueueService.js:326). A lost "Playing" → FALSE COMPLETION ~2 s in: display mode flips back, ducking restores, waiting cues are told the video ended — while the TV keeps playing (2026-04-17 family). The boundary-mode cue wedge is the benign face of the same event.
- **Owner window, corrected twice:** on a VLC restart the owner lookup usually finds no owner and a null owner disables the filter (signals accepted) — BUT `_refreshOwner()` (mprisPlayerBase.js ~:327-333) RESTORES the old owner when re-resolution fails, and only the ProcessMonitor `exited` handler nulls it (vlcMprisService.js ~:114). So on any path where the monitor does not see an exit, a stale owner persists and its filter drops every signal from the new instance. Not narrow.
- **Two instances in E2E, and why it will get worse, not better, with a naive fix:** the harness (`tests/e2e/setup/vlc-service.js`, Oct 2025, predates orchestrator-owned VLC of 2026-03-02) spawns `cvlc --intf dummy` before every `startOrchestrator()`, so it owns the bus name and the orchestrator drives IT while the orchestrator's own fullscreen instance idles on `.instanceNNN`. Removing the harness instance alone is not enough: `test:e2e:tier-l` runs `--workers=3` (package.json:39) → three orchestrators → three VLCs fighting for one well-known name inside PRODUCT code. CI installs no VLC at all (test.yml:224-232), so video flows skip there. Note `cvlc` is `exec /usr/bin/vlc -I dummy`: the process name is `vlc`, and `ProcessMonitor._killOrphan` (processMonitor.js ~:185) matches `cvlc` in `/proc/<pid>/cmdline` → the orphan reap NEVER fires for VLC.
- **Pre-existing bug found by the review:** `skipCurrent()` (videoQueueService.js ~:502) calls `completePlayback(item)` with no skip marker, so `timelineRuntime.js` ~:464-466 (`data?.skipped`) is dead code and a GM skip anchors the post-video segment at the FULL video duration — remaining entries fire immediately. Any plausibility guard keyed on duration would reject every skip.
- **Untrustworthy inputs the v2 guard relied on:** `queueItem.duration` starts at 0 for file-based adds and is only filled from VLC metadata at play time (the same signal that a dropped "Playing" would lose); `getPlaybackDuration()` is wall-clock incl. pauses. The ONE trustworthy live signal is `status.time` (live `Position` read), already present in the monitor's cache-completion branch (videoQueueService.js ~:333-345).
- **Evidence — CORRECTED 2026-09-15:** an earlier draft cited the 2026-05-23 game night as showing 20 VLC restarts and 16 video-load timeouts. Re-reading those entries: the timeouts name `test_30sec.mp4` and sit in 01:00-03:00 E2E bursts; the 19:08 VLC health flaps carry the message "test" (jest runs) and follow a "Reset"; none is from the show. There is NO retained production evidence of a lost signal or a false completion. The 2026-04-17 endgame cut is real but predates the 2026-06-10 rewrite of the video/cue path (E5 TimelineRuntime, completion on time margin, paused state, pre-play lock) and the 2026-06-17 fixes; the only post-rewrite game (2026-07-18) was clean. The false-completion MECHANISM exists in the current code (read 2026-09-15: two polls of cached non-playing state, `videoQueueService.js:333-345`, rule dating from 2025-10-31), but its production frequency is unknown, possibly zero. The stale-owner restore in `_refreshOwner` was a deliberate 2026-03-13 choice ("preserve old owner to prevent cross-contamination") made under a one-instance assumption. Consequence: P0 is cheap defensive hardening, not an emergency; the "interim for the venue" paragraph below is a precaution, not a response to observed failures. `--vout=gles2` with the full production arguments PLAYS on the bench's headless Xorg (probed) — do NOT set `VLC_HW_ACCEL` in TEST_ENV.
- **Correlation is inert today:** `capturedVideoTokenId` is always null (cues queue by `videoFile`). Correlate on `queueItem.videoPath`, NOT `tokenId` (on the token branch `tokenId` is the matching token's id, videoQueueService.js ~:742-748; only the standalone branch uses the filename stem).

### Package P0 — make completion trustworthy (FIRST; small; product; venue mitigation)

Owner: Opus, strict TDD (`tests/unit/services/videoQueueService*.test.js`, `processMonitor.test.js`, `mprisPlayerBase*.test.js`). Scope: `videoQueueService.js` (monitor + skip), `processMonitor.js` (orphan guard), three log lines.

1. **Live-time guard (B-minimal, zero new D-Bus reads):** in `monitorVlcPlayback`'s non-playing branch, keep the previous poll's `status.time`; if the cached state says non-playing but `time` advanced since the last poll (or is > 0 and < length − 1 and moving), VLC is still playing: reset `nonPlayingChecks`, log once ("cache says stopped, position advancing at Ns — signal lost?"), and continue. Complete only when `time` is not advancing (true stop / natural end). Also use `time` in the near-end check as today. This alone prevents the April-17 false completion for display, ducking, queue AND cues.
2. **Skip marker:** `skipCurrent()` passes `{ skipped: true, position: <live time at skip> }` into `completePlayback`, which forwards it on the `video:completed` emit alongside the item (keep the item as first arg for existing consumers; add the marker as a second arg / property — check every `video:completed` consumer: cueEngineWiring ~:60-92, broadcasts video push, standingEvaluator). Makes the existing `data?.skipped` path live: a GM skip anchors post-video at the real skip position.
3. **Orphan reap:** ProcessMonitor matches the executed binary name (`vlc`), not the wrapper (`cvlc`), or matches either. Test with a fake cmdline.
4. **Instrumentation (info level, rate-limited):** (a) sender-mismatch drop: one line per new sender, not per signal; (b) owner resolve/refresh outcome incl. the "restored stale owner" branch; (c) the live-time guard's "signal lost?" line (this IS the cache-completion instrumentation from v2, now free).

Acceptance: unit cases for (1) cached-stopped + advancing time → no completion; cached-stopped + static time → completion after grace; (2) skip → event carries `skipped` + position; (3) orphan guard matches `vlc`; existing tests untouched except where they encoded the bare-item skip. Non-goals: no new D-Bus reads, no cue-engine change.

### Package C — one VLC per orchestrator, addressed by identity (DECISION: C1 test-only vs C1 + C2)

**C1 (test-only, do first, diagnostic):** `setupVLC()` stops spawning; harness probes only; `cleanupVLC()` no-op; the ONE `vlcInfo.type === 'real'` gate (flow 30 ~:502) and flow 22's private `isVLCHealthy()` (~:41) move to `getCapabilities(url).vlc` + `waitForCapability` before first playback; NO `VLC_HW_ACCEL` in TEST_ENV; invariant assertion (exactly one `vlc` process, no "Existing VLC processes found" line) ONLY under `--workers=1` and when `cvlc` is present (skip on CI). Diagnostic protocol: run flow 30 + 22/25 + 07d-03 with `TEST_LOG_LEVEL=info TEST_DEBUG=true --workers=1`, twice; read P0's counters. Zero drops/refreshes/"signal lost?" and no flake → the harness was the trigger. Non-zero → the counters name the boundary for B.

**C2 (product, cleaner architecture, own trace + review):** `vlcMprisService` addresses the instance it SPAWNED, not the well-known name: ProcessMonitor exposes the child pid (re-read on `restarted`; `exec` keeps the pid); `_resolveOwner` lists `org.mpris.MediaPlayer2.vlc*` names and keeps the one whose `GetConnectionUnixProcessID` equals that pid (store unique name + alias); `_getDestination()` returns the resolved name (null until resolved); `_refreshOwner` NULLS on failure (not-yet-registered) and retries — never restores a stale owner; `checkConnection` tolerates the resolve gap without reporting down; `_waitForVlcReady`/`init()` wait on the pid-matched name. Removes the harness collision, makes `--workers=3` correct, and stops an orphan or a crash-restart from hijacking production. Risk: every `_dbusCall` now depends on resolution; needs a hard-timeout fallback and tests for: name appears late, VLC restart, two instances present (spawn a decoy in the test). Tier L CI is unaffected (no VLC). Recommended AFTER C1's diagnostic, as the durable fix; decision owner's.

### Package A — engine tolerates a video that ends without ticks (AFTER P0)

Owner: Opus, strict TDD in `timelineRuntime-e5.test.js`. Scope: `timelineRuntime.js` `handleVideoLifecycle` (~:405-476), `cueEngineService.handleVideoLifecycleEvent` payload plumbing.

1. Accept `completed` for a boundary-mode cue when the completed item's `videoPath` equals the path this cue's own `video:queue:add` resolved to (record it when the entry fires). No duration plausibility guard — P0 makes completions trustworthy upstream; the guard's inputs were shown unreliable.
2. Anchor: skipped → the event's `position`; natural end → `item.duration` if > 1, else the live time the monitor last saw (carry it on the event from P0), else wall-clock `getPlaybackDuration()` as last resort. Never the frozen boundary `elapsed`.
3. Set a NEW `videoResolved` flag (do not reuse `videoStarted`, which keys the stop/pause/resume cascade at ~:530/:552/:580); fire remaining entries at their `at` under post-video clock anchoring (never skip; `checkCompletion` requires all fired); complete normally. **Clock caveat:** post-video entries advance only on `gameclock:tick` (cueEngineService ~:322); if the clock is paused/unstarted the cue waits — document; a cue with no pending entries completes immediately.
4. Delete the wholly dead `hasPostVideoEntries` block (~:455-462), not just the arrow.
5. Note in the commit that previously-wedged cues now complete and will fire `cue:completed` chains (none configured today).

Tests (RED first, revert-checked): completion-before-progress, matching path, no pending entries → completes once; with pending entries → anchored at duration, correct offsets; unrelated path → ignored; skipped with position → anchored at position; stop during post-video → no double skip; existing test that encodes "ignore completed in boundary" (if any) updated deliberately.

### Package B — remaining boundary reseeds (ONLY if C1's counters are non-zero)

After an owner refresh, a dbus-monitor restart, or a VLC restart: one direct `PlaybackStatus` + `Metadata` read re-seeding the cache through `_processStateChange`; while Playing with `length === 0`, one bounded `Metadata` retry so progress can start. Fixture from real `dbus-send --print-reply` output on the Pi before writing the parser branch. Superseded for the completion case by P0.

### Interim for the venue (before any package lands)

No config-only mitigation exists (`maxNonPlayingChecks` is a hard-coded local). A false completion is VISIBLE: display mode flips and ducking restores while the TV keeps playing; the operator can re-issue the display mode. P0 is the code mitigation and is small enough to land before the next game.

### Decision (owner, 2026-09-15): Option 1 — P0 → C2 (harness VLC removed as part of it) → A; B only on post-C2 evidence

### P0 — execution plan (team lead; strict TDD; no commits by agents)

Honest framing: no production evidence exists that a false completion has fired on the current code. P0 is defensive hardening plus two real bugs (skip marker, orphan reap). It is also what makes A safe.

| Task | Owner / model | Files (exclusive) | Depends on |
|------|---------------|-------------------|------------|
| P0.1 live-position guard | Agent X, Opus (timing logic, event shape) | `backend/src/services/videoQueueService.js` (`monitorVlcPlayback`), `tests/unit/services/videoQueueService*.test.js` | — |
| P0.2 skip marker on `video:completed` | Agent X (same file), then consumers | `videoQueueService.js` (`skipCurrent`, `completePlayback`), `cueEngineService.js` / `cueEngineWiring.js` / `cue/timelineRuntime.js` ONLY for payload plumbing, their unit tests | P0.1 (same file) |
| P0.3 orphan reap matches the executed binary | Agent Y, Sonnet (mechanical) | `backend/src/utils/processMonitor.js`, `tests/unit/utils/processMonitor*.test.js` | — |
| P0.4 instrumentation: mismatch drop (rate-limited per sender), owner resolve/refresh outcome incl. the "restored stale owner" branch | Agent Y | `backend/src/services/mprisPlayerBase.js`, its unit tests | — |
| Review | RV, Opus code-reviewer | read-only | X, Y done |
| Verification + commit | lead | — | review clean |

**P0.1 spec.** In the non-playing branch of `checkStatus`, remember the previous poll's `status.time`. If cached state is non-playing but `time` moved forward since the previous poll AND `time < length - 1` (or length unknown), treat VLC as playing: reset `nonPlayingChecks`, log ONE info line per video ("VLC cache says <state> but position advancing at Ns — change signal lost?"), keep monitoring. If `time` did not move, count as today. Natural end (near-end check) unchanged. Do not add D-Bus reads. Also carry the last live `time` on the completion emit (P0.2 shape) so A can anchor a natural end.

**P0.2 spec.** `skipCurrent()` reads the live position (one `getStatus()`), then `completePlayback(item, { skipped: true, position })`. `completePlayback` emits `video:completed` with the item as the FIRST argument unchanged (every existing consumer keeps working) and the marker `{ skipped, position, lastTime }` as a SECOND argument. Before changing anything, map EVERY `video:completed` listener (grep src/) and state what each reads: `cueEngineWiring` → `handleVideoLifecycleEvent('completed', data)` must forward the marker so `timelineRuntime.handleVideoLifecycle`'s existing `data?.skipped` / `data.position` path (~:464-466) becomes live; `standingEvaluator` reads `payload.queueItem?.tokenId` — verify whether that ever matched the item shape and report (do not silently fix an unrelated bug; if it is one, say so). Add a `timelineRuntime` unit case: video-mode cue, skip at 12 s of 30 s → post-video anchored at 12 s.

**P0.3 spec.** `_killOrphan` compares `/proc/<pid>/cmdline` against the wrapper name (`cvlc`) while `cvlc` execs to `vlc`, so it never matches. Match the resolved binary basename OR accept an explicit `orphanMatch` option set by `vlcMprisService` to `vlc`. Test with fake cmdlines for both names and a non-matching pid-reuse case (must NOT kill).

**P0.4 spec.** In `_handleMprisSignal`'s mismatch branch: one info line per distinct sender (Set), with sender + current owner. In `_resolveOwner`/`_refreshOwner`: info line with old → new owner, and an explicit line when the restore-stale-owner branch runs. No behaviour change.

**Verification gate (lead runs every step; agents' output is not trusted):**
1. Each agent: RED-first tests, revert-check at least one test per task, run its own test files.
2. Lead: `cd backend && npm test && npm run coverage:check`; `npm run test:integration`.
3. Lead: adversarial review of the diff (RV).
4. Lead, real-infra observable for P0.1 on this bench: run flow 30 on mobile-chrome twice with `TEST_LOG_LEVEL=info TEST_DEBUG=true`. Before P0.1, a stale cached "stopped" produced "Video playback completed" ~2 s after "started via VLC" (see 10:40:57 → 10:40:59 in the 2026-09-15 verbose log). After P0.1 that pattern must not occur; instead the "position advancing — change signal lost?" line appears and completion lands near the clip length. (The cue step itself may still wedge until C2 — the guard fixes the queue, not the missing progress ticks — and that is expected; record it.)
5. Lead: E2E video flows that exercise skip and completion: `22`, `25` (both @hardware; VLC plays headless here), `07d-03`, `08`, on chromium, with the new log lines visible; all must pass or skip for a documented environment reason.
6. Commit per task on `production-2026-07`; update this plan's status; memory note if a new gotcha surfaced.

### P0 — STATUS: DONE 2026-09-15 (parent e73c4383, 0fef6f7c)

Gate: unit+contract 2213 / coverage ratchet green / integration 342 / video flows 22 (3 passed), 25 (2 skipped, capability), 07d-03 (7 passed, 4 skipped), 08 (6 passed). Two adversarial review passes (RV-6, RV-7); all findings fixed forward and revert-checked.

**The predicted real-infra observable was wrong, and the correction matters for C2.** Flow 30 still failed both verbose runs, but NOT via a false completion: the log shows the play command at t, "started via VLC" at t+30 s, and a wall-clock playback duration of 37 s at completion — the 30 s clip had genuinely ended, the position was static, and the guard correctly stayed out. Zero "unexpected sender" and zero owner-refresh lines were logged (P0.4 instrumentation), so the sender filter is NOT dropping signals. The two-instance symptom is a ~30 s LATENCY of the "Playing" change signal reaching the cache (the `waitForVlcLoaded` window is 30 s; it resolved, it did not time out). A buffering hypothesis for that latency was PROBED AND REFUTED the same day: `dbus-monitor --session --monitor <rule>` piped to a reader delivers VLC's first `PropertiesChanged` within ~20 ms of the signal (12:56:20.911 emitted → 12:56:20.912 read), so pipe buffering is not the cause. The ~30 s latency lies elsewhere in the two-instance case (parser/debounce, the orchestrator's own idle instance, or VLC emitting late when driven by a second client via OpenUri) — C2's investigation starts from that, with P0.4's counters and `TEST_LOG_LEVEL=info`.

### Venue verification 2026-09-15 (HDMI display + W-KING over Bluetooth connected)

**Step 1 — production posture, single VLC, real hardware (PM2 `npm start`, all 8 services healthy, sinks = HDMI + `bluez_output.F4_4E_FD_53_5D_F2.1`):** `cue:fire e2e-video-compound` → `[VLC] Video playback started` 15:25:52.086 → `Video playback started via VLC` 15:25:52.665 (+0.58 s) → `Video progress received, switching to video-driven` 15:25:53.674 (+1.6 s) → `Video playback completed` 15:26:22.690 (+30.6 s, full clip) → `Video-driven cue completed` +5 ms → idle loop resumed. Zero "change signal lost?", zero "unexpected sender", zero owner refreshes. **The ~30 s "playing" latency is exclusive to the two-instance E2E harness; the production signal path is correct and fast. C2 (address the spawned instance; remove the harness instance) is confirmed as the right target. P0's guard did not need to engage.**

**Incidental venue defect fixed (outside W9):** the ALN WirePlumber policy (`/etc/wireplumber/bluetooth.lua.d/51-aln-bluez.lua`, 2026-08-28) set the LOCAL role `bluez5.roles = [ a2dp_sink ]` (Pi receives audio); a speaker needs `[ a2dp_source ]`. Symptom: speaker connects with only `audio-gateway`/`off` profiles, bluetoothd "a2dp-sink profile connect failed: Protocol not available", only `/MediaEndpoint/A2DPSink/*` registered. Fixed in the Lua file and the 0.5 `.conf` twin (backups `*.bak-2026-09-15`); W-KING now `bluez_output.F4_4E_FD_53_5D_F2.1` on `a2dp-sink`. Memory: `finding_wireplumber_bluez_role_direction`.

**Venue steps 2-4 (2026-09-15):** cold panel: Video → HDMI name, Music/Sound → "Unknown sink" (routes come from persistence, default defines `video` only; unrouted streams use `defaultSink`). **Owner UX decision: show the EFFECTIVE sink (the resolved default) for unrouted streams instead of "Unknown sink"** — follow-up `audioRoutingService.getState()`: resolve missing streams to the default sink's concrete name. Music routed to the W-KING plays; cross-station volume propagation works (two GM devices). MPD kill: health → down at +0 s, supervisor restart at +5 s, reconnect on the next 15 s revalidation at +16 s, controls back without reload. **Follow-ups found:** (a) an MPD crash costs up to ~20 s of dead controls — trigger a reconnect from the supervisor's `restarted` event instead of waiting for the revalidation tick; (b) the disconnect was not visible on the panel: on MPD exit `musicService` only flips `connected` and pushes a snapshot that still says `state: playing` + last track; `MusicRenderer` derives "playing" from `state` alone (progress bar keeps animating), disabled buttons have no stylesheet rule (browser default only), the full-render template hard-codes `music--connected`, and there is no offline banner. Fix on both sides: backend resets cached state to `stopped`/`track: null` on MPD exit before the push; renderer stops the progress timer whenever `connected` is false, uses the flag for the class, and shows "Music offline — reconnecting".

**Venue steps 5-6 (2026-09-15):** HA container stopped → lighting `down` at +1 s (HA WebSocket drop, reactive, faster than the probe), panel "unavailable", Check Now → toast "lighting = down" (P0/W4 path live). HA started → API up +7 s → lighting `healthy` +12 s, domain pushed, tiles back with no reload (8-scene cache intact). Scene activations game→party→game accepted by HA. **Follow-up:** `audio:volume:set` while a stream has no live sink-input (Video slider moved with no video playing) is rejected ("No active sink-input found for stream 'video'") and toasts as an error; it should be accepted and persisted, then applied when the stream appears (`_identifySinkInput` already re-applies stored volumes).

**Venue step 7 (2026-09-15), skip marker + standing-cue conditions live:** Run A (`test_30sec.mp4` queued directly): pre-video cue → attention.wav at +0.0 s, `scene.video` at +6.0 s (commands run in order; the lights change when the sound ends, 0.1 s before the video starts), video observed playing +0.2 s after the command, skip at +12 s → `video:completed` 9 ms later → post-video cue `scene.game` 1 ms after that → display back to the previous mode (scoreboard). Run B (`policesequencewoverlay.mp4` queued directly): NO pre-video sound or scene, video playing +0.2 s, skip → completed → NO post-video scene. The `tokenId neq policesequencewoverlay` conditions on both standing cues are verified end to end on real hardware; before today the post-video one always fired.
