# Documentation Audit — 2026-06-18 (post Phase-2 merge, main @ 9a683d9c)

## Executive summary

| Surface | Health (one line) |
|---|---|
| Root CLAUDE.md | Mostly current; 1 medium (validator count 15→9) + 2 low (Phase-N labels, deviceType `admin` gap). |
| backend/CLAUDE.md | Good, but Admin Commands table omits the entire video:* family (HIGH); several per-service event lists missing 1 event each; Pi 4 H.264 recipe misleading on a Pi 5; stale "Last verified" stamp. |
| ALNScanner/CLAUDE.md | Largest doc-vs-code drift: undocumented `app/domains/` four-domain split + 4 renderers (HIGH); stale bluetooth events + contradictory `window.*` debug snippets. |
| aln-memory-scanner/CLAUDE.md | Key Components describes wrong primary file post module-extraction (HIGH); stale line refs + 2 undocumented test files. |
| arduino-cyd-player-scanner/CLAUDE.md | Archive path + dir tree stale (medium); missing SYNC_ASSETS key; cosmetic line-count drift; dangling root-owned plan path. |
| README / scoring / submodule refdocs | aln-memory-scanner README mislabels itself "GM Edition" (HIGH); SCORING_LOGIC.md cites a deleted file (HIGH); SUBMODULE_MANAGEMENT.md sync-script root-path wrong (HIGH); config-tool README omits Music section (HIGH). |
| backend/contracts/README.md | Heavily stale "target architecture" framing + wrong counts everywhere; service:state (the sole push mechanism) entirely absent (HIGH ×7). |
| backend/backend_docs + tests/*.md | WS quick reference (canonically linked) riddled with fabricated facts (HIGH ×4); multiple orphaned dated snapshots to archive. |
| MEMORY.md + topic files | Over budget (29.6KB > 24.4KB, truncated) (HIGH); Spotify→music staleness throughout (HIGH); dangling wiki-links; contradictory baselines. |
| docs/plans + reviews + decisions | Healthy as history; main issue is organization (3 archive folders, completed plans unarchived) + 1 stale "Open" status marker. |

### Severity tally (confirmed actionable findings only)

| Severity | Count |
|---|---|
| High | 26 |
| Medium | 24 |
| Low | 31 |
| **Total** | **81** |

(Excludes 4 refuted findings and 1 no-defect/positive note.)

---

## HIGH severity — actively misleading

### Group A — backend/contracts/README.md (largest single cluster; the entire file needs a rewrite)

| # | What's wrong (claim → reality) | Concrete fix | Evidence |
|---|---|---|---|
| contracts-01 | "target architecture (24 APIs, 59% reduction)" → contracts are the **live, implemented** API (13 HTTP paths, 25 WS messages, 58 gm:command actions). | Replace the Overview paragraph: drop "target architecture… not necessarily what they currently are" and "(24 APIs total, 59% reduction…)". State they reflect the live implemented API kept in sync via contract tests. | README:23; openapi `^  /`=13; asyncapi 25 messages; GmCommand enum=58. |
| contracts-14 | WebSocket Events section **never mentions service:state** → it is the SOLE push mechanism for all 10 domains. **Biggest single gap.** | Add a prominent `#### service:state (Server → Clients)` subsection: `{domain, state}` envelope, 10 domains (music, video, health, bluetooth, audio, lighting, sound, gameclock, cueengine, held), note it replaced all per-service discrete events. | asyncapi ServiceState L2192, domain enum L2233, 10 DomainState* schemas; service:state only at README:439 in passing. |
| contracts-02 | "16 / 20 WS events" (internally inconsistent), lists removed video:status + non-event display:status, omits service:state etc. → 25 messages. | Fix TOC+header to 25 messages; remove video:status and display:status; add service:state, transaction:result, score:adjusted, scoreboard:page, session:overtime, group:completed, sync:request, cue:fired/completed/error. (Do NOT add gm:identified — not a defined message.) | README TOC L13 "16" vs body L62 "20"; asyncapi L116-2381. |
| contracts-03 | video:status documented as a current broadcast → **removed**; video state rides service:state domain video. | Delete the `#### video:status` section (L395-416) and "Decision #5" (L473-476); replace with a service:state domain:video example. | README:395-416; asyncapi:2200-2204 lists video:status as removed. |
| contracts-06 | gm:command "Available Actions" lists ~16, omits the whole environment/show-control surface → 58 actions. | Replace the block with the full grouped list, or point to the GmCommand enum in asyncapi as source of truth. | asyncapi:1572-1687 = 58 entries; README:432-437. |
| contracts-07 | "8 HTTP endpoints" → 13. Omits /api/assets/manifest, /api/assets/images/{tokenId}.bmp, /api/assets/audio/{tokenId}.{ext}, /api/music/tracks, /api/music/playlists. | Change heading to "HTTP Endpoints (13)" and add the 5 missing endpoints. | openapi 13 paths (L232/319/370/1223/1292 are the missing 5); README:12/51/114 say "8". |

### Group B — backend_docs WebSocket references (canonically linked from backend/CLAUDE.md)

| # | File · what's wrong → reality | Concrete fix | Evidence |
|---|---|---|---|
| backenddocs-01 | WEBSOCKET_QUICK_REFERENCE.md — video:status, `groupBonusInfo` on the wire, room "gm-stations", a heartbeat→heartbeat:ack WS event, and `handleSyncRequest` → none exist. Room is `gm`; payload field is `teamScore`; heartbeat is HTTP /health polling; sync:request is an inline server.js:75 handler. | video:status→service:state(domain video); `groupBonusInfo`→`teamScore` (L14, L78-80); every `gm-stations`→`gm`; delete the heartbeat row (L29); sync:request handler → "inline server.js:75". | broadcasts.js:210 `teamScore`; gmAuth.js:93 `socket.join('gm')`; heartbeatMonitorService.js:5; server.js:75. |
| backenddocs-02 | Same file — "gm:command 11 action types", "DUPLICATE_TRANSACTION 1-hour window", stateService.js as a key file → 50 actions; per-session global rejection with **no time window**; stateService.js **deleted**. | Point "11 types" → backend/CLAUDE.md Admin Commands; rewrite DUPLICATE_TRANSACTION as per-session global (no window), remove L264 "1 session hour"; delete the stateService.js row. | commandExecutor cases=50; duplicatePolicy.js:5 "Two rules, both per-session"; stateService only a comment in listenerRegistry.js:106. |
| backenddocs-05 | WEBSOCKET_TESTING_GUIDE.md — a copy-paste **heartbeat test pattern (L177-187) that hangs forever** (no such WS event), plus video:status broadcast/perf rows and "11 types". | Delete the heartbeat pattern + "keep-alive" line; replace with a real client event (gm:command→gm:command:ack); remove video:status (L157, L389)→service:state; fix "11 types" pointer. | no heartbeat handler in src; commandExecutor cases=50. |
| backenddocs-14 | **All four WS docs** describe per-event broadcasts and never mention service:state (0 hits ×4) → it is the sole push mechanism (50ms per-domain debounce, video:failed bypass). | Add a "Unified service:state" section to WEBSOCKET_QUICK_REFERENCE.md (10 domains, envelope, 50ms debounce + `advanceTimersByTime(51)` gotcha, list of remaining discrete events). | broadcasts.js:487-528; backend/CLAUDE.md "Unified service:state Pattern". |
| backenddocs-03 | WEBSOCKET_QUICK_REFERENCE.md is the file backend/CLAUDE.md (L14, L207) points developers to, yet contains the above. | **EDIT in place** (do NOT archive) — apply 01/02/14. | backend/CLAUDE.md:14, :207. |

### Group C — other HIGH items

| # | File · claim → reality | Concrete fix | Evidence |
|---|---|---|---|
| backend-02 | backend/CLAUDE.md Admin Commands table: 30 actions documented → commandExecutor implements **50**. Omits the entire `video:*` family + bluetooth:*, audio:route:set, lighting:*, cue:pause/resume/stop, display:scoreboard/status, music:seek, scoreboard:page:*, score:adjust/reset, transaction:create/delete, system:reset. | Add the missing rows (at minimum the central video controls) or relabel the table as a representative subset. | `grep case` commandExecutor.js = 50; table at CLAUDE.md:287-312. |
| gmscanner-02 | ALNScanner/CLAUDE.md src/ tree + Module Responsibilities omit `src/app/domains/` → a real four-domain split (environment/gameAdmin/gameOps/showControl) is constructed and delegated to by App. | Add an `app/domains/` subsection documenting GameOpsDomain (NFC/scan pipeline, team entry, transactions, scoreboard/history nav, score interventions), ShowControlDomain (video transport+queue, display mode), GameAdminDomain (session lifecycle, report download, system reset), EnvironmentDomain (bluetooth/audio/lighting/music boundary); note App is the single DI point. | app.js:28-31 imports, :78-81 instantiates; domain docblocks. |
| gmscanner-03 | ALNScanner/CLAUDE.md renderers/ tree lists 6 → also has EvidencePickerRenderer, GameAdminRenderer, GameOpsRenderer, MusicRenderer. | Add the 4 renderers (MusicRenderer = MPD playback/playlist/ducking; EvidencePickerRenderer = scoreboard-evidence character picker; GameOps/GameAdminRenderer = UIManager domain-split extractions). | uiManager.js:18-19/55-56; MonitoringDisplay.js:8/29; main.js:126/128. |
| gmscanner-04 | ALNScanner/CLAUDE.md L712 "BluetoothController Events: `bluetooth:device`, `bluetooth:scan`" → those events **do not exist** (removed in Unified State); controller emits commands only. | Delete the Events line; replace with "State via `service:state` domain `bluetooth`; commands are bluetooth:scan:start/stop, pair, unpair, connect, disconnect." | no `bluetooth:device`/`bluetooth:scan` event-form in src/tests; BluetoothController.js:29-77. |
| playertoken-01 | aln-memory-scanner/CLAUDE.md: "index.html is a SPA with ~950 lines of embedded JS containing MemoryScanner" → index.html is 176 lines of markup; MemoryScanner is in `js/app.js:14`; rendering in `js/tokenDisplay.js`. | Rewrite the index.html bullet as a thin shell loading js/scannerCore.js, js/tokenDisplay.js, js/app.js, js/orchestratorIntegration.js; add component entries for app.js + tokenDisplay.js. | wc -l index.html=176; app.js:14/547; sw.js:2 "phase2 module extraction". |
| refdocs-01 | aln-memory-scanner/README.md titled "GM Edition" / "This GM scanner…" → this repo is the **Player** Scanner (submodule URL = ALNPlayerScan). | Retitle "Player Edition"; rewrite line 3 to describe a player PWA (scan QR/NFC → reveal image/audio + orchestrator-triggered video); "GM Tools" → "Token management & playtest tools". | .gitmodules ALNPlayerScan; README:1/3/20. |
| refdocs-02 | config-tool/README.md omits the wired "Music & Playlists" section + /api/music routes. | Add a "### Music & Playlists" section; add music.js/musicModel.js to the architecture tree; add GET /api/music/tracks, GET/PUT /api/music/playlists to the API Reference. | app.js:12; index.html:34/91; sections/music.js; routes.js:249/261/273. |
| refdocs-04 | docs/SCORING_LOGIC.md Implementation Locations cites `ALNScanner/src/core/dataManager.js` (**does not exist**) + 4 stale line ranges. | Replace the table with symbol references: backend config (game.valueRatingMap/typeMultipliers), backend group logic (gameRules/scoring.js isGroupComplete/groupBonusAmount, adapted by transactionService.processScan), GM config (core/scoring.js SCORING_CONFIG), GM group logic (core/storage/LocalStorage.js `_checkGroupCompletion`). Drop the "Lines" column. | dataManager.js absent; LocalStorage.js:363/398-399; gameRules/scoring.js:76/112. |
| refdocs-05 | SUBMODULE_MANAGEMENT.md: `npm run sync*` shown run from repo root → **no root package.json**; scripts live in backend/package.json:70-77, so root invocation fails. | Add a note atop Quick Commands: "these sync scripts live in backend/package.json — run from backend/ (no root package.json), e.g. `cd backend && npm run sync`." | no root package.json; backend/package.json:70-77; doc:53-91 uses bare npm run. |
| memory-01 | MEMORY.md L109: service:state domains listed as "(spotify, …)" → domain is **music**; no 'spotify' anywhere in backend. | Replace "(spotify, video, …" with "(music, video, health, bluetooth, audio, lighting, sound, gameclock, cueengine, held)". | broadcasts.js:495/502 `domain:'music'`; no spotify in backend/src. |
| memory-02 | MEMORY.md L75 renderer list includes "SpotifyRenderer" → it's **MusicRenderer.js**; no SpotifyRenderer exists. | Replace "SpotifyRenderer" with "MusicRenderer". | ls renderers/ = MusicRenderer.js; no spotify in ALNScanner/src. |
| memory-03 | MEMORY.md L106-108: three bullets describe spotifyService single-authority/D-Bus-debounce → spotifyService.js **deleted**; music is musicService.js via mpd2 over a **Unix socket** (not D-Bus). | **Delete** the three Spotify bullets (durable MPD lessons already at L171-184; a rewrite would invent facts). | spotifyService.js absent; musicService.js:45 extends EventEmitter, :96-101 mpd2 Unix socket. |
| memory-06 | MEMORY.md is **30292 bytes (~29.6KB) vs 24.4KB budget** → harness truncates it (cut off mid-"Project Patterns"); 47 lines >200 chars. | Cut under budget: move long narrative bullets (89, 109, 122-128, 180, 184, 187, 189) into topic files leaving one-line pointers. Worst offender is L184 (663 chars). | wc -c=30292; awk length>200=47; harness warning fired. |

---

## MEDIUM severity — stale / incorrect

### backend/CLAUDE.md — per-service event lists each missing 1 event, plus singleton/factory gaps

| # | Claim → reality | Fix |
|---|---|---|
| backend-01 | Service Singleton table omits scoreboardControlService (real EventEmitter singleton). | Add a row: scoreboardControlService — passthrough for GM scoreboard page-nav commands (emits scoreboard:page:requested → broadcast scoreboard:page). |
| backend-03 | "7 shared mock factories" → 8 (musicService missing). | Append `, musicService` to the list on L86. |
| backend-09 | Pi 4 H.264 (`-c:v h264`) re-encode recipe leads, contradicting the Pi 5 HEVC-only requirement that immediately follows. | Retitle the Pi 4 section "Legacy Pi 4 (not current deployment)" / remove it; add a one-line pointer that the active deployment is Pi 5 (HEVC-only). |

### gmscanner / contracts / config-tool / submodule (medium)

| # | File · claim → reality | Fix |
|---|---|---|
| gmscanner-01 | ALNScanner/CLAUDE.md L474 "GOTCHA": array is inside `_setupMessageHandlers()` and collapses transaction:* / omits scoreboard:page → it's the exported const `MESSAGE_TYPES` (orchestratorClient.js:24-47); contains transaction:result/new/deleted + scoreboard:page; per-event routing now in src/network/messageRouters.js. | Rename to `MESSAGE_TYPES` (exported const at top); add scoreboard:page, transaction:result, transaction:deleted; note routing lives in messageRouters.js. |
| gmscanner-08 | Admin Layer omits ScoreboardController + many live actions (cue:pause/resume/stop, held:release-all/discard-all, music:setVolume/setShuffle/setLoop/loadPlaylist, scoreboard:page:*). | Add ScoreboardController (scoreboard:page:next/prev/owner); expand Show Control/Environment gm:command coverage with the above. |
| gmscanner-10 | Network Layer list omits src/network/messageRouters.js (gameOpsRouter/gameAdminRouter/showControlRouter/sharedInfraRouter, iterated by NetworkedSession._messageHandler). | Add messageRouters.js to the Network Layer list. |
| gmscanner-12 | Debugging section provides `window.connectionManager`/`Settings.mode`/etc. console snippets while the same section states modules are NOT on `window` → contradictory; all snippets error at the console. | Remove/mark the `window.*` and bare-global snippets (L766-831) as "pre-migration, no longer available"; point to in-app debug view / DevTools breakpoints; also fix the stale docstring at initializationSteps.js:51. |
| contracts-04 | gm:command:ack payload `{action, success, message}` is never documented. | Add a subsection documenting the payload and that state changes arrive via service:state (no result.data). |
| contracts-05 | transaction:submit Flow steps 3+4 imply two transaction:new broadcasts → broadcast **once**, enriched with teamScore. | Collapse to a single step: "broadcasts a single transaction:new (enriched with teamScore)". |
| contracts-08 | References contracts/MIGRATION-GUIDE.md (×3) → file **does not exist**. | Remove from file tree (L48) + the two refs (L524, L573); fold notes into Breaking Changes. |
| contracts-10 | Eliminated-Events list predates the unified-state removals. | Add: video:status + all per-service discrete state events (gameclock:status, bluetooth:device, lighting:scene, audio:routing, held:*, cue:status, audio:ducking:status) — replaced by service:state. |
| contracts-11 | "ajv validation coming in Phase 6" → already implemented. | Point to tests/helpers/contract-validator.js (validateHTTPRequest/Response); remove/label-historical the 30-40/5-10 target counts. |
| refdocs-03 | config-tool/README.md "27 tests / 2 files" → 5 files, ~96 invocations. | Update to "~96 tests… (run `npm test` for the live count)"; add routes/conditionBuilder/musicModel test files to the tree. |
| refdocs-06 | SUBMODULE_MANAGEMENT.md omits arduino-cyd-player-scanner (a 4th branch-tracked submodule). | Add it to the Repository Structure tree and the "configuration is set for" list. |
| refdocs-07 | ALNScanner/README.md: "Vite 5.x" → 7.2.2; "598 tests" ×5 → far stale; SUBMODULE_INFO.md link → file absent. | "Vite 7.x"; replace 598 with "~1.3k unit tests (run `npm test`)"; remove/repoint the SUBMODULE_INFO.md link. |
| refdocs-08 | ALNScanner/README.md Type Multipliers omit Mention 3x + Party 5x; Base Values "$100-$10,000" → $10,000-$150,000. | Add Mention/Party; fix base range to "$10,000-$150,000 per token (per star rating)". |

### esp32 / player-token / memory (medium)

| # | File · claim → reality | Fix |
|---|---|---|
| esp32-01 | arduino CLAUDE.md cites top-level `ALNScanner1021_Orchestrator/` → now under `archive/` (which the tree omits). | Replace L53 with an `archive/` entry summarizing its contents. |
| esp32-02 | services/ / ui/screens/ / hal/ trees omit AssetService.h, AssetManifestDiff.h, BatchId.h, PayloadBuilder.h, ScanResponse.h, ScanFailedScreen.h, NDEFParser.h. | Add the 7 source files to the tree. |
| esp32-05 | config.txt key list omits SYNC_ASSETS (a real first-class key the parent CLAUDE.md tells operators to check). | Add `SYNC_ASSETS=true   # false to skip BMP/audio asset sync (first boot ~30-40 MB)` after SYNC_TOKENS. |
| playertoken-02 | "Fallback Chain (index.html:~193)" → now in js/app.js loadTokens(). | Change to "(js/app.js, loadTokens())"; drop the line number. |
| playertoken-03 | "two test files" → four (app.test.js + tokenDisplay.test.js undocumented). | Add the two test files with one-line descriptions. |
| playertoken-07 | ALN-TokenData/CLAUDE.md File Structure omits tokens.schema.json (contract-enforced). | Add `tokens.schema.json` to the File Structure block. |
| memory-04 | MEMORY.md L89 ProcessMonitor: "mprisPlayerBase (VLC + Spotify D-Bus monitors)" → mprisPlayerBase is VLC-only; list omits musicService (its own ProcessMonitor for MPD). | Change to "mprisPlayerBase (VLC D-Bus playback monitor)" and add "musicService (MPD process)". |
| memory-07 | comms_fixes_plan_execution.md (54KB) is a one-time plan-execution log stored as durable memory. | Relocate out of the memory store (plan+detail already in docs/plans/); distill durable lessons into finding_alnscanner_test_gotchas.md; keep a one-line pointer. |
| memory-11 | MEMORY.md L131-134 + L14-21 are completed-milestone dumps; L134 baseline (1557/1116) contradicts the current L24 baseline (~2104/~1368). | Collapse "Open Items COMPLETED" to a one-line pointer (drop L134 numbers); trim the 2026-02-09 audit section to durable lessons. |
| backenddocs-04/07/08/09/10 | Deep-dive/index/snapshot WS docs carry removed events (score:updated, video:status, GameState, stateService); E2E_TEST_HELPERS has 2 stale listener examples; several are orphaned dated snapshots. | See Low/organization (archival) + targeted edits below. |

### deploy — DEPLOYMENT_GUIDE.md medium cluster (Pi-OS paths + offline flag)

| # | Claim → reality | Fix |
|---|---|---|
| deploy-06 | `ENABLE_OFFLINE_MODE` documented as a config key → **not recognized anywhere** in backend/src. | Remove the entry (L206-210) and its .env appearances (L143, L324); note the offline GM queue is always active. |
| deploy-08 | "Edit /boot/config.txt" → on this Pi 5 (Bookworm) the live file is /boot/firmware/config.txt (the bare path is a 91-byte stub). | "Edit /boot/firmware/config.txt (Bookworm; older releases used /boot/config.txt)". |
| deploy-09 | "Edit /etc/dhcpcd.conf" → Bookworm uses NetworkManager; the file doesn't exist. | Replace with `nmcli con mod … ipv4.method manual` / `nmtui` guidance. |
| deploy-10 | Manual VLC test uses `--extraintf http` + `curl :8080/requests/status.json` → control is D-Bus MPRIS. | Replace with the D-Bus MPRIS `Peer.Ping`; relabel the http-launch as a standalone sanity test only. |
| deploy-11 | "grep args: ecosystem.config.js / --intf qt --extraintf http" → no VLC app/args in ecosystem.config.js. | Point to vlcMprisService._getHwAccelArgs (`--vout=gles2` on Pi 5); check `pgrep -x cvlc` + D-Bus ping. |
| deploy-12 | "VLC Control http://[IP]:8080" listed as an endpoint + firewall opens 8080/tcp "VLC HTTP" → nothing listens on 8080. | Remove all 8080 rows (L467/725/1188) and ufw/firewalld 8080 rules (L827/832); keep 3000/8000/8888. |
| deploy-14 | "MPD undocumented outside install step" (partly overstated) → genuinely missing: PID file /tmp/aln-pm-mpd.pid, config/music-playlists.json hot-reload, /tmp/aln-mpd.db wipe-on-reboot, and any MPD entry in Troubleshooting/Health sections. | Add a "Music (MPD)" troubleshooting subsection for those specifics; cross-link the existing socket/aln-music/music:seed details. |

---

## LOW / organization

### Cosmetic count/line drift (drop hard numbers or hedge with "run the suite")

| # | File · drift |
|---|---|
| backend-04 | getState.test.js 19→18; service-state-push.test.js 13→11 (L484). |
| backend-05 | transactionService event list (L163) omits transaction:deleted. |
| backend-06 | sessionService event list (L162) omits session:started, session:overtime. |
| backend-07 | gameClockService event list (L169) omits gameclock:stopped. |
| backend-08 | audioRoutingService event list (L167) omits routing:error, ducking:changed, ducking:failed. |
| gmscanner-06 | "1364 unit tests, 69 suites" (L30) → ~1372/70 (L171 already hedges). |
| esp32-03 | 7 inflated per-file line counts (Application.h 1645 vs ~1375, etc.). Prefer dropping counts for role descriptions. |
| refdocs-09 | DOCUMENTATION_INDEX.md "759 tests" — disagrees with CLAUDE.md (1364) and README (598); hedge all three. |
| memory-10 | external-state-propagation.test.js "10 tests" → 8 (L103). |
| memory-12 | Three competing test baselines (L24/L114/L134) — keep only dated L24, mark "~/needs re-count". |

### Stale line refs (replace with function/symbol names per project convention)

| # | File · ref |
|---|---|
| playertoken-05 | orchestratorIntegration.js:19 → constructor (actual code at :34). |
| esp32-04 | Application.h initializeEarlyHardware() "line ~697" → use function name only (actual :838). |
| deploy-04 | connectionManager.js:47 → constructor default at :26; use symbol ref. |
| deploy-05 | scoreboard.html "(line ~440)" → CONFIG block ~L770; say "search for `const CONFIG`". |

### Stale "Last verified" stamps (refresh after the corresponding fix batch)

backend/CLAUDE.md (2026-03-01, **backend-10**), aln-memory-scanner/CLAUDE.md (2026-02-06, **playertoken-06**), ALN-TokenData/CLAUDE.md (2026-02-06, **playertoken-08**), contracts/README footer (2025-09-30 + Phase 5/6 labels, **contracts-13**).

### Phase-N labels & minor wording

- **root-02**: drop "Phase 3 features"/"Phase 2 adds" prefixes (violates the standing anti-Phase-N MEMORY rule); use descriptive names.
- **root-03**: optional deviceType note that GM WS connections may identify as `admin` but are recorded as `gm`; HTTP scan accepts only player/esp32.
- **gmscanner-09**: "CommandSender.sendCommand()" → "the shared `sendCommand()` helper from src/admin/utils/CommandSender.js".
- **esp32-06**: serial-command table add FORCE_OVERFLOW, HELP, MEM (built-ins).
- **esp32-07**: remove dangling root-owned `/root/.claude/plans/bright-hopping-rossum.md` path.
- **esp32-08**: note ORCHESTRATOR_URL accepts https:// and auto-upgrades http://→https://.
- **deploy-04/05/13**: deploy-13 — note prestart also runs `desktop-control.sh stop`, and `npm run stop` restores it.
- **contracts-09**: Support-section docs/api-alignment/ paths → docs/ARCHIVE/api-alignment/.
- **contracts-12**: add a note that /api/scan also has a rejected branch (waitTime) + SESSION_NOT_FOUND/SERVICE_UNAVAILABLE.
- **backenddocs-06**: WEBSOCKET_TESTING_GUIDE.md L16 "(this file)" mislabels the quick-reference bullet.

### Archival candidates (orphaned / dated snapshots — not linked from any CLAUDE.md)

| # | File · action |
|---|---|
| backenddocs-09 | README_WEBSOCKET_ANALYSIS.md (Generated 2025-10-27, describes deleted GameState/stateService) — **DELETE/ARCHIVE** (orphaned). |
| backenddocs-10 | backend/docs/TEST_COVERAGE_SUMMARY.md (branch snapshot 2025-11-06) — **ARCHIVE**. |
| backenddocs-11 | backend/tests/ISOLATION_ISSUES.md (2025-10-30, dead stateService snippet) — **ARCHIVE**. |
| backenddocs-12 | backend/tests/RESET_APPROACH_COMPARISON.md (dead stateService.reset()) — **ARCHIVE to decisions/**. |
| backenddocs-13 | backend/tests/UNIT_TEST_ANTI_PATTERNS.md (2025-10-29, vlcService.test.js gone) — **ARCHIVE**; fold Iron Laws into CLAUDE.md if desired. |
| backenddocs-04 | WEBSOCKET_ANALYSIS.md (60KB, self-flags as lagging; 14× score:updated, 5× video:status, 21× gm-stations) — **ARCHIVE** + repoint/remove the backend/CLAUDE.md:15 "Deep Dive" link. |
| deploy-07 | DEPLOYMENT_GUIDE.md lists vlc-error.log/vlc-out.log (0-byte legacy) — remove or annotate as legacy. |

### docs/plans + reviews organization

| # | Action |
|---|---|
| plans-01 | **Three sibling archive folders** (docs/archive/, docs/ARCHIVE/, docs/archives/) fragment archived material (and would collide on a case-insensitive FS). Consolidate into docs/ARCHIVE/; delete the empty two; document the casing in CLAUDE.md. **(only medium-severity item in this surface)** |
| plans-04 | ~25 completed-and-merged 2026-02..04 plans (service-health, code-simplification, unified-state, test-architecture, etc.) sit beside live Phase 3 work — move to docs/ARCHIVE/ (do not rewrite). |
| plans-05 | ~34 pre-cutover Spotify plans are correct dated history (superseded by the 2026-05-20 music-cutover-review) — archive alongside plans-04; no content rewrite. |
| refdocs-10 | CHANGELOG.md stops at 2026-05-21 (~4 weeks before HEAD). Add a 2026-06-18 entry (5 show-control fixes + submodule re-pin) or note post-cutover history lives in docs/plans/reviews. |
| memory-08/09 | Dangling wiki-links: [[finding-subagent-driven-development-drift]], [[mpd2-sendcommands-returns-string]]/[[mpd2-sendcommands-string]] resolve to no file. Extract the inline MEMORY.md sections (L164-169, L171-176) into topic files and fix the links, or point links at the section headings. |

---

## Cross-surface issues

The same underlying stale fact appears in multiple files. Fix these as single batches so one correction propagates everywhere.

### X1 — Spotify → MPD/music migration (the dominant cross-cutting fact)

Spotify was fully replaced by MPD (`musicService.js` via mpd2 over a Unix socket; `spotifyService.js` deleted; service:state domain `spotify`→`music`; renderer `SpotifyRenderer`→`MusicRenderer`). Files still carrying Spotify/old-music facts:

- MEMORY.md L75 (SpotifyRenderer), L106-108 (Spotify single-authority bullets), L89 (mprisPlayerBase "+ Spotify"), L102 + L109 ("spotify" domain / "Spotify timeout") — **memory-01/02/03/04/05**
- backend/contracts/README.md (eliminated-events list, music endpoints) — **contracts-10, contracts-07**
- config-tool/README.md (Music & Playlists section) — **refdocs-02**
- ~34 docs/plans/*spotify* + reviews — **plans-05** (archive, no rewrite)

### X2 — VLC is D-Bus MPRIS, NOT an HTTP-controlled PM2 app

No VLC_HOST/PORT/PASSWORD; no 8080 interface; VLC spawned by ProcessMonitor inside vlcMprisService (not PM2). Files:

- DEPLOYMENT_GUIDE.md — **deploy-01, 02, 03, 07, 10, 11, 12** (the largest cluster: .env keys, PM2 framing, dead npm scripts/menu option, vlc logs, manual test, troubleshooting grep, 8080 endpoint+firewall)
- backend/backend_docs WS docs — video:status removed (rides service:state domain video) — **backenddocs-01, 03, 04, 05, 07**

### X3 — `service:state` is the SOLE push mechanism (10 domains) — absent from doc surfaces

Present in backend/CLAUDE.md + asyncapi, missing from: contracts/README (**contracts-14, 02, 03**), all four backend_docs WS files (**backenddocs-14**), and the MEMORY.md domain list mislabels it (**memory-01**).

### X4 — `commandExecutor.js` implements **50** gm:command actions (not 11/16/30)

The action count is understated in three places: backend/CLAUDE.md Admin Commands table (30, **backend-02**), contracts/README "Available Actions" (~16, **contracts-06**), and backend_docs WS docs ("11 types", **backenddocs-01/02/05**). Single source of truth = the GmCommand enum in asyncapi.yaml; point docs at it.

### X5 — `stateService.js` / `GameState` are DELETED

Still referenced as live in backend_docs WS docs and tests/*.md — **backenddocs-01, 02, 04, 09, 11, 12, 13**. (Handled by the archival batch + WEBSOCKET_QUICK_REFERENCE edits.)

### X6 — ALNScanner unit-test count disagreement (759 / 1364 / 598 / static ~1.3k)

Three docs, three numbers, none matching the static count — **gmscanner-06, refdocs-07, refdocs-09**. Adopt one hedged phrasing ("~1.3k; run `npm test` for the live count") across CLAUDE.md, README, DOCUMENTATION_INDEX.

### X7 — Stale absolute line-number references (project convention is symbol/function names)

playertoken-02/05, esp32-04, deploy-04/05, backend-05/06/07/08 line drift, gmscanner-01. Batch with the "drop line numbers, use symbol names" rule.

---

## Possibly-still-open follow-ups (from plans/reviews) — VERIFY BEFORE ACTING

| Item | Status from plans pass | Verify |
|---|---|---|
| **comms-deferred item D** | vite.config.js:17 still uses cwd-relative `readFileSync('./sw.js')` — genuinely open low/nit (plans-03). | Confirm at ALNScanner/vite.config.js:17 before touching. |
| **comms-deferred item F** | ALNScanner/sw.js:56 still uses `caches.match('./')` offline-nav tertiary fallback — genuinely open low/nit (plans-03). | Confirm at sw.js:56. |
| **comms-deferred item C** | **Resolved** — suites consolidated to sw-artifact.test.js (swArtifact.test.js gone). Annotate the doc as DONE; no code action. | — |
| **system-reset-ci-isolation** | **Resolved** — un-quarantined in commit 1cd13f95; test now plain `it(...)` at line 211. Doc still says "Status: Open" (plans-02). | Flip the status marker / archive the doc. |
| initializationSteps.js:51 docstring | Stale "Depends on window.sessionModeManager" (gmscanner-12). | Fix alongside the debug-snippet cleanup. |

No other high-severity open code action items surfaced; the newest Phase 3 proposals/program docs are legitimately Draft/Proposed future work.

---

## Recommended fix batches (approve batch-by-batch)

Ordered roughly by impact and to group same-fact edits. "(pure doc)" = no memory edits; "(memory)" = touches the auto-memory store.

1. **MEMORY.md trim + Spotify→music + dangling links (memory)** — memory-01..12. Highest priority: the file is over budget and truncating. Trim under 24.4KB, fix the music-domain/renderer/ProcessMonitor facts, relocate comms_fixes_plan_execution.md, fix wiki-links, dedupe baselines. *(memory)*
2. **contracts/README.md rewrite (pure doc)** — contracts-01..14. Reframe target→live; add service:state; fix 13 endpoints / 25 messages / 58 actions; remove video:status + MIGRATION-GUIDE refs; fix ack/flow/eliminated-events; refresh footer. The single most-stale file.
3. **backend_docs WS sweep (pure doc)** — backenddocs-01..14. Edit-in-place WEBSOCKET_QUICK_REFERENCE + TESTING_GUIDE + E2E_TEST_HELPERS (room=gm, teamScore, remove heartbeat pattern, 50 actions, add service:state); ARCHIVE the 5 orphaned dated snapshots; repoint the CLAUDE.md "Deep Dive" link.
4. **DEPLOYMENT_GUIDE.md VLC-HTTP + Pi-OS sweep (pure doc)** — deploy-01..14. Remove the VLC HTTP/8080/PM2 framing + dead npm scripts; fix /boot/firmware + NetworkManager paths; add MPD troubleshooting.
5. **ALNScanner/CLAUDE.md structure refresh (pure doc)** — gmscanner-01..12. Document app/domains + 4 renderers + messageRouters + ScoreboardController; fix bluetooth events; remove contradictory window.* debug snippets; rename MESSAGE_TYPES.
6. **backend/CLAUDE.md fixes (pure doc)** — backend-01..10. Add video:* to Admin Commands table; add scoreboardControlService + musicService; complete 4 event lists; relabel Pi 4 section; refresh stamp.
7. **README/scoring/submodule refdocs (pure doc)** — refdocs-01..10. Retitle Player README; add config-tool Music section; rewrite SCORING_LOGIC.md locations table; fix submodule root-path + 4th submodule; Vite 7.x + test-count hedges; CHANGELOG entry.
8. **Player-token + ALN-TokenData CLAUDE.md (pure doc)** — playertoken-01..08. Rewrite index.html Key Components; fix fallback/detection refs; add 2 test files + tokens.schema.json; refresh stamps.
9. **ESP32 CLAUDE.md (pure doc)** — esp32-01..08. Fix archive path + dir tree; add SYNC_ASSETS + serial commands; drop dangling plan path + inflated line counts.
10. **docs/ archive consolidation (pure doc)** — plans-01/02/04/05. Merge the three archive folders into docs/ARCHIVE/; archive completed 2026-02..04 plans + Spotify plans; flip the system-reset "Open" status.
11. **Root CLAUDE.md polish (pure doc)** — root-01/02/03. Validator count 15→9; drop Phase-N prefixes; optional deviceType `admin` note.

Batches 2-11 are pure documentation edits and can be parallelized/reordered freely. **Batch 1 is the only one that touches the auto-memory store** and should be done first (the truncation actively degrades every future session).

---

## Refuted / not-confirmed (transparency)

| # | Finding | Why not actionable |
|---|---|---|
| gmscanner-05 | "`getTeamCompletedGroups()` returns [] pending F-GMS-02; networked is wired via NetworkedStorage." | The doc's behavioral claim ("returns []") is **correct** — NEITHER LocalStorage nor NetworkedStorage implements the method; the UDM fallback `return []` fires in both modes. Only optional cleanup: drop the dead "F-GMS-02" id. |
| gmscanner-07 | "verify-merge-ready.sh '8-phase' is an unbacked claim." | The "8-phase" label IS backed (`[1/8]`..`[8/8]`). Real (separate) issue is the **script** is stale (references deleted standaloneDataManager.js, hardcodes /598) — a script fix, not a doc inaccuracy. |
| gmscanner-11 | "`python3 sync.py` is wrong/unverified." | sync.py exists and works as documented (git-submodule sync wrapper). No inaccuracy; optional clarity note only. |
| (backenddocs-07 partial) | "videoFile payload key is stale → should be videoPath" and "'11 types' present in E2E_TEST_HELPERS." | **Both refuted**: commandExecutor.js:265 destructures `videoFile` (doc is correct); "11 types" appears 0× in that file. Only the 2 stale video:status/video:queue:update listener examples are the real (confirmed) defect. |
| refdocs-11 / SCORING_LOGIC formula | "Group bonus formula / values." | **No defect** — formula and values match both implementations; logged as a positive. Only the Implementation Locations table (refdocs-04) is stale. |