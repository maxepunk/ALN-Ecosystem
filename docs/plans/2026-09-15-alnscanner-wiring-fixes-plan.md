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

## W9 — video-driven cue completion: harness first, engine second, service only on evidence (revised 2026-09-15)

Origin: flow 30 step 1.6.6 (`e2e-video-compound`). Review doc → "Follow-ups found during E2E verification". Nothing here is implemented yet; C starts on the owner's go.

### The situation, stated once

- **Design intent (decision E5, `docs/decisions/2026-06-10-tier-e-wave2-semantics.md`):** a compound cue's timeline is clock-driven, except between "video actually starts" and "video ends", where it follows the video's own position; it pauses at the video boundary so load time never consumes timeline, and resumes on the clock from the real end. Implicit assumption: once a video starts, the engine sees at least one position tick before it sees the end.
- **How the orchestrator learns VLC's state:** it does not ask. A `dbus-monitor` child (ProcessMonitor-supervised) tails the session bus; each `PropertiesChanged` is parsed from text, filtered by the remembered owner of `org.mpris.MediaPlayer2.vlc` (`mprisPlayerBase._handleMprisSignal`), merged over 100 ms, and applied by ONE writer (`vlcMprisService._processStateChange`) which also emits `state:changed`. Only `Position` is read live (`getStatus()`, once per second while playing). This was a deliberate March 2026 performance choice (commit c66d7c4b removed 300-900 forks per video); its price is that the cache cannot notice it is wrong — nothing reconciles it against VLC.
- **The consequential consumer is the video monitor, not the cue engine.** `videoQueueService.monitorVlcPlayback` declares a video complete after two consecutive polls of cached non-playing state (`maxNonPlayingChecks = 1`). A lost "Playing" signal therefore produces a FALSE COMPLETION ~2 s in: `video:completed` fires, display mode returns to its previous mode, ducking is restored, waiting cues are told the video ended — while VLC is still playing on the TV. (This is the 2026-04-17 symptom family: endgame video cut to idle loop at 30 s.) The cue engine's boundary-mode wedge is the benign face of the same event.
- **Why two VLC instances exist in E2E, and only in E2E:** `tests/e2e/setup/vlc-service.js` (Oct 2025) predates the orchestrator owning VLC (2026-03-02, commit 938059f2); it was patched (2026-03-31) to keep spawning `cvlc --intf dummy` before `startOrchestrator()` in all 19 flow files, so the harness instance owns the bus name and the orchestrator drives IT, while the orchestrator's own fullscreen instance sits idle on `.instanceNNN`. Production runs one instance. The suite has never exercised the production VLC arguments.
- **Evidence that single-instance signal trouble is real:** retained logs show 20 VLC exit/restart entries and 16 "Timeout waiting for video" entries on the 2026-05-23 game night; the 2026-04-17 pre-game cut; 2026-07-18 clean. All "no duration metadata" warnings are from E2E runs.
- **What is NOT yet proven:** that today's E2E flake is caused by sender-filter drops. It is the leading hypothesis; the dbus-monitor path logs neither mismatches nor owner refreshes at info level, so it has not been observed directly. C's instrumented run decides it. Correction to an earlier claim: on a VLC restart the owner lookup usually returns NO owner, and a null owner disables the filter (all signals accepted); the stale-owner drop needs the name to still resolve to a dying process — a narrow window, not the common case.

### Correlation is inert today (shapes A)

`capturedVideoTokenId` (timelineRuntime.js ~:234) comes from `entry.payload.tokenId`; both video cues in `config/environment/cues.json` use `payload.videoFile`, so it is always null and every F-SHOW-08 guard is a no-op: ANY video's progress or completion drives ANY boundary-mode cue. A must correlate on the queued filename (`videoQueueService.js ~:728-770` derives `queueItem.tokenId` = filename minus extension).

### Package C — one VLC in tests, with the instrumentation that decides B (FIRST)

Owner: Opus. Scope: `backend/tests/e2e/setup/vlc-service.js`, `setup/test-server.js`, `helpers/capabilities.js`, flow files that gate on `vlcInfo`, plus three observability lines in `src/services/mprisPlayerBase.js` / `vlcMprisService.js` / `videoQueueService.js`.

1. Harness stops spawning VLC. `setupVLC()` becomes a probe-only helper (or is removed) and `cleanupVLC()` a no-op; the orchestrator's ProcessMonitor owns the only instance. `TEST_ENV` sets `VLC_HW_ACCEL=""` (drops `--vout=gles2`; the bench has Xorg but no HDMI, so fullscreen on the virtual screen is fine). At the venue the E2E videos will play on the real screen during the suite — accepted, and more honest than today.
2. Replace every `vlcInfo.type === 'real'` (and `!==` / `'mock'` variants — grep all 19 files) gate with `getCapabilities(orchestratorInfo.url).vlc`; flows that play a video right after an orchestrator (re)start must `waitForCapability(url, 'vlc')` first (most already do).
3. Instrumentation (product side, info level, cheap): (a) `_handleMprisSignal` sender mismatch → one info line per drop with sender/owner; (b) `_resolveOwner`/`_refreshOwner` outcome → info line with old/new owner (promote from debug); (c) `monitorVlcPlayback`: when about to `completePlayback` from the cached non-playing path, log the last live `time` read and the elapsed since `video:started` ("completion from cache: state=… time=…s of …s"). No behaviour change.
4. Invariant assertion in one flow (00-smoke or 07d-03): exactly one `vlc` process during a test (note `cvlc` execs to `vlc`) and no "Existing VLC processes found at init" line in the orchestrator output (`TEST_DEBUG=true` captures it).

Diagnostic protocol after C: run the touched flows + flow 30 + 22/25 (video lifecycle) with `TEST_LOG_LEVEL=info TEST_DEBUG=true`, twice. Count (a) mismatch drops, (b) owner refreshes mid-video, (c) cache-completions whose logged `time` was still advancing / far from length. **All zero and no flake → B stays on the shelf; the harness was the whole trigger. Any non-zero → B in the shape below, targeted at the boundary the counters name.**

Non-goals: no change to `getStatus()`, no polling, no cue-engine change.

### Package A — engine tolerates a video that ends without ticks, safely (SECOND)

Owner: Opus, strict TDD in `tests/unit/services/cue/timelineRuntime-e5.test.js`. Scope: `src/services/cue/timelineRuntime.js` (`handleVideoLifecycle`, ~:405-476), possibly `cueEngineService.js` for the completed-item payload.

1. In `handleVideoLifecycle`, a `completed` for a cue still in boundary mode is accepted ONLY when BOTH hold: (i) the completed `VideoQueueItem` is the one this cue's own `video:queue:add` produced (match on filename → `queueItem.tokenId`); (ii) **plausibility guard:** the item's actual playback duration (`getPlaybackDuration()`) is within a margin of its expected duration (`duration` on the item / token DB), e.g. ≥ 80% or within 3 s. If (ii) fails, do NOT complete: log an anomaly ("completed after Ns of Ms — treating as false completion, cue stays in boundary") and leave the cue waiting. Rationale: the realistic production trigger is a false completion with VLC still playing; completing then would fire the remaining choreography against a live video, which is worse than a stuck list entry.
2. On acceptance: set a NEW flag `videoResolved = true` (do not reuse `videoStarted`, which keys the stop/pause/resume cascade); anchor the post-video segment at the item's actual playback duration (NOT the frozen boundary `elapsed`, or later entries fire that long after the video ended); fire remaining entries at their `at` under post-video clock anchoring (never skip: `checkCompletion` requires all entries fired, and skipping would drop e.g. the 600 s `scene.game` restore); then complete normally. Note post-video entries advance on `gameclock:tick`; a cue with no pending entries completes immediately.
3. Remove the always-truthy arrow at ~:459 (`if (firedEntryIndex => …)`), dead code.
4. Audit `cues.json` for cues triggered by `cue:completed` (none today) and note in the commit that previously-wedged cues now complete and will fire such chains.

Tests (all RED first): completion-before-progress, matching filename, plausible duration, no pending entries → completes once, `cue:completed` emitted once; same with pending entries → anchored at playback duration, entries fire at correct clock offsets; unrelated filename → ignored; implausible duration (2 s of 30 s) → NOT completed, anomaly logged, cue still boundary; stop during post-video → no double skip. Revert-check each.

### Package B — reconcile the cache at decision boundaries (ONLY if C's counters demand it)

Shape (not per-second polling, not a second cache writer): (1) before `monitorVlcPlayback` declares completion from cached non-playing state, ONE direct `PlaybackStatus` read; if Playing, feed it through `_processStateChange` and keep monitoring; (2) after an owner refresh, a dbus-monitor restart, or a VLC restart, ONE full `PlaybackStatus` + `Metadata` read re-seeds the cache through the same writer; (3) while Playing with `length === 0`, ONE `Metadata` read, retried on a bounded schedule (e.g. every 2 s, max 10) until a length appears, so progress can start. Steady-state cost zero. Load-bearing risk: `_parseMetadata` expects `dbus-monitor` text; a `dbus-send --print-reply` reply has a different layout — capture real output on the Pi as a fixture before writing the parser branch. Callers of `getStatus()` are exactly five (vlcMprisService.js:169; videoQueueService.js:288, :309, :339, :557); `getState()`/`service:state`/`sync:full` are cache-only and untouched. Tests: unit on each boundary; production no-op proof (healthy stream → zero extra reads).

### Order and gates

C → instrumented diagnostic run → A → (B if and only if counters non-zero). Each package: own commit(s) on `production-2026-07`, adversarial review, full unit + integration + touched-flow E2E before the next starts.
