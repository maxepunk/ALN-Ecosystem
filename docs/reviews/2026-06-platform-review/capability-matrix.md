# Capability Classification Matrix

**Date:** 2026-06-09
**Phase:** 1 discovery (feeds Phase 3.0 game.json schema design)
**Builds on:** `docs/plans/2026-06-09-platform-review-refactor-workflow.md` Part 1 (survey-level entanglement map — deepened here, not re-derived)

## Axes

| Variability class | Meaning |
|---|---|
| `engine-fixed` | Same for every game; engine code, no per-game variation needed |
| `game-configurable` | Varies per game via game.json-style config (rules, policies, parameters) |
| `game-content` | Per-game data: tokens, cues, assets, strings, playlists, themes |
| `venue-config` | Varies per *venue/deployment*, not per game (a third bucket the codebase forces — sinks, HA entities, .env). Flagged because the game-pack design must NOT absorb these |
| `uncertain` | Needs owner decision — question listed in §10 |

| Deployment class | Meaning |
|---|---|
| `required-always` | Present in every topology |
| `networked-only` | Requires orchestrator |
| `standalone-only` | Only exists in no-orchestrator operation |
| `optional-module` | Game/venue can run without it (with or without orchestrator) |

Notation: rows reference `Q#` for uncertain questions (§10). "Change for pack" is the one-line migration note.

---

## 1. Game mechanics core (scoring, transactions, sessions, teams)

This is the heart of the engine/game seam. "Scoring" decomposes into 14 distinct rows with different classifications.

| # | Capability | Where it lives | Variability | Deployment | Current state | Change for pack |
|---|---|---|---|---|---|---|
| 1.1 | Scoring base values (rating 1-5 → $) | `ALN-TokenData/scoring-config.json`; loaded by `backend/src/config/index.js:14-25`, `ALNScanner/src/core/scoring.js:12-25` | game-configurable | required-always | Config (the model seam — already shared) | Move scoring-config.json into pack; keep load pattern |
| 1.2 | Type multipliers (Personal 1x … Technical 5x) | same files as 1.1 | game-configurable | required-always | Config | Same as 1.1 |
| 1.3 | Memory-type enum itself (the 5 type names) | Derived implicitly from scoring-config keys; fallback duplicated `backend/src/config/index.js:21-24`; docs/UI reference names | game-configurable | required-always | Semi-config; validator accepts ANY string → silent 0x | Enum = keys of pack scoring config; strict validation (reject or loud-warn unknown types) |
| 1.4 | UNKNOWN-type → 0x rule | `scoring-config.json` (`UNKNOWN: 0`), `tokenService.js calculateTokenValue`, `scoring.js:98-101` | game-configurable | required-always | Config value, hardcoded fallback ×2 | Keep as config; document as policy |
| 1.5 | Token value **formula shape** (`floor(base[rating] × mult[type])`) | `backend/src/services/tokenService.js calculateTokenValue` AND `ALNScanner/src/core/scoring.js calculateTokenValue` | **uncertain (Q2)** | required-always | Hardcoded formula, duplicated in 2 runtimes | If fixed: shared rules module. If variable: rule-expression in game.json |
| 1.6 | Group completion **rule** (team collects ALL tokens in group; group needs 2+ tokens; mult > 1) | `transactionService.js:370-408` + `isGroupComplete`; `ALNScanner/src/core/storage/LocalStorage.js:351-392` | **uncertain (Q3)** | required-always | Hardcoded, duplicated, **with a parity nuance**: backend bonus = `(mult-1) × Σ catalog token values` (tokenService-calculated values); scanner bonus = `(mult-1) × Σ team's transaction points`. Same when team scanned all in blackmarket mode, divergent under mixed-mode/adjustment edge cases | Shared rules module (Phase 2 flagship); rule params (and possibly rule type) in game.json |
| 1.7 | Group bonus formula `(mult−1) × baseSum` | same as 1.6 | game-configurable | required-always | Hardcoded ×2 | Into shared rules module, parameterized |
| 1.8 | Group **encoding**: multiplier embedded in name string `"Name (xN)"` parsed by regex | `tokenService.js parseGroupMultiplier/extractGroupName`, `scoring.js parseGroupInfo:38-62`, `sync_notion_to_tokens.py` SF_Group handling, group-name normalization `scoring.js normalizeGroupName` | engine-fixed (the parsing) over game-content (the encoding) — **the encoding itself should die** | required-always | Stringly-typed convention parsed in ≥3 places | tokens.json schema: structured `group: {id, multiplier}`; sync adapter emits it; delete regexes |
| 1.9 | Transaction modes — the **set** (`detective`, `blackmarket`) | `backend/src/utils/validators.js:45,137` (Joi enum), `models/transaction.js:156` (default `'blackmarket'`), scanner `Settings.mode`, mode toggle UI `ALNScanner/index.html:71` | **uncertain (Q1)** | required-always | Hardcoded enum in 4+ places across 2 repos + contracts | game.json `modes: [{id, name, scoring policy, scoreboard behavior}]`; AsyncAPI/OpenAPI mode field becomes pack-validated |
| 1.10 | Mode zero-points rule (detective scores 0) | `transactionService.js:203-217`; `LocalStorage.js:332-336` (`mode === 'blackmarket' && points`) | game-configurable | required-always | Hardcoded branch, duplicated | Per-mode `scoring: none\|standard` flag in game.json mode defs |
| 1.11 | Detective exposure behavior (summary published on scoreboard) | `transactionService` summary enrichment :166-176, scoreboard.html evidence cards, AsyncAPI summary field (max 350) | game-configurable | networked-only (scoreboard display) | Hardcoded mode semantics | Per-mode `display: evidence-board\|none` behavior in game.json |
| 1.12 | Default mode when scan omits it (`blackmarket`) | `models/transaction.js:156`, `validators.js:45` | game-configurable | required-always | Hardcoded literal | game.json `defaultMode` |
| 1.13 | Duplicate policy per deviceType (gm: reject; player/esp32: allow + rescan analytics) | `transactionService.js isDuplicate:258-326`; deviceType enum `models/transaction.js:146` | game-configurable (policy) over engine-fixed (deviceType vocabulary) | required-always | ~70 lines of hardcoded branching | game.json `duplicatePolicy: {gm: reject-global, player: allow, ...}`; deviceType enum stays engine |
| 1.14 | First-come-first-served cross-team token claim (GM) | `transactionService.js:307-326`, `findOriginalTransaction` | **uncertain (Q4)** | required-always | Hardcoded | Policy option under 1.13 |
| 1.15 | Per-device GM duplicate rejection (same device, same token) | `transactionService.js:296-305`, `session.hasDeviceScannedToken` | game-configurable | networked-only (session-based) | Hardcoded | Same policy block |
| 1.16 | Scanner-local global duplicate check (`scannedTokens` Set) | `ALNScanner` app.js `processNFCRead`, DataManager `scannedTokens` | game-configurable (must mirror 1.13) | required-always (both modes) | Hardcoded; parity risk with backend policy | Drive from same game.json policy via shared rules module |
| 1.17 | Team model: dynamic creation, freeform names, no roster, no cap | `sessionService` addTeam, `session:addTeam` command, GM team-entry UI | **uncertain (Q5)** | required-always | Hardcoded behavior (documented as deliberate) | game.json `teams: {creation: dynamic\|fixed, roster?, max?}` |
| 1.18 | Session lifecycle state machine (setup→active→paused↔active→ended) | `sessionService.js`, commands in `adminEvents.js`/`commandExecutor.js` | engine-fixed | required-always | Engine code | None |
| 1.19 | Transactions rejected unless session `active` | `transactionService`/`adminEvents` session-state gate | engine-fixed | networked-only | Engine | None |
| 1.20 | Score adjustments, transaction deletion, scores reset (admin) | `transactionService` (`score:adjusted`, `scores:reset`), GM admin | engine-fixed | networked-only (standalone has local resetScores) | Engine | None |
| 1.21 | Session duration / overtime threshold (2h game) | `SESSION_TIMEOUT` env (config/index.js:51), `gameClockService.setOvertimeThreshold` | game-configurable | required-always | Env var + runtime call | game.json `gameClock: {duration, overtimeAt}` |
| 1.22 | Token summary length cap (350 chars) | `tokenService.validateSummary`, `validators.js:46,138`, AsyncAPI | engine-fixed (contract constant) | required-always | Hardcoded contract value | None (document in tokens schema) |
| 1.23 | Token schema (SF_* fields, media paths, owner, summary) | No JSON Schema; validation scattered: `utils/validators.js tokenSchema`, `tokenService.loadTokens` transform, scanner `tokenManager`, sync script | engine-fixed (schema) over game-content (data) | required-always | Implicit/scattered | Write tokens.json JSON Schema (Phase 2.5); pack carries the data |
| 1.24 | Token ID normalization / fuzzy matching (case, colons, hyphens) | `ALNScanner tokenManager.js:207-233`; ESP32 `cleanTokenId`; backend exact-match | engine-fixed | required-always | Engine, but **3 divergent implementations** (parity-audit item) | Single spec in player-scanner role spec; no pack impact |
| 1.25 | Currency **presentation** ($ formatting) | `ALNScanner/src/utils/formatCurrency.js` (used 10+ places in uiManager), `sessionReportGenerator._formatCurrency`, `scoreboard.html` | game-content (strings/format) | required-always | Hardcoded $ formatter ×3 | strings.json `currency: {symbol, format}`; one shared formatter |
| 1.26 | Star-rating presentation (⭐ repeat for detective) | `uiManager.js:718` | game-content | required-always | Hardcoded glyph | strings.json/theme |
| 1.27 | Standalone local scoring engine | `LocalStorage.js` (full reimplementation of 1.5-1.7, 1.10) | duplicated game logic — target of D3 | standalone-only | Hardcoded duplicate | Shared rules module consumed by both runtimes (distributed like scoring-config) |
| 1.28 | Token `owner` → character mapping | tokens.json `owner` field (Notion sync resolves relation), consumed by report generator + scoreboard grouping | game-content | required-always | Content field; resolution logic in sync script | Field stays in tokens schema; resolution moves to source adapter |

## 2. Backend services — show control & environment

| # | Capability | Where it lives | Variability | Deployment | Current state | Change for pack |
|---|---|---|---|---|---|---|
| 2.1 | Video queue mechanics (queue, conflict detection, `canAcceptVideo`, progress) | `videoQueueService.js` (977L) | engine-fixed | networked-only, optional-module (`ENABLE_VIDEO_PLAYBACK`) | Engine | None |
| 2.2 | Video files + filename↔tokenId convention (`{tokenId}.mp4`) | `backend/public/videos/`, `videoQueueService.js:651-661` inference | game-content (files) over engine-fixed (convention) | networked-only, optional-module | Content + convention | Pack `assets/videos/`; keep convention, document in tokens schema |
| 2.3 | Idle-loop video (`idle-loop.mp4` literal) | `displayControlService.js:6,131`, videoQueueService comments | game-content (the file) / engine-fixed (the mode) | networked-only, optional-module | Hardcoded filename | game.json/pack `display.idleLoop` filename |
| 2.4 | Display mode state machine (IDLE_LOOP / SCOREBOARD / VIDEO) | `displayControlService.js` | engine-fixed (set of modes — see Q14) | networked-only, optional-module | Engine | Likely none; confirm Q14 |
| 2.5 | Scoreboard window discovery by HTML title (`xdotool search --name "Case File"`) | `displayDriver.js` + `scoreboard.html:9` `<title>Case File: About Last Night</title>` | engine-fixed mechanism **coupled to game-content string** | networked-only, optional-module | Hidden coupling: theming the scoreboard title breaks window management | Search by a stable non-themed marker (e.g., fixed window-name suffix) before strings extraction |
| 2.6 | VLC control (D-Bus MPRIS, hw-accel args) | `vlcMprisService.js`, `mprisPlayerBase.js` | engine-fixed | networked-only, optional-module | Engine | None |
| 2.7 | Music playback mechanics (MPD, crossfade, shuffle/loop, hot reload) | `musicService.js`, `mpdConfigBuilder.js` | engine-fixed | networked-only, optional-module | Engine | None |
| 2.8 | Music playlists + tracks | `backend/config/music-playlists.json`, `backend/public/music/` | game-content | networked-only, optional-module | Already data-driven | Move into pack (`playlists.json` + assets) |
| 2.9 | Sound playback (pw-play wrapper) | `soundService.js` | engine-fixed | networked-only, optional-module | Engine | None |
| 2.10 | Sound files (attention.wav etc.) | `backend/public/audio/` | game-content | networked-only, optional-module | Content dir | Pack `assets/audio/` |
| 2.11 | Bluetooth speaker pairing | `bluetoothService.js` (886L) | engine-fixed | networked-only, optional-module | Engine | None (venue runtime operation) |
| 2.12 | Audio routing (streams → sinks) | `audioRoutingService.js` routes; `config/environment/routing.json` `routes` | venue-config | networked-only, optional-module | Config file, but mixed with ducking (2.14) | Split routing.json: routes = venue file, NOT in game pack |
| 2.13 | Stream-name vocabulary (`video`/`music`/`sound`) | `audioRoutingService.js` `['video','music','sound']`, routing.json keys, `audio:volume:set` validation | engine-fixed | networked-only, optional-module | Hardcoded engine vocabulary | None (defer per plan 3.2g unless a game needs new streams) |
| 2.14 | Ducking rules (video ducks music to 20%, etc.) | `routing.json` `ducking` array; engine in `audioRoutingService` | **uncertain (Q8)** — show design (game) vs venue tuning | networked-only, optional-module | Config, co-located with venue routes | Decide owner; likely game-pack with venue override |
| 2.15 | Ducking engine (multi-source, lowest-wins, fade, restore) | `audioRoutingService.js` (split target, Phase 2.3) | engine-fixed | networked-only, optional-module | Engine | None |
| 2.16 | Lighting adapter (Home Assistant REST/WS, Docker lifecycle) | `lightingService.js` | engine-fixed | networked-only, optional-module | Engine | None |
| 2.17 | Lighting scenes | Home Assistant (runtime fetch) | venue-config | networked-only, optional-module | External | None |
| 2.18 | Cue → scene-ID references (`scene.video`, `scene.game` literals in cues) | `config/environment/cues.json` | **uncertain (Q9)** — game-content referencing venue entities | networked-only, optional-module | Game data hard-bound to one venue's HA entity IDs | Abstract scene *roles* in pack, venue maps role→entity |
| 2.19 | Game clock (start/pause/resume/tick/persist) | `gameClockService.js` | engine-fixed | networked-only (standalone GM has no clock — parity gap) | Engine | None; clock params from game.json (1.21) |
| 2.20 | Cue engine (operators eq/neq/gt/gte/lt/lte/in, EVENT_NORMALIZERS, timelines, clock/video drive modes, hold system, routing inheritance) | `cueEngineService.js` (1169L), `cueEngineWiring.js` | engine-fixed | networked-only, optional-module | Engine; generic | None (3.2g deferred) |
| 2.21 | Cue definitions (incl. token-ID conditions like `policesequencewoverlay`) | `config/environment/cues.json` | game-content | networked-only, optional-module | Already data | Pack `cues.json` |
| 2.22 | Event vocabulary cues can trigger on (`video:loading`, `transaction:accepted`, `gameclock:*`, `music:*`…) | EVENT_NORMALIZERS in `cueEngineService.js`, forwarding in `cueEngineWiring.js` | engine-fixed | networked-only, optional-module | Engine; this vocabulary is part of the engine↔pack contract | Document as the cue-authoring contract in game-pack schema |
| 2.23 | Service health registry (8-service list, 15s revalidation) | `serviceHealthRegistry.js` | engine-fixed (list hardcoded) | networked-only | Engine; registry always contains all 8 even when a venue/game disables a module | Registry should reflect enabled modules (deployment-axis work, not pack) |
| 2.24 | Command gating + resource validation (`SERVICE_DEPENDENCIES`, `validateCommand` checks sound/video/scene/sink existence) | `commandExecutor.js` (780L) | engine-fixed | networked-only | Engine; resource checks resolve against content dirs | Point resource resolution at pack asset dirs |
| 2.25 | Held items (hold/release/discard, 10s auto-cancel) | `cueEngineService` + `videoQueueService` + `buildHeldItemsState()` | engine-fixed | networked-only | Engine | None |
| 2.26 | Scoreboard display control (show/hide kiosk) | `scoreboardControlService.js`, `displayControlService` | engine-fixed | networked-only, optional-module | Engine | None |
| 2.27 | System reset orchestration | `systemReset.js` | engine-fixed | networked-only | Engine | None |
| 2.28 | Offline scan queue (player HTTP scans while no session) | `offlineQueueService.js` | engine-fixed | networked-only | Engine | None |
| 2.29 | Persistence (session files, archives, backup interval) | `persistenceService.js`, storage config | engine-fixed | networked-only | Engine + env | None |
| 2.30 | UDP discovery (port 8888, advertises https) | `discoveryService.js` | engine-fixed | networked-only | Engine + env | None |
| 2.31 | HTTP heartbeat monitoring (30s player timeout) | `heartbeatMonitorService.js` | engine-fixed | networked-only | Engine | None |
| 2.32 | Token loading + transform (raw → engine model) | `tokenService.js` | engine-fixed (mechanism); embeds game logic 1.5/1.8 | required-always (backend) | Engine + embedded formula | Formula moves to rules module; loader points at pack tokens.json |
| 2.33 | Session as source of truth + sync:full assembly | `sessionService.js`, `syncHelpers.js buildSyncFullPayload` | engine-fixed | networked-only | Engine | None |
| 2.34 | Auth (JWT, admin password) | `gmAuth.js`, `middleware/auth.js`, env | venue-config (secrets) over engine-fixed | networked-only | Env; **scoreboard.html hardcodes the admin password** (must match env — flagged defect class) | Fix hardcode (not pack work) |
| 2.35 | Feature flags (`ENABLE_VIDEO_PLAYBACK`, `ENABLE_OFFLINE_MODE`…) | `config/index.js:108-114` | venue-config — but this is the **embryo of the optional-module system** | required-always | Env flags | Evolve into explicit module-enable map (engine), referenced by topology tests |

## 3. WebSocket / HTTP surface (protocol vs game-flavored payloads)

| # | Capability | Where | Variability | Deployment | Current state | Change for pack |
|---|---|---|---|---|---|---|
| 3.1 | Event envelope `{event, data, timestamp}` | `eventWrapper.js`, AsyncAPI | engine-fixed | networked-only | Contract | None |
| 3.2 | `transaction:submit` payload — `mode` enum, `teamId` free string, `deviceType` enum | AsyncAPI, `validators.js` | engine protocol with game-flavored field domains | networked-only | mode enum hardcoded in contract | Contract: mode validated against pack mode list (runtime), schema says `string` |
| 3.3 | `transaction:new` / `transaction:accepted` payloads — `points`, `teamScore{baseScore,bonusPoints,completedGroups}` | AsyncAPI, broadcasts.js | game-flavored shapes (group concepts baked into protocol) | networked-only | Contract assumes group-bonus mechanic exists | Keep shape; semantics defined by pack rules (empty groups OK). Revisit if Q3 says rules vary structurally |
| 3.4 | `group:completed` event | transactionService → broadcasts | game-flavored discrete event | networked-only | Mechanic-specific event name in protocol | Consider generic `bonus:awarded` if Q3 opens rule variety; else keep |
| 3.5 | `player:scan` broadcast + `session.playerScans` persistence | `scanRoutes.js`, sessionService | engine-fixed | networked-only | Engine | None |
| 3.6 | `gm:command` action vocabulary (35+ actions: session/video/music/sound/cue/audio/bluetooth/lighting/held/service) | `adminEvents.js`, `commandExecutor.js`, AsyncAPI | engine-fixed | networked-only | Engine protocol | None |
| 3.7 | `service:state` 10-domain envelope | broadcasts.js `pushServiceState` | engine-fixed | networked-only | Engine | None |
| 3.8 | `sync:full` composition (session, scores, playerScans, gameClock, cueEngine, music, serviceHealth, heldItems, sound, environment) | `syncHelpers.js` | engine-fixed | networked-only | Engine | None |
| 3.9 | `POST /api/scan` (+ `videoQueued`, 409 semantics, video trigger for player scans) | `scanRoutes.js:18-150`, OpenAPI | engine-fixed | networked-only | Engine; embeds policy "player scan triggers video, GM scan never does" — game-configurable? treated engine-fixed (player-scanner role spec) | None unless role spec says otherwise |
| 3.10 | `POST /api/scan/batch` (ESP32, 10 at a time) | `scanRoutes.js`, OpenAPI | engine-fixed | networked-only | Engine | None (replay video semantics = parity-audit item) |
| 3.11 | `GET /api/tokens` (raw token DB serve) | `resourceRoutes.js` | engine-fixed (mechanism) delivering game-content | networked-only | Engine | Becomes pack-content delivery; later carries strings/theme for ESP32 (3.2f) |
| 3.12 | `GET /api/assets/manifest` + BMP/audio asset endpoints | `resourceRoutes.js`, OpenAPI | engine-fixed delivering game-content | networked-only | Engine | Extend manifest with pack strings/theme/config (Phase 3.2f) |
| 3.13 | `/api/session`, `/api/state`, `/api/admin/*`, `/health`, `/api/music/*`, `/api/admin/logs` | route files, OpenAPI | engine-fixed | networked-only | Engine | None |
| 3.14 | Scanner request-schema contract tests | `backend/tests/contract/scanner/request-schema-validation.test.js` | engine-fixed (QA asset) | n/a | Exists | Extend for pack-indirected fields |

## 4. GM Scanner

| # | Capability | Where | Variability | Deployment | Current state | Change for pack |
|---|---|---|---|---|---|---|
| 4.1 | NFC scan + manual entry + fuzzy token lookup | `app.js processNFCRead`, `tokenManager.js`, `nfcHandler.js` | engine-fixed | required-always | Engine | None |
| 4.2 | Networked/standalone mode selection + locking | `sessionModeManager.js` | engine-fixed | required-always | Engine | None |
| 4.3 | Transaction-mode toggle UI ("Detective Mode" indicator, click-to-switch, `?mode=` URL override) | `ALNScanner/index.html:71`, `settings.js`, app.js `toggleMode` | game-configurable (names/count from game.json modes) + game-content (labels) | required-always | Hardcoded 2-mode toggle with hardcoded labels | Render mode selector from pack mode list; labels from strings.json |
| 4.4 | Team entry UI (standalone text input / networked dropdown + Add Team) | teamEntryScreen, `teamRegistry.js`, SessionManager | engine-fixed (per Q5) | required-always | Engine | Driven by game.json team rules if Q5 opens variability |
| 4.5 | Result/history screens | uiManager, screens | engine-fixed + game-content strings | required-always | Hardcoded copy | strings.json |
| 4.6 | Scoreboard screen ("🏆 Black Market Scoreboard", currency, group progress, team details) | `index.html:264`, `uiManager.js renderScoreboard/teamDetails:340-620` | engine-fixed (ranking display) + game-content (title, currency, group copy) | required-always (standalone variant exists) | Branding inline | strings.json + theme.css |
| 4.7 | Standalone storage strategy (sessions, scores, groups in localStorage) | `LocalStorage.js` | duplicated game logic (see 1.27) | standalone-only | Duplicate impl | Shared rules module |
| 4.8 | Networked storage strategy + offline queue + replay | `NetworkedStorage.js`, `networkedQueueManager.js` | engine-fixed | networked-only | Engine | None |
| 4.9 | StateStore (10 service domains) | `stateStore.js`, `networkedSession.js` | engine-fixed | networked-only | Engine | None |
| 4.10 | Admin: Session panel (create/start/pause/resume/end, add team) | `admin/SessionManager.js` | engine-fixed | networked-only | Engine | None |
| 4.11 | Admin: Video panel (transport, queue, manual add by filename, display-mode toggle) | `admin/VideoController.js`, `DisplayController.js`, `VideoRenderer.js` | engine-fixed | networked-only, optional-module | Engine | None |
| 4.12 | Admin: Music panel (transport, volume, shuffle/loop, playlist picker, ducking indicator) | `admin/MusicController.js`, `MusicRenderer` | engine-fixed UI over game-content playlists | networked-only, optional-module | Engine | Playlist names come from pack |
| 4.13 | Admin: Sound panel | `admin/SoundController.js` | engine-fixed over game-content files | networked-only, optional-module | Engine | Sound list from pack |
| 4.14 | Admin: Cue panel (Quick Fire grid, standing cue toggles, active cues) | `admin/CueController.js`, `CueRenderer.js` | engine-fixed UI over game-content cues | networked-only, optional-module | Engine | Cue labels/icons from pack cues.json |
| 4.15 | Admin: Environment (Bluetooth, Audio routing/volume, Lighting scenes) | `BluetoothController/AudioController/LightingController.js`, `EnvironmentRenderer` | engine-fixed (venue runtime ops) | networked-only, optional-module | Engine | None |
| 4.16 | Admin: Service health dashboard + Check Now | `HealthRenderer.js` | engine-fixed | networked-only | Engine | None |
| 4.17 | Admin: Held items queue | `HeldItemsRenderer.js` | engine-fixed | networked-only | Engine | None |
| 4.18 | Game Activity unified view (player discoveries + GM transactions) | `gameActivityBuilder.js`, `MonitoringDisplay.js` | engine-fixed + game-content copy (e.g., "memory" terminology) | networked-only | Engine, copy inline | strings.json |
| 4.19 | Scoring adjustments UI (manual adjust, delete transaction, reset scores) | admin/AdminOperations + uiManager adjustments display | engine-fixed | networked-only | Engine | None |
| 4.20 | Session report generator (markdown download) | `sessionReportGenerator.js` | game-flavored — section titles/columns are an **external contract** (see §8) | networked-only (standalone unsupported — gap) | Hardcoded template; mode names, "Detective Evidence Log", currency baked in | Template/section registry per pack + versioned schema; preserve ALN pipeline contract |
| 4.21 | App branding, titles, evidence-red CSS, screen copy | `index.html`, `src/styles/` | game-content | required-always | Inline, no strings file | strings.json + theme.css (Phase 3.2a) |
| 4.22 | Token DB + scoring-config distribution (nested data submodule, Vite import) | `data/` submodule, `scoring.js:12` | engine-fixed (mechanism) delivering game-content | required-always | Submodule pattern (the proven pack-distribution channel) | Submodule evolves into game pack (D1/Phase 3.4) |
| 4.23 | Connection wizard, JWT validation, state restore | `connectionWizard.js`, `StateValidationService.js`, `jwtUtils.js` | engine-fixed | networked-only | Engine | None |

## 5. Player-scanner role (web PWA + ESP32 — one role, two implementations)

| # | Capability | Where (web / ESP32) | Variability | Deployment | Current state | Change for pack |
|---|---|---|---|---|---|---|
| 5.1 | Scan input → token resolution | `index.html` QR (jsQR)+Web NFC / RFID+NDEF `cleanTokenId` | engine-fixed | required-always | Engine; impl divergence = parity-audit | Role spec |
| 5.2 | Memory content display (image/audio) | `displayMemory` / `TokenDisplayScreen.h` + SD assets | engine-fixed (mechanism) over game-content (assets) | required-always | Engine | Pack assets |
| 5.3 | "Memory" framing & branding (NeurAI title, "Memory Unlocked", "✨ New Memory!", "VIDEO MEMORY TRIGGERED" alert, 📺) | `aln-memory-scanner/index.html:7,19-20,73,565,832-844` / ESP32 screen strings | game-content | required-always | Hardcoded inline (web has NO strings file; ESP32 strings compiled in) | strings.json (web); manifest-delivered strings (ESP32, Phase 3.2f) |
| 5.4 | Video-token behavior (POST scan → orchestrator queues video; alert UI / 2.5s modal) | web `scanToken` + video-alert / ESP32 modal | engine-fixed (role behavior) | networked-only | Engine | Role spec; alert copy → strings |
| 5.5 | Scan reporting `POST /api/scan` (deviceType player/esp32) | `js/orchestratorIntegration.js` / `OrchestratorService.h`, `PayloadBuilder.h` | engine-fixed | networked-only | Engine; contract-tested | None |
| 5.6 | Offline queue + replay (localStorage max-100 / SD `queue.jsonl` + `/api/scan/batch`) | both | engine-fixed | networked-only (queue exists to reach orchestrator) | Engine; replay-semantics parity open | Role spec |
| 5.7 | Standalone deployment stance (web: path-based never-connect; ESP32: none) | web `isStandalone` pathname check / — | **uncertain (Q10)** | standalone-only | Web only; ESP32 has offline-resilient operation but no explicit stance | Decision then role spec |
| 5.8 | Collection/memory log | web localStorage collection / ESP32 absent | engine-fixed (role feature) | required-always | Parity gap (audit item) | Role spec decision |
| 5.9 | Team association | web optional teamId / ESP32 `config.txt TEAM_ID` | engine-fixed | required-always | Engine | None |
| 5.10 | Token/asset sync (submodule+SW cache / wireless manifest sync, sha1, retry) | `sw.js`, `sync.py` / `AssetService.h`, `AssetManifestDiff.h` | engine-fixed | required-always (content must arrive somehow) | Engine | Manifest becomes pack-delivery channel for ESP32 (3.2f) |
| 5.11 | Unknown-token handling (ESP32 local-DB gate refuses send; web behavior TBD) | `TokenService.h` / index.html | engine-fixed | required-always | Parity-audit item | Role spec |
| 5.12 | Connection awareness (backoff monitor / 10s health poll) | both | engine-fixed | networked-only | Engine | None |
| 5.13 | ESP32 device config (`config.txt`: WiFi, orchestrator URL, TEAM_ID, SYNC_ASSETS) | `ConfigService.h` | venue-config | required-always (device) | SD-card config | Add pack-delivered game config alongside (3.2f) |

## 6. config-tool (port 9000)

| # | Capability | Where | Variability | Deployment | Current state | Change for pack |
|---|---|---|---|---|---|---|
| 6.1 | Edit backend `.env` | `lib/configManager.js` envPath, `PUT /api/config/env` | venue-config editor | optional-module (setup-time) | Engine tool | Stays venue surface |
| 6.2 | Edit scoring-config.json | `PUT /api/config/scoring` → `ALN-TokenData/scoring-config.json` | game-configurable editor | optional-module | Tool writes into the (future) pack | Becomes pack editor surface |
| 6.3 | Edit cues.json | `PUT /api/config/cues` | game-content editor | optional-module | Same | Pack editor |
| 6.4 | Edit routing.json (routes + ducking together) | `PUT /api/config/routing` | mixed venue+uncertain (Q8) | optional-module | Edits both concerns in one file | Split when routing.json splits |
| 6.5 | Token browser (read-only) | `GET /api/tokens` | game-content viewer | optional-module | Read-only | Seed of Phase 5 authoring tool |
| 6.6 | Asset upload/delete (sounds, videos) | `POST/DELETE /api/assets/*` → `backend/public/{audio,videos}` | game-content management | optional-module | Writes engine-owned dirs | Point at pack asset dirs |
| 6.7 | Music playlist editor | `GET/PUT /api/music/playlists`, `/api/music/tracks` | game-content editor | optional-module | Edits music-playlists.json | Pack editor |
| 6.8 | HA scene listing | `GET /api/scenes` | venue-config viewer | optional-module | Runtime fetch | Stays venue |
| 6.9 | **Presets** (save/load/export/import bundles of env+scoring+cues+routing) | `lib/routes.js:156-220`, `config-tool/presets/` | **proto-game-pack** — currently bundles venue + game config together | optional-module | Closest existing artifact to a pack; wrong granularity | Restructure: preset = venue profile; pack = separate export. Strong design input for Phase 3 |

## 7. Content pipeline (scripts/)

| # | Capability | Where | Variability | Deployment | Current state | Change for pack |
|---|---|---|---|---|---|---|
| 7.1 | Notion → tokens.json sync | `sync_notion_to_tokens.py` | engine-fixed (pipeline shape) wrapping game/source config | optional-module (authoring-time) | DB UUIDs hardcoded (`:43-44`), SF_ regexes (`:395-401`), element-type filter, owner-relation resolution all inline | Source-adapter interface (3.2e); Notion = adapter #1 with `{dbIds, fieldMap, parseRules}` config |
| 7.2 | SF_ field text-format convention (`SF_RFID: [x]` in description) | sync script regexes + Notion authoring convention | game-content convention (ALN's Notion schema) | optional-module | Rigid regexes | Adapter config |
| 7.3 | Character-name detection (`[A-Z]{2,}` pattern) + timestamp stripping (`TOKEN - TIME - CONTENT`) | sync script `:74-80` | game-content (ALN narrative conventions) | optional-module | Hardcoded patterns | Adapter parse rules |
| 7.4 | NeurAI BMP display generation (240×320, font ladder, NeurAI.png logo, styling) | sync script + `neurai_display_generator.py`, `NeurAI.png` | game-content (theme) | optional-module | Hardcoded theme generation | Theme config in pack (`displayTheme: {logo, fonts, layout}`) |
| 7.5 | Asset manifest generation (sha1, sizes) | `generate_asset_manifest.py` | engine-fixed | optional-module | Engine | None |
| 7.6 | RFID↔file mismatch QA | `compare_rfid_with_files.py` | engine-fixed (QA tool) | optional-module | Engine | Generalize paths to pack dirs |
| 7.7 | Placeholder/QR generators | `generate_placeholder.py`, `aln-memory-scanner/generate-qr.py` | engine-fixed tooling | optional-module | Engine | None |

## 8. Session report → GenAI pipeline handoff (external contract)

| # | Capability | Where | Variability | Deployment | Current state | Change for pack |
|---|---|---|---|---|---|---|
| 8.1 | Report markdown overall assembly (Summary → Detective Evidence Log → Scoring Timeline → Player Activity) | `sessionReportGenerator.js generate()` | game-flavored; **structure is the external contract** consumed by `aboutlastnight/reports` `parseRawInput` | networked-only | Hardcoded template; no schema, no contract test | Versioned report schema + snapshot contract test (Phase 2.6) BEFORE any strings extraction touches it |
| 8.2 | "Detective Evidence Log" table (token ID leftmost; Owner/Exposed By/Time/Evidence) | `_buildDetectiveSection` (~line 100-125) | external contract (pipeline parses exposed token IDs) | networked-only | Renaming heading/columns breaks pipeline silently | Pin via contract test; pack-themed titles must NOT alter the parsed structure (Q11) |
| 8.3 | "Scoring Timeline" table (`Time\|Type\|Detail\|Team\|Amount`; `Type=Sale` rows; `Detail=tokenId/CharacterName`) | `_buildScoringTimeline` (~line 182) | external contract | networked-only | Same | Same |
| 8.4 | "Final Standings" (team name, total, rank, token count) | `_buildSessionSummary` | external contract | networked-only | Same | Same |
| 8.5 | Notion dual-consumption (pipeline fetches token content independently) | external repo | n/a — constraint on 7.1 | n/a | Two Notion consumers | Source-adapter design must serve reports pipeline as 2nd client; Phase 5 content DB likewise |
| 8.6 | Narrative-pipeline config slot (theme/prompt pack per game) | not in this repo | game-content (reserved) | optional-module | Nothing here | Reserve `narrative:` slot in game.json schema |
| 8.7 | Future intake capture (roster, director notes, photos, accusation → session bundle) | planned, Phase 3.3 Game Admin | engine-fixed (capture mechanics) + game-configurable (what to capture) | networked-only | Not built | Design Game Admin UX with capture points; bundle format in report schema |

---

## 9. Top-10 highest-leverage extraction targets

Ranked by (game-specific logic removed) ÷ (refactor effort/risk):

1. **Shared scoring/group-rules module** (rows 1.5-1.7, 1.10, 1.27) — kills the worst duplication (backend `transactionService` vs scanner `LocalStorage`), fixes the bonus-base parity nuance (1.6), and its interface *is* the engine/game seam. Distribute like scoring-config (submodule).
2. **Transaction-mode table → game.json** (1.9-1.12, 4.3) — mode set, labels, per-mode scoring policy, per-mode display behavior. Removes hardcoded `detective`/`blackmarket` from validators, transaction model, scanner toggle, and 2 scoring branches.
3. **Strings/branding extraction** (1.25-1.26, 4.21, 5.3, 6.x labels, scoreboard.html) — HTML/CSS-only, near-zero logic risk, huge surface. Prerequisite: fix the `displayDriver` "Case File" window-title coupling (2.5) first.
4. **Structured group field + tokens.json JSON Schema** (1.8, 1.23) — kills the `"(xN)"` regex parsed in 3+ places; the schema doubles as the Phase 5 authoring contract.
5. **Memory-type enum tightening** (1.3-1.4) — derive enum from pack scoring config, remove duplicated fallback in `config/index.js`, make unknown-type loud. Tiny effort, removes a silent-zero scoring bug class.
6. **deviceType duplicate-policy table → game.json** (1.13-1.16) — replaces ~70 lines of branching in `transactionService.isDuplicate` plus scanner-local mirror with a declarative policy consumed by the shared rules module.
7. **Notion source-adapter config** (7.1-7.3) — DB UUIDs, field map, parse regexes out of `sync_notion_to_tokens.py`; new game = new adapter config, not script rewrite; design for the reports pipeline as second consumer (8.5).
8. **Session-report template registry + versioned contract test** (4.20, 8.1-8.4) — must land BEFORE #3 touches report strings; converts a silent external dependency into a tested contract with a pack-themable layer on top.
9. **config-tool preset split → pack export** (6.9, 6.2-6.7) — presets already bundle config; re-cut them along the venue/pack boundary and config-tool becomes the pack-authoring UI for free.
10. **ESP32 manifest-delivered strings/config** (5.3, 5.13, 3.12) — extend the existing asset-manifest channel to carry pack strings/behavior config; firmware string audit; keeps firmware game-agnostic without per-game flashes.

## 10. Uncertain rows — questions for the owner

Each maps to matrix rows; answers gate the game.json schema (Phase 3.0).

- **Q1 (rows 1.9-1.12) — Transaction modes:** Is sell-vs-expose a fixed engine duality, or should a game be able to define N modes (1, 2, or 3+) each with its own name, scoring policy, and scoreboard behavior? Concretely: could a future game have a third choice like "destroy the memory," or a game with no detective-equivalent at all?
- **Q2 (row 1.5) — Scoring formula shape:** Is `floor(baseValue[rating] × typeMultiplier[type])` the permanent engine formula with games supplying only the tables — or do you foresee games needing structurally different formulas (set-collection points, time-decaying values, per-scan diminishing returns)? Tables-only is dramatically cheaper; say so explicitly if it's enough.
- **Q3 (rows 1.6-1.7, 3.3-3.4) — Group mechanics:** Is "collect every token in a group → multiplier bonus" the only completion mechanic the engine needs (with values configurable), or might games need partial-completion thresholds, ordered collection, or cross-team groups? This decides whether `group:completed` and `TeamScore.completedGroups` stay in the wire protocol as-is.
- **Q4 (row 1.14) — Token exclusivity:** Should first-come-first-served cross-team claiming be a per-game policy switch (e.g., a game where every team can sell the same token), or is one-claim-per-session fixed?
- **Q5 (row 1.17) — Team structure:** Are teams always dynamic freeform-named groups, or do some games need fixed rosters, individual-player identity, team size caps, or pre-registered teams? (Affects session model, GM UI, and report format.)
- **Q6 (row 1.11) — Evidence exposure:** Is "expose ⇒ summary appears publicly on the venue display" fixed second-mode behavior, or per-game configurable (what is shown, where, when)?
- **Q7 (rows 1.25-1.26) — Score presentation semantics:** Does only the presentation vary ($ vs credits vs stars), or also numeric semantics (negative scores allowed, non-monetary point scales, multiple currencies per game)?
- **Q8 (row 2.14) — Ducking ownership:** Are ducking rules (video ducks music to 20%, etc.) part of a game's *show design* (→ game pack) or per-venue audio tuning (→ venue config)? routing.json currently mixes them with venue sink routes.
- **Q9 (row 2.18) — Lighting scene references in cues:** Cues (game content) currently reference concrete Home Assistant entity IDs (`scene.video`). Should packs reference abstract scene *roles* that each venue maps to its own entities, or is one-venue coupling acceptable for now?
- **Q10 (row 5.7) — ESP32 standalone stance:** Should the ESP32 gain an explicit "no orchestrator exists" config (suppress queue/connection status) to mirror the web scanner's standalone mode, or is its de facto offline operation sufficient? (Also resolves the root CLAUDE.md "Standalone: No" doc drift.)
- **Q11 (rows 8.1-8.4) — Report contract vs theming:** When a new game themes the session report, do the three pipeline-parsed table structures stay engine-fixed (section *semantics* versioned, titles fixed) with only ALN consuming the GenAI pipeline — or must the report schema itself be game-variable, forcing the pipeline's parser to take per-game config?
- **Q12 (rows 5.2-5.4) — Player-scanner role variability:** Is the player role fixed at "scan → view memory content (+ maybe trigger video)" for every game, or might games need different player-side interactions (choices, puzzles, multi-step reveals)? Fixed role keeps both implementations (web + ESP32) simple.
- **Q13 (row 1.21) — Game clock:** Is "single elapsed clock + one overtime threshold" enough for all games, or do games need phases/acts (which would also become cue-trigger conditions)?
- **Q14 (row 2.4) — Display surfaces:** Is the IDLE_LOOP / SCOREBOARD / VIDEO display-mode set engine-fixed, or might a game define additional display surfaces (e.g., a second screen, a non-scoreboard idle visual)?

## 11. Classification totals

| Variability | Rows |
|---|---|
| engine-fixed | 62 |
| game-configurable | 17 |
| game-content | 18 |
| venue-config | 7 |
| uncertain | 9 (Q-flagged rows; 14 questions total incl. sub-questions) |
| **Total rows** | **113** (some rows carry a dual primary/secondary class; counted by primary) |

| Deployment | Rows (primary) |
|---|---|
| required-always | 38 |
| networked-only | 55 |
| standalone-only | 3 |
| optional-module | 17 |

Standalone-only is tiny (3 rows: local scoring engine, standalone storage, web standalone stance) but it duplicates the *largest* game-logic rows — which is exactly why the shared rules module is the flagship extraction.

**Cross-cutting observations for Phase 3.0:**
1. The codebase forces a **third config bucket — venue-config** — that the original two-axis plan didn't name. routing.json and config-tool presets currently mix venue and game concerns; the game.json schema must explicitly exclude venue items or packs won't be portable across venues (see Q8/Q9).
2. The **distribution channels already exist**: ALN-TokenData submodule (web scanners + backend) and the asset-manifest API (ESP32). The pack is "more files through the same pipes," not new infrastructure.
3. Two **hidden couplings** will break naive strings extraction: the `displayDriver` xdotool window search on the scoreboard's themed `<title>` (2.5), and the scoreboard.html hardcoded admin password (2.34).
4. The protocol (AsyncAPI/OpenAPI) is mostly engine-clean; game flavor leaks in at exactly four points: the `mode` enum, `group:completed`, `TeamScore` group fields, and the session-report markdown (an undocumented external contract).
