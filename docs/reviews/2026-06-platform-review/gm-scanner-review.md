# GM Scanner (ALNScanner) — Static Structure Review

Date: 2026-06-09
Scope: `ALNScanner/src/app/app.js`, `src/ui/uiManager.js`, `src/core/` (unifiedDataManager, storage/, scoring, sessionReportGenerator), `src/network/`, `src/admin/`, `index.html`, plus contract cross-check vs `backend/contracts/asyncapi.yaml`, doc-drift vs `ALNScanner/CLAUDE.md`, and a test-quality sample.
All file paths below are relative to `/home/user/ALN-Ecosystem/ALNScanner/` unless prefixed.

## Summary

| Severity | Count |
|----------|-------|
| P0 | 1 |
| P1 | 4 |
| P2 | 10 |
| P3 | 10 |
| **Total** | **25** |

Top theme: the storage-strategy refactor left several seams half-wired (missing strategy methods, missing event emissions, broadcast handlers that re-emit commands), and the standalone-restore path bypasses initialization entirely. The two God files are highly splittable — a concrete domain map is below.

---

## Findings

### P0

**F-GMS-01 | P0 | src/app/initializationSteps.js:288-292 (with src/app/app.js:450-487, src/core/teamRegistry.js:253-264)**
**Standalone-mode restore after page reload leaves the scanner non-functional.**
`applyInitialScreenDecision` for `action: 'initStandalone'` only calls `sessionModeManager.setMode('standalone')` + `showScreen('teamEntry')`. Unlike `App.selectGameMode('standalone')` (app.js:450-487) it never: (a) calls `dataManager.initializeStandaloneMode()` (no active strategy → `addTransaction` throws `'No active strategy'`, thrown inside an un-awaited async NFC callback = silent lost scan), (b) sets `dataManager.sessionModeManager`, (c) sets `teamRegistry.sessionModeManager` (so `teamRegistry.selectTeam()` falls into the networked branch → `_createTeamOnBackend` → `orchestratorClient` is null → `{success:false, error:'Not connected'}` — the GM cannot get past team entry), (d) adds the `standalone-mode` body class (networked-only admin sections un-hidden; `data-requires="networked"` hiding in `src/styles/screens/admin.css` keys off that class). A mid-show reload of a standalone station bricks scanning.
Evidence: only call site of `initializeStandaloneMode()` is app.js:465 (grep). Unit test `tests/unit/app/initializationSteps.test.js:457-465` asserts only `setMode` + `showScreen` — it encodes the broken behavior as expected.
**Tag: fix-now**

### P1

**F-GMS-02 | P1 | src/core/unifiedDataManager.js:552-558 (with storage/LocalStorage.js, storage/NetworkedStorage.js)**
**`getTeamCompletedGroups()` is implemented by neither storage strategy → always `[]`.**
`UnifiedDataManager.getTeamCompletedGroups` delegates "if available"; grep confirms no strategy defines it. Consequences: `getEnhancedTeamTransactions` (uiManager team details) never renders the "✅ Completed Groups" section; `calculateTeamScoreWithBonuses` always returns `bonusScore: 0`. In standalone mode the team-details Score Breakdown therefore disagrees with the scoreboard (LocalStorage **does** track `team.bonusPoints` and includes them in `getTeamScores()`). In networked mode `backendScore` overrides the totals (uiManager.js:579-583) so only the group-section rendering is lost. LocalStorage tracks `team.completedGroups` as an array of plain names — even if delegated, the shape (`{name, normalizedName, multiplier}`) expected by UDM (uiManager too) does not exist anywhere.
**Tag: fix-in-phase-2** (the group logic should be consolidated during the split; an interim shim on LocalStorage is cheap if standalone team-details accuracy matters before then)

**F-GMS-03 | P1 | src/network/networkedSession.js:314-322 + src/core/storage/NetworkedStorage.js:167-178**
**`transaction:deleted` broadcast handler re-issues the delete command from every connected GM, and never prunes the local cache.**
On the broadcast, `_messageHandler` calls `this.dataManager.removeTransaction(payload.transactionId)`, which in networked mode delegates to `NetworkedStorage.removeTransaction` → `_emitCommand('transaction:delete', ...)` — i.e., each GM client that receives the deletion broadcast sends a *new* `gm:command transaction:delete` back to the backend (N-station echo; bounded only by the backend failing to find the tx). Meanwhile nothing removes the entry from `NetworkedStorage.transactions`, so the deleted transaction remains in Game Activity / team details until the next `sync:full`. The handler needs a local-cache-removal method (mirror of `addTransactionFromBroadcast`), not the command-emitting path.
**Tag: fix-now**

**F-GMS-04 | P1 | src/app/app.js:785-789; src/ui/uiManager.js:334-349, 489-494, 697-732**
**Unescaped HTML interpolation of user/NFC-controlled strings (XSS / markup breakage).**
- `App.showDuplicateError` injects raw `tokenId` (arbitrary NDEF text from any NFC tag) into `innerHTML` (app.js:785-789).
- `UIManager.renderScoreboard` injects raw `team.teamId` into both text and the `data-arg="${team.teamId}"` attribute (uiManager.js:340-346). Team names are explicitly unvalidated free text per project docs ("O'Brien & Co." is valid — a quote breaks the attribute; `<img onerror>` executes).
- `renderTokenCard` injects raw `token.group` (= `"Unknown: ${tokenId}"` for unknown tokens → NFC-controlled), `token.rfid`, `token.memoryType` (uiManager.js:697-713); group headers inject `group.displayName` (uiManager.js:489, 517).
`escapeHtml` is imported and used correctly elsewhere in the same file (`_renderActivityTokenCard`, `renderSessionStatus`) — the gaps are inconsistent, not systemic.
**Tag: fix-now**

**F-GMS-05 | P1 | src/app/app.js:839-860; src/core/unifiedDataManager.js:244-253; backend/src/websocket/gmAuth.js:126-128**
**Cross-device duplicate scans display false success to the operator.**
Local dedup (`scannedTokens`) is populated only from (a) this device's scans and (b) `sync:full.deviceScannedTokens`, which the backend builds **per device** (`session.getDeviceScannedTokens(deviceId)`). `transaction:new` broadcasts from other GM stations do NOT mark the token (`addTransactionFromBroadcast` only appends to the tx array). So GM-B scanning a token already claimed via GM-A: passes the local check, shows the optimistic "Transaction Complete!" result screen with points, then the backend returns `status: 'duplicate'`, which the queue intentionally swallows (`_submitDurable` removes silently; `transaction:failed` is dispatched only for `rejected`/`error`, and app.js:186 explicitly returns early for duplicates). Team never gets the points; operator never learns. Either mark tokens scanned from `transaction:new` broadcasts, or surface duplicate results as a non-error toast.
**Tag: needs-owner-decision** (the "don't unmark duplicates" comment is deliberate; the false success screen probably isn't)

### P2

**F-GMS-06 | P2 | src/app/app.js:300-321**
`toggleMode()` mutates `settings.mode` but never calls `settings.save()` — the mode indicator comment claims "stored in Settings and localStorage" but localStorage is not written. A reload reverts the station to the last-saved mode (default `'detective'`), silently changing scoring behavior mid-show. (Only `applyURLModeOverride` ever calls `settings.save()` for mode.)
**Tag: fix-now**

**F-GMS-07 | P2 | src/core/storage/LocalStorage.js:180-182**
Standalone `endSession()` is `{ this._saveSession(); }` — it never sets `sessionData.status = 'ended'`, never sets `endTime`, never emits `session:updated`. After "End Session", `_refreshAdminSessionDisplay` re-renders and `getCurrentSession()` still reports `status: 'active'` → admin panel continues to show an Active session with Pause/End buttons. Also blocks any future standalone post-game report ("session over" is undetectable).
**Tag: fix-now**

**F-GMS-08 | P2 | src/core/storage/LocalStorage.js:399-432, 461-490**
LocalStorage violates the documented strategy-event contract (CLAUDE.md: "Storage strategies MUST emit events"): `removeTransaction` does not emit `transaction:deleted`; `adjustTeamScore` does not emit `team-score:updated`. Result in standalone mode: deleting a transaction leaves history badge, history screen, admin Game Activity, and both scoreboards stale (app.js manually refreshes only the team-details panel, app.js:1604-1608); score adjustments don't refresh scoreboards. The main.js handlers for those events (main.js:140-147, 163-170) exist and would do the right thing.
**Tag: fix-now**

**F-GMS-09 | P2 | src/core/storage/NetworkedStorage.js:334-345 vs backend/contracts/asyncapi.yaml (gm:command enum) and backend/src/services/commandExecutor.js:331**
`NetworkedStorage.resetScores()` emits gm:command action `'scores:reset'`; the contract enum and backend implement `'score:reset'`. Currently unreachable in production (app.js networked path uses `AdminOperations.resetScores()` which correctly sends `'score:reset'`), so this is dead code carrying latent contract drift — it would fail the moment someone "unifies" admin ops onto the strategy.
**Tag: fix-in-phase-2** (delete or fix during the split)

**F-GMS-10 | P2 | src/network/networkedSession.js:350-367 (backend:error)**
Non-auth backend `error` events have no UI consumer. `networkedSession` dispatches `backend:error` "UNCONDITIONAL so a future auth-code toast consumer still fires", but grep shows zero production listeners (only a unit test listens). AsyncAPI Decision #10 says clients MUST display error events — e.g., `QUEUE_FULL`/`VALIDATION_ERROR` outside the replay path is silently dropped.
**Tag: fix-now** (one `addEventListener` + toast in `App._wireNetworkedSessionEvents`)

**F-GMS-11 | P2 | src/ui/connectionWizard.js:477-488 (QueueStatusManager.init)**
`queue:changed` listener is registered only if `app.networkedSession` already exists when `queueStatusManager.init()` runs (main.js:251, once at startup). That is true only on the auto-connect restore path. In the common fresh-launch flow (user picks Networked Mode after init), the listener is never attached → the offline-queue indicator (`#queueStatusIndicator`) never updates for the whole session.
**Tag: fix-now**

**F-GMS-12 | P2 | backend/contracts/asyncapi.yaml sync:full schema vs backend/src/websocket/gmAuth.js:126-135, src/network/networkedSession.js:219-221**
Contract drift: `deviceScannedTokens` is sent by the backend in `sync:full` and is load-bearing for the GM scanner's dedup restore (TQ-7) and queue reconciliation (TQ-6), but it is absent from the AsyncAPI `sync:full` schema (required list ends at `displayStatus`; no property defined). Per the project's contract-first rule this field must be added to the contract.
**Tag: fix-now** (contract edit only)

**F-GMS-13 | P2 | src/app/app.js:1423-1455 (updateAdminPanel fallback scoreboard)**
The standalone admin "Team Scores" fallback recomputes scores inline (`calculateTokenValue` per tx), ignoring group bonuses AND admin adjustments → admin-view totals disagree with the scoreboard screen (which uses `getTeamScores()` incl. `bonusPoints`). It also duplicates `UIManager.renderScoreboard` with a divergent table. `UIManager.renderScoreboard(scoreBoard)` works in standalone (LocalStorage `getTeamScores` exists; main.js already renders it into `#admin-score-board` on `team-score:updated`) — the fallback branch is both wrong and unnecessary.
**Tag: fix-now** (delete fallback, call `renderScoreboard(scoreBoard)` unconditionally)

**F-GMS-14 | P2 | Duplication cluster (split-relevant)**
- Three duration formatters: `app.formatSessionDuration` (app.js:1324-1339), `uiManager._formatDuration` (uiManager.js:434-447), `SessionReportGenerator._formatDuration` (sessionReportGenerator.js:396-403).
- Two toast implementations: `UIManager.showToast` (uiManager.js:100-116) vs `MonitoringDisplay.showToast` (MonitoringDisplay.js:362-379, inline styles).
- `App.showDuplicateError` (app.js:781-814) hand-builds result-screen DOM in the app layer, duplicating `UIManager.showTokenResult` responsibilities.
- Group-bonus math exists in 3 places client-side alone: `LocalStorage._checkGroupCompletion` (authoritative standalone), `UDM.calculateTeamScoreWithBonuses` + `getEnhancedTeamTransactions` (display, currently broken per F-GMS-02), plus backend `transactionService._checkGroupCompletion`. LocalStorage's comparison is also non-normalized (`parseGroupInfo(tx.group).name === groupInfo.name`, LocalStorage.js:363-366) while UDM uses `normalizeGroupName` — curly-apostrophe/case variants would complete in one layer and not the other.
**Tag: fix-in-phase-2**

**F-GMS-15 | P2 | Test quality (sampled)**
- `tests/app/app.test.js:57` mocks `getTeamCompletedGroups: jest.fn(() => [])` — the mock mirrors the broken production seam (F-GMS-02), so tests pass while the feature is dead. No test anywhere exercises real `UDM + LocalStorage` group-bonus display (`calculateTeamScoreWithBonuses` appears in tests only as a mock).
- `tests/unit/app/initializationSteps.test.js:457-465` asserts the standalone-restore path does exactly `setMode` + `showScreen` — it certifies the P0 (F-GMS-01) as correct behavior. The mock app even defines `initStandaloneMode: jest.fn()` (line 53) that is never asserted.
- Positive: `tests/unit/core/storage/LocalStorage.test.js` is genuinely behavioral (asserts persisted state, score math, event emission, day-boundary session load). `tests/unit/ui/uiManager.test.js` is a legitimate pure-render test, but because every dataManager method is mocked, no test layer covers the UDM↔strategy↔UIManager integration where F-GMS-02/07/08 live. Coverage ratchet measures lines, not seams.
**Tag: fix-in-phase-2** (add integration-level tests along the new domain boundaries)

### P3

**F-GMS-16 | P3 | src/app/adminController.js:109-122 + src/network/networkedSession.js:173-187**
`AdminController.resume()` is never called (grep: no call sites); `_connectedHandler` calls `initialize()` whose re-init guard makes reconnect a no-op warning. `SessionManager`/`VideoController` have no `pause`/`resume` methods at all (optional-chained guards always false). Dead lifecycle scaffolding; `MonitoringDisplay.resume()` (re-request state) is unreachable — masked only because the server auto-sends `sync:full` on reconnect.
**Tag: subsumed-by-platform-refactor**

**F-GMS-17 | P3 | src/app/app.js:1280-1319 (adminViewSessionDetails)**
Reads `session.getDuration` (never a function on the plain `sessionState` object → Duration always "Unknown"), `session.scores` (not in session:update/sync:full session contract → Teams always 0 despite `session.teams` existing), `session.connectedDevices` (not in contract → GM Stations always 0), and `session.status.toUpperCase()` (TypeError if status missing). The alert shows mostly placeholder data.
**Tag: fix-in-phase-2**

**F-GMS-18 | P3 | src/core/unifiedDataManager.js:927-935**
`updateSessionState(null)` resets `sessionState` to `{}` instead of the constructor's shaped default (`{id:null, status:'disconnected', teams:[], ...}`). Downstream `sessionState?.status` reads become `undefined` (the scan gate at app.js:746-754 still blocks, with the generic "not active" label), and the shape contract documented in the constructor silently changes.
**Tag: fix-in-phase-2**

**F-GMS-19 | P3 | src/core/teamRegistry.js:165-175**
`populateFromSession`'s `sessionData.scores` branch is dead: per asyncapi.yaml, neither `session:update.data` nor `sync:full.data.session` carries a `scores` field (scores are a sibling of session in sync:full). Registry team scores are therefore always 0 (harmless — only names are displayed — but misleading).
**Tag: fix-in-phase-2**

**F-GMS-20 | P3 | Dead event plumbing**
- `session-state:updated` (UDM:931,947) — no consumers.
- `player-scans:synced` (UDM:865) — no consumers; after reconnect, restored player scans don't refresh Game Activity until another event/view switch (main.js listens only to `player-scan:added`).
- `session:updated` (LocalStorage pause/resume) forwarded by UDM — no consumers (app refreshes manually).
- `game-state:updated` — main.js:157 listens, but NO strategy ever emits it (grep: emitter absent).
**Tag: fix-in-phase-2**

**F-GMS-21 | P3 | index.html stale markup/comments + repo cruft**
- Comments reference removed code: `loadAvailableVideos()` (line 387, dead `<datalist id="available-videos">` — CLAUDE.md confirms no video-list endpoint exists), `MonitoringDisplay.updateSessionDisplay()` (line 326), `_renderActiveCues()` (424), `_renderAudioRoutingDropdowns()` (443), `ScreenUpdateManager` (508, 517 — class does not exist).
- Inline `onmouseover`/`onmouseout` handlers on game-mode buttons (125, 140) — the only inline handlers left; CSS `:hover` would do. Also inline `onclick` in uiManager-generated HTML (uiManager.js:994, 1020-1021 summary/timeline toggles) — inconsistent with the data-action architecture.
- Repo cruft at module root: `index.html.backup`, `indextext`, `tokens.json.backup`, `ES6_INTEGRATION_FIXES.md`, `TEST_REPORT.md`.
**Tag: fix-in-phase-2**

**F-GMS-22 | P3 | src/utils/config.js:7,12**
`MAX_TEAM_ID_LENGTH: 6` is dead (no usages) and contradicts the actual 30-char team-name policy (index.html `maxlength="30"`, root CLAUDE.md "1-30 chars") — a trap for future readers. `NFC_PULSE_INTERVAL` also unused.
**Tag: fix-in-phase-2**

**F-GMS-23 | P3 | src/ui/uiManager.js:122-158 (showScreen back-stack)**
Screen registry keys are inconsistent (`'gameModeScreen'` full id vs `'teamEntry'`/`'scan'` shortened), and the previousScreen exclusion list is duplicated as both id-form and name-form string literals. `previousScreen = current.id.replace('Screen','')` would produce non-key names for excluded screens if the lists ever drift. Works today; fragile state machine for the Phase-2 navigation split.
**Tag: fix-in-phase-2**

**F-GMS-24 | P3 | Doc drift (ALNScanner/CLAUDE.md, current code as truth)**
- Three conflicting test counts in one doc: "926 unit tests", "754 tests" (L1 section), "1116 tests across 57 suites".
- "Console Access: All modules exposed on `window`" (window.App, window.DataManager, etc.) — no window globals exist anymore (domEventBindings.js header confirms removal); all the debug snippets in that section (`DataManager.transactions`, `console.table(...)`, `DataManager.scannedTokens` works but `DataManager.transactions` does not exist on UDM) are stale.
- "settings.js — Pure state holder + localStorage persistence (no DOM manipulation)" — `Settings.save()` writes `#deviceIdDisplay` (settings.js:47-50).
- "scoreboardScreen — Black Market rankings (networked only)" — scoreboard works in both modes (blackmarket-gated only, app.js:943-950).
- "View System (Networked Mode Only)" — viewSelector is shown in BOTH modes since the standalone-admin work (app.js:207-216).
- "Group Completion Rules (LocalStorage.js:345-386)" — now 351-392 (minor).
- `DataManager.getTeamCompletedGroups('teamId')` debug recipe returns `[]` always (F-GMS-02).
**Tag: fix-in-phase-2**

**F-GMS-25 | P3 | src/ui/uiManager.js:330-332, 343**
Scoreboard renders `Team ${team.teamId}` — with free-text team names this produces "Team Whitemetal Inc." (cosmetic); score-source banner styles are inline-string HTML with emoji ("🔗 Live from Orchestrator" / "📱 Local Calculation") — belongs in CSS/strings pack.
**Tag: fix-in-phase-2**

---

## Domain-Mapping Blueprint (Phase-2 split)

Target domains: **Game Ops** (scanning, scores, logged memories, transactions), **Environment** (lights, music/volume, audio routing, bluetooth), **Game Admin** (pregame setup, session lifecycle, postgame report), **shared-infra**.

### src/app/app.js (1672 lines)

| Lines | Responsibility | Domain |
|---|---|---|
| 33-61 | Constructor / DI wiring | shared-infra |
| 67-130 | `init()` 11-phase bootstrap | shared-infra |
| 137-192 | `_wireNetworkedSessionEvents` (session:ready/auth:required → shared-infra; group:completed, transaction:failed toasts → Game Ops; scoreboard:page echo → Game Ops) | mixed — split listener registration per domain |
| 199-296 | `viewController` (view switching, admin module refs) | shared-infra (navigation shell) |
| 300-321 | `toggleMode` (detective/blackmarket) | Game Ops |
| 329-412 | Team entry UI (`initTeamEntryUI`, `_renderTeamList`, `confirmTeamId`) | Game Ops |
| 422-600 | `selectGameMode`, `_initializeNetworkedMode`, `_isTokenValid` | shared-infra (mode/connection lifecycle) — surfaces in Game Admin pregame UI |
| 607-609 | `switchView` helper | shared-infra |
| 616-921 | NFC pipeline (`startScan`, `_startNFCScanning`, pause/resume, `processNFCRead`, `showDuplicateError`, `recordTransaction`, `manualEntry`, `cancelScan`, `continueScan`, `finishTeam`) | Game Ops |
| 925-956 | History + scoreboard navigation | Game Ops |
| 960-977 | Team details navigation | Game Ops |
| 982-1120 | `adminCreateSession/Pause/Resume/End` (dual-mode branches) | Game Admin |
| 1126-1175 | `downloadSessionReport` | Game Admin (postgame) |
| 1177-1278 | `adminResetAndCreateNew` (system:reset + raw socket ack handling) | Game Admin |
| 1280-1339 | `adminViewSessionDetails`, `formatSessionDuration` | Game Admin |
| 1341-1399 | Video transport + queue (`_adminVideoAction`, `adminAddVideoToQueue`, `adminClearQueue`) | **needs-owner-decision** — video/show-control is in none of the three named domains; closest fit Environment (venue AV) but it is gameplay-triggered |
| 1403-1456 | `updateAdminPanel` (monitoring refresh + game activity + scoreboard fallback) | mixed: Game Ops (activity/scores) + shared-infra (refresh orchestration); fallback deleted per F-GMS-13 |
| 1458-1494 | `adminResetScores` | Game Ops (score intervention) |
| 1499-1510 | `viewFullScoreboard/History` | Game Ops |
| 1516-1521 | `_refreshAdminSessionDisplay` | Game Admin |
| 1525-1636 | GM intervention (`adjustTeamScore`, `deleteTeamTransaction`) | Game Ops |
| 1640-1664 | Display mode control (idle loop / scoreboard / return-to-video) | **needs-owner-decision** (same bucket as video) |

### src/ui/uiManager.js (1132 lines)

| Lines | Responsibility | Domain |
|---|---|---|
| 26-69 | Constructor, `init`, error container | shared-infra |
| 76-116 | `showError`, `showToast` | shared-infra |
| 122-184 | `showScreen`, back-stack, result quick-dismiss | shared-infra (navigation) |
| 190-221 | Mode display + nav-button visibility | Game Ops |
| 227-303 | Team display, session stats, history badge/stats | Game Ops |
| 309-350 | `renderScoreboard` | Game Ops |
| 357-447 | `renderSessionStatus`, `_formatDuration` | Game Admin |
| 454-733 | `renderTeamDetails`, `renderTokenCard` | Game Ops |
| 739-774 | `showGroupCompletionNotification` | Game Ops |
| 782-847 | `showTokenResult` | Game Ops |
| 854-1126 | Game Activity (`renderGameActivity`, card/timeline renderers, filters) | Game Ops |

### Supporting modules (already mostly domain-pure)

| Module | Domain |
|---|---|
| core/unifiedDataManager.js, storage/*, scoring.js, gameActivityBuilder.js, tokenManager.js, teamRegistry.js | Game Ops (data) |
| core/sessionReportGenerator.js | Game Admin |
| core/stateStore.js | shared-infra |
| network/* (orchestratorClient, connectionManager, networkedSession, networkedQueueManager) | shared-infra; note `networkedSession._messageHandler` (lines 203-378) multiplexes ALL domains — Phase 2 should split its switch into per-domain routers |
| admin/SessionManager.js | Game Admin |
| admin/AdminOperations.js | Game Ops (score/tx intervention) + Game Admin (`checkService`) |
| admin/Bluetooth/Audio/Lighting/MusicController.js, ui/renderers/EnvironmentRenderer.js, MusicRenderer.js | Environment |
| admin/Video/DisplayController.js, ui/renderers/VideoRenderer.js | needs-owner-decision (see above) |
| admin/Cue/SoundController.js, ui/renderers/CueRenderer.js, HeldItemsRenderer.js | needs-owner-decision (show control) |
| admin/ScoreboardController.js, ui/renderers/EvidencePickerRenderer.js | Game Ops (scoreboard evidence) |
| admin/MonitoringDisplay.js | mixed: store subscriptions for environment domains (Environment), session/devices/health (Game Admin), cue/video (show control), toasts (shared-infra) — natural seam: split `_wireStoreSubscriptions` by domain |
| ui/connectionWizard.js, services/StateValidationService.js, app/initializationSteps.js, app/sessionModeManager.js, utils/domEventBindings.js | shared-infra (connection/bootstrap); wizard surfaces in Game Admin pregame |
| ui/renderers/SessionRenderer.js, HealthRenderer.js | Game Admin |

**index.html**: scanner-view screens (96-317) → Game Ops + shared shell; admin-view sections map 1:1 — Session Management (323-330) Game Admin; Video (333-393) + Show Control (396-435) needs-owner-decision; Audio Output (438-463) + Lighting (466-471) Environment; Health (474-486) Game Admin; Scoreboard Evidence (489-502) + Team Scores (505-511) + Game Activity (514-522) Game Ops. The markup is already sectioned cleanly enough to re-house per domain.

---

## Hardcoded Strings / Branding Inventory (game-pack extraction feed)

**Product/branding**
- `index.html:6` title "Memory Transaction Station"; `:70` h1 "Transaction Station"; `:180` "Tap Memory Token"; `:264` "🏆 Black Market Scoreboard"; `:113` "How are you playing today?"; `:13` "🎮 Connect to Game Server"; `:41` "GM Password"
- Mode names: "Detective Mode"/"Black Market Mode" (uiManager.js:199-205, index.html:71) and the mode keys `'detective'`/`'blackmarket'` woven through app.js, storage, backend contract
- Transaction-type verbs: "SOLD to"/"EXPOSED by" (uiManager.js:966-971), "Black Market"/"Detective" timeline labels (uiManager.js:1066), report headings "Detective Evidence Log"/"Black Market" (sessionReportGenerator.js:106,118)
- Memory types `Personal|Business|Technical|Mention|Party` — values come from shared `data/scoring-config.json` (good), but CSS class derivation `type-${memoryType.toLowerCase()}` (uiManager.js:983) hardcodes the taxonomy into stylesheets
- Currency: `$` + `en-US` locale hardcoded (`formatCurrency` util, sessionReportGenerator.js:345, report timestamps en-US)
- Emoji vocabulary as semantics: 🥇🥈🥉, 🏆, 💰, 🔍, 👁, ⏳, ✅, ❓, 📦 (uiManager.js scoreboard/team-details/activity)

**Identifiers/config**
- localStorage keys: `aln_auth_token`, `aln_orchestrator_url`, `aln_station_name`, `aln_recent_teams`, `gameSessionMode`, `standaloneSession`, `networkedTempQueue`, `networkedSessionId`, `networkedScannedTokens:<sid>`, plus un-prefixed `deviceId`, `mode` (settings.js:28-45 — inconsistent with the `aln_` convention)
- Device naming: `GM_Station_N` assignment scheme (connectionWizard.js:251-273), `GM_STATION_UNKNOWN` fallback (app.js:508, networkedQueueManager.js:25, connectionManager.js:27), default station name `'GM Station'` (app.js:522)
- Default URL `https://localhost:3000` (app.js:507, connectionManager.js:26, orchestratorClient.js:54); discovery defaults subnet `192.168.1`, ports `[3000, 8080]` (connectionWizard.js:57,67)
- Session-id prefix `LOCAL_` (LocalStorage.js:51); video filename placeholder `jaw001.mp4` (index.html:385, app.js:1369)
- Group string microformat `"Name (xN)"` parsing regex (scoring.js:47)

---

## Doc Drift

See F-GMS-24 for the CLAUDE.md item list (test-count conflicts, obsolete window-globals debug section, settings.js "no DOM" claim, scoreboard/view-system mode claims) and F-GMS-21 for index.html comment drift (removed methods, `ScreenUpdateManager`, `loadAvailableVideos`). Additional: root CLAUDE.md's deviceType table and duplicate-detection description ("Rejected globally") is accurate backend-side but the scanner-side description in ALNScanner/CLAUDE.md ("Each token can only be scanned ONCE across ALL teams — tracked in DataManager.scannedTokens") overstates the client's knowledge in networked mode (per-device only; see F-GMS-05).

## Test-Quality Notes

- 71 test files; the network layer (queue durability, reconnect, ack correlation) is visibly battle-hardened with behavior-level regression tests (TQ-/NC-/WS- annotated fixes all have matching specs).
- Weak spots are the integration seams: every consumer of `UnifiedDataManager` group/bonus APIs tests against mocks that encode the current (broken) `[]` behavior (F-GMS-15); the standalone-restore unit test certifies the P0 as expected behavior; no L2/L3 test reloads a standalone session and scans (E2E spec covers settings persistence only).
- LocalStorage.test.js and gameActivityBuilder tests are good behavioral models to copy when adding the missing seam tests.

## Open Questions (for owner)

1. Where do **video playback + display mode + show control (cues/sound/held items)** live in the three-domain model? They are absent from the stated taxonomy and are the largest admin surface (needed before the MonitoringDisplay/_messageHandler split).
2. Cross-device duplicate UX (F-GMS-05): should `transaction:new` broadcasts mark tokens locally (prevents the false-success screen) or should the duplicate result surface as an informational toast?
3. Is standalone-mode session restore after reload a supported scenario (F-GMS-01 fix in Phase 1) or is "reload = fresh mode selection" acceptable operationally?
4. Is `dataManager.resetScores()` intended to become the unified path for score reset (then F-GMS-09 is a real bug to fix) or should the strategy method be deleted?
