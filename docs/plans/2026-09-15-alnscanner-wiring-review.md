# GM Scanner (ALNScanner) — Wiring Review: Information Surfaced to the GM

**Date:** 2026-09-15. **Tree:** ALNScanner @ 56f8c7a, parent @ 5ed1be93 (production-2026-07).
**Question asked:** where does the GM Scanner's plumbing (backend payload → client handler → state → renderer → DOM) surface *incorrect* information to the game master, or leave them confused?
**Out of scope (already reviewed May–June 2026, `2026-05-28-alnscanner-comms-review.md`):** reconnect/lifecycle, offline-queue durability, auth/wizard/HTTP, service worker, XSS.

## Method

Five parallel review dimensions, each run by a dedicated agent with the model chosen for the job, followed by adversarial re-verification (refute-by-default) of every finding the lead had not already confirmed by direct read:

| Dim | Scope | Model | Findings |
|-----|-------|-------|----------|
| A | Transaction / score / activity path (backend event → router → storage → main.js → GameOpsRenderer) | Opus | 13 |
| B | `service:state` domains → StateStore → MonitoringDisplay → 7 renderers, plus gm:command controllers | Opus | 12 |
| C | Session lifecycle, connection/mode status surfaces, scan gating, standalone-vs-networked parity | Opus | 15 |
| D | Mechanical cross-check: DOM ids, data-action handlers, MESSAGE_TYPES vs backend emits, gm:command enum, CustomEvent orphans, StateStore domains | Sonnet | 6 + dead-code list |
| E | `sessionReportGenerator` + `gameActivityBuilder` pure transforms vs real backend shapes | Sonnet | 6 |

Cross-dimension duplicates were merged (C-3=A-1, C-4=A-2, C-5=A-5=E-1, C-13=A-13, C-14=A-7, D-2=B-6, D-6=A-6). **Status** column: LEAD = confirmed by the lead reading both sides of the code; VER = confirmed by an independent verifier agent; UNV = reported only (all Low).

## Executive summary

The event plumbing itself is sound: every backend event the GM needs is in `MESSAGE_TYPES`, every `data-action` resolves to a handler, all 56 client `gm:command` actions are accepted by the backend, and all 10 service domains have exactly one subscriber. The defects are one hop further in, where **the client keeps its own copy of state and never reconciles it**, or **reads a field off the wrong object**. They cluster into four groups:

1. **Tokens go dead on a station and scans are silently lost.** The local scanned-token guard is only ever *added to*: deleting a transaction (A-3) and "Reset All Scores" (A-4) both free the token on the backend but not on any GM station, so re-scans are refused as duplicates for the rest of the session, persisted across reload. In standalone mode the session-status gate does not run at all, so a scan into a paused session shows "Transaction Complete!" with a dollar value while recording nothing and burning the token (C-2).
2. **The end-of-show sequence contradicts itself.** Ending a session nulls the backend's current session, so the very next `sync:full` (triggered by switching Scanner→Admin tab, or any reconnect) wipes the GM's history, player scans and session panel, removes the Download Report button, and leaves a stale scoreboard next to an empty history (C-1). The report that does get downloaded shows two different final totals per team because the timeline omits group bonuses (E-2). Standalone has no report at all and renders an ended session as "Active" (C-6, C-12).
3. **Team Details and Game Activity show numbers the scoreboard disagrees with.** Team Details reads `backendScores` off the facade where it does not exist (A-1) and `getTeamCompletedGroups()` is implemented by neither strategy (A-2), so completed groups show as "In Progress" with Group Bonuses $0 and admin adjustments are never itemised, in both modes. Game Activity reads token fields off the `{token, matchedId}` wrapper returned by `findToken()` (E-1), so claimed tokens show "Unknown / ☆☆☆☆☆ / Worth $0". Detective claims in networked mode print a black-market dollar figure (A-8).
4. **Admin panel environment state freezes.** Lighting and music connection changes never push their own domain (B-2, B-3): HA or MPD down at connect time leaves the panel disabled forever, and MPD dying mid-show leaves the progress bar advancing. Audio routing dropdowns can never match the configured route because routes are aliases and options are raw sink names (B-1). The video queue list is never unhidden (B-4). "Check Now" on a still-down service gives zero feedback (B-5).

All four clusters share a root pattern worth fixing structurally rather than case by case: the client mirrors backend state (scanned tokens, session, scores, connection flags) and the mirror has add-only or one-shot update paths.

## Findings by severity

### Critical

| ID | Status | Title | Where |
|----|--------|-------|-------|
| C-1 | LEAD | Ending a session wipes GM history, player scans and the session panel (and the Download Report button) on the next `sync:full`; scoreboard stays stale so the panel contradicts itself | `backend/src/services/sessionService.js:450-453` nulls `currentSession`; `backend/src/websocket/syncHelpers.js:50,64,133,139` builds from null; `ALNScanner/src/network/messageRouters.js:105-123` treats `[]` as authoritative; `unifiedDataManager.js:941-943` |
| C-2 | LEAD | Standalone: scan into a paused session shows "Transaction Complete!" with a value, records nothing, marks the token scanned; scan into an *ended* session is recorded | `src/app/domains/gameOps.js:204-212` gate is inside `isNetworked()`; `:304-307` ignores `addTransaction()`'s `{success:false}`; `LocalStorage.js:280-286` only checks `paused` |

### High

| ID | Status | Title | Where |
|----|--------|-------|-------|
| A-1 | LEAD | Team Details reads `dataManager.backendScores`, which exists only on the strategy; backend score branch and Admin Adjustments panel are dead | `src/ui/renderers/GameOpsRenderer.js:213,219-223,234-266`; `NetworkedStorage.js:29`; test mock drift `tests/unit/ui/uiManager.test.js:31,441` |
| A-2 | LEAD | `getTeamCompletedGroups()` returns `[]` in **both** modes (neither strategy implements it, though both track the data) → completed groups render as "In Progress", bonus $0 | `unifiedDataManager.js:566-572,582,687`; `LocalStorage.js:403`; `NetworkedStorage.js:204` exposes only a count |
| A-3 | VER | `transaction:deleted` never unmarks the token locally; backend frees it and sends `tokenId`; guard persists across reload on every station. **A page refresh does NOT clear it**: `_rehydrateScannedTokens` (NetworkedStorage.js:23-34) reloads the guard from `localStorage` key `networkedScannedTokens:<sessionId>`. Only workaround today: delete that key in DevTools | `messageRouters.js:47-54`; `NetworkedStorage.js:442-449` union-only; backend `transactionService.js:568-591` |
| A-4 | LEAD | `scores:reset` clears transactions + dedup on the backend (decision A3) but the client only zeroes scores; every pre-reset token stays refused; confirm text "Transactions will be preserved" is false | `messageRouters.js:56-58`; `gameOps.js:428`; backend `session/persistenceListeners.js:44-49` |
| E-1 | LEAD | `gameActivityBuilder` reads `SF_*` off the `{token, matchedId}` wrapper from `findToken()` → "Unknown / 0★ / Worth $0 / no Intel" on every GM-claimed token without a prior player scan (= every token in standalone). Unit-test mock returns a flat token. | `src/core/gameActivityBuilder.js:55-64`; `tokenManager.js:226-251`; `tests/unit/core/gameActivityBuilder.test.js:3-10` |
| E-2 | LEAD | Session report "Scoring Timeline → Final Totals" omits group bonuses; disagrees with the report's own "Final Standings" by exactly the bonus. `sync:full` scores already carry `bonusPoints`/`completedGroups`. | `src/core/sessionReportGenerator.js:137-219`; `backend/src/models/teamScore.js` |
| B-1 | LEAD | Audio routing dropdowns: backend `audio.routes` are aliases (`hdmi`/`bluetooth`), option values are raw pactl sink names; silent `options[0]` fallback shows the first sink, not the configured route | `src/ui/renderers/EnvironmentRenderer.js:186-193,241`; `backend/src/services/audioRoutingService.js:310-322,584`; `backend/config/environment/routing.json` |
| B-2 | LEAD | `lighting` domain is never pushed on HA connect/disconnect (push list = 2 scene events; `health:changed` pushes only `health`) → "Lighting unavailable" forever if HA was down at connect; dead tiles if HA dies mid-show; no Refresh button exists. Verified further: the reconnect success path (`lightingService.js:120-124`) only clears the retry timer and never calls `refreshScenes()`, so if HA was down at orchestrator start the scene list stays empty until a `lighting:scenes:refresh` command, which has no button | `backend/src/websocket/broadcasts.js:536,555`; `lightingService.js:102-114`; `EnvironmentRenderer.js:77-84` |
| B-3 | LEAD | `music` domain never pushed on MPD connect/disconnect (`_setConnected` only reports to the registry) → controls disabled forever, or progress bar keeps advancing after MPD dies. Verified further: after reconnect `_wireMpdEvents` (musicService.js:444) only registers idle listeners and nothing refreshes status, so the next push happens only when MPD itself fires a player/mixer event (e.g. a cue plays music). The disabled panel cannot trigger one. A page reload recovers it (sync:full carries `connected`) | `backend/src/services/musicService.js:230-233`; `broadcasts.js:505`; `MusicRenderer.js:183-189,333` |
| C-6 | LEAD | Standalone admin panel renders an *ended* session as "Active" with Pause/End buttons; fresh standalone session has no `status`, so Pause errors "No active session to pause" | `src/ui/renderers/GameAdminRenderer.js:51,76-93`; `LocalStorage.js:31-37,151,203-205` |

### Medium

| ID | Status | Title | Where |
|----|--------|-------|-------|
| A-8 | VER | Detective claims in Game Activity show a black-market dollar figure (networked `pointsFallback` fires on `points: 0`); standalone shows $0 | `NetworkedStorage.js:241-247`; `gameActivityBuilder.js:80-82`; `GameOpsRenderer.js:556-562` |
| B-4 | LEAD | `#video-queue-container` has inline `display:none` that nothing ever clears; queue count updates but the list of queued videos is never visible | `index.html:400`; `VideoRenderer.js:147-164` |
| B-5 | VER | "Check Now" on a still-down service gives zero feedback (registry emits only on status change; ack message discarded; no `lastChecked`) | `backend/src/services/commandExecutor.js:736-780`; `serviceHealthRegistry.js:56`; `src/utils/domEventBindings.js:21-32,129-133` |
| B-7 | VER | Per-stream volume changes are never broadcast (other stations' sliders stale); ducking push mid-drag snaps the slider back | `audioRoutingService.js:534-552`; `broadcasts.js:549`; `EnvironmentRenderer.js:262-278` |
| B-8 | VER | Lighting scene grid built once; refreshed/renamed/removed HA scenes never reach the grid; an empty first build leaves it blank until a disconnect. Owner triage: scenes do not change during game time, so only the empty-first-build case matters (it is the same failure as B-2) | `EnvironmentRenderer.js:91-100,133` |
| C-7 | LEAD | Header "Device ID" reverts to `001` after any reload (only `save()` repaints; `load()` does not) while scans still submit as `GM_Station_N`. Same class as the July mode-pill fix. | `src/ui/settings.js:27-33,47-50`; `index.html:72` |

### Low

| ID | Status | Title |
|----|--------|-------|
| A-6 | VER-partial | `sync:full` restore emits nothing main.js listens to → History badge hidden after reload until next scan; already-open History/Game Activity stale after reset/queue drain (fresh open re-renders correctly) |
| A-7 | VER | Team Details token cards show blank RFID in networked mode (`token.rfid` vs backend `tokenId`) |
| A-9 | VER | `sync:full` restore does not mark restored tokens scanned (live path does) → optimistic success then `transaction:failed` correction after reload |
| A-11 | VER | Session Details "Teams"/"GM Stations" frozen at last `sync:full` (`session:update` lacks those fields) |
| A-12 | VER | Backend `queued` result leaves the optimistic success screen uncorrected (only when `offlineQueueService.isOffline`, never set in prod) |
| A-13 | VER | Scoreboard token count (blackmarket only) vs Team Details count (all modes) disagree |
| B-6 | LEAD | `#video-status-badge` has never existed in markup → Playing/Paused/Idle badge never renders (F-GMCMD-01 markup half never shipped) |
| B-9 | UNV | Quick Fire / Standing Cues grids built once; empty first snapshot freezes them for the session |
| B-10 | UNV | `StateStore.replace()` shallow-equal short-circuit can skip first render of gameclock/lighting after a MonitoringDisplay rebuild (clock shows `--:--`) |
| B-11 | UNV | `AdminController.resume()` has no caller (console warning per reconnect; no GM impact) |
| B-12 | UNV | `sync:full` gameclock/cueengine shapes differ from `service:state` shapes (no consumer today; latent) |
| C-8 | VER | Overtime banner is one-shot and destroyed by any session-panel template swap (pause/resume, reconnect) |
| C-9 | VER | Duplicate message never names the claiming team (local guard fires before backend's "claimed by Team X") |
| C-10 | VER | Standalone shows a permanent red "Disconnected" pill; clicking it opens the wizard, which persists a token and rewrites the device ID before failing with "mode is locked" |
| C-11 | VER | Standalone transactions have no `id` → no Delete button in Team Details (intent explicitly "both modes") |
| C-12 | VER | Standalone has no session-report path; `getSessionData()` always null outside networked |
| C-15 | product call | History "Total Value"/"Avg Value" are score÷1000, the scan screen's identically-labelled figure is Σ star rating; 0 in detective-only play |
| D-1 | VER | `cue:completed` has no client handler (active-cue list still updates via the cueengine push; only the completion toast is missing) |
| D-3 | VER | `game-state:updated` forwarded and listened for but never dispatched (dead since inception; handler is a subset of `transaction:added`) |
| D-4 | UNV | `#orchestrator-status` never defined (header `#connectionStatus` covers it) |
| D-5 | UNV | `offline:queue:processed` has no consumer (dormant on both ends) |
| E-3 | VER | Report resolves token owner from local `tokens.json` only, ignoring backend-resolved `tx.owner` |
| E-4 | VER | Report table rows do not escape `\|` in teamId / owner / deviceId |
| E-5 | UNV | Report sale-detail breakdown text uses build-time scoring config (F-TOOL-05); Amount column is correct |
| E-6 | info | Report Duration is wall-clock, not pause-adjusted; no data to fix |

## Recommended fix order

1. **Local mirrors must reconcile, not only accumulate** (A-3, A-4, C-2, A-9): add `clearScannedTokens()` on `scores:reset`, `unmarkTokenAsScanned(payload.tokenId)` on `transaction:deleted`, mark restored tokens in `setTransactions`, move the session-status gate out of the `isNetworked()` branch and honour `addTransaction()`'s result. Fix the reset confirm text.
2. **Session end must not wipe the client** (C-1): either keep the ended session addressable in `buildSyncFullPayload` until reset, or make the three client wipes no-ops when `payload.session === null` while the client holds an `ended` session of the same id.
3. **One accessor for backend team scores** (A-1, A-2, A-13): `UnifiedDataManager.getBackendTeamScore(teamId)` and `getTeamCompletedGroups()` on both strategies; rebuild the uiManager test mock from the real class surface.
4. **Two one-line shape fixes** (E-1 `findToken(...)?.token`; A-8 gate `pointsFallback` on `mode !== 'detective'`) plus their drifted test fixtures.
5. **Push a service's own domain when its connection flips** (B-2, B-3, and B-7's volume): the cleanest single change is a `health:changed` listener in `broadcasts.js` that also pushes the domain for that serviceId, plus `volume:changed` in the audio push list.
6. **Resolve routing aliases server-side** (B-1) so `audio.routes` carries the concrete sink name it would route to; drop the silent `options[0]` fallback.
7. **Report bonus row** (E-2) from `bonusPoints`/`completedGroups`, then E-3/E-4.
8. Standalone admin parity (C-6, C-11, C-12, C-10), C-7 device-ID repaint, B-4/B-6 markup, B-5 unconditional health push after `service:check`.
9. Dead-code sweep from dimension D (list below).

## Verified correct (what was checked and found sound)

- `MESSAGE_TYPES` covers every backend→GM event; envelope unwrap matches `emitWrapped`; conformance test asserts list == AsyncAPI subscribe set.
- All `data-action` attributes resolve (incl. `admin.stopBtScan` set via `dataset`); all 56 client `gm:command` actions are in the backend enum; StateStore has one subscriber per domain, none dead, `destroy()` unsubscribes.
- `transaction:new` / `teamScore` / `score:adjusted` / `group:completed` / `player:scan` / `device:*` field names match backend producers; no own-scan double count; `sync:full` replaces rather than appends; session-boundary reset is id-gated; duplicates never persisted.
- GM sockets are moved into the new `session:<id>` room on session creation, so session-scoped broadcasts reach stations that connected earlier.
- Mode pill boot repaint (July fix) works; `sync:full` re-enriches transactions; `gm:command:ack` envelope consistent across all three consumers; team registry repopulates cleanly.
- Scoring parity: detective = 0 in both modes; group-bonus formula and 2+ member rule match; networked scan gate matches backend rejection.
- Service-state field parity for video, held, cueengine (active cues), health (8 keys), audio ducking, sound, bluetooth; MusicRenderer drag guard and playlist-signature rebuild.

## Not traced

`session:overtime` at router level (rendered by MonitoringDisplay only); `commandExecutor` beyond service:check/audio; `vlcMprisService` state emission; bluetooth cache population; `systemReset` re-sync; `StateValidationService` against a live orchestrator; `backend/public/scoreboard.html`. No tests were run; all findings are static traces with both sides quoted.

## Appendix — dead code / cleanup (dimension D)

Vestigial DOM ids `modeText`, `modeToggle`, `teamDisplay`, `orchestrator-status`, `video-status-badge`; dead handler `admin.pairBtDevice`; unconsumed events `settings:loaded/saved/changed`, `socket:connected` (prod), `initialized`, `team:added`, `session:error`, `session:updated`, `session-state:updated`, `player-scans:synced`, `game-state:updated`; backend `gm:identified` emitted but absent from contract and `MESSAGE_TYPES`; `batch:ack` structurally undeliverable to a GM; `transaction:create` / `music:seek` / `video:seek` backend actions with no client UI; conformance test does not scan `teamRegistry.js` (`session:addTeam`) or `gameAdmin.js` (raw `system:reset` emit).

Raw per-hit lists and verdicts for the mechanical checks were kept in the session scratchpad only; regenerate with the same greps if needed.

## Owner triage (2026-09-15, after walkthrough)

| Priority | Findings | Note |
|----------|----------|------|
| Fix | A-3, A-4 (tokens go dead) | No in-UI workaround; refresh does not help (see A-3 row) |
| Fix | A-1, A-2, E-1, E-2 (Team Details / Game Activity / report numbers) | |
| Fix | B-7 volume drift + the two-slider design (see memory `tech_debt_dual_music_volume`) | Owner: "the fact that there are two sliders is kind of an issue" |
| Fix | B-2, B-3 (lighting/music panel freeze) | Root cause shared with B-5 fix |
| Address | B-5 "Check Now" feedback; B-4 invisible video queue; C-7 device ID header | |
| Lower | C-1 session-end wipe | Owner downloads the report immediately after End Session, so it has not bitten; the wipe fires on Scanner→Admin tab switch (`sync:request`) or any reconnect. Cheap guard worth adding |
| Lower | C-2 standalone paused-scan; C-6/C-11/C-12 standalone admin | Standalone is not the current use case; noted |
| Accept | A-8 detective claim shows $ value | Owner finds it useful ("what it WOULD have earned"); relabel at most |
| Accept | B-8 scene grid rebuild | Scenes are stable during game time; only the empty-first-build case matters (folded into B-2) |

## Execution status (2026-09-15, plan `2026-09-15-alnscanner-wiring-fixes-plan.md`)

| Findings | Status | Commit |
|----------|--------|--------|
| B-4, C-7 | FIXED | ALNScanner 19beb7c |
| A-3, A-4, A-9 | FIXED | ALNScanner 9bd04fd |
| E-2, E-3, E-4 | FIXED (bonus term conditional; pipeline confirmation pending) | ALNScanner 8d4706d |
| A-1, A-2, E-1/A-5/C-5, C-4 | FIXED (both modes) | ALNScanner 540a096 |
| B-1 (client), B-5 (client), B-7 (client) + MPD slider removed | FIXED | ALNScanner 7e059c9 |
| B-1, B-2, B-3, B-5, B-7 (backend) + reset listener order (found in review) | FIXED | parent 08af30ea |
| Review follow-ups: drag guard reset on rebuild, missing route → placeholder | FIXED | ALNScanner fc45c28 |
| C-1 | FIXED (ended session retained in sync:full until create/reset; also un-blanks the wall scoreboard after End Session) | parent 8baed5b5 |
| A-8, B-8 | ACCEPTED (owner) | |
| C-2, C-6, C-11, C-12, remaining Lows, D dead-code list | OPEN, not scheduled | |

## Follow-ups found during E2E verification (2026-09-15)

- **Cue engine: a video-driven cue whose video ends before its first progress tick never completes.** `timelineRuntime.handleVideoLifecycle` (~:420-421) skips cues that have not yet left boundary mode, so `video:completed` for a very short clip is ignored and the cue stays active until stopped by hand. Reproduced with the headless harness VLC: `test_2sec.mp4` is already `Stopped` at position 0 ~1.7s after launch (length IS reported: 2.0s), while 27-30s clips report `Playing` with an advancing position. Production videos are long, so live risk is low. Fix candidate: on `completed` for a boundary-mode cue whose queued video matches the event, transition to video-driven completion instead of ignoring it.
- **Flow 30 step 1.6.6 (`e2e-video-compound`) fails for that reason**, not for lack of hardware. Plan: give the cue an ~8s clip cut from `test_30sec.mp4` (30s is too close to the flow's 40s completion wait once VLC start-up is added); keep the cue duration-less so the test still proves video-driven completion. Needs a new small binary under `backend/public/videos/` — owner decision pending.
- **E2E verification status:** touched flows re-run by the lead on both projects after the fixes (07b 8, 07c 6, 07d-02 9, 07d-03 14, admin-state-reactivity 6, 07d-04 8 passed / 2 skipped, 0 failed). Revert-checked: delete→rescan and reset→rescan fail with the router fix reverted; ended-session test fails with the sync-builder fix reverted. Flows that need venue hardware are listed in `backend/tests/e2e/README.md` → Environment Classes.
