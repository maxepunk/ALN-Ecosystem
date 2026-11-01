# Today's client modules against the engine's ten jobs

**Status: reader sheet for the architecture pass, step 1, relationships level (the modules inside the clients). Nothing here is decided.** Every target shape stays a candidate for step 3. This sheet maps what exists today: for each module in the GM scanner, the web player scanner, the hardware (ESP32) player scanner and the scoreboard page, which jobs it serves, what a caller has to know to use it, whether it is deep or shallow, and what it depends on. Then it answers three questions: which client modules redo a job the backend also does and how the copies are kept equal; which modules would have to carry the game alone in a standalone game; and what the phone and the hardware scanner share or duplicate under the parity rule.

- **Date:** 2026-11-01.
- **Tree:** `/home/user/ALN-Ecosystem`, branch `claude/nice-curie-hescfv`. Nothing was run except `sed`, `grep`, `find`, `wc`, `ls` and `awk`. The stale clones beside the repository were not read. `backend/.env` was not opened.
- **The four places.** (1) GM scanner: `ALNScanner/src` (77 files: 67 `.js`, 10 `.css`). (2) Web player scanner: `aln-memory-scanner/js` (4 files). (3) Hardware player scanner: `arduino-cyd-player-scanner/ALNScanner_v5` (44 files: 28 source, 16 build-history documents). (4) Scoreboard page: `backend/public/scoreboard.html` (one file) and what it loads (17 font files, the engine's socket client, two pack fetches, three serve-time injections). Section 7 holds the raw-listing checks.
- **Sources and citation keys.** EJ = `docs/plans/architecture-pass/2026-10-31-engine-jobs.md` (the ten jobs; `EJ:N` is line N). CC = `docs/plans/architecture-pass/relationships/2026-11-01-today-components.md` (the big components against the jobs). GM = `2026-10-30-map-gm-scanner.md`, CT = `2026-10-30-map-clients-tests.md`, IN = `2026-10-30-map-inbound.md`, RS = `2026-10-30-map-runtime-state.md`, SP = `2026-10-31-standalone-pass.md`, AN = `2026-10-30-cause-analysis.md` (flaws C1 to C16), MD = `2026-10-30-map-direction.md` (the 52 capabilities and the owner's standing rules), all in `docs/plans/architecture-pass/`. Code paths are relative to the repository root unless the row sits under a place whose root is named. A citation `path:line` written alone was re-read in this tree on 2026-11-01. A citation followed by "via KEY" was carried from that record and not re-read.
- **Words.** Design words are as `codebase-design` defines them: **module** (anything with an interface and an implementation), **interface** (everything a caller must know, including ordering and error modes), **depth** (leverage at the interface: much behaviour behind a small interface is deep; an interface nearly as complex as the implementation is shallow), **seam** (where a module's interface lives), **adapter**, **leverage**, **locality**. The deletion test is used where it clears up a verdict: delete the module; if the complexity vanishes it was a pass-through, if it comes back across the callers it was earning its keep. Domain words are `CONTEXT.md` (sections 1, 2, 4b, 5, 7): authority, copy, delivery path, verdict, mode (deployment mode: standalone or networked). "The tablet" is a GM scanner, "the phone" the web player scanner, "the hardware scanner" the ESP32.
- **How a row is built.** *Jobs:* `P:` is the one job the module exists for, `s:` are the others it touches. J1 to J10 are EJ section 2's jobs (J1 pack, J2 one true record, J3 answer and remember, J4 equipment, J5 life of a game, J6 designers, J7 roles, J8 wherever, J9 tell the truth, J10 trustworthy). `P:none` means a style sheet, a helper or a build-history document with no decision in it. Primary and secondary placements are mine, drawn from the job definitions; they change nothing in EJ. *Interface* is what a caller must know. *Depth* is my judgment against the definition above. A dagger after the depth word marks a judgment made from the interface list, the import list and the GM or CT map without reading the whole body; an unmarked verdict means I read the interface and the body that matters. *Depends on* is the import list (JavaScript, from `^import` lines) or the `#include` list (C++), run mechanically.
- **Reading depth, said plainly.** I read in full or in the relevant span: `gameOps.js` (scan pipeline), `scoring.js`, the head of `modeSemantics.js`, `messageRouters.js` (`sync:full` and `error` paths), `networkedSession.js` (boundary), `CommandSender.js`, `settings.js`, all of `scannerCore.js`, `scanToken` and the reply handling in `orchestratorIntegration.js`, `processToken` in `app.js`, `Application.h` (scan pipeline), `ScanResponse.h`, `TokenService.h` (load and `get`), `AssetManifestDiff.h`, and the page's evidence, money and mode code. For every other module the interface comes from a mechanical list of exports and public methods and the role comes from GM, CT and CC; those verdicts carry the dagger.

## 1. What the mapping shows

Eleven findings, strongest first. Each is argued in sections 2 to 6.

1. **Seven questions are answered by more than one client module, and in five of them by a second hand-written copy of a backend rule.** Which token a tag means is decided by four different rules (GM fuzzy match, phone strip, hardware scanner exact match after trimming, backend exact lookup). What a mode does, what a token scores, whether a group is complete, whether a claim is a duplicate and what the money looks like are each re-implemented on the tablet, and money and mode meaning a third time on the scoreboard page (section 4, R1 to R18). This is job J2 and J3 each split across up to six parts.
2. **The copies are kept equal by four things only: pack data at runtime, comments that say PARITY, unit tests that pin hand-written expectations on each side, and one end-to-end scoring test whose group case skips on the real pack.** No client source file imports a backend rule module and no client test imports one: the only hit for the backend path in the client test trees is a comment (`ALNScanner/tests/unit/core/scoring-parity.test.js`, grep over `ALNScanner/tests` and `aln-memory-scanner/tests`; for source, SP section 1 via CC section 2, finding 3). Nothing runs the same input through a backend rule and a client rule and compares the answers (SP:147 via CC section 3.3).
3. **The tablet is a command center and a second engine in one app.** Four files carry a second copy of the rules (`LocalStorage.js` 629 lines, `scoring.js` 219, `modeSemantics.js` 413, `gameActivityBuilder.js` 112), plus the derived-score half of `unifiedDataManager.js` (`:500-745`). A standalone game needs all of them; a networked game still uses them for the result screen's points and for team details. Of 67 JavaScript files, 30 would carry a standalone game and 37 serve only the networked game (section 5).
4. **The standalone choice is not a seam.** The strategy seam that exists (`UnifiedDataManager` over `LocalStorage` and `NetworkedStorage`) covers storage only. Everything else asks the mode directly: 15 `isStandalone()` or `isNetworked()` branches in five modules (`gameAdmin.js` x4, `gameOps.js` x6, `showControl.js`, `app.js`, `teamRegistry.js` x3; grep). The facade that holds the seam has about 55 methods and is the widest interface in the app.
5. **The command path is the shallowest part of the tablet, and the one deep module in it sits at the end.** "Skip video" crosses five modules: the button's `data-action` (`ALNScanner/index.html:403`), `App.adminSkipVideo` (`app.js:690`), `ShowControlDomain.adminSkipVideo` (`showControl.js:43`), `_adminVideoAction` (`showControl.js:25`), `VideoController.skipVideo` (`VideoController.js:52`), then `sendCommand`. Twelve admin controllers are one line per command. The deep module is `CommandSender.js`, and it matches an acknowledgement to a request by the action name alone (`CommandSender.js`, the `response.action !== action` test).
6. **The pack has one deep client loader and three client paths that bypass it.** The tablet's `packLoader.js` (457 lines, one call, three sources, per-file hash check, staged flip) is the best-shaped pack module on any client, and it feeds five consumers through one fan-out (`tokenManager.loadDatabase`). The scoreboard page fetches `game.json` and `/api/tokens` itself, the phone reads its own nested token file, and the hardware scanner copies tokens and media to its SD card at boot. Only the tablet sends its pack hash to the engine, and the engine only logs a mismatch (`backend/src/websocket/socketServer.js:139-148`).
7. **The phone and the hardware scanner share contracts and pack data, and no code or test.** Nothing but the request payload shape, the batch endpoint, the 10 second health poll, the 100-entry queue cap and the replies' meaning are common, each written twice (JavaScript and C++), and the one cross-check is a contract test over hand-written payload literals (`backend/tests/contract/scanner/request-schema-validation.test.js:1-30`). Thirteen differences remain in the networked game (section 6.3), one of which changes what a player sees: on a refused scan the phone still shows the memory (`aln-memory-scanner/js/app.js:431-471`), while the hardware scanner stops and shows "NO SESSION" (`Application.h:567-575` with `applyScanOutcome`, `Application.h:689`).
8. **The scoreboard page is one 1,860-line file with no module boundary.** Fifteen commented sections share one `state` object and one `<script>`. It carries three decisions the backend also takes (which modes are evidence, money format, the countdown) and infers game boundaries from a changed session id (`scoreboard.html:1473`). It is also the only client that is two deployments (the TV and the Pi 4) from one file (CC sections 3.6 and 3.7).
9. **Three layer inversions make the tablet's dependencies run both ways.** `network/networkedSession.js` imports `app/adminController.js`; `admin/MonitoringDisplay.js` imports seven renderers from `ui/renderers`; and the four domain objects reach every collaborator through a back-reference to `App` (`this.app`), so none of them has a narrowed interface (import lists in section 2).
10. **On the hardware scanner the deep modules are the hardware ones and the pure ones; the overloaded one is the engine client.** `RFIDReader.h` (954 lines), `AssetService.h`, `SDCard.h` and the pure headers (`NDEFParser`, `PayloadBuilder`, `ScanResponse`, `BatchId`, `AssetManifestDiff`) hide a lot behind a small interface. `OrchestratorService.h` (1,424 lines) carries five roles (Wi-Fi, health poll, scan send, SD queue, HTTP and file download for the other two services) and is not covered by the native tests (arduino `CLAUDE.md`, "What's NOT tested"). `Application.h` has two public methods and 1,656 lines: its interface is small and its implementation is unlayered.
11. **Three of the four places have a module whose whole job is a pass-through.** `domains/environment.js` (28 lines, no behaviour: GM section 1), `domains/showControl.js` and most of `App`'s forwarders fail the deletion test in the good direction for deleting them: the complexity does not reappear in the callers. `IStorageStrategy.js` is a 14-method interface of which the networked strategy's write half has no networked caller (GM conclusion 10). Sixteen of the hardware scanner's 44 files are build-history reports that no job reads.

## 2. The GM scanner, file by file (`ALNScanner/src`, 77 files)

Paths below are under `ALNScanner/src/`. Line counts are `wc -l` today (16,497 JavaScript lines; the GM map counted 16,486 before four comment-only edits, CC header).

### 2.1 Entry and application shell

| File | Lines | Jobs | Interface (what a caller must know) | Depth | Depends on |
|---|---|---|---|---|---|
| `main.js` | 294 | P:J8; s:J2 | No callable interface; runs at import. Builds the singletons, binds seven data-manager events to screen refreshes (`:131-187`), starts `App` | shallow (a wiring script, nothing to call) | debug, uiManager, settings, tokenManager, unifiedDataManager, teamRegistry, stateStore, nfcHandler, config, initializationSteps, app, connectionWizard, domEventBindings, EvidencePickerRenderer |
| `app/app.js` | 716 | P:J3; s:J5, J8, J2, J7 | Class `App`, more than 100 methods and the single injection point. A block at `:603-708` is one-line forwarders to the four domain objects (for example `adminSkipVideo` at `:690`). Real logic only in `init` (`:90`), `selectGameMode` (`:455`) and `_initializeNetworkedMode` (`:501`). Callers must know which method forwards to which domain | shallow (interface is every action any button can call) | 15 imports: debug, formatCurrency, modeSemantics, jwtUtils, uiManager, settings, tokenManager, nfcHandler, config, initializationSteps, sessionModeManager, networkedSession, and the four domains |
| `app/adminController.js` | 144 | P:J4 | `AdminController(client, dataManager, teamRegistry, store)`: `initialize()` builds the 12 admin modules once, `getModule(name)` returns one | shallow† (a registry of 12) | the 12 `admin/` modules |
| `app/initializationSteps.js` | 530 | P:J8; s:J1, J5, J9 | 17 exported functions that `App.init` calls in a fixed order (phase names 1A to 1J); the order is part of the interface. `loadTokenDatabase` (`:148`), `applyPackStringsToDom` (`:180`), `renderPackInfo` (`:242`), `validateAndDetermineInitialScreen` (`:387`), `applyInitialScreenDecision` (`:441`) | medium† (ordering constraint is interface) | debug, jwtUtils, StateValidationService, packLoader, scoring, modeSemantics, strings, theme, formatCurrency |
| `app/sessionModeManager.js` | 144 | P:J8 | `setMode`, `isNetworked`, `isStandalone`, `restoreMode`, `clearMode`, `getMode`, `isLocked`; writes `gameSessionMode`. Mode is locked once chosen until reload | shallow, and the wrong place for the seam: callers ask `isStandalone()` at 15 sites instead of being handed a strategy | none |
| `app/domains/environment.js` | 28 | P:J4 | Class `EnvironmentDomain` with no methods (GM section 1) | shallow (empty; deletion removes nothing) | none |
| `app/domains/gameAdmin.js` | 428 | P:J5; s:J3, J8 | Session create, start, pause, resume, end with a standalone branch at `:35`, `:119`, `:152`, `:186`; `downloadSessionReport` (`:214`); system reset (`:283`); reads the backend's "NO-GO: " message prefix (`:26`, `:88` via GM section 4). Reaches everything through `this.app` | medium† | formatDuration, strings |
| `app/domains/gameOps.js` | 635 | P:J3; s:J2, J5, J8 | The scan pipeline: `processNFCRead`, `recordTransaction` (`:302`), team entry, mode toggle, score and delete interventions. The callable surface is "an `App` back-reference", so it can reach any collaborator | medium (deep in behaviour, no narrowed interface) | escapeHtml, modeSemantics; `this.app.*` |
| `app/domains/showControl.js` | 111 | P:J4 | Video transport, queue and display-mode wrappers; each is `viewController.adminInstances.videoController[action]()` with an `alert` when the controller is absent (`:25-37`) | shallow (pure pass-through) | none imported; `app.viewController` |

### 2.2 Core: the game record, the pack copy and the rules

| File | Lines | Jobs | Interface | Depth | Depends on |
|---|---|---|---|---|---|
| `core/unifiedDataManager.js` | 968 | P:J2; s:J3, J5 | About 55 methods: a facade over the two strategies, plus derived scores, groups and stats (`:500-745`), plus the "apply a server message" methods (`setTransactions`, `updateTeamScoreFromBackend` `:801`, `setPlayerScansFromServer`, `updateSessionState` `:944`, `resetForNewSession` `:542`). Until `initializeStandaloneMode` or `initializeNetworkedMode` runs it has no strategy and calls throw (ALNScanner `CLAUDE.md`, "Strategy Selection") | shallow (interface about as wide as the implementation; the widest in the app) | modeSemantics, LocalStorage, NetworkedStorage |
| `core/storage/IStorageStrategy.js` | 185 | P:J2; s:J3 | 14 methods that throw "not implemented"; typedefs. The networked strategy's command methods (`addTransaction`, `removeTransaction`, `adjustTeamScore`, `createSession`, `endSession`, pause, resume, `resetScores`) have no networked caller (GM conclusion 10) | shallow† (an interface wider than its callers use) | none |
| `core/storage/LocalStorage.js` | 629 | P:J2; s:J3, J5, J8 | The whole standalone game behind the strategy interface: sessions (`:163-261`), `addTransaction` (`:300`, gate checks only `paused`), score update (`:350`), group completion (`:394`), delete and rebuild (`:445-543`), adjustment with the score floor (`:544`), game activity (`:614`) | deep in behaviour; it is a second implementation of `backend/src/gameRules/` | IStorageStrategy, gameActivityBuilder, modeSemantics (and an injected tokenManager) |
| `core/storage/NetworkedStorage.js` | 498 | P:J2; s:J3 | A cache of four backend facts (transactions, `backendScores`, `scannedTokens`, `playerScans`) with four different write rules; persists claims to `networkedScannedTokens:<id>` (`:67-75`) | medium† | IStorageStrategy, scoring, gameActivityBuilder, modeSemantics |
| `core/gameActivityBuilder.js` | 112 | P:J2; s:J3 | `buildGameActivity(...)`, one pure function joining transactions and player scans. Reads `SF_MemoryType` off the `{token, matchedId}` object `findToken` returns (GM conclusion 12) | deep for its size (pure; passes the deletion test, since both strategies would each need it) | scoring |
| `core/modeSemantics.js` | 413 | P:J1; s:J2, J3, J8 | 16 exports: `applyPackModes`, `resolveMode`, `isConsumingMode`, `isScoringMode`, `countsTowardGroups`, `isEvidenceMode`, `modeLabel`, `claimAnnouncement`, `entityLabel`, and others. Callers ask what a mode does, never its name. Module state set once at pack load; baked ALN table as a last-resort shim that warns once (`:1-70`) | deep (the best-shaped rule seam on a client) | debug, slugify, escapeHtml |
| `core/scoring.js` | 219 | P:J2; s:J1 | `SCORING_CONFIG` (an exported object overwritten in place by `applyPackScoring`), `calculateTokenValue` (`:202`), group helpers, `formatStars`. Interface includes a mutable module table and the rule "apply the pack before use"; baked shim warns loudly (`:18`, `:34`) | medium (small functions, hidden global state) | formatCurrency |
| `core/tokenManager.js` | 309 | P:J1; s:J3 | `loadDatabase()` (`:50`, the one place that applies the loaded pack to packLoader, scoring, strings, theme and modeSemantics), `findToken(id)` returning `{token, matchedId}` with a colon, hyphen and case-insensitive match (`:276-302`), group inventory | medium (a fan-out seam plus a lookup) | debug, packLoader, scoring, strings, theme, modeSemantics |
| `core/packLoader.js` | 457 | P:J1; s:J8, J9 | `packLoader.loadPack()` once at start; `getActivePack()` returns `{packId, version, contentHash, source}`. Behind it: network, then service-worker cache, then bundled; per-file sha1 check; staged atomic pointer flip; discard on failure. One caller (`tokenManager.js:52`) | deep (one call, large behaviour) | debug, config |
| `core/strings.js` | 172 | P:J1 | `applyPackStrings`, `getString`, `getPackString`, `packStringsApplied` | shallow† (a lookup table with a loader) | debug |
| `core/theme.js` | 280 | P:J1 | `applyPackTheme`, `ratingDisplay`, `ratingGlyphs`, `themeColors`, `applyThemeColorsToDom` | medium† | debug |
| `core/stateStore.js` | 95 | P:J2; s:J4, J9 | `update` (shallow merge), `replace`, `get`, `getAll`, `on`, `off` for ten service domains. Carries no age or freshness field | shallow by design, and the one seam for service-domain copies (CC section 3.2b) | none |
| `core/teamRegistry.js` | 321 | P:J2; s:J8 | `TeamRegistry`: `populateFromSession` (clear then refill), `addTeam`, `hasTeam`; three standalone branches (`:216`, `:237`, `:250`); `aln_recent_teams` | medium† | modeSemantics |
| `core/sessionReportGenerator.js` | 522 | P:J3; s:J2 | `new SessionReportGenerator(...).generate()` returns the post-game markdown built from the tablet's own copies of session, scores, transactions and player scans | medium† (small interface, large body, but built from copies, not from the engine's record; EJ J3) | scoring, modeSemantics, strings, formatCurrency, debug |

### 2.3 Network

| File | Lines | Jobs | Interface | Depth | Depends on |
|---|---|---|---|---|---|
| `network/orchestratorClient.js` | 386 | P:J7; s:J2, J3, J1 | `connect`, `send`, `sendCommand`, `disconnect`; exports `MESSAGE_TYPES` (22 events) and turns each into one `message:received` event. A new backend event must be added to that list or it never arrives (ALNScanner `CLAUDE.md`, GOTCHA). Sends `packHash` in the handshake (`:101`). Needs a global `io` from the engine-served client library | medium† | packLoader |
| `network/connectionManager.js` | 396 | P:J7; s:J9, J8 | `connect`, `disconnect`, `checkHealth`, `isTokenValid`; retry with backoff; clears a stale token | medium† | jwtUtils |
| `network/networkedSession.js` | 271 | P:J2; s:J5, J7 | `initialize`, `getService`, `destroy`. Builds client, connection manager, queue manager and `AdminController`; runs the router chain; infers a game boundary from a changed session id and then resets the data manager and clears the queue (`:246-258`) | medium | orchestratorClient, connectionManager, networkedQueueManager, **app/adminController** (a network module importing an app module), messageRouters |
| `network/messageRouters.js` | 230 | P:J2; s:J5 | Four functions `(type, payload, ...)` returning a boolean: `gameOpsRouter`, `sharedInfraRouter`, `gameAdminRouter`, `showControlRouter`. The one place that says which event writes which copy. `transaction:deleted` uses only the transaction id and the team score (`:47-54`), so claims are not released | medium (small interface over 22 events, uneven parameter lists) | none |
| `network/networkedQueueManager.js` | 434 | P:J3; s:J9 | `queueTransaction(tx)` returns a client transaction id; `syncQueue`; `reconcileWithServerState`; `clearQueue`; durable `networkedTempQueue`; matches a result to a scan by `clientTxId` | deep (offline queue, replay and matching behind two calls) | modeSemantics |
| `services/StateValidationService.js` | 194 | P:J9; s:J5, J7 | `validateAll()` returns token, health and session verdicts for the restore decision; `clearStaleState` removes two keys nothing writes (GM conclusion 13) | shallow† | debug, jwtUtils |

### 2.4 Admin controllers (the GM's command surface)

All twelve send `gm:command` through `admin/utils/CommandSender.js`; each public method is one command (56 distinct actions across them, via CC section 3.2).

| File | Lines | Jobs | Interface | Depth | Depends on |
|---|---|---|---|---|---|
| `admin/utils/CommandSender.js` | 69 | P:J3; s:J4 | `sendCommand(connection, action, payload, timeout=5000)` resolves on the acknowledgement for the same action name, rejects on failure or timeout. Two in-flight commands with the same action cannot be told apart | deep (the one module every command shares) | none |
| `admin/MonitoringDisplay.js` | 438 | P:J4; s:J2, J5, J9 | Listens to `message:received` directly (`:35`, `_handleMessage` `:216`), subscribes to the ten StateStore domains, owns the session panel, device list, display mode and toasts; `refreshAllDisplays` sends `sync:request` | medium (many duties behind a constructor) | debug, escapeHtml, showToast, Cue, Environment, Session, Video, Music, Health, HeldItems renderers |
| `admin/SessionManager.js` | 82 | P:J5 | `createSession`, `startGame`, pause, resume, end, `addTeam` | shallow | CommandSender |
| `admin/AdminOperations.js` | 68 | P:J3; s:J2, J9 | `score:reset`, `score:adjust`, `transaction:delete`, `service:check` | shallow | CommandSender |
| `admin/VideoController.js` | 96 | P:J4 | play, pause, stop, skip, queue add, clear | shallow | CommandSender |
| `admin/DisplayController.js` | 63 | P:J4 | idle loop, scoreboard, return to video | shallow | CommandSender |
| `admin/AudioController.js` | 54 | P:J4 | routing and per-stream volume | shallow | CommandSender |
| `admin/BluetoothController.js` | 89 | P:J4 | scan, pair, unpair, connect, disconnect | shallow | CommandSender |
| `admin/LightingController.js` | 48 | P:J4 | activate scene, refresh scenes | shallow | CommandSender |
| `admin/CueController.js` | 129 | P:J4; s:J3 | fire, enable, disable, pause, resume, stop, held release and discard | shallow | CommandSender |
| `admin/SoundController.js` | 59 | P:J4 | play, stop | shallow | CommandSender |
| `admin/MusicController.js` | 84 | P:J4 | transport, volume, shuffle, loop, load playlist | shallow | CommandSender |
| `admin/ScoreboardController.js` | 45 | P:J4; s:J2 | scoreboard evidence page next, previous, owner | shallow | CommandSender |

### 2.5 User interface

| File | Lines | Jobs | Interface | Depth | Depends on |
|---|---|---|---|---|---|
| `ui/uiManager.js` | 535 | P:J3; s:J2, J9 | About 25 methods: `showScreen`, `showError`, `showTokenResult`, stats, and delegations to two renderers. `showTokenResult` prints "Transaction Complete!" before any engine reply and computes points from the tablet's pack copy (`:421-508` via GM conclusion 7) | shallow† | escapeHtml, formatCurrency, modeSemantics, strings, scoring, theme, formatDuration, showToast, GameOpsRenderer, GameAdminRenderer |
| `ui/settings.js` | 76 | P:J8; s:J7 | `Settings`: `deviceId`, `mode`; `load`, `save`. The mode seed `detective` is a legacy default validated after the pack loads (`:20-31`) | shallow | none |
| `ui/connectionWizard.js` | 588 | P:J7; s:J8 | Three exports: `ConnectionWizard` (scan for servers, assign a station name from a list read before connecting, submit), `QueueStatusManager`, `setupCleanupHandlers` | medium† (three classes in one file) | config |
| `ui/renderers/GameOpsRenderer.js` | 704 | P:J2; s:J3 | Scoreboard, team details, token cards, game activity. Reads `dataManager.backendScores` (`:221`), a field the data manager does not have, so team details falls back to a local sum | medium (large; hidden dependency on data-manager internals) | escapeHtml, formatCurrency, slugify, scoring, theme |
| `ui/renderers/SessionRenderer.js` | 324 | P:J5; s:J2, J9 | Session panel and the game clock; extrapolates the clock once a second between pushes | medium† | escapeHtml |
| `ui/renderers/GameAdminRenderer.js` | 98 | P:J5 | `renderSessionStatus` for the standalone admin panel | shallow | escapeHtml, formatDuration |
| `ui/renderers/EvidencePickerRenderer.js` | 65 | P:J2; s:J4 | Owner dropdown for the scoreboard's evidence page jump | shallow | escapeHtml, strings |
| `ui/renderers/HealthRenderer.js` | 223 | P:J9; s:J4 | Draws the `health` domain: green, red and grey (dormant) rows, "Check Now" | medium† (differential, idempotent) | escapeHtml, escapeCssAttrValue, dormancyWording |
| `ui/renderers/HeldItemsRenderer.js` | 113 | P:J4; s:J3, J9 | Draws the `held` snapshot with a live duration counter; release and discard buttons | shallow† | escapeHtml |
| `ui/renderers/CueRenderer.js` | 355 | P:J4 | Quick Fire grid, standing cues, active cues from `cueengine` | medium† | escapeHtml, escapeCssAttrValue, slugify, dormancyWording |
| `ui/renderers/EnvironmentRenderer.js` | 399 | P:J4 | Lighting, audio routing, Bluetooth from three domains | medium† | escapeHtml, escapeCssAttrValue |
| `ui/renderers/MusicRenderer.js` | 361 | P:J4 | Music panel and ducking display | medium† | escapeHtml |
| `ui/renderers/VideoRenderer.js` | 238 | P:J4 | Now playing, queue, progress from `video` plus the display mode | medium† | escapeHtml |
| `ui/renderers/dormancyWording.js` | 32 | P:J9 | `doorWording(door)`; a parity copy of `backend/src/gameRules/dormancyWording.js` that never throws on an unknown door | shallow (a two-sentence table), kept equal by a test on each side (`ALNScanner/tests/unit/ui/renderers/dormancyWording.test.js`, `backend/tests/unit/gameRules/dormancyWording.test.js`) | none |

### 2.6 Utilities

| File | Lines | Jobs | Interface | Depth | Depends on |
|---|---|---|---|---|---|
| `utils/domEventBindings.js` | 396 | P:J3; s:J4 | `bindDOMEvents(app, dataManager, settings, debug, uiManager, connectionWizard, queueStatusManager)`: one delegated click listener; a `switch` of 41 cases maps `data-action` to calls (`:63-`). Wraps admin actions so a rejection becomes an error banner | shallow (a dispatch table) | none |
| `utils/nfcHandler.js` | 192 | P:J3 | `init`, `startScan`, `stopScan`, `extractTokenId`, `simulateScan`; hides Web NFC | medium† | debug |
| `utils/jwtUtils.js` | 30 | P:J7 | `isTokenValid(token)` with a 60 second buffer | shallow | none |
| `utils/config.js` | 26 | P:J8 | `CONFIG`; `isOrchestratorServed()`, the predicate that picks the pack channel and the connection path | shallow | none |
| `utils/debug.js` | 81 | P:none | `Debug.log`; a buffer of the last 50 messages for the debug view | shallow | config |
| `utils/formatCurrency.js` | 73 | P:J1 | `parseMoneyFormat`, `applyPackMoneyFormat`, `formatCurrency`; money format comes from the pack; a grammar twin of `backend/src/gameRules/formatting.js` | shallow (small, pinned by tests on both sides per its header, `:6`) | none |
| `utils/formatDuration.js` | 46 | P:none | `formatDuration(seconds)` | shallow | none |
| `utils/showToast.js` | 40 | P:none | `showToast(message, ...)` | shallow | none |
| `utils/escapeHtml.js` | 14 | P:none | `escapeHtml(s)` | shallow | none |
| `utils/escapeCssAttrValue.js` | 24 | P:none | `escapeCssAttrValue(s)` | shallow | none |
| `utils/slugify.js` | 19 | P:none | `slugifyId(s)` | shallow | none |

### 2.7 Style sheets

No job decisions. The GM role's look and the colour words for state; `ALNScanner/tests/unit/ui/cssTaxonomy.test.js` exists as a guard. Design tokens use the `--color-` prefix (ALNScanner `CLAUDE.md`).

| File | Lines | Jobs | What it holds |
|---|---|---|---|
| `styles/main.css` | 33 | P:none | Imports the others |
| `styles/variables.css` | 201 | P:none | Design tokens |
| `styles/base.css` | 290 | P:none | Reset, typography |
| `styles/layout.css` | 387 | P:none | Layout and screens |
| `styles/components.css` | 639 | P:none | Shared components |
| `styles/responsive.css` | 425 | P:none | Breakpoints |
| `styles/components/environment.css` | 234 | P:none | Environment panel |
| `styles/components/show-control.css` | 225 | P:none | Show Control panel |
| `styles/screens/admin.css` | 1131 | P:none | Admin view |
| `styles/screens/scanner.css` | 690 | P:none | Scan, result and team screens |

## 3. The web player scanner (`aln-memory-scanner/js`, 4 files)

Loaded in order by `aln-memory-scanner/index.html` (`:149-158`) as plain scripts that attach to `window`; `config.html` loads `scannerCore.js` and `orchestratorIntegration.js` (`:252-253`). The page also loads `qr-scanner` from `unpkg.com` (`index.html:138`). Files beside `js/` that the phone needs but this sheet does not row: `sw.js` (306 lines), `index.html` (176), `config.html` (470), `styles/`, and the nested `data/tokens.json`.

| File | Lines | Jobs | Interface | Depth | Depends on |
|---|---|---|---|---|---|
| `js/app.js` | 614 | P:J3; s:J1, J2, J7, J8 | Class `MemoryScanner`, bootstrapped as `window.app`. No declared interface: it finds its collaborators as globals (`window.scannerCore`, `window.tokenDisplay`, `window.orchestrator`, `QrScanner`) and DOM ids. It does QR camera, NFC, install prompt, the token database (`:61`) and pack info (`:98`) loads, the seen set (`:195-215`), the scan flow (`handleScan` `:393`, `processToken` `:431`), the collection screen, manual entry and the `?token=` link (`:538`). Sends `teamId` of `sessionStorage.currentTeam` or `'001'` (`:435`); nothing writes that key (CT conclusion 8) | shallow (one 614-line class with eleven duties and a global-state test surface) | globals: scannerCore, tokenDisplay, orchestrator, QrScanner; DOM; localStorage |
| `js/orchestratorIntegration.js` | 560 | P:J3; s:J9, J8, J7 | Class `OrchestratorIntegration`. One call, `scanToken(tokenId, teamId)`, returns `{status, queued, ...}`; the rest is hidden: mode by URL path (`:33-34`), device id `PLAYER_<ms>` (`:20-29`), a 10 second health poll, the offline queue capped at 100 (`:169-183`), batches of 10 with a stored snapshot resent verbatim (`:246-262`, `:369-379`), 4xx treated as final (`:132-166`). The constructor has side effects (a localStorage read and a timer), which weakens the test seam (aln-memory-scanner `CLAUDE.md`) | deep (the best-shaped phone module), with a leaky constructor | fetch, localStorage, window.location |
| `js/scannerCore.js` | 109 | P:J3; s:J8, J4 | Four pure functions: `normalizeTokenId` (lowercase, strip everything outside `[a-z0-9_]`, `:28`), `isStandaloneMode(pathname)` (`:51`), `classifyScanResponse(response, isVideoToken)` returning one of five treatments (`:68-98`), `shortPackHash`. Works in browser and Node | deep for its size (pure, and the only phone-side home of "what the engine's reply means") | none |
| `js/tokenDisplay.js` | 206 | P:J3; s:J4 | Object `tokenDisplay`: `displayMemory(token, isNew)`, `showError`, `showVideoAlert`, `showVideoUnavailable`, `hideVideoAlert`, `stopAudio`. Writes fixed DOM ids; a video token shows a blank screen with its id (SP row 13) | shallow (interface about as complex as the DOM writes) | DOM |

## 4. The hardware player scanner (`arduino-cyd-player-scanner/ALNScanner_v5`, 44 files)

Paths below are under `arduino-cyd-player-scanner/ALNScanner_v5/`. Layers as the device's `CLAUDE.md` names them: HAL, models, services, UI, application. Native tests cover `models/Config.h`, `models/Token.h`, `PayloadBuilder`, `ScanResponse`, `BatchId`, `NDEFParser` and `AssetManifestDiff` (seven `test/test_*` folders plus a smoke test); `Application.h`, `OrchestratorService.h`, the HAL and the UI have no native test (arduino `CLAUDE.md`).

### 4.1 Source (28 files)

| File | Lines | Jobs | Interface | Depth | Depends on |
|---|---|---|---|---|---|
| `ALNScanner_v5.ino` | 16 | P:J8 | `setup()` and `loop()`, each one line into `Application` | shallow by design | Application.h |
| `Application.h` | 1656 | P:J3; s:J1, J5, J8 | Class `Application`: public `setup()` (`:1570`) and `loop()` (`:407`). Inside: boot and hardware order (`:838-1057`), the 30 second serial override (`:765`), the scan decision `processRFIDScan` (`:484-617`: read, token-list gate, send or queue, outcome, display), `generateTimestamp` (`:619`: local time after NTP, a 1970 placeholder before), `applyScanOutcome` (`:689`), and about 460 lines of serial test commands (`:1059-1515`) | small interface over an unlayered body; the scan decision has no native test | config.h, RFIDReader, DisplayDriver, AudioDriver, TouchDriver, SDCard, ConfigService, TokenService, AssetService, OrchestratorService, SerialService, UIStateMachine |
| `config.h` | 175 | P:J8 | 60 `constexpr` values in seven namespaces (pins, timing, RFID, queue, paths, limits, FreeRTOS). `MAX_TOKENS = 50` (`:89`) is defined and never used (grep); the real ceiling is `MAX_TOKEN_DB_SIZE = 50000` bytes (`:90`) | shallow (a table) | none |
| `hal/RFIDReader.h` | 954 | P:J3 | `detectCard()` returns `NoCard`, `Detected` or `CommFailed`; `extractNDEFText()` returns the token text or empty; RF-field control. Hides software SPI, retries, re-select and the NDEF page read | deep | Arduino, MFRC522, config.h, NDEFParser |
| `hal/NDEFParser.h` | 141 | P:J3 | `parseNDEFText(bytes)` returns the first text record; pure; native-tested | deep for its size | Arduino, config.h |
| `hal/SDCard.h` | 270 | P:J8 | `begin`, `isPresent`, `takeMutex` and `giveMutex`, and an RAII `Lock`. Display must initialise before the SD card (device `CLAUDE.md`, VSPI order) | deep (hides the mutex and bus rule; used by four services) | SD, SPI, FreeRTOS semaphore, config.h |
| `hal/DisplayDriver.h` | 440 | P:J3 | `begin`, `drawBMP(path)`, `fillScreen`, `clear`, `displayError`, and `getTFT()`, which returns the raw `TFT_eSPI` object; `Application` draws straight onto it (`Application.h:980`) | medium, with a leaky seam | TFT_eSPI, config.h, SDCard |
| `hal/AudioDriver.h` | 241 | P:J3 | `begin`, `play(path)`, `stop`, `isPlaying`, `loop`, `silenceDAC`; lazy I2S start; plays WAV only | medium-deep† | AudioFileSourceSD, AudioGeneratorWAV, AudioOutputI2S, config.h |
| `hal/TouchDriver.h` | 118 | P:J3 | `isTouched`, `isValidTouch`, `getTouchTime`, `clearTouch`; filters Wi-Fi interference | shallow† | Arduino, config.h |
| `models/Config.h` | 96 | P:J8 | Struct `DeviceConfig`: `validate()` (rewrites `http://` to `https://`), `isComplete()`; native-tested | shallow | Arduino, config.h |
| `models/ConnectionState.h` | 82 | P:J9 | Enum `ORCH_DISCONNECTED`, `ORCH_WIFI_CONNECTED`, `ORCH_CONNECTED`; a thread-safe holder (`get`, `set`, `isConnected`, `hasWiFi`). The device's own three connection words, not the engine's `healthy, down, dormant` | shallow | FreeRTOS semaphore, config.h |
| `models/Token.h` | 89 | P:J3; s:J1 | `TokenMetadata {tokenId, video}`, `cleanTokenId` (remove colons and spaces, trim, lowercase, `:23-30`), `getImagePath`, `getAudioPath` (always `{id}.wav`), `ScanData`; native-tested | shallow | Arduino, config.h |
| `services/TokenService.h` | 381 | P:J1 | `loadDatabaseFromSD`, `get(id)` (exact match, linear search, `:160-167`), `exists`, `syncFromOrchestrator`. Keeps only `video` per token (`:130-135`); accepts only the wrapped shape `{"tokens": {...}}` (`:125`); refuses a file over `MAX_TOKEN_DB_SIZE` | medium-deep | Arduino, ArduinoJson, Token.h, SDCard, config.h, OrchestratorService |
| `services/AssetService.h` | 320 | P:J1; s:J9 | `syncFromOrchestrator(url, orch)`; `packId()`, `packVersion()`, `packHash()` (empty unless the asset manifest carries a `pack` key, `:145-152`). Hides manifest diff, streamed download, size and sha1 check, orphan prune, atomic manifest write | deep | Arduino, ArduinoJson, SD, SDCard, config.h, AssetManifestDiff, OrchestratorService |
| `services/AssetManifestDiff.h` | 152 | P:J1 | `diff(remote, local)`, `collectOrphans`, `buildPath`, `updateEntry`, `extractPackIdentity`; pure; native-tested | deep for its size | Arduino, ArduinoJson, config.h |
| `services/OrchestratorService.h` | 1424 | P:J3; s:J9, J1, J8 | `initializeWiFi`, `startBackgroundTask`, `sendScan` (one bounded attempt), `queueScan`, `uploadQueueBatch`, `getState`, `getQueueSize`, `clearQueue`, `checkHealth`, plus the HTTP and file-download helpers `TokenService` and `AssetService` call. Five roles in one class; the health poll can spend about 61 seconds inside one tick (CT section 1.3). Not natively tested | deep in behaviour, overloaded in role (a queue change and a download change meet in one file) | Wi-Fi, HTTPClient, ArduinoJson, SD, mbedtls, Config.h, Token.h, ConnectionState.h, SDCard, config.h, PayloadBuilder, BatchId, ScanResponse |
| `services/ScanResponse.h` | 77 | P:J3 | `classifyScanResponse(code, body)` returns one of four outcomes (`ACCEPTED`, `REJECTED_NO_SESSION`, `ACCEPTED_NO_VIDEO`, `RETRY_QUEUE`); pure; native-tested. The device-side twin of the phone's `classifyScanResponse` | deep for its size | Arduino, ArduinoJson |
| `services/PayloadBuilder.h` | 89 | P:J3 | `buildScanJson`, `parseScanFromJsonl`, `buildBatchJson`; a queue line with no `deviceType` reads as `esp32` (`:60`); native-tested | deep for its size | Arduino, ArduinoJson, Token.h |
| `services/BatchId.h` | 42 | P:J3 | `makeBatchId`: `{deviceId}_{bootNonce}_{counter}`, stable across retries; native-tested | deep for its size | Arduino |
| `services/ConfigService.h` | 562 | P:J8 | `loadFromSD`, `saveToSD`, `set`, `validate`, `generateDeviceId` from the MAC. A failed `validate` only logs (SP row 2) | medium† | Arduino, esp_system, esp_mac, SDCard, Config.h, config.h |
| `services/SerialService.h` | 278 | P:J10 | `registerCommand(name, handler, help)`, `processCommands`; built-ins `HELP`, `REBOOT`, `MEM`. Application registers 15 more (`CONFIG`, `STATUS`, `SIMULATE_SCAN`, `SYNC_ASSETS_NOW`, and others) | shallow, and generic by design | Arduino |
| `ui/Screen.h` | 217 | P:J3 | Template Method base class: `draw`, `update`, `handleTouch` hooks | shallow† (a base class) | DisplayDriver |
| `ui/UIStateMachine.h` | 444 | P:J3; s:J9 | `showReady`, `showStatus`, `showToken`, `showProcessing`, `showScanFailed`, `handleTouch`, `update`, `isBlockingRFID`. Hides five states, timeouts and touch debounce | deep† | Screen, five screens, DisplayDriver, TouchDriver, AudioDriver, SDCard, Token.h, ConnectionState.h, config.h |
| `ui/screens/ReadyScreen.h` | 251 | P:J3 | The idle prompt, with "RFID ready" and debug flags | shallow† | Screen, DisplayDriver |
| `ui/screens/TokenDisplayScreen.h` | 392 | P:J3 | Shows the token's BMP and plays its WAV if the file exists; double-tap dismiss | medium† | config.h, Token.h, DisplayDriver, AudioDriver, Screen |
| `ui/screens/ProcessingScreen.h` | 289 | P:J4; s:J3 | The video-token modal: image plus a label and sub-label ("Sending..." or "VIDEO UNAVAILABLE / Rescan later"); 2.5 second auto-hide | shallow† | Screen, DisplayDriver, SDCard, config.h |
| `ui/screens/StatusScreen.h` | 319 | P:J9 | Draws `SystemStatus`: Wi-Fi, orchestrator, queue count; a red outage reading when the engine is absent (SP row 17) | shallow† | Screen, ConnectionState.h, DisplayDriver |
| `ui/screens/ScanFailedScreen.h` | 91 | P:J3; s:J9 | The non-blocking failure screen with a reason (`READ FAILED`, `UNKNOWN TOKEN`, `NO SESSION`); 1.5 second auto-dismiss | shallow | Screen, DisplayDriver |

### 4.2 Build-history documents (16 files, not source)

Every one dates from the October 2025 v5 refactor (the headers read say so) and describes how a part was extracted from the v4.1 sketch. No job reads them; they are noise inside the sketch folder and one of them (`DEAD_CODE_ANALYSIS.txt`) analyses "20 header files" where 28 source files exist today.

| File | Lines | Jobs | What it is |
|---|---|---|---|
| `APPLICATION_FIXES_NEEDED.md` | 95 | P:none | Compile fixes after the parallel build |
| `DEAD_CODE_ANALYSIS.txt` | 281 | P:none | Dead-code report, October 22, 2025 |
| `EXTRACTION_REPORT_ReadyScreen.md` | 413 | P:none | ReadyScreen extraction report |
| `EXTRACTION_SUMMARY_ReadyScreen.txt` | 266 | P:none | ReadyScreen extraction summary |
| `LOOP_IMPLEMENTATION_REPORT.md` | 550 | P:none | Loop and `processRFIDScan` extraction |
| `PHASE3_COMPLETION_REPORT.md` | 536 | P:none | Phase 3 service layer |
| `PHASE4_COMPLETION_SUMMARY.md` | 246 | P:none | Phase 4 UI layer |
| `PHASE5_COMPLETION_SUMMARY.md` | 523 | P:none | Phase 5 integration |
| `VALIDATION_REPORT.md` | 275 | P:none | Validation of phases 0 to 2 |
| `docs/extraction/TokenDisplayScreen_extraction_report.md` | 741 | P:none | TokenDisplayScreen extraction |
| `docs/extraction_reports/StatusScreen_extraction_report.md` | 984 | P:none | StatusScreen extraction |
| `docs/extractions/ProcessingScreen_extraction_report.md` | 883 | P:none | ProcessingScreen extraction |
| `services/ConfigService_EXTRACTION_REPORT.md` | 450 | P:none | ConfigService extraction |
| `ui/SCREEN_BASE_CLASS_REPORT.md` | 725 | P:none | Screen base class |
| `ui/UIStateMachine_EXTRACTION_REPORT.md` | 676 | P:none | UIStateMachine extraction |
| `ui/UIStateMachine_IMPLEMENTATION_SUMMARY.md` | 412 | P:none | UIStateMachine implementation |

## 5. The scoreboard page (`backend/public/scoreboard.html`, 1,860 lines) and what it loads

One file: CSS at `:18-679`, markup at `:681-736`, one inline script at `:739-1858`. It is shown on the TV by a browser the backend launches (`backend/src/utils/displayDriver.js:77`) and on the Pi 4 by a browser a person or the machine starts (CC section 3.7). The script has no module boundary: its sections share one `state` object (`:863`). Each row is a section, since a module here is a span of one script.

| Section (lines) | Jobs | Interface | Depth | Depends on |
|---|---|---|---|---|
| Device identity (`:740-768`) | P:J7 | `generateDeviceId()`: `?deviceId=` wins, then `kiosk=true` gives `SCOREBOARD_DISPLAY`, else a per-browser id in `sessionStorage` | shallow | window, sessionStorage |
| Configuration, pack strings and theme (`:769-858`) | P:J1 | `CONFIG`; `%%OBSERVE_TOKEN%%` (`:776`), `%%PACK_STRINGS%%` (`:787`) and `%%PACK_THEME%%` (`:793`) are replaced by the engine at serve time (`backend/src/routes/resourceRoutes.js:204-213`); `applyPackTheme`, `packStr`, `STR`, baked fallback per key | shallow | engine injection |
| State and DOM handles (`:860-908`) | P:J2 | One `state` object (team scores, evidence by owner, countdown, display mode, session id) and `elements` | shallow (a bag every section reads and writes) | none |
| Countdown (`:927-1013`) | P:J2; s:J9 | `renderCountdown`, `syncCountdown(gameClock)`, a one second tick; extrapolates from `lastSyncTime` with `Date.now()` and keeps ticking after a disconnect because `status` stays `running` (`:974-992`) | medium | state |
| Modes and display mode (`:1015-1069`) | P:J4 | `initModes`, `handleDisplayMode`; the video overlay shows only in kiosk mode (`:1051-1068`) | shallow | state |
| Connection status (`:1071-1077`) | P:J9 | `updateConnectionStatus(status, text)` | shallow | state |
| Evidence, money and pack mode loading (`:1079-1306`) | P:J2; s:J1 | `renderEvidence`, `calculatePages`, `renderPage`, `addEvidence`, `removeEvidence` (drops by id or token id), `loadEvidenceModes` (fetches `/api/pack/files/game.json` once, `:1231`; evidence modes are those with `displayBehavior.surface === 'scoreboard-evidence'`, baked `detective` fallback with a warning), `applyMoneyFormat` and `formatMoney` (a vendored grammar twin of the backend's formatter, `:1209-1227`) | medium (three pack-derived rules in one span) | state, fetch |
| Page cycling (`:1308-1405`) | P:J2 | `startPageCycling`, `transitionToPage`, `clearManualPause`; interval by window height; 60 second pause after a GM page command | shallow | state |
| Score ticker (`:1407-1468`) | P:J2 | `renderTicker`, `updateTeamScore`; decides which teams show (score above zero, tokens scanned or an adjustment, `:1412`) | shallow | state |
| Session boundary (`:1470-1486`) | P:J5 | `handleSessionBoundary(newSessionId)`: a changed id clears scores and evidence | shallow | state |
| Token totals (`:1488-1509`) | P:J1; s:J2 | `fetchTokenTotals`: `GET /api/tokens` once at load for per-owner totals; never refreshed | shallow | fetch |
| Authentication (`:1511-1532`) | P:J7 | `authenticate`, `refreshAuth(reason)`: reloads the page for a new token | shallow | window |
| Socket and handlers (`:1534-1831`) | P:J2; s:J4, J5, J9 | `connectWebSocket`, `setupSocketHandlers`: handles `sync:full`, `transaction:new`, `transaction:deleted`, `score:adjusted`, `scores:reset`, `session:update`, `service:state` (only `gameclock`), `display:mode`, `scoreboard:page`, `group:completed`; ignores `player:scan`, `cue:*`, `device:*` and the snapshot's `displayStatus`; sends `deviceType: 'gm'` and no `packHash` (`:1559-1566`); tears the socket down after five quiet minutes (`:1581-1606`) | medium (the one section that decides the page's truth) | socket client, state, every section above |
| Initialisation (`:1833-1858`) | P:J2 | `initialize()`: loads modes, then tokens, then connects; a timed reload every 23 hours (`:1853`) | shallow | all sections |
| Style (`:18-679`) and markup (`:681-736`) | P:none | The audience's look; colours overridden by the injected theme | n/a | `/fonts/fonts.css` |
| `/fonts/fonts.css` | P:none | Declares the self-hosted faces (17 files with itself) | n/a | 16 `.woff2` files |
| 16 `.woff2` files in `backend/public/fonts/` | P:none | IBM Plex Mono 400, 500, 600, 700, Libre Baskerville 400, 400 italic, 700 and Special Elite 400, each in `latin` and `latin-ext` (8, 6 and 2 files) | n/a | none |
| `/socket.io/socket.io.js` | P:J2 | The socket client library, served by the engine's own socket server (not a file in the repository) | n/a | engine |

## 6. Relationships

### 6.1 Which jobs each client's modules serve

Every job lists its client modules. D marks a module that decides the job's fact for that client, H one that holds or shows a copy, R one that carries out someone else's decision. Counts of modules by primary job come from the `P:` tags above.

| Job | GM scanner | Web player scanner | Hardware scanner | Scoreboard page |
|---|---|---|---|---|
| **J1** pack | D `core/packLoader`, `core/modeSemantics`, `core/tokenManager` (fan-out); H `core/scoring` (table), `core/strings`, `core/theme`, `utils/formatCurrency`; R `app/initializationSteps` (applies the loader, shows identity) | D `js/app.js` (reads its own `data/tokens.json`, loads pack identity); H `js/scannerCore` (pack hash short form) | D `TokenService` (boot sync), `AssetService` (media and identity); H `models/Token`; pure `AssetManifestDiff` | D configuration and pack mode loading sections (fetches `game.json`, tokens); H serve-time injected strings and theme |
| **J2** one true record | H `core/unifiedDataManager`, `core/storage/NetworkedStorage`, `core/stateStore`, `core/teamRegistry`, `network/messageRouters`, `network/networkedSession`; D (standalone) `core/storage/LocalStorage`, `core/scoring`; renderers `GameOpsRenderer`, `EvidencePickerRenderer` | D (private) seen set in `js/app.js` | none (queue only) | H state, countdown, evidence, ticker, socket sections; D evidence-mode filter |
| **J3** answer and remember | D `app/domains/gameOps` (first verdict), `core/storage/LocalStorage` (standalone verdict); H `ui/uiManager` (result screen), `network/networkedQueueManager`, `admin/utils/CommandSender`, `admin/AdminOperations`, `core/sessionReportGenerator`; R `utils/domEventBindings`, `utils/nfcHandler`, `app/app` | D `js/orchestratorIntegration` (queue, final or retry), `js/scannerCore` (reply meaning); H `js/tokenDisplay`, `js/app.js` | D `Application` (token gate and outcome), `ScanResponse`, `PayloadBuilder`, `BatchId`, `OrchestratorService` (send, queue); H screens, `UIStateMachine`, `RFIDReader`, `NDEFParser`, `Token` | none (it does not scan) |
| **J4** equipment | R twelve `admin/*` controllers, `app/domains/showControl`, `app/domains/environment` (empty), `app/adminController`; H `admin/MonitoringDisplay` and nine renderers | H `js/tokenDisplay`, `js/scannerCore` (video alert) | H `ProcessingScreen`, `Application.applyScanOutcome` (video-unavailable treatment) | H display-mode section (overlay) |
| **J5** life of a game | D (standalone) `core/storage/LocalStorage`, `app/domains/gameAdmin`; D (inference) `network/networkedSession` (boundary from a changed id), `core/unifiedDataManager.resetForNewSession`; R `admin/SessionManager`, `app/sessionModeManager`, `services/StateValidationService`, `app/initializationSteps`; H `SessionRenderer`, `GameAdminRenderer` | none by design (seen set, queue and pending batch outlive every game) | `Application` boot and serial override (device life only); queue and token list outlive every game | D session-boundary section (a changed id), `scores:reset` handler, 23 hour reload |
| **J6** designers | none author or apply. Consumers of what a designer changes: `core/packLoader`, `core/modeSemantics`, `core/strings`, `core/theme`, `core/scoring` | consumer: `js/app.js` | consumer: `TokenService`, `AssetService` | consumer: configuration and evidence sections |
| **J7** roles | D `network/orchestratorClient` (credential in handshake), `network/connectionManager`, `ui/connectionWizard` (station name), `utils/jwtUtils`, `ui/settings` | D `js/orchestratorIntegration` (device id), `js/app.js` (team `'001'`) | D `ConfigService` (device id and team from `config.txt`); engine records it as `player` (CC section 3.5) | D device identity and authentication sections (observe token) |
| **J8** wherever | D `app/sessionModeManager` (the tap), `app/initializationSteps`, `utils/config`, `ui/connectionWizard`, `core/packLoader` (channel by origin); the mode branches in `gameAdmin`, `gameOps`, `teamRegistry`, `showControl`, `app` | D `js/scannerCore.isStandaloneMode`, `js/orchestratorIntegration` (URL path) | D `ConfigService`, `Config`, `config.h`, `SDCard`, `OrchestratorService.initializeWiFi`; no standalone path | R initialisation (`kiosk` and `deviceId` URL parameters) |
| **J9** tell the truth | D `ui/renderers/HealthRenderer`, `dormancyWording`, `network/connectionManager`, `services/StateValidationService`; H `admin/MonitoringDisplay` (orchestrator dot); `core/stateStore` holds no age | D `js/orchestratorIntegration` (poll, "Offline") | D `ConnectionState`, `StatusScreen`, `ScanFailedScreen`, the health poll in `OrchestratorService` | D connection-status section, five-minute quiet rule, countdown that keeps ticking |
| **J10** trustworthy | test seams: `MESSAGE_TYPES` export (`network/orchestratorClient`), `_resetForTesting` (`core/modeSemantics`, `core/theme`), `IStorageStrategy`, `ui/renderers/dormancyWording` parity copy | `js/scannerCore` (pure, extracted for tests) | seven pure, natively tested headers; `SerialService` and its simulate commands | none (the page is tested only through the backend's browser tests via a page object) |

Modules by primary job, from the `P:` tags: GM scanner (67 JavaScript files, 10 style sheets with no job): J1 7, J2 11, J3 7, J4 21, J5 5, J7 4, J8 6, J9 4, none 12 (including nine helpers). Phone (4): J3 4. Hardware scanner (28 source files): J1 4, J3 12, J4 1, J8 6, J9 3, J10 1, plus the `.ino`; 16 documents with none. Scoreboard sections (13 rows of code): J1 3, J2 5, J4 1, J5 1, J7 2, J9 1. J4 is large on the tablet because twelve single-purpose controllers and nine renderers each count once; J6 has no client module as primary on any client.

### 6.2 Client modules that redo a job the backend also does, and how each copy is kept equal

Backend sides are `backend/src/gameRules/*` unless named. "Kept equal by" lists every mechanism I found; "nothing" means I found none.

| # | The job redone | Client modules (copies) | Backend side | Kept equal by | Where they can disagree |
|---|---|---|---|---|---|
| R1 | Claim and duplicate rule | `app/domains/gameOps.js:253` (gate), `:329-331` (optimistic mark), `core/storage/NetworkedStorage` (Set), `core/storage/LocalStorage:324` (standalone) | `duplicatePolicy.js:83` | Comments saying "backend duplicatePolicy parity" (`gameOps.js:250`, `LocalStorage.js:322`); unit tests `gameOps-claims-and-floor.test.js`, `gameOps.duplicateRow.test.js`; no shared code | After a delete the backend frees the claim and the tablet keeps it (`messageRouters.js:47-54`); AN C1 |
| R2 | What a token scores | `core/scoring.js:202` `calculateTokenValue`, called at `gameOps.js:320`, `uiManager` result screen, `GameOpsRenderer` token cards | `scoring.js:51` `pointsFor` | Pack numbers at runtime (`applyPackScoring`); a drift test pinning the baked table to `data/game.json` (`scoring-config.test.js:15`); pins of the same edge cases on both sides (`scoring-parity.test.js`, hand-written expectations) | A tablet on a different pack than the engine; the token card recomputes from the tablet's table even when the transaction carries its own points (GM section 4) |
| R3 | Group completion and bonus | `core/storage/LocalStorage:394`, `core/unifiedDataManager.js:582-745` (team details) | `scoring.js:133`, `:184`, `:220` | Comments (`LocalStorage.js:426`); `LocalStorage.test.js`; one end-to-end proof (`backend/tests/e2e/flows/07c-gm-scanner-scoring-parity.test.js`) whose group case skips on the real pack (SP:147) | `getTeamCompletedGroups` is implemented by neither strategy, so networked team details shows no completed group (`unifiedDataManager.js:569-575`, grep shows no other definition) |
| R4 | What a mode does | `core/modeSemantics.js` (table, baked ALN shim), scoreboard evidence filter (`scoreboard.html:1229-1255`) | `modeSemantics.js` (its own baked shim) | Pack data; a drift test pinning the baked table to the real `game.json` (`modeSemantics.test.js`); a "parity-pack fixture" on the backend side (`modeSemantics.js:22`); the scoreboard has a Tier L browser check for its money and evidence rule (`scoreboard.html:1204-1212` comment) | Different packs; the scoreboard fetches its own `game.json` bytes while the engine scores from a frozen snapshot (CT conclusion 4) |
| R5 | May a scan happen in this phase | `gameOps.js:233-241` (networked: `active` only), `LocalStorage.js:302` (standalone: refuses only `paused`) | `transactionService.js:157` via GM section 4 | nothing shared | Standalone accepts scans in setup and ended (SP SG-02); the networked gate reads a local status that can be older than the engine's |
| R6 | Which token a tag means | `core/tokenManager.js:276-302` (strip `:` and `-`, lowercase), `aln-memory-scanner/js/scannerCore.js:28` (lowercase, strip all but `[a-z0-9_]`), `models/Token.h:23` plus exact `TokenService::get` (`:160`) | exact map lookup in `transactionService` via GM section 4 | nothing; four rules (SP row 7 states the phone and hardware scanner pair) | A tag the GM's fuzzy match accepts and the engine's exact lookup refuses; a tag with a hyphen the phone strips and the hardware scanner keeps |
| R7 | Money format | `utils/formatCurrency.js`, `scoreboard.html:1214-1227` | `formatting.js` | Grammar comments; pins "identical outputs on the same inputs" (`formatCurrency.js:6`); the scoreboard's Tier L rendered-affix check | A format outside the one `#,###` grammar |
| R8 | Which owners' evidence is exposed | `core/unifiedDataManager.js:301-331` (`getExposedOwners`), `scoreboard.html:1257-1306` | the scoreboard's own filter is the server-side reference (GM section 4) | a comment | Two filters of one rule |
| R9 | Where one game ends and the next starts | `network/networkedSession.js:246-258`, `scoreboard.html:1473`; phone and hardware scanner none | no boundary message exists (AN C4) | nothing | A tablet that reloads reads the first event as a new game and drops its queue (GM conclusion 5, inference) |
| R10 | Time left on the clock | `ui/renderers/SessionRenderer.js` (tick), `scoreboard.html:938-1000` | `gameClockService` | nothing | After a disconnect the page keeps counting while the engine may have paused |
| R11 | Which pack is running | tablet `core/packLoader`; scoreboard `loadEvidenceModes` and `fetchTokenTotals`; phone nested `data/tokens.json`; hardware `TokenService` and `AssetService` | `packService` (frozen at boot) | the tablet's `packHash` in the handshake and a log line on mismatch (`socketServer.js:139-148`); the phone shows identity on its config page; the hardware scanner shows it in the boot log and serial `CONFIG` | Nine holders (CC section 2, finding 2); nothing compares them |
| R12 | What a scan reply means | phone `scannerCore.classifyScanResponse`, hardware `ScanResponse.h`, tablet `networkedQueueManager` (per result) | the scan routes | the contract test over hand-written payload literals (request side only) and two separate unit suites; nothing runs the same reply through both classifiers | A 4xx the phone treats as final and the hardware scanner queues; a batch the phone drops on 4xx and the hardware scanner keeps until 200 (CT conclusion 9) |
| R13 | Is the engine reachable | tablet `connectionManager.checkHealth`, phone `checkConnection` (10 s poll), hardware health poll (10 s poll, up to 61 s inside), scoreboard socket plus five-minute rule | `/health` and the device registry | nothing | Each client shows a different answer for up to one poll interval |
| R14 | Dormancy wording | `ui/renderers/dormancyWording.js` | `dormancyWording.js` | a test on each side pinning the two sentences | A new door added on one side |
| R15 | Preflight go or no-go | `app/domains/gameAdmin.js:26,:88` reads a `NO-GO: ` message prefix | `commandExecutor.js:263` builds the message | a string match | A change of wording |
| R16 | The post-game record | `core/sessionReportGenerator.js` builds markdown from the tablet's own copies | no engine-side record of the night exists yet (EJ J3) | n/a | The downloaded report's two totals disagree (AN C11) |
| R17 | Score adjustment and the floor | `core/storage/LocalStorage:544-613` | `TeamScore.adjustScore` | comments (`LocalStorage.js:565`, `:580`) | A rebuild after a delete that replays adjustments differently |
| R18 | Team exists | `core/teamRegistry.hasTeam` then `session:addTeam` | a score row created on the first scan (GM section 4) | n/a | low risk, two creation paths |

How the copies are kept equal, in one count: 18 rows; 5 are held by pack data alone or by pack data plus a test; 9 by comments or paired tests with hand-written expectations; 4 by nothing (R6, R9, R10, R13). No row is held by shared code, because the three client languages (browser JavaScript, a second browser page, C++) have no common rule module. The parity surface the backend declares in its own comments (`gameRules/scoring.js:9`, `duplicatePolicy.js:15`, `formatting.js:11`) is read by no client.

### 6.3 What the web and hardware player scanners share, duplicate and differ on

Owner's parity rule: phone clients and hardware scanners stay equal in engine capabilities, and everything a designer iterates on is pack data (MD constraint 2.5, `2026-10-30-map-direction.md:62`; capability 49 at `:127`).

**Shared (by contract and by data, not by code).** The request to `POST /api/scan` (`tokenId`, optional `teamId`, `deviceId`, `deviceType`, `timestamp`) and the batch endpoint; no credential; a 10 second `/health` poll; a 100-entry offline queue that drops the oldest; replies A4 and A5 (a queued scan never starts a video; a refused scan is final); the pack's token ids as the vocabulary; the engine's `/api/scan` as the only path to a video. Both read their token list from a copy of pack data (phone: nested file; hardware: SD copy of `GET /api/tokens`).

**Duplicated with no shared code or test (each written twice).** Id matching (R6), reply classification (R12), the unknown-token gate (phone `app.js:399`, hardware `Application.h:535-548`), the offline queue, batch ids and snapshot handling, the health poll and the connection word, and the "video unavailable" treatment. The one cross-check is `backend/tests/contract/scanner/request-schema-validation.test.js`, whose header says its payloads "match the output of" `PayloadBuilder.buildScanJson()` and `OrchestratorIntegration.scanToken()`; the payloads are literals written in the test, so a change to either builder is not seen by it (inference from the file's first thirty lines).

**Where they differ in the networked game** (the standalone rows are the 24 in SP section 4 and are not repeated). Thirteen:

| # | Behaviour | Phone | Hardware scanner |
|---|---|---|---|
| 1 | Memory shown when the scan is refused or there is no game | Shown anyway, with a toast (`app.js:431-471`: `scanToken` is not awaited before `displayMemory`) | Not shown; "NO SESSION" screen (`Application.h:689` with `ScanResponse.h` `REJECTED_NO_SESSION`) |
| 2 | Id matching | Lowercase, strip to `[a-z0-9_]` | Exact match of the tag text for lookup; `cleanTokenId` only for file paths |
| 3 | Team sent | `sessionStorage.currentTeam` or `'001'` | Static `TEAM_ID` from `config.txt` |
| 4 | `deviceType` sent and recorded | Sends `player`; recorded `player` | Sends `esp32`; the device list records `player` (`healthRoutes.js:54`) |
| 5 | Seen mark | "New" or "Revisited", kept for good | None |
| 6 | Time on a scan | Browser ISO time | Local time after NTP, else a 1970 placeholder the engine recognises |
| 7 | Reply to a batch | 4xx drops the batch, 5xx keeps it | Only HTTP 200 removes entries; anything else retries every 10 s |
| 8 | Scan path retry | One `fetch`, queue on network error or 5xx | One bounded 10 s attempt, queue otherwise |
| 9 | Pack identity | Reads `GET /api/pack/manifest` at load, shows it on the config page | Reads it from the asset manifest if the file has a `pack` key; boot log and serial `CONFIG` only |
| 10 | Token file shape | Flat id to record | Wrapped `{"tokens": {...}}`; keeps only `video` |
| 11 | Media rule | Path from the token's `image` and `audio` fields | `{id}.bmp` and `{id}.wav` built from the id |
| 12 | Video token | Alert after the reply: "triggered" or "unavailable, rescan" | Processing screen with a label; "VIDEO UNAVAILABLE / Rescan later" when queued or video-rejected |
| 13 | When it learns "no engine" | Within one 10 s poll | Within one poll plus up to about 61 s of retries (CT section 1.3) |

Rows 1, 2 and 12 change what a player sees or which tag works. The rest are internal. The pack-data half of the parity rule holds (both read pack data); the capability half has no check at all.

### 6.4 Standalone: the client modules that would have to carry the game alone (decision 22)

Standalone is a declared choice never mixed with networked (CC section 1, CS decision 22 via EJ J8). Today the tablet's mode is a tap (`app/sessionModeManager.js`), the phone's is its URL path (`js/scannerCore.js:51`, `js/orchestratorIntegration.js:33-34`), the hardware scanner has none, and the pack has no field for it (SP N1; EJ J8).

**Tablet: 30 of 67 JavaScript files carry a standalone game.** Authority for every game fact is `core/storage/LocalStorage.js`.

| Group | Modules |
|---|---|
| Start and mode | `main.js`, `app/app.js`, `app/initializationSteps.js`, `app/sessionModeManager.js` |
| Scan and admin | `app/domains/gameOps.js`, `app/domains/gameAdmin.js` (four standalone branches), `utils/nfcHandler.js`, `utils/domEventBindings.js` |
| The game record (the second engine) | `core/unifiedDataManager.js`, `core/storage/IStorageStrategy.js`, `core/storage/LocalStorage.js`, `core/gameActivityBuilder.js`, `core/teamRegistry.js` |
| The pack and the rules | `core/tokenManager.js`, `core/packLoader.js`, `core/scoring.js`, `core/modeSemantics.js`, `core/strings.js`, `core/theme.js`, `utils/formatCurrency.js` |
| Screens | `ui/uiManager.js`, `ui/renderers/GameOpsRenderer.js`, `ui/renderers/GameAdminRenderer.js`, `ui/settings.js` |
| Helpers | `utils/debug.js`, `utils/config.js`, `utils/formatDuration.js`, `utils/escapeHtml.js`, `utils/showToast.js`, `utils/slugify.js` |

The other 37 serve only the networked game: all 13 `admin/` files, all five `network/` files, `services/StateValidationService.js`, `core/stateStore.js`, `core/storage/NetworkedStorage.js`, `core/sessionReportGenerator.js` (standalone has no player scan data, ALNScanner `CLAUDE.md`), nine renderers (Cue, Environment, EvidencePicker, Health, HeldItems, Music, Session, Video, dormancyWording), `ui/connectionWizard.js`, `utils/jwtUtils.js`, `utils/escapeCssAttrValue.js`, `app/adminController.js`, `app/domains/showControl.js`, `app/domains/environment.js`. `ALNScanner/index.html:570` loads the engine's socket client from the engine's own path; on a static host that file is absent (inference: the path is served only by the engine's socket server; I did not check whether anything breaks).

What the standalone carriers lack today, each already in the standalone pass: the scan gate checks only `paused` (R5); a refused scan still shows "Transaction Complete" because the caller ignores the store's answer; no screen starts a named or second game; a mid-game reload online adopts the newest published pack under the game in progress; group completion in team details is empty (R3) (SP SG-01 to SG-03, SP section 2 C9).

**Phone: all four files.** Standalone is the whole phone: `scannerCore` (mode and id), `orchestratorIntegration` (returns `{status: 'standalone'}` and sends nothing, `:91-95`), `app.js` (token list, seen set), `tokenDisplay`. What it keeps is a private seen set that outlives every game (SP row 16).

**Hardware scanner: none.** No file declares or handles a standalone game. The modules that would have to change are `Application.h` (boot and the 30 second window), `ConfigService.h` and `models/Config.h` (a declared setting, a config check that passes with no Wi-Fi), `TokenService.h` (a way to load pack tokens with no engine), `AssetService.h`/`ui/screens/StatusScreen.h` (identity and a standalone label), and `OrchestratorService.h` (skip Wi-Fi, health and queue); SP section 4 lists the seven parity rows where it trails the phone.

### 6.5 Depth, in short

- **Deep:** `core/packLoader`, `core/modeSemantics`, `network/networkedQueueManager`, `admin/utils/CommandSender`, `js/orchestratorIntegration`, `RFIDReader.h`, `AssetService.h`, `SDCard.h`, `UIStateMachine.h`, and the pure headers and functions (`NDEFParser`, `PayloadBuilder`, `ScanResponse`, `BatchId`, `AssetManifestDiff`, `scannerCore`, `gameActivityBuilder`).
- **Shallow where it hurts leverage:** `core/unifiedDataManager` (the widest interface in the tablet), `app/app.js` (forwarders), `app/domains/showControl.js` and `environment.js`, the twelve admin controllers, `utils/domEventBindings.js`, `js/app.js` on the phone, `js/tokenDisplay.js`, `ui/settings.js`.
- **Deep in behaviour, overloaded in role:** `OrchestratorService.h` (five roles), `Application.h` (boot, scan decision, timestamp and fifteen test commands in one class), `core/storage/LocalStorage.js` (the standalone engine, a second copy of backend rules), `ui/renderers/GameOpsRenderer.js` (704 lines reading a data-manager field that does not exist).
- **Deletion test, passing both ways:** deleting `core/modeSemantics` or `packLoader` would send complexity back to many callers; deleting `app/domains/environment.js` removes nothing.

## 7. Completion check

Raw listings, run 2026-11-01 (`find <dir> -type f | wc -l`), against rows in this sheet (rows counted by script over the first column's backticked path, section 7.2):

| Place | Raw count | Rows | Where |
|---|---|---|---|
| GM scanner `ALNScanner/src` | 77 (67 `.js`, 10 `.css`) | 77 (9 + 15 + 6 + 13 + 14 + 11 + 10) | sections 2.1 to 2.7 |
| Web player scanner `aln-memory-scanner/js` | 4 | 4 | section 3 |
| Hardware scanner `ALNScanner_v5` | 44 (28 source, 16 documents) | 44 (28 + 16) | sections 4.1 and 4.2 |
| Scoreboard page: `scoreboard.html` | 1 file | 14 section rows plus a style and markup row | section 5 |
| Scoreboard page: loaded files | `backend/public/fonts`: 1 `.css` and 16 `.woff2` = 17; the socket client (served by the engine, not in the repository) | 17 font files in 2 rows; 1 socket client row | section 5 |

Per-directory GM counts (raw): `admin` 12 plus `admin/utils` 1 = 13; `app` 4 plus `app/domains` 4 = 8; `core` 13 plus `core/storage` 3 = 16 including `core/storage`; checked as: `core` top level 14 files (gameActivityBuilder, modeSemantics, packLoader, scoring, sessionReportGenerator, stateStore, strings, teamRegistry, theme, tokenManager, unifiedDataManager and three under `storage/` counted separately) giving 11 plus 3; `main.js` 1; `network` 5; `services` 1; `ui` 3 plus 11 renderers; `utils` 11; `styles` 10. The sections 2.1 to 2.7 row totals above add to 77, matching `find ALNScanner/src -type f | wc -l`.

Every job lists its client modules: section 6.1 has a row for each of J1 to J10 and a column for each of the four places. J6 has no client module that authors or applies a pack change on any client, stated in its row; J10's modules are test seams, listed.

The three questions the task asked are answered: section 6.2 (client modules that redo a backend job and how each copy is kept equal, 18 rows), section 6.4 (modules that would carry a standalone game, by client), section 6.3 (what the phone and the hardware scanner share, duplicate and differ on, 13 networked differences, the 24 standalone rows pointed to).

**What I did not do, so the reader can weigh it.** I ran no test, build or device. Depth verdicts marked with a dagger rest on interface lists and the earlier maps, not a full read of the body. I did not read `ALNScanner/sw.js`, `ALNScanner/index.html` beyond the script tags and one button, the GM scanner's test files beyond the names cited, the phone's `sw.js`, `index.html` or `config.html` beyond the script tags, or the hardware scanner's `docs`, reports and HAL bodies other than headers and the spans cited. Two claims are inference and marked so in place: the contract test's payloads are not generated from the builders (read from the first thirty lines only), and the standalone page's missing socket client on a static host. Line numbers carried "via" were not re-read; the ALNScanner comment-only drift since the GM map can leave them a few lines off (CC header).
