# Map: the other clients, and how tests share the machine

Reader output for the architecture pass. Read-only survey; the only file written is this one.

- Code state: branch `claude/nice-curie-hescfv`. The task named commit `26fc2f2`; HEAD at read time was `4000c99`. `git diff --name-only 26fc2f2 HEAD | grep -vc "^docs/"` returned `1` (CONTEXT.md only), so the code read is the code at `26fc2f2`. Submodule pins read: ALN-TokenData `6f9bc30`, ALNScanner `e83723c`, aln-memory-scanner `e0bf299`, arduino-cyd-player-scanner `f81aba5` (`git submodule status`). Nested `aln-memory-scanner/data` is pinned at `15d8d2e`, not `6f9bc30` (section 1.2).
- Commands run: `cat`, `sed`, `awk`, `grep`, `find`, `ls`, `wc`, `python3` (to count JSON), `git show`, `git log`, `git status`, `git submodule status`, `git branch -a`, `git merge-base`, `git rev-parse`, and one `git fetch --dry-run` (it printed one new remote branch and changed nothing). No server, test, service or subagent was started. The four stale sibling clones were not read.
- Vocabulary: CONTEXT.md sections 0, 2, 4, 4b, 5, 5b. "Authority", "copy", "delivery path", "runtime state", "verdict", "held item", "dormant vs fault", "rung", "preflight" are used as defined there. Terms I needed that CONTEXT.md lacks are listed in section 7.
- Line numbers come from `awk '{print FNR": "$0}'` or `grep -n` on the file named. "inference" marks anything I reasoned out and did not read. Abbreviations: SF = a `sync:full` snapshot; LE = a live event; the "session room" is socket.io room `session:<id>`; the "gm room" is `gm`.
- Related sheets already landed: `2026-10-30-map-backend-game.md` (events, sync:full keys, reset order) and `2026-10-30-map-backend-show.md` (services, spawns). This sheet cites them only where a client claim needs their facts.

## Conclusions

1. Scope and depth: scoreboard.html script and markup seams (lines 735-1860 read in full; the 734 lines of CSS and markup before them only grepped); PWA js/*.js, sw.js, config.html script, index.html script tags; ESP32 Application.h (scan, outcome, timestamp, boot and serial-command parts), OrchestratorService.h, TokenService.h, AssetService.h, ScanResponse.h, PayloadBuilder.h, BatchId.h, models/Config.h (the HAL and UI layers were not read); config-tool server.js and all of lib/ except validators.js and packFs.js bodies, public/js by grep; backend test configs, e2e setup, rung-1 scripts, helpers by grep and targeted reads; 3 parent workflows; the two named docs. Counts and commands are in section 8.
2. Only the scoreboard receives pushed runtime state. It joins the same `gm` and `session:<id>` rooms as GM stations (gmAuth.js:106,124) and keeps everything in RAM. The web scanner and the ESP32 receive no runtime state at all: they poll `GET /health` every 10 s and learn "no session" only from the answer to a scan (409 `SESSION_NOT_FOUND`). The config tool receives none; it edits files.
3. The scoreboard ignores two things the server sends it. `sync:full.displayStatus` is never read (handler scoreboard.html:1741-1790), so a TV reloaded mid-video shows the wrong overlay until the next `display:mode`. It sends no `packHash` (auth block :1559-1566), so the staleness check at socketServer.js:139-148 never sees it.
4. "Frozen at activation" is only true of parsed snapshots and the manifest inventory. `/api/pack/files/*` sends live disk bytes under the frozen inventory (packService.js:1450-1460, packRoutes.js:34-45). `/api/tokens` re-reads disk on every request (tokenService.js:75-120, resourceRoutes.js:53-65). The scoreboard loads `game.json` bytes on page load (scoreboard.html:1231). After a config-tool publish and before a restart, the GM scanner (inference: its per-file sha1 check against the frozen manifest rejects the new bytes, so it keeps the old pack, per ALNScanner CLAUDE.md), the scoreboard (fresh `game.json` bytes) and the ESP32 (fresh tokens at its next boot) hold three different packs. CONTEXT.md section 2 says the running system ignores disk edits.
5. The web scanner in production does not use the active pack. It reads its own nested submodule file `aln-memory-scanner/data/tokens.json` (pin `15d8d2e`; 81 tokens; token `nat001` still has the schema-illegal `SF_Group` "Marcus Mention (x1)"; no `game.json`, no `pack-manifest.json`). Only a set `PACK_PATH` shadows it (app.js:131-142). So the harness hides this split on toy legs but not on the production leg (test-server.js:167 leaves `PACK_PATH` unset).
6. The ESP32's asset set and pack identity come from a checked-in file, `aln-memory-scanner/assets/manifest.json`, read by mtime (resourceRoutes.js:19-46,71-83). The committed file has no `pack` key (keys: `audio`, `images`, `version`), so the device reports no pack identity until `generate_asset_manifest.py` is rerun with a pack dir. Assets ignore `PACK_PATH`.
7. ESP32 limits: token sync is refused above 50,000 bytes (config.h:90, TokenService.h:223-228); the `/api/tokens` body is about 28,400 bytes for 81 tokens (python estimate), so the ceiling is near 142 tokens (inference, arithmetic). Tokens sync only at boot (Application.h:978-998); assets can also re-sync by serial `SYNC_ASSETS_NOW` (:1497-1512). A new pack reaches a deployed ESP32 only after a reboot.
8. Team attribution: ESP32 sends the static config `TEAM_ID` (3 digits, Config.h:18); the web scanner sends `sessionStorage.currentTeam || '001'` and nothing in the repo writes `currentTeam` (grep, app.js:435). Player scans therefore never carry a real session team. CLAUDE.md says any non-empty string is a team.
9. Offline queues: web and ESP32 both cap at 100 and silently drop the oldest (orchestratorIntegration.js:171-173; OrchestratorService.h:263-265,1243-1247). On a batch reply the web scanner drops 4xx batches (:333-356); the ESP32 removes entries only on HTTP 200 (:541-545) and retries anything else every 10 s forever (inference: low odds, the server answers 200 even for bodies it cannot parse, app.js:160-168).
10. The kit "works with no internet", but the web scanner page loads qr-scanner from unpkg (index.html:138; sw.js:27-30 caches it only if the first load had internet). The scoreboard already fixed this class (local socket.io, scoreboard.html:735-737). Backend UDP discovery (port 8888, server.js:273-275,329-331) has no client in scope; the web config page instead scans the subnet on port 8000 (config.html:389-410), which exists only when HTTPS is on (server.js:322-324).
11. Config tool: it is the Author surface plus venue configuration. It has no Rehearse, Run or Review function, and no "Deploy" navigation item (grep `deploy` in config-tool public/lib: none) although CONTEXT.md section 5b names Deploy as its fourth item. It never tells the orchestrator anything except the music proxy and the login-time token fetch. An edit becomes visible only at the next orchestrator restart. Auth: its own login against the same `backend/.env` password, audience `config-tool`, loopback bind by default.
12. The config-tool README promises cue edits take effect on "restart or system:reset"; the code reloads the frozen snapshot on reset (systemReset.js:231-239), so only a restart works. Audio-routing `routes` edits (the tool writes them, routes.js:69-76) have no reader; only `ducking` is read (app.js:265-271; the only code readers of `routing.json` are app.js and systemReset.js, plus a comment in profileService.js).
13. A password edit in the tool's env editor applies to the tool at once (toolAuth.js:98-109, fresh read per call) but to the orchestrator only at restart. For that window the two doors have different passwords.
14. Tests: 12 config files (backend: base, unit+contract, integration, setup, teardown, Playwright; ALNScanner: jest, build jest, Playwright; PWA jest; config-tool Playwright; ESP32 platformio), plus config-tool's config-less `node --test` and pytest. Parent CI runs 6 jobs plus a 4-leg Tier L matrix; it does not run Tier H, the config-tool Playwright smoke, ALNScanner Playwright, `test:build`, `test:docker`. `test:offline` points at `tests/integration/offline_mode.test.js`, which does not exist (package.json; `ls tests/integration`).
15. CI says Tier L at `--workers=3` is safe because pid files, pkill and the kiosk are "Tier H concerns" (test.yml:291-297). The code says otherwise. Every harness orchestrator runs with `ENABLE_VIDEO_PLAYBACK=true` (test-server.js:103), which pre-launches the kiosk (displayControlService.js:90-94); it shares six fixed `/tmp/aln-pm-*.pid` names and `/tmp/aln-mpd.*` with its siblings; and `audioRoutingService.init()` runs `pkill -f 'pactl subscribe'` machine-wide (audioRoutingService.js:110,597-608). On the CI runner `chromium-browser` is absent and `CHROMIUM_BIN` is unset (test.yml:288-306), so the kiosk launch fails harmlessly there; on a machine with Chromium it opens. Whether the siblings actually kill each other was not run (inference from code).
16. Machine sharing: the harness is "ambient first". It adopts a live X display (session-env.js:99-101), a live PipeWire (:201), and real BlueZ (provision.js:543-551). On a venue machine with `DISPLAY` set, Tier L and rung-1-style runs open the kiosk on the TV and play through real sinks. Three Tier L flows (07d-03, admin-state-reactivity, 30-full-game) pin the venue profile `aln-full-kit`, which names `hdmi-0`, the W-KING X10 speaker and `scene.*` ids and carries no `rung1`/`witness` marker (grep count 0), so `harnessProvides` is false and nothing is provisioned (the "real posture"). On a venue box those flows drive the real Home Assistant, PipeWire and BlueZ. Flow 30 also runs `docker start homeassistant` and copies `test_tone.wav` into the live `public/audio` (ha-service.js:74-81; sound-service.js:51-54).
17. The fixture generator writes into the live asset directories: placeholder `.mp4` files under REAL token and cue video names in `backend/public/videos` when absent, and `rung1-silence.wav` in `backend/public/music` (generate-fixtures.js:99,129-132,152-155). Both directories are gitignored and read by a live orchestrator on the same checkout.
18. The unit layer is not isolated from the machine. `mprisPlayerBase.test.js` and `vlcMprisService.test.js` mock `child_process` but not `fs` or `process.kill`, and they build real `ProcessMonitor` objects, so `_killOrphan()` reads the real `/tmp/aln-pm-*.pid` and can SIGTERM a live process whose command line contains `dbus-monitor` (processMonitor.js:180-192; inference for this tree). Blue's branch documents the incident on its own tree (2026-09-15, live VLC killed, commit 7be1b09c).
19. Blue's machine-sharing fixes (pidFile.js and `ALN_PIDFILE_DIR`, the jest per-run pid dir, the leaked-child guard, `cleanupInitializedServices`, `DISPLAY_DRIVER=off`, orphan reap by argv0, the harness no longer spawning VLC; 8 rows in section 6) are all absent here (`grep -rln` for each name returns nothing). The new engine has per-worker data and log dirs and a per-worker bus (P21) and the closed-pipe log guard (P22), but no per-run pid dir. Section 6 lists each fix.
20. Rung-1 scripts are destructive on a shared machine. `up.sh:47-51` deletes `/tmp/aln-pm-*.pid` and `/tmp/aln-mpd.*` unless `pgrep -f 'node src/server.js'` finds a server (a PM2 command line may not contain that exact string; inference). `down.sh:23-27` SIGTERMs every pid it finds in `/tmp/aln-pm-*.pid` with no command-line check and `down.sh:12` runs `docker rm -f rung1-ha`.
21. Shared files with no per-run isolation under jest and the Playwright workers' own imports: `backend/logs/{combined,error,exceptions,rejections}.log` (logger.js:12,86-108), written by every process that imports the logger, including the Playwright worker (test-server.js:35) and the PM2 orchestrator on the same checkout. `backend/.env` is committed and carries a live Home Assistant token that jest blanks only by env (jest.config.base.js:19-32).
22. Gaps: nothing was run, so every "can disagree" and "can kill" claim is from code. The ESP32 HAL and UI layers, ALNScanner internals, the GM scanner and `scripts/` were not read (other sheets own the GM scanner). I did not check how PM2 titles the process. I did not read the 26 flow bodies beyond pins, tags and setup calls.

## 1. The clients

### 1.0 How each client attaches

| Client | Transport | Credential | Identity | Reaches |
|---|---|---|---|---|
| Scoreboard (`backend/public/scoreboard.html`) | socket.io, `transports: ['websocket']` (:1559-1566) plus 2 HTTP fetches at start | Per-serve OBSERVE token injected into the page text (`'%%OBSERVE_TOKEN%%'` :776, replaced in resourceRoutes.js:204-206, minted at auth.js:129-147, 24 h, held in a backend `Map` that a restart empties) | `deviceId`: `?deviceId=` wins, else `kiosk=true` gives `SCOREBOARD_DISPLAY`, else `SCOREBOARD_DISPLAY_<ts>` kept in `sessionStorage` (:742-768). The backend's kiosk URL passes `deviceId=SCOREBOARD_HDMI` (displayDriver.js:77). Handshake says `deviceType: 'gm'` (:1563) | Joins `device:<id>`, `gm`, `session:<id>` and gets `sync:full`; is not registered as a GM station (gmAuth.js:54-65,102-131). Ids that start `SCOREBOARD_` skip the duplicate-id check (socketServer.js:85-86) |
| Web player scanner (`aln-memory-scanner`) | HTTP `fetch` only | none | `device_id` = `PLAYER_<ms>` in localStorage (orchestratorIntegration.js:20-29) | `GET /health?deviceId=&type=player`, `POST /api/scan`, `POST /api/scan/batch`, `GET /api/pack/manifest`, `GET ./data/tokens.json`, static assets |
| ESP32 player scanner | HTTPS (or HTTP) via `HTTPClient`; certificate checks off (`setInsecure()` OrchestratorService.h:945,979) | none | `DEVICE_ID` from `config.txt`, else generated from the MAC (arduino CLAUDE.md, config.txt format; not re-checked in ConfigService.h) | `GET /health?deviceId=`, `POST /api/scan`, `POST /api/scan/batch`, `GET /api/tokens`, `GET /api/assets/{manifest,images/*,audio/*}` |
| Config tool | Browser SPA on its own Express server (port 9000, server.js:13) | Tool login (section 2) | `deviceId: 'config-tool'` in its token (toolAuth.js:130) | Local files; `GET/PUT /api/music/*` and `POST /api/admin/auth` on the orchestrator (routes.js:397-442; toolAuth.js:86); Home Assistant `GET /api/states` (routes.js:291-312) |

Server side: `GET /health` returns `status`, `version`, `uptime`, `timestamp`, `timezone`, `pack` (identity), `profile` (identity) (healthRoutes.js:33-46). With `?deviceId=` it also registers a `player` device in the current session (:51-101). The ESP32 reads only `timezone` (OrchestratorService.h:370-386); the web scanner reads only `response.ok` (orchestratorIntegration.js:432-433). Neither reads `pack` or `profile`.

### 1.1 The scoreboard

Receives (handlers in `setupSocketHandlers`, scoreboard.html:1581-1822):

| Event | Handler line | What it does |
|---|---|---|
| `sync:full` | 1741 | Session boundary check; REPLACES scores (`data.scores`) and evidence (`data.recentTransactions`, filtered by pack evidence modes, sorted by time; despite its name that key holds every transaction of the session, syncHelpers.js:63, not the 10 kept by `recentTransactionsCount`); syncs the clock from `data.gameClock`; re-renders. Ignores every other key (`displayStatus`, `pack`, `profile`, `serviceHealth`, `playerScans`...) |
| `transaction:new` | 1660 | Adds evidence if the transaction's mode is an evidence mode; sets the team's score from `data.teamScore` |
| `transaction:deleted` | 1674 | Removes evidence matching the id OR the `tokenId`; sets `updatedTeamScore` |
| `score:adjusted` | 1645 | Sets the team's score |
| `scores:reset` | 1719 | Zeroes every score, clears evidence (keeps team names) |
| `session:update` | 1687 | New `id` triggers the boundary reset; `status:'ended'` stops cycling and the clock; seeds zero rows for new team names |
| `service:state` | 1792 | Only domain `gameclock` is read; the other nine domains are dropped |
| `display:mode` | 1800 | Sets `state.displayMode`; shows the "video playing" overlay in kiosk mode only (:1051-1068) |
| `scoreboard:page` | 1807 | GM-driven evidence page next/prev/owner jump; 60 s pause of auto-cycling (:1313) |
| `group:completed` | 1654 | Logs only |
| Not handled | | `player:scan`, `cue:*`, `device:*`, `session:overtime`, `offline:queue:processed`, `batch:ack`, `gm:command:ack` |

HTTP pulls: `GET /api/pack/files/game.json` once at start (:1229-1255) for evidence modes, money format, evidence cycle time; `GET /api/tokens` once at start (:1493) for per-owner token totals (`state.ownerTotalTokens`, used at :1156). Neither is refreshed. Serve-time injection: `PACK_STRINGS` (:787) and `PACK_THEME` (:793) are fixed at page load (resourceRoutes.js:208-213).

Delivery path for each event: backend emitter, then `emitToRoom(io, 'session:<id>', ...)` for `transaction:new|deleted`, `score:adjusted`, `scores:reset` (broadcasts.js:216,249,267,307); `emitToRoom(io, 'gm', ...)` for `sync:full` after session create / scores reset / offline queue (:103,325,367) and `group:completed` (:292); `emitWrapped(io, ...)` (all sockets) for `session:update` (:76) and `display:mode` (:464); `emitToRoom(io,'gm','service:state')` debounced 50 ms per domain (:487-493). Snapshot paths: on connect (gmAuth.js:164-181), on the client's own `sync:request` (server.js:75-103; scoreboard.html:1591,1639). The scoreboard therefore gets TWO `sync:full` on every connect (the automatic one and the one it asks for).

Copies it holds: see table 1.5 rows 1-5. Write semantics: team scores replace per team; evidence adds (event) or replaces (snapshot); clock replaces; page position is local.

Decides itself: which modes count as evidence (pack `displayBehavior.surface === 'scoreboard-evidence'`, with a baked `detective` fallback and a console warning, :1206,1229-1255); page layout and cycle speed from window height (`calculatePages` :1115-, constants 80/120/64 px, interval 18 s or two thirds of it at 4+ pages :1315-1341); ticker rank and which teams show (score > 0 or tokens scanned or an adjustment, :1412); money format (:1206-1226); the countdown (`expectedDuration - (elapsed + drift)` with `Date.now()` drift, :938-972); session boundary by id change (:1473-1486); a "zombie" reconnect after 5 minutes with no application event (`onAny` timestamp, :1581-1606).

Offline and reconnect:
- On `disconnect` it only changes the status word (:1608-1617). It keeps every copy on screen. A running countdown keeps ticking because `status` stays `running` (:974-992).
- socket.io reconnects on its own. The `connect` handler re-emits `sync:request` (:1585-1592), which replaces scores and evidence.
- The extra `socket.on('reconnect')` (:1637) is a Manager event in socket.io 4.8.1, so on a socket it never fires (inference from the library; `connect` covers the case).
- A handshake refusal containing `AUTH_` or `DEVICE_ID_` reloads the page after 2 s to mint a new token (:1619-1634). This is the restart-recovery path: a backend restart empties the observe-token map (auth.js store), so the old token fails. A timed reload every 23 h renews the token (:1853).
- The zombie check counts only application events, not socket pings. A healthy connection in a quiet game (no event for 5 minutes) is torn down and rebuilt (:1594-1606; inference on the quiet-game consequence).
- `transaction:deleted` is sent to the session room only when a session exists, otherwise to the `gm` room (broadcasts.js:262-277); both handlers on the page are idempotent.

### 1.2 The web player scanner

Receives:
- `GET /health` answer: `response.ok` only (orchestratorIntegration.js:418-433), every 10 s with a 5 s timeout (:463-471).
- `POST /api/scan` answer (:105-167): 2xx gives `{status:'accepted', tokenId, mediaAssets, videoQueued}` (only `status` and `queued` are used); 409 `{status:'rejected'}` is "scan recorded, video skipped"; any other 4xx is final; 5xx and network failure queue.
- `POST /api/scan/batch` answer: `failedCount` is logged only (:296-320).
- `GET /api/pack/manifest` once per load in networked mode (app.js:98-125); `./data/pack-manifest.json` in standalone mode (which does not exist in the nested pin, so the pack line stays empty there).
- `./data/tokens.json` (app.js:61-87), served from the symlinked checkout `backend/public/player-scanner -> ../../aln-memory-scanner` or from `PACK_PATH` when set (app.js:131-142). Fallback chain: `data/tokens.json`, `tokens.json`, an embedded one-token default (:127-139).

Copies it holds (see table 1.5 rows 6-9, 12): the token file in memory; `alnMemoryScanner` (scanned token ids); `offline_queue`; `pending_batch`; `orchestrator_url`; `device_id`; `aln_pack_info`; the service worker cache `aln-scanner-v1.11` (sw.js:4).

Decides itself:
- Whether a token exists: it looks the id up in its own file and never sends unknown ids (app.js:399-405).
- New or revisited, from its own set (:448-451). The set survives every session (nothing clears it).
- Online or offline, from `/health` (:432-433). While `connected` is false it queues without trying (:98-101).
- Which replies are final or retryable (:132-166), and the video-alert treatment (scannerCore.js:68-98: queued or rejected video scans show "Video unavailable — rescan to retry").
- Standalone versus networked, by URL path only (:33-34; scannerCore.js:51-54). Standalone sends nothing (:91-95).

Offline and reconnect: queue cap 100, oldest dropped (:171-173); persisted after each change (:185-191); on the offline-to-online flip and on every tick while anything is pending, `processOfflineQueue` runs (:441-447,480-491); a batch is up to 10 items, snapshotted with its id and stored in `pending_batch` before the queue shrinks (:246-262), resent verbatim until resolved, with a 10 s abort (:267-285); 200 clears it (:296-322); 4xx drops it with an error log (:333-356); 5xx or a network error keeps it (:287-291,358-359). Replayed scans never start video (A4; classification at scannerCore.js:73-84).

Service worker (sw.js): app shell is cache-first and needs a `CACHE_NAME` bump to refresh (:4,173-235); `data/tokens.json` and `data/pack-manifest.json` are network-first with cache fallback (:104-145); `/api/*` and `/health` pass through, with a synthetic 503 when offline (:152-170); images and audio are cached when first fetched (:192-202). `/api/pack/manifest` goes through the pass-through branch and is never cached.

Pin facts: `aln-memory-scanner/data` is at `15d8d2e` (`git submodule status --recursive`). `python3` comparison of its `tokens.json` against `ALN-TokenData/tokens.json`: 81 and 81 keys, 0 only-in-one, 1 differing token (`nat001`, `SF_Group` "Marcus Mention (x1)" versus "Marcus Mention"). Its `data/` folder holds `scoring-config.json`, a file the project retired (CLAUDE.md root).

### 1.3 The ESP32 player scanner

Receives:
- `GET /health` every 10 s on Core 0 (OrchestratorService.h:1266-1320), 5 s timeout, with up to six retries over about 61 s (`httpWithRetry` :1020-1052). Reads `timezone` and applies it with `setenv/tzset` once per distinct value (:370-386).
- `GET /api/tokens` once at boot (TokenService.h:203-264), written to SD `/tokens.json`. The device keeps only `video` per token (TokenService.h:93-137).
- `GET /api/assets/manifest`, then each changed file (AssetService.h:90-224), streamed to `*.part`, checked by size and sha1, then renamed (OrchestratorService.h:692-845). The pack identity rides this manifest if present (AssetService.h:148-158).
- `POST /api/scan` answer, classified by `classifyScanResponse` (ScanResponse.h:51-75): 2xx accepted; 409 `SESSION_NOT_FOUND` final, not queued ("NO SESSION" screen); 409 `status:'rejected'` accepted without video; anything else queues.
- `POST /api/scan/batch` answer: only `code == 200` counts (OrchestratorService.h:541).

Copies on the SD card (table 1.5 rows 8, 10-12): `/config.txt`, `/device_id.txt`, `/tokens.json`, `/queue.jsonl`, `/assets/manifest.json`, `/assets/images/*.bmp`, `/assets/audio/*`.

Decides itself:
- Whether the tag read worked and whether the token is known; unknown ids never reach the orchestrator (Application.h:525-548, "READ FAILED", "UNKNOWN TOKEN").
- Online or offline from the background task's last health result (`ORCH_CONNECTED`, :570); then ONE send attempt with a 10 s timeout and no retry on the scan path (:216; Application.h:551-583).
- Whether to queue (outcome table above, `applyScanOutcome` Application.h:689-730).
- The timestamp: local time with offset once SNTP has run, else a 1970 placeholder (Application.h:619-672); the backend recognises the 1970 form (scanRoutes.js:178,267).
- Whether to sync at all: `SYNC_TOKENS` and `SYNC_ASSETS` flags (Application.h:978,1007).
- The team: static `TEAM_ID` from `config.txt` (Application.h:558-563).

Offline and reconnect: scans append to `/queue.jsonl` (OrchestratorService.h:256-310); at 100 entries the oldest is removed first (:263-265,1243-1247); a corrupt queue over 100 KB is deleted at boot (:427-440); the background task uploads batches of 10 every 10 s while connected (:1299-1307), id `{deviceId}_{bootNonce}_{counter}` stable across retries (BatchId.h:33-40; counter moves only after a 200, OrchestratorService.h:547-548); entries leave the file by a stream rebuild through `/queue.tmp` (:1142-1225); a batch reboot duplicates rather than loses (:506-518). WiFi reconnect is left to the WiFi stack (:1315). There is no reconnect hook for tokens or assets: they sync only at boot (Application.h:978-1046) or by serial `SYNC_ASSETS_NOW` (:1497-1512; there is no token equivalent).

### 1.4 The config tool (as a client)

Receives no runtime state. It reads files (section 2), asks the orchestrator for the music tracks and playlists on demand (routes.js:397-419), and asks Home Assistant for scenes (routes.js:291-312). It decides: schema validity of every write (validators.js), the engine's cue vocabulary (imported from `backend/src/gameRules/cueValidation`, routes.js:11), publish conflict and gate refusals (publish.js:100-163). Write semantics: env edits MERGE key by key and append unknown keys (configManager.js:121-135); scoring MERGES into the `scoring` block (:156); cues, routing and preset files REPLACE the whole file; draft creation COPIES the live pack (draftStore.js:69-116); publish REPLACES the live files and removes ones the new manifest drops (publish.js:177-192); uploads ADD files, deletes remove them. Offline: with the orchestrator down, authoring works, login still works (toolAuth.js:83-96), music routes answer 502 (routes.js:405).

### 1.5 Runtime-fact table (facts a client holds)

Columns as the task defines. "RAM" = lost on reload.

| Fact | Authority | Copies (file:line) | Writers (client code) | Change events | Delivery paths | Persistence | Cleared or rebuilt at |
|---|---|---|---|---|---|---|---|
| 1. Team scores on the TV | transactionService / session scores (syncHelpers.js:59,134; other sheet) | Scoreboard `state.teamScores` Map (scoreboard.html:863-870) | `updateTeamScore` :1459; `session:update` seeds zeros :1700-1712; `scores:reset` zeroes :1719-1735; `sync:full` clear then set :1741+ | `transaction:new` (broadcasts.js:216), `score:adjusted` (:249), `transaction:deleted` (:267), `scores:reset` (:307) to the session room | LE to session room; SF to the `gm` room on connect, on `sync:request`, after session create (:103), after reset (:325) | none (RAM) | New session id (:1473-1486); any `sync:full`; reload on auth error (:1630-1634) and every 23 h (:1853) |
| 2. Exposed evidence by owner | session transactions (syncHelpers.js:63-134) | `state.evidenceByOwner` (:868); `evidenceModes` Set (:1206, from live `game.json` bytes :1231) | `addEvidence` :1257-1290 (adds; dedupes by id); `removeEvidence` :1292-1308 (drops by id OR token id); `sync:full` rebuild :1750-1778 | `transaction:new`, `transaction:deleted`, `scores:reset` | as row 1 | none | `handleSessionBoundary`; `scores:reset` (:1719); any `sync:full` |
| 3. Game clock / countdown | gameClockService (other sheet) | `state.countdown` {status, elapsed, expectedDuration, lastSyncTime} (:879-890) | `syncCountdown` :974-992 from `sync:full.gameClock` and `service:state` `gameclock`; 1 s tick :994-1000; `stopCountdown` :1006 | `service:state` domain `gameclock` (broadcasts.js:487-493) | LE and SF | none | Session ended or boundary (:1006,1473); each sync replaces it |
| 4. Display mode (TV overlay) | displayControlService (other sheet) | `state.displayMode` and the overlay CSS class (:866,1051-1068) | `handleDisplayMode` :1051 | `display:mode` (broadcasts.js:463-465, to all sockets) | LE only. SF carries `displayStatus` (syncHelpers.js:127-146) but the page ignores it | none | Never reset; a reload starts at `SCOREBOARD` |
| 5. Current session id | sessionService | `state.sessionId` (:867) | `handleSessionBoundary` :1473 | `session:update` (broadcasts.js:76), `sync:full.session.id` | LE and SF | none | Reload |
| 6. Scanned token ids (web) | none (device-local) | localStorage `alnMemoryScanner` {scannedTokens[], lastScan, version} (app.js:195-215); `MemoryScanner.scannedTokens` Set | `processToken` add :448-451; `saveData` replaces whole value :208-215 | none | none | localStorage, written on every scan | Never (no session link); browser data clear |
| 7. Offline scan queue (web) | the client until the server accepts | localStorage `offline_queue` (replace whole array, orchestratorIntegration.js:185-191); `pending_batch` snapshot (:369-379) | `queueOffline` push, shift at 100 :169-183; `_sendNextBatch` splice 10 :255-262; 200/4xx clear :322,347 | none | none | localStorage after each change | Batch resolved; `clearQueue` :516-523 (no caller in js/, config.html or index.html: `grep -n clearQueue`) |
| 8. Offline scan queue (ESP32) | the client | SD `/queue.jsonl` + RAM size counter (OrchestratorService.h:870-874) | `queueScan` append :256-310; `removeUploadedEntries` stream rebuild :1142-1225; overflow drop-oldest :1243-1247 | none | none | SD; corrupt file (>102,400 B) deleted at boot :427-440 | Upload 200; `CLEAR_QUEUE` serial command (Application.h:1353) |
| 9. Orchestrator reachable? | the orchestrator itself | web `connected` bool (:39,432); ESP32 `_connState` (ConnectionState.h; set at OrchestratorService.h:1289-1313); scoreboard `isConnected` (:1585,1612) | health polls; socket events | `orchestrator:connected/disconnected` window events (web, :482,495) | polling | none | Next poll |
| 10. Token set | the active pack's tokens.json (frozen parse) vs disk | Web: `aln-memory-scanner/data/tokens.json` bytes (pin `15d8d2e`); ESP32: SD `/tokens.json` (full replace each boot, TokenService.h:243-251, not atomic); scoreboard `ownerTotalTokens` (:870,1493-1505) | `loadTokenDatabase` (app.js:61-87); `syncFromOrchestrator`; `fetchTokenTotals` | none | web: file fetch (network-first in SW); ESP32: `/api/tokens` at boot; scoreboard: `/api/tokens` once | SD / SW cache | Web: next load; ESP32: next boot; scoreboard: next page load |
| 11. Media assets | `aln-memory-scanner/assets/` dir + checked-in manifest (resourceRoutes.js:19-22) | ESP32 SD `/assets/**` + `/assets/manifest.json`; web SW cache (images/audio on first fetch) | `AssetService::syncFromOrchestrator` (adds/replaces per file, commits manifest per file :207-213, prunes orphans :219) | none | `/api/assets/*` at boot or `SYNC_ASSETS_NOW` | SD | Sync; prune |
| 12. Pack identity (what the client believes it runs) | packService active pack | Web localStorage `aln_pack_info` (app.js:115-117, replace); ESP32 RAM `packId_/packVersion_/packHash_` (AssetService.h:229-231, cleared if manifest lacks `pack`, :145-152); scoreboard none | `loadPackInfo`; `syncFromOrchestrator` | none | `/api/pack/manifest` (web), asset manifest (ESP32) | web localStorage; ESP32 none | Each online load / each boot |
| 13. Config tool state | files on disk | Draft working copy `config-tool/data/drafts/pack/<id>/` + `draft.json` (draftStore.js:12-21, server.js:42-46); `publish-log.jsonl` (publish.js:221); server-held orchestrator token (toolAuth.js:49); SPA operator token in memory | draft writers (routes.js:137-182); `publishDraft` | none | HTTP only | files | Publish re-stamps the draft base (draftStore.js:157-164); tool restart keeps drafts |

### 1.6 Questions with several answers (clients)

| Question | Places that answer it | Can they disagree? Scenario |
|---|---|---|
| Which pack (rules, tokens) is running? | Frozen snapshot: `/health.pack`, `/api/pack/manifest`, `sync:full.pack`. Live disk: `/api/pack/files/*` bytes (packService.js:1450-1460), `/api/tokens` (tokenService.js:75-120), game.json read by the scoreboard (:1231). Own copies: web `data/tokens.json` (pin `15d8d2e`), ESP32 SD tokens, ESP32 asset manifest file (no pack key). Tool: `ALN-TokenData` working tree (configManager.js:30) | Yes. Publish in the config tool, no restart: the manifest says old hash, the bytes are new, a client verifying sha1 against the manifest rejects the new bytes, and the scoreboard's evidence modes come from the new game.json while the backend scores with the old one. Also: production leg, `PACK_PATH` unset, web scanner shows its own older tokens |
| Is the orchestrator reachable? | Web `connected` (10 s poll, 5 s timeout); ESP32 `_connState` (10 s poll, up to 61 s retry inside the poll); scoreboard socket state plus 5 min zombie rule; backend device registry (each `/health?deviceId` refreshes `lastHeartbeat`, healthRoutes.js:73-93) | Yes. Server dies between polls: each client shows "online" for up to 10 s (web, ESP32) or until the websocket drops (scoreboard); the web scanner then sends, fails, and queues |
| Which team did a player scan belong to? | ESP32 `TEAM_ID` (config.txt); web `sessionStorage.currentTeam` or the literal `'001'` (never written); backend teams are free strings from `session:addTeam` (CLAUDE.md) | Yes. Scans carry `001` or a 3-digit id that is not a session team |
| Has a token been seen or exposed? | Web `scannedTokens` Set (device lifetime); scoreboard `evidenceByOwner` (session); backend session transactions and `playerScans` (other sheet) | Yes. New game, same phone: the PWA still says "revisited"; the scoreboard cleared at the new session id |
| How much time is left? | Scoreboard local extrapolation from `lastSyncTime` (:938-972); gameClockService (other sheet); GM scanner (other sheet) | Yes. Disconnect while running: the scoreboard keeps counting; the clock may be paused on the server. Fixed on the next sync |
| Is the TV showing video or scoreboard? | `displayControlService.currentMode` (intent); `displayDriver` `visible` flag; the scoreboard's `state.displayMode` and overlay | Yes. The scoreboard misses `display:mode` while disconnected and ignores `sync:full.displayStatus` |
| Does a session exist? | Backend; web and ESP32 learn only from a scan reply 409 `SESSION_NOT_FOUND` | Yes. A player gets a normal screen on a queued scan during an outage and "NO SESSION" only when online (ESP32 Application.h:699-707); the web scanner shows the error message from the body |

## 2. The config tool

**What it edits.** Sources from DEFAULT_PATHS (configManager.js:25-43):

| Target | File | Writer | Validation | Write mode |
|---|---|---|---|---|
| Orchestrator environment | `backend/.env` | `PUT /api/config/env` (routes.js:44-51) -> `writeEnvValues` (configManager.js:121-135) | `validateEnvUpdates`; newline refused (envParser.js:72-74) | tmp + rename (`${file}.tmp`, envParser.js:103-114); masked secrets round-trip as a sentinel (secrets.js) |
| Pack rules (scoring) | `ALN-TokenData/game.json` + `pack-manifest.json` | Draft: `PUT /api/drafts/:id/scoring` (routes.js:137-147). Live route refuses with 409 (:61-63) | `validateScoring`; merge into the `scoring` block (configManager.js:137-167) | tmp + rename; manifest rebuilt in the same step, restored if the rebuild throws (:150-166) |
| Pack cues | `ALN-TokenData/cues.json` | Draft `PUT /api/drafts/:id/cues` (:149-159); live route 409 (:65-67) | `validateCuesBlock` (the activation gate's own pure check, configManager.js:261-276) | as above |
| Pack strings, theme | `strings.json`, `theme.json` in the draft | `PUT /api/drafts/:id/files/:name` (:173-182), whitelist (draftStore.js:32) | JSON object only (draftStore.js:190-192); the engine gate checks at publish | atomic; manifest rebuilt |
| Publish | `ALN-TokenData/*` (the checked-in submodule working tree) | `POST /api/drafts/:id/publish` -> `publishDraft` (publish.js:100-231) | conflict check on contentHash (:118-124); the engine's `validate-pack.js` in a child process (:78-92,141-153); re-verify of the landed tree (:194-205) | sibling temp files, ordered rename, manifest last (:165-181) |
| Audio routing | `backend/config/environment/routing.json` | `PUT /api/config/routing` (routes.js:69-76) -> `writeRouting` (configManager.js:308-311) | `validateRouting` | tmp + rename |
| Sounds and videos | `backend/public/audio`, `backend/public/videos` or `VIDEO_DIR` | `POST/DELETE /api/assets/*` (routes.js:266-287); `multer` with extension filter and size caps 50 MB / 2 GB (:263-264) | extension only | direct write |
| Presets | `config-tool/presets/*.json` (gitignored) | `/api/presets*` (routes.js:314-390); load writes env + scoring + routing (configManager.js:453-461) with an auto-backup and rollback (:436-482), scoring first run through the engine gate (`_gatePresetScoring` :178-222) | `validatePresetSections` | direct |
| Music playlists | `backend/config/music-playlists.json`, owned by the orchestrator | Proxy `PUT /api/music/playlists` -> orchestrator (routes.js:421-442) with the server-held orchestrator token | orchestrator-side | orchestrator tmp + rename (musicService.js:418-423) |
| Lighting scenes | Home Assistant, read only | `GET /api/scenes` (routes.js:291-312) | n/a | n/a |
| Not edited | Installation profile (`backend/config/profiles/*.json`, `PROFILE_PATH`), `.env` of the tool, tokens (`GET /api/tokens` is read-only, routes.js:217-223) | `draftStore.js:9-10` says the profile store is "C4", future | | |

"Environments" in the engine sense (rungs) are not an object the tool knows. The only environment it touches is `backend/.env`.

**How the running orchestrator sees an edit.**

| Edit | Orchestrator reads it | Evidence |
|---|---|---|
| `.env` | At start (`dotenv.config()` once, config/index.js:7-10). Restart only | infra.js:105 says "take effect on backend restart" |
| Pack scoring, cues, strings, theme | Parsed snapshot frozen at activation: restart only. But disk bytes are served live by `/api/pack/files/*` and `/api/tokens` (section 1, conclusion 4). `system:reset` re-loads the SAME frozen cues (systemReset.js:231-239), so the README line "Backend restart or system:reset" for cues (README.md "When changes take effect") is wrong | packService.js:1254-1269 warns once when disk differs: "restart the orchestrator to activate the new one" |
| `routing.json` | `ducking` array only, at boot (app.js:265-271) and at `system:reset` (systemReset.js:199-205). `routes` never read | grep `routing.json` in `backend/src`: those two files plus a profileService comment |
| Sounds, videos | At the time of each command: `soundService.play` spawns `pw-play` on `public/audio/<file>` (soundService.js:58-75) and the video queue checks the file (videoQueueService.js:907-911, as cited by the backend-show sheet). Live | |
| Music playlists | Live: the orchestrator itself writes the file and `fs.watch`es it (musicService.js:147-152) | |
| Presets | Same as the files they write | |

There is no reload, restart or "apply" call from the tool to the orchestrator (grep `reload|restart|pm2|systemctl` in `config-tool/lib`, `server.js`, `public/js`: only a comment, a README note and a UI hint). CONTEXT.md names hot-apply (E10) as scheduled work; it does not exist.

**Authentication.**
- Login `POST /api/auth/login` is open (server.js:81); everything under `/api` requires a tool token (:82; toolAuth.js:181-195), reads included, loopback included.
- The token is HS256, audience `config-tool`, tier `operator`, class `staffed`, 24 h, grants from the engine's own `computeGrants` (toolAuth.js:124-138). No `packHash` claim (:132-135).
- The password and signing secret are read fresh from the same `backend/.env` the orchestrator reads, with the same public defaults `admin` and `change-this-secret-in-production` (toolAuth.js:31-32,98-109).
- At login the tool also posts the password to the orchestrator's `/api/admin/auth` (5 s bound) and keeps that orchestrator-audience token in memory for the music proxy (toolAuth.js:83-96,166). Orchestrator down at login means a null token and a 401 on playlist writes. The Playwright smoke login therefore posts its fixture password to `ORCHESTRATOR_URL` (default `http://localhost:3000`, routes.js:17), which is the live orchestrator on a shared box (inference: the smoke does not set `ORCHESTRATOR_URL`, smoke.spec.js:42-56).
- Binding: `127.0.0.1` unless `CONFIG_TOOL_HOST` is set (server.js:18). Beyond loopback it refuses to start while `JWT_SECRET` or `ADMIN_PASSWORD` is unset (:63-70). The SPA files, `/audio` and `/video` previews need no login (:22,76-77; warning :130-135).
- Transport: HTTPS using the backend's key and cert (`SSL_KEY_PATH`, `SSL_CERT_PATH` from the same `.env`), else plain HTTP with a warning (server.js:105-129).

**Where it sits in Author, Rehearse, Run, Review (CONTEXT.md section 5b).**
- Author: yes. Sidebar sections: Game Economy, Show Control, Music & Playlists (`sectionNames`, app.js:19-27) edit pack content through drafts and the engine's gate at publish.
- Venue configuration (cross-cutting, "not a stage"): Audio & Environment, Infrastructure, Presets.
- Rehearse: none. A designer cannot apply a change and play it; publishing lands files and the orchestrator ignores them until restart. A "Pack Manager" prototype exists only behind `?variant=` (app.js:29-34).
- Run, Review: none. No preflight, no session or report view.
- Deploy: no navigation item (`grep -i deploy` in `config-tool/public`, `lib`, `server.js`, `README.md` returns nothing). The "venue technician binds the installation profile" step has no tool support yet (`draftStore.js:9-10`).
- Coupling: the tool imports engine modules by relative path (`cueValidation` routes.js:11 and configManager.js:21; `grants` toolAuth.js:27; `build-pack-manifest` configManager.js:229, publish.js:32, draftStore.js:26) and runs `backend/scripts/validate-pack.js` as a child (server.js:47). CI installs backend dependencies before the tool's tests for that reason (test.yml:121-127).

## 3. Test layers

### 3.1 Config files and the commands that found them

```
$ cd ALN-Ecosystem && find . \( -name node_modules -o -name .git \) -prune -o \( -name 'jest*.config*.js' -o -name 'jest.config*' -o -name 'playwright*.config.*' -o -name 'platformio.ini' -o -name 'vitest*' -o -name 'jest.setup*' -o -name 'jest.globalTeardown*' \) -print | sort
./ALNScanner/jest.build.config.js
./ALNScanner/jest.config.js
./ALNScanner/playwright.config.js
./aln-memory-scanner/jest.config.js
./arduino-cyd-player-scanner/platformio.ini
./backend/jest.config.base.js
./backend/jest.config.js
./backend/jest.globalTeardown.js
./backend/jest.setup.js
./backend/playwright.config.js
./config-tool/playwright.config.js
```

Plus `backend/jest.integration.config.js` (the pattern `jest*.config*.js` missed it; `ls backend/*.js` shows it). That is 12 config files. The config-tool unit tests use Node's built-in runner (no config file; `node --test tests/*.test.js`). Workflows:

```
$ find . -name node_modules -prune -o -path '*/.github/workflows/*' -type f -print | sort
./.github/workflows/capability-probe.yml   ./.github/workflows/rung1.yml   ./.github/workflows/test.yml
./ALNScanner/.github/workflows/{claude-code-review,claude,sync,test}.yml
./aln-memory-scanner/.github/workflows/{claude-code-review,claude,sync,test}.yml
./arduino-cyd-player-scanner/.github/workflows/{claude-code-review,claude,test}.yml
./config-tool/.github/workflows/test.yml
```

GitHub reads only the repository-root `.github/workflows`. The submodule workflows run in their own repositories. `config-tool/.github/workflows/test.yml` (Node 20, `npm ci`, `npm test`) is inert in this monorepo.

### 3.2 Layers

| Layer | Files (count command in section 8) | Command | Config | Workers | Notes |
|---|---|---|---|---|---|
| Backend unit | 110 under `tests/unit` | `npm run test:unit` = `jest tests/unit --maxWorkers=4` | `jest.config.js` over `jest.config.base.js` | 4; CI 2 for the combined run | Timeout 10 s (jest.config.js:34). `testEnvironment: node` |
| Backend contract | 40 under `tests/contract` (8 call `initializeServices()`, section 4) | `npm run test:contract` = `jest tests/contract --maxWorkers=4` | same | 4 | In-process, `supertest`, no fixed port |
| Backend unit + contract (what `npm test` and CI run) | unit + contract + `tests/diagnostic-scan.test.js` | `npm test` = `jest`; CI: `npm test -- --coverage --maxWorkers=2` | `jest.config.js`; roots `tests`; ignores `/tests/integration/` and `/tests/e2e/` (:24-28); per-file coverage ratchet from `.coverage-thresholds.json` | jest default (cores - 1) locally; 2 in CI | `npm run coverage:check` after |
| Backend integration | 38 under `tests/integration` (3 in `player-scanner/`, 2 in `scanner/`) | `npm run test:integration` = `jest --config jest.integration.config.js --runInBand` | `jest.integration.config.js` (testMatch `**/integration/**/*.test.js`) | 1 (`maxWorkers: 1`, `--runInBand`) | Timeout 30 s. In-process server on port 0 (integration-test-server.js:188-192). Real child processes: `docker-lifecycle` (real docker CLI), `logger-epipe-guard` (spawns `node src/server.js`), `udp-discovery` (UDP port 0) |
| E2E Tier L | 26 files under `tests/e2e/flows` | `npm run test:e2e:tier-l` = `playwright test --grep-invert @hardware --workers=3` | `playwright.config.js`: two projects, `chromium` and `mobile-chrome`; no `--project` flag, so both run; many flows skip desktop with `test.skip(({isMobile}) => !isMobile)` (25, 26, 07d-diagnostic, 24, 27, 30...) | 3 (config says 1; CLI wins) | Timeout 60 s; retries 2 in CI, 1 locally. `fullyParallel: false` |
| Dual-pack Tier L | same files, packs swapped | CI matrix of 4 legs (test.yml:233-247): `production` (no pins), `toy-heist` (`tests/e2e/fixtures/packs/toy-heist`), `toy-dormant-lighting` (toy + `fixtures/profiles/toy-dormant-lighting.json`), `toy-require-dormant` (`packs/toy-heist-require` + the same profile). Locally: `npm run test:e2e:toy-pack` (toy leg only) | env `E2E_PACK_PATH`, `E2E_PROFILE_PATH` read in test-server.js:167,172 | 3 | Flows that pin a pack win over the env (07c `parity-pack`; 07d-03, 22, 30-full, admin-state-reactivity pin ALN-TokenData and the venue profile) |
| E2E Tier H | 3 files tagged `@hardware`: 08, 22, 25 (`grep -rl @hardware flows`) | `npm run test:e2e:tier-h` = `playwright test --grep @hardware --workers=1` | same config | 1 | Not in CI. `test:e2e` (all, 1 worker), `:fast` (all, 3 workers, includes `@hardware`), `:headed`, `:ui` also exist |
| Rung-1 rig | 0 jest files; scripts `up.sh`, `probe.sh`, `engine.sh`, `audit-flows.js`, `down.sh`, `provision.js`, `generate-fixtures.js`, `onboard-ha.js` | CI: `rung1.yml` steps (below). Container recipe: baseline doc section 7 | none | 1 engine on port 3199 (engine.sh:14) | `provision.js` is also the E2E harness's environment module (session-env.js:48) |
| Capability probe | none | `capability-probe.yml` | none | n/a | Probes `hci_vhci`/`btvirt` only |
| ALNScanner unit | 86 under `tests/unit` + 1 `tests/contract` (+ helpers/integration/app dirs) | `npm test` (CI: `npm test -- --coverage`) | `jest.config.js` (jsdom, `testMatch **/tests/**/*.test.js`, ignores build-artifacts) | jest default | Coverage ratchet |
| ALNScanner build artifacts | 1 | `npm run test:build` | `jest.build.config.js` | default | Runs a real `vite build`; not in parent CI |
| ALNScanner Playwright | 6 specs under `tests/e2e/specs` | `npm run test:e2e` | `playwright.config.js` | 1 | `webServer: npm run dev` on port 8443, `reuseExistingServer: !CI` (:61-67). Standalone mode only; no orchestrator. Not in parent CI |
| PWA unit | 4 under `aln-memory-scanner/tests` | `npm test` | `jest.config.js` (jsdom, per-file coverage ratchet) | default | CI |
| Config-tool unit | 16 `*.test.js` | `npm test` = `node --test tests/*.test.js` | none | Node default | CI. Also `npm run lint` |
| Config-tool Playwright | 1 (`tests/e2e/smoke.spec.js`) | `npm run test:e2e` | `playwright.config.js` (workers 1) | 1 | Fixed port 9123; fixture tree in `os.tmpdir()`; reads `backend/ssl/*.pem`; not in CI |
| ESP32 native | 8 dirs under `arduino-cyd-player-scanner/test` | `pio test -e native` | `platformio.ini` `[env:native]` | n/a | CI job `esp32-tests` |
| Scripts | 5 test files plus `conftest.py` under `scripts/tests` | `python3 -m pytest tests/ -v` | none | n/a | CI job `scripts-tests` |
| Visual script | `tests/visual/test_memory_display_css.js` | `node` by hand | none | n/a | Not a jest test (name does not match `*.test.js`); needs a running orchestrator; writes screenshots to `/tmp/aln-visual-test` (:18) |

Dead or doubtful npm scripts: `test:offline` names `tests/integration/offline_mode.test.js`, which does not exist (the nearest file is `offline-queue-sync.test.js`).

### 3.3 Every CI job (parent repository)

| Workflow / job | Lines | Trigger | Timeout | Command and config | Workers |
|---|---|---|---|---|---|
| test.yml `backend-unit-contract` | 19-54 | push/PR to main, dispatch | 10 min | `npm run lint`; `npm test -- --coverage --maxWorkers=2` (`jest.config.js`); `npm run coverage:check` | 2 |
| test.yml `backend-integration` | 56-83 | same | 15 min | `npm run test:integration` (`jest.integration.config.js`) | 1 |
| test.yml `scanner-tests` | 85-131 | same | 20 min | ALNScanner `npm ci && npm test -- --coverage`, `npm run coverage:check`; PWA `npm ci && npm test`; `npm ci` in backend; config-tool `npm ci && npm test`, `npm run lint` | jest default; Node default |
| test.yml `esp32-tests` | 133-154 | same | 5 min | `pip install platformio`; `pio test -e native` (`platformio.ini`) | n/a |
| test.yml `scripts-tests` | 156-182 | same | 5 min | `python3 -m pytest tests/ -v` in `scripts/` | n/a |
| test.yml `summary` | 184-220 | same, `always() && !cancelled()` | default | Fails if any of the six needs failed | n/a |
| test.yml `backend-e2e-tier-l` (4 legs) | 222-314 | same | 30 min | `npx playwright install chromium --with-deps`; `cd ALNScanner && npm ci && npm run build`; apt: `vlc-bin vlc-plugin-base dbus xvfb xdotool pipewire pipewire-pulse wireplumber pulseaudio-utils bluez python3-dbusmock python3-dbus` (no `mpd`, no `chromium-browser`); `npm run test:e2e:tier-l` with `E2E_PACK_PATH`/`E2E_PROFILE_PATH` from the leg | 3 per leg; legs run on separate runners |
| rung1.yml `rung1` | 24-125 | dispatch; push touching `backend/tests/rung1/**` or the file | 20 min | apt installs the full stack incl. `mpd mpc`; `sysctl kernel.apparmor_restrict_unprivileged_userns=0`; `up.sh`, `probe.sh`, `engine.sh start`, `node audit-flows.js` (13 assertions), `down.sh` | 1 engine |
| capability-probe.yml `virtual-bluetooth` | 17-69 | dispatch; push touching the file | 10 min | `modprobe hci_vhci`, `btvirt`, `bluetoothctl` | n/a |

Parent CI does not run: Tier H, `test:e2e` (both projects, all tiers), `test:docker`, ALNScanner Playwright and `test:build`, config-tool Playwright, `verify-merge-ready.sh`, the visual script.

The rung-1 environment in the dev container (baseline doc section 7): `up.sh` leaves dockerd, the witness HA container, bus, Xvfb, pipewire and the Bluetooth mock running "for the Tier L legs" under `/tmp/rung1`; a container restart loses it all. So a local Tier L run is "ambient first" against those daemons. The harness-minimum brief adds the per-worker `DATA_DIR`/`LOGS_DIR` (P21) and the closed-pipe log guard (P22) and tells the implementer that "the rig's daemons under `/tmp/rung1` are not yours to stop" and that MPD defaults to the machine-wide `/tmp/aln-mpd.sock` (brief: "The facts you build on").

## 4. Machine sharing

"Live orchestrator" below means a PM2 production orchestrator or a dev orchestrator on the same host and the same checkout.

### 4.1 Per layer: every real resource it can touch

| Layer | Programs it spawns | Process files and paths | Ports | Data and log dirs | Display | Audio | Bluetooth | Network | Isolated per run? |
|---|---|---|---|---|---|---|---|---|---|
| Backend unit | Mostly none: `child_process` mocked in `mprisPlayerBase`, `vlcMprisService`, `audioRouting`, `bluetooth`, `sound`, `displayDriver`, `processMonitor` tests. Real `ProcessMonitor` objects in the first two | Reads and writes the real `/tmp/aln-pm-vlc.pid`, `/tmp/aln-pm-vlc-dbus-monitor.pid` through `ProcessMonitor` (inference from code: `ProcessMonitor` is real and `fs` is not mocked in those two files); `processMonitor.test.js` mocks fs (:13) and uses `/tmp/aln-pm-test-monitor.pid` | none | Logger writes `backend/logs/*.log` (shared with PM2 on the same checkout) | no | no | no | no | No for pid files and logs. Mocks isolate the rest |
| Backend contract | Real: 8 files call `initializeServices()` (bluetoothService.init -> `bluetoothctl show`, `dbus-monitor --system` if an adapter answers; audioRoutingService.init -> `pgrep`/`pkill -f 'pactl subscribe'`, `pactl list cards`, `pactl set-card-profile`, a `pactl subscribe` child; soundService `which pw-play`). No afterAll stops them | `/tmp/aln-pm-bluez-dbus-monitor.pid`, `/tmp/aln-pm-pactl-subscribe.pid` | `supertest` ephemeral | `backend/logs`; storage `memory` under `NODE_ENV=test` (config/index.js:51) | none (VLC/display off by env) | Real `pactl` against the host PipeWire: `set-card-profile output:hdmi-stereo` on every HDMI card (audioRoutingService.js:938-948) | `bluetoothctl show` read-only | none | No. Env switches only: `ENABLE_VIDEO_PLAYBACK=false`, `ENABLE_MUSIC_PLAYBACK=false`, `HOME_ASSISTANT_TOKEN=''`, `ENABLE_AUDIO_WIRES=false` (jest.config.base.js:11-44) |
| Backend integration | Same services via `performSystemReset` (21 files; list in section 4.5): re-runs `audioRoutingService.init`, `bluetoothService.init`, `displayControlService.init` which pre-launches the kiosk Chromium (displayControlService.js:90-94, systemReset.js:188-193, not gated by `videoPlayback`) and `xdotool`/`wmctrl` against `DISPLAY` (default `:0`). `docker-lifecycle` runs real `docker ps/start/stop` on `config.lighting.dockerContainer` = `homeassistant` and restores its state (docker-lifecycle.test.js:50-100,108-120). `logger-epipe-guard` spawns `node src/server.js` | `/tmp/aln-pm-*.pid` as above plus `/tmp/aln-pm-scoreboard-chromium.pid`; `logger-epipe-guard` fingerprints `/tmp/aln-pm-mpd.pid` (:34,115-125) | port 0 for the in-process server; UDP port 0; the spawned server on a free port | `backend/logs`; the guard test uses `os.tmpdir()` dirs | Yes: a kiosk window on the real display if `chromium-browser` exists | pactl as in contract | `bluetoothctl show` | HA calls blocked by the empty token | No. Same env switches. `DISPLAY_DRIVER` has no effect in this tree |
| E2E Tier L | `node src/server.js` per start (test-server.js:292); VLC via `runuser -u rung1vlc cvlc` (root) or `cvlc` (vlc-service.js:95-105); then through `provision.js`: `dbus-daemon`, `Xvfb`, `pipewire`, `wireplumber`, `pipewire-pulse`, `pactl load-module`, `dockerd` (fallback), `docker run/start/restart rung1-ha`, `python3 -m dbusmock`, `bluetoothctl list`, python venv + pip, `generate-fixtures.js`; the orchestrator itself spawns MPD (if installed), `dbus-monitor`, `pactl subscribe`, `pw-play`, `bluetoothctl`, kiosk Chromium | Orchestrator pid files in `/tmp/aln-pm-*.pid`, `/tmp/aln-mpd.*` (fixed, shared by all workers and the live orchestrator); `/tmp/rung1/*.pid` for rig daemons (written only by the CLI path) | Orchestrator port: free port per start (test-server.js:44-66,177-179), `HOST 0.0.0.0` (:101) so LAN-visible; HA `127.0.0.1:8123` shared; Xvfb `:99` shared; Vite not used | Per worker: `/tmp/aln-e2e-env/w<slot>/{data,logs}` (test-server.js:81-88); the Playwright worker's own logger still writes `backend/logs` | `:99` Xvfb if no live `DISPLAY`; an ambient live display is adopted (session-env.js:99-101) | Ambient PipeWire adopted when alive (session-env.js:201); else rig pipewire at `/tmp/rung1/xdg` with null sinks | Real BlueZ adopted when on the system bus (provision.js:543-551); else mocked bus `/tmp/rung1/system-bus.sock` | `0.0.0.0` listener; HA container `--network=host` | Partly. Isolated: session bus per worker (session-env.js:59), data/logs per worker, orchestrator port. Shared: pid files, MPD paths, HA, Xvfb, pipewire, BT mock, ambient devices |
| E2E Tier H | Same, plus real hardware paths | Same | Same | Same | The real HDMI display (flows 08, 25 drive the kiosk) | Real sinks | Real | LAN | No by design; runs with 1 worker |
| Rung-1 rig | `up.sh` (as root: `useradd`, `chown`, `dockerd`, `docker run`), `engine.sh` (`runuser ... node src/server.js` on 3199), `down.sh`; `audit-flows.js` runs `mpc add` against `/tmp/aln-mpd.sock` (:183-185) | Sweeps and kills `/tmp/aln-pm-*.pid`, `/tmp/aln-mpd.*` (up.sh:47-51; engine.sh:31-42; down.sh:23-27); owns `/tmp/rung1/**` | 3199, 8123, Xvfb `:99` | `/tmp/rung1/engine-data`, `/tmp/rung1/engine-logs` (up.sh:113-114) | Xvfb `:99` | rig pipewire | mock | `--network=host` HA | Own dirs yes; `/tmp/aln-*` no |
| ALNScanner jest, PWA jest, config-tool node tests | none (jsdom; config-tool tests use `os.tmpdir()` dirs, six files, mkdtemp) | none | none | `os.tmpdir()` | no | no | no | no | Yes |
| ALNScanner Playwright | Vite dev server | none | 8443; reuses an existing server unless CI | `ALNScanner/tests/e2e/reports` | headless Chromium | no | no | no | Port 8443 is shared with any dev server |
| Config-tool Playwright | `node server.js` | none | 9123 (fixed) | `os.tmpdir()` fixture; tool data dir inside it | headless | no | no | Posts fixture password to `ORCHESTRATOR_URL` (default localhost:3000) | Mostly; the orchestrator login post is the leak (inference) |
| ESP32 native, pytest | `pio`, `python` | none | none | pio build dir | no | no | no | `pio` may download platforms | Yes |

### 4.2 Every spawn site found by the grep, classified

```
$ cd backend && grep -rnE "spawn\(|spawnSync|execFile\(|execFileSync|exec\(|execSync|fork\(|child_process" src tests/e2e/setup --include=*.js | grep -v "\.test\.js" | grep -vE "^\S+:[0-9]+:\s*(//|\*)" | wc -l
60
```

Of the 60 lines, 2 are regex `.exec(` calls in resourceRoutes.js:91,118 (not spawns), 6 are `_execFile(` wrapper calls inside audioRoutingService/bluetoothService that forward to `pactlClient`/`execHelper` (counted with their sites below), and the rest are the sites in this table. Caller counts for the wrappers: `grep -rn "execFileAsync\|pactlClient" src`.

| ID | Site (file:line) | Program | Reached by layers | Isolated per run? | Shared with a live orchestrator? |
|---|---|---|---|---|---|
| S1 | vlcMprisService.js:113-141 | `cvlc` under `ProcessMonitor`, pid file `/tmp/aln-pm-vlc.pid` (:117), gated by `VLC_SELF_SPAWN` (:111, config/index.js:98) | E2E sets `VLC_SELF_SPAWN=false` (test-server.js:109); rung-1 engine self-spawns; unit tests with mocked spawn | No (fixed path; `_killOrphan` matches `cvlc` in the command line, but `cvlc` execs to `vlc`, so the match fails and the reap is ineffective; inference from blue's 0fef6f7c message) | Yes for rung-1 and for any harness that leaves self-spawn on |
| S2 | vlcMprisService.js:95 | `pgrep -a vlc` (read only) | init in every layer that inits VLC | n/a | Lists the machine's VLCs; only logs |
| S3 | mprisPlayerBase.js:205-210 | `dbus-monitor --session` under `ProcessMonitor`, pid file `/tmp/aln-pm-vlc-dbus-monitor.pid` | unit (real ProcessMonitor), integration, E2E, rung-1 | Bus: yes per worker in E2E (private bus). Pid file: no | Pid file yes |
| S4 | mprisPlayerBase.js:86,326 | `dbus-send` (MPRIS control) via execHelper | same | follows the session bus address | Only if the bus is shared |
| S5 | audioRoutingService.js:789-795 | `pactl subscribe` under `ProcessMonitor`, pid file `/tmp/aln-pm-pactl-subscribe.pid` (:793) | contract (8 files), integration, E2E, rung-1 | No | Yes |
| S6 | audioRoutingService.js:597-608 (called at :110 in `init`, so also at every `system:reset`) | `pgrep -f 'pactl subscribe'` then `pkill -f 'pactl subscribe'` | same as S5 | No: kills every `pactl subscribe` of the user, not just its own | Yes: a test orchestrator's start kills the live one's sink monitor, and sibling workers' monitors |
| S7 | audioRoutingService.js:158,215,444,460,509,567,877,909,938,948 via pactlClient.js:37 | `pactl` info/list/`move-sink-input`/`set-sink-input-volume`/`set-card-profile` | contract and integration (`init`: `list cards`, `set-card-profile` :938-948); E2E | Follows `PULSE_SERVER` (E2E sets it only when it starts the rig pipewire, session-env.js:201-206) | Yes when an ambient PipeWire is adopted: it mutates real sinks and card profiles |
| S8 | soundService.js:44,75 | `which pw-play`; `spawn('pw-play', ...)` (no pid file; in-memory map) | E2E, rung-1 (and unit with mocks) | Follows `PULSE_SERVER` | Plays on the ambient default sink if adopted |
| S9 | bluetoothService.js:117,130,284,326,355,376,411,426,652,674,846,863 | `bluetoothctl` show/info/connect/disconnect/remove/devices; `pactl list cards` | init in contract/integration; E2E | Follows `DBUS_SYSTEM_BUS_ADDRESS` (E2E sets it only for the mocked bus, session-env.js:211-214) | Real BlueZ when ambient |
| S10 | bluetoothService.js:165,699 | `bluetoothctl` scan, `bluetoothctl --agent NoInputNoOutput` (pairing) | GM `bluetooth:*` commands in E2E | as S9 | Can pair real devices |
| S11 | bluetoothService.js:497-503 | `dbus-monitor --system` under `ProcessMonitor`, pid `/tmp/aln-pm-bluez-dbus-monitor.pid` | contract, integration, E2E | pid no; bus per above | pid yes |
| S12 | musicService.js:603-619 | `mpd --no-daemon /tmp/aln-mpd.conf` under `ProcessMonitor`, pid `/tmp/aln-pm-mpd.pid` (:607) plus MPD's own `aln-mpd-internal.pid` (:598) | E2E (`ENABLE_MUSIC_PLAYBACK` is not set by the harness, so default on; MPD must be installed: not in the Tier L apt list), rung-1 | No | Yes: socket `/tmp/aln-mpd.sock`, conf, db, log, state, playlists dir are fixed |
| S13 | displayDriver.js:165-184 | `chromium-browser` or `$CHROMIUM_BIN`, kiosk, URL `https://<LAN-ip>:<PORT>/scoreboard?kiosk=true&deviceId=SCOREBOARD_HDMI` (:77), `DISPLAY` default `:0` (:56) | integration (21 files via reset), E2E (`ENABLE_VIDEO_PLAYBACK=true`), rung-1 | No | Yes: the display, the pid file `/tmp/aln-pm-scoreboard-chromium.pid` (:53), window found by title `ALN-SCOREBOARD` (:104) |
| S14 | displayDriver.js:147 | `pkill -9 -f 'chromium.*--kiosk'` | every kiosk launch | No: machine-wide | Yes: kills the live TV's kiosk when any orchestrator launches one |
| S15 | displayDriver.js:104,289,290,319 | `xdotool search/windowactivate/windowminimize`, `wmctrl` on `DISPLAY` | every show/hide | No | Acts on the live window if the title matches |
| S16 | processMonitor.js:68 and :180-192 | generic spawn; orphan reap by pid file: reads pid, checks `/proc/<pid>/cmdline` contains the command, SIGTERM | all users of S1, S3, S5, S11, S12 | No | Yes |
| S17 | execHelper.js:21,41 | generic `execFile` wrapper (callers: pactlClient, soundService, bluetoothService, mprisPlayerBase, dockerHelper) | all | n/a | n/a |
| S18 | dockerHelper.js:20 (via lightingService.js:417,459,465,472) | `docker ps/start/stop` on container `homeassistant` | production only: skipped when `NODE_ENV==='test'` or `HA_DOCKER_MANAGE=false` (lightingService.js:452; the harness sets both, test-server.js:100,264) | Yes (gated) | n/a |
| H1 | vlc-service.js:95,101 | `runuser -u rung1vlc -- cvlc --intf dummy --control dbus` or `cvlc`, detached, unref | 10 E2E flows via `setupVLC()` | Bus: private per worker. No pid file at all, so a killed worker can leak it | Display and audio if ambient |
| H2 | vlc-service.js:42,88,93,94 | `dbus-send`, `which cvlc`, `id`, `useradd rung1vlc` | same | n/a | creates a host user |
| H3 | test-server.js:292 | `node src/server.js` with `HOST=0.0.0.0`, dynamic port, per-worker data/logs | all E2E | Port and dirs yes | Pid files, MPD paths, kiosk, HA |
| H4 | sound-service.js:32 | `which pw-play`; copies `test_tone.wav` to `backend/public/audio` (:21,51-54) | flow 30 | No | Writes the live sound directory; `cleanupTestAudioFixtures` removes it (:65-72) |
| H5 | ha-service.js:33-45,74-81 | `sg docker -c "docker inspect / docker start homeassistant"` | flow 30 only | No | Starts the venue's HA container |
| H6 | manifest-reporter.js:20 | `which` | all E2E | n/a | read only |
| H7 | session-env.js -> provision.js:294,321,365,378,405,470-484,567,590,686-694,726 | `dbus-daemon`, `Xvfb`, `pipewire`/`wireplumber`/`pipewire-pulse`, `pactl load-module`, `dockerd`, `docker run/start/restart rung1-ha`, `python -m dbusmock`, `bluetoothctl list`, `pip install`, `generate-fixtures.js` | E2E start-up, rung-1 | Memoized per worker process (session-env.js:122-151); daemons shared | One HA container `rung1-ha` on `127.0.0.1:8123`; refuses to adopt a foreign HA (provision.js:146-150,447-466) |
| H8 | ssl-cert-helper.js:253-284 | none (no spawn) but sets `NODE_TLS_REJECT_UNAUTHORIZED=0` process-wide | tests that call it | per process | n/a |

### 4.3 Every fixed path found by the grep, classified

```
$ grep -rnE "/tmp|tmpdir|\.pid\b|/run/|XDG_RUNTIME|/var/run" src tests/e2e/setup --include=*.js | grep -v "\.test\.js" | grep -vE "^\S+:[0-9]+:\s*(//|\*)" | wc -l
44
```

44 raw lines; 25 are `proc.pid` / `.pid` property uses in logs or maps (soundService.js:77-108, processMonitor.js:83,198, displayDriver.js:227-245,388,401, bluetoothService.js:172, vlc-service.js:119,151, test-server.js:340,394,628) and one `process.pid` in a temp name (musicService.js:420). The other 19 are literal fixed paths:

| ID | Path | Defined at | Isolated per run? | Shared with a live orchestrator? |
|---|---|---|---|---|
| P1 | `/tmp/aln-pm-vlc.pid` | vlcMprisService.js:117 | No | Yes |
| P2 | `/tmp/aln-pm-pactl-subscribe.pid` | audioRoutingService.js:793 | No | Yes |
| P3 | `/tmp/aln-pm-bluez-dbus-monitor.pid` | bluetoothService.js:501 | No | Yes |
| P4 | `/tmp/aln-pm-vlc-dbus-monitor.pid` (built from label `VLC`) | mprisPlayerBase.js:209, label at vlcMprisService.js:17 | No | Yes |
| P5 | `/tmp/aln-pm-mpd.pid` | musicService.js:607 | No | Yes |
| P6 | `/tmp/aln-pm-scoreboard-chromium.pid` | displayDriver.js:53 | No | Yes; SIGKILL on read (:127-134) |
| P7 | `/tmp/aln-mpd.sock` | musicService.js:47; mpdConfigBuilder.js:20 | No | Yes |
| P8 | `/tmp/aln-mpd.conf` | musicService.js:48; app.js:225 | No | Yes |
| P9 | MPD runtime dir `/tmp`: `aln-mpd.db`, `aln-mpd.log`, `aln-mpd.state`, `aln-mpd-internal.pid`, `aln-mpd-playlists/` | musicService.js:50,589-598; mpdConfigBuilder.js:21-25 | No | Yes |
| P10 | `/tmp/rung1/` (HA config, auth, xdg, system bus socket, BT venv, simulation profiles) | session-env.js:51 | One tree per machine, by design | Shared by every worker and the rig; the HA container binds it |
| P11 | `/tmp/aln-e2e-env/dbus-w<slot>.sock` | session-env.js:59 | Yes, per worker slot (`TEST_PARALLEL_INDEX`) | No |
| P12 | `/tmp/aln-e2e-env/w<slot>/data`, `/logs` | test-server.js:83 | Yes, per worker slot | No (the orchestrator's `DATA_DIR`/`LOGS_DIR`, :246-247) |
| (count) | 11 ids cover 19 literal hits: P1 1, P2 1, P3 1, P4 1, P5 1, P6 1, P7 2, P8 2, P9 6 (musicService.js:50 plus mpdConfigBuilder.js:21-25 = 6), P10 1, P11 1, P12 1 = 19 | | | |

Other shared stores that are not `/tmp` but sit in the checkout: `backend/logs/*.log` (logger.js:12,86-108; the Playwright worker imports the logger without `LOGS_DIR`, test-server.js:35); `backend/data/` (file storage, config/index.js:52; harness and jest avoid it); `backend/public/audio` (H4), `backend/public/videos` and `backend/public/music` (generate-fixtures.js:99,129-132,152-155); `backend/config/music-playlists.json` (tracked; written only by `PUT /api/music/playlists`; no test points at it, grep `_playlistFile =` shows only `null` assignments in unit tests); `backend/.env` (tracked, live HA token); `ALN-TokenData/` and `config-tool/presets` (written by the tool).

### 4.4 Ports, display, audio, Bluetooth, network (summary)

- Ports: live 3000 (HTTPS), 8000 (HTTP redirect, `config.ssl.httpRedirectPort`), UDP 8888 (discovery; off when `NODE_ENV=test`, server.js:273), 9000 config tool, 8443 Vite, 8123 HA. Tests: ephemeral for jest and E2E orchestrators; 3199 rung-1; 9123 config-tool smoke; 8443 ALNScanner Playwright (reused if occupied); 8123 witness HA (shared with a real HA only if the machine runs one, in which case `ensureHA` refuses, provision.js:447-466).
- Display: the kiosk driver uses `DISPLAY || ':0'` (displayDriver.js:56) at module load. E2E adopts a live `DISPLAY` if `xdotool getdisplaygeometry` answers (session-env.js:99-101), else starts Xvfb `:99`.
- Audio: E2E uses an ambient PipeWire if `pactl info` answers (session-env.js:201); the rig's null sinks `rung1_hdmi`, `rung1_bt` otherwise (provision.js:376-379). VLC and `pw-play` follow `PULSE_SERVER`/`XDG_RUNTIME_DIR` of their parent.
- Bluetooth: real BlueZ is used when `org.bluez` is on the ambient system bus; else a mock on `/tmp/rung1/system-bus.sock`.
- Network: the E2E orchestrator listens on `0.0.0.0` with a known admin password `@LN-c0nn3ct` (test-server.js:101,110; helpers/test-config.js:13), visible to the venue LAN during a run. Player-scanner config page probes the whole /24 on port 8000 (config.html:389-410).

### 4.5 Integration files that reach `performSystemReset` (kiosk launch and `pkill`)

`grep -rl "resetAllServicesForTesting\|performSystemReset" integration contract unit`: integration/admin-interventions, cue-engine, device-type-duplicate-detection, duplicate-detection, early-connection, environment_control, error-propagation, external-state-propagation, fr-admin-panel, fr-transaction-processing, group-completion, multi-client-broadcasts, multi-gm-coordination, offline-queue-sync, room-broadcasts, scan-edge-cases, service-state-push, session-lifecycle, system-reset-regression, transaction-flow, video-orchestration (21 files); the same grep also names 3 unit files (unit/services/dormancyService, unit/services/systemReset, unit/websocket/adminEvents); I did not check whether they mock the services, so they are not counted.

### 4.6 Questions with several answers (tests)

| Question | Places that answer it | Can they disagree? |
|---|---|---|
| Is a VLC (or MPD, or kiosk) running on this machine? | The orchestrator's own `ProcessMonitor` handle; the pid file `/tmp/aln-pm-*.pid`; `pgrep -a vlc` at init (vlcMprisService.js:95); `pkill -f` machine-wide patterns (S6, S14); the harness's `isVLCAvailable()` on the worker's private bus (vlc-service.js:40-56) | Yes. Two orchestrators on one host each believe they own the same pid file; the second reaps the first's child (S16). The harness probes a private bus, the engine's `pgrep` sees the whole host |
| Which pack and profile did this run use? | `startOrchestrator` options and `E2E_PACK_PATH`/`E2E_PROFILE_PATH` (test-server.js:167,172); `provisionForRun` result (session-env.js:233-238); flow pins | Yes. A flow that pins ALN-TokenData and `aln-full-kit` under the toy leg runs the ALN pack on the venue profile, i.e. in the real posture, on every leg |
| Is the environment real or simulated? | `harnessProvides(profile)` (provision.js:82-114) per run; ambient probes (`pipewireAlive`, `displayAlive`, org.bluez on the system bus) | Yes. The gate looks at the profile; the ambient probes look at the machine. A simulated profile on a machine with a live PipeWire still adopts the live one (session-env.js:201 runs inside `if (gate)`; the display adoption at :99 does not depend on the gate) |

## 5. What the two named documents add

- Baseline section 7 (2026-09-12): the rig is provisioned in the dev container from the rung1.yml recipe plus `bluez`; `up.sh` exit 0, five arms up, audit 13/13; probe showed `pipewire` NOT ok when run as root because the arm runs as `rung1vlc`; `btvirt` blocked by `/dev/vhci`; a container restart loses everything and `pio` is absent. This confirms that local Tier L runs rely on daemons that outlive the run and that every machine-sharing conclusion above applies to the dev container itself.
- Harness-minimum brief: P21 (one data and log dir per worker) and P22 (closed-pipe log guard) are the harness changes already on this branch (test-server.js:81-88,246-247; logger.js:147-156). The brief's guardrails forbid changing the Jest configs, `session-env.js`, `provision.js`, `down.sh` and engine services, so it could not carry blue's pid-file or leaked-child fixes.

## 6. Blue's machine-sharing fixes: does the new engine have an equivalent?

Commands: `git show origin/production-2026-07:backend/src/utils/pidFile.js`; `git show origin/production-2026-07:backend/jest.config.base.js`; `git log origin/production-2026-07 --oneline -- backend/tests backend/src/utils | wc -l` returned `31`; `git show --stat` on the six commits below; merge base with HEAD `a4ebacdf`.

| Blue fix (commit) | What it does | Equivalent here? | Evidence |
|---|---|---|---|
| `pidFile.js` + `ALN_PIDFILE_DIR` (7be1b09c, W10 P2) | Every pid file resolves to `join($ALN_PIDFILE_DIR or /tmp, basename)`. `ProcessMonitor` and `displayDriver` call it. Relative or unwritable values warn and fall back to `/tmp` | No | `grep -rln ALN_PIDFILE_DIR src tests jest*.js` returns nothing; `ls src/utils` has no `pidFile.js`; fixed paths at vlcMprisService.js:117, audioRoutingService.js:793, bluetoothService.js:501, mprisPlayerBase.js:209, musicService.js:607, displayDriver.js:53 |
| Jest base sets a per-run `ALN_PIDFILE_DIR` (`mkdtemp aln-jest-`), removed in global teardown (7be1b09c) | The unit suite cannot touch another process tree's pid files | No | jest.config.base.js:11-44 sets four env switches only; jest.globalTeardown.js destroys HTTP agents only |
| E2E harness: one pid dir per parallel slot, passed to each orchestrator, removed on exit (7be1b09c) | Parallel workers and the live orchestrator no longer share pid files | Partly | HEAD has per-slot data/logs dirs and a per-slot bus (test-server.js:81-88; session-env.js:59) but no pid dir; the child env sets only `DATA_DIR`, `LOGS_DIR` (:246-247) |
| Leaked-child guard: `jest-environment-guarded.js` + `live-children-guard.js` (50cc4e36, W10 P3) | Scans `/proc` for real children of the jest worker at teardown, kills them, fails the file | No | `grep -rln "live-children-guard\|jest-environment-guarded"` returns nothing; `testEnvironment: 'node'` (jest.config.base.js:48) |
| `cleanupInitializedServices()` in contract suites (bd72c487) and `displayDriver.cleanup()` in integration cleanup (50cc4e36) | Stop the `dbus-monitor` and `pactl subscribe` children that `initializeServices()` starts; stop the kiosk | No | `grep -rn cleanupInitializedServices tests` returns nothing; the 8 contract files that call `initializeServices()` contain neither `cleanup` nor `stopRevalidation` (`grep -rLn` check); `cleanupIntegrationTestServer` (integration-test-server.js:212-277) never calls `displayDriver.cleanup` |
| `DISPLAY_DRIVER=off` (176fd2ed, W10 P4) | Kiosk driver inert under jest: no launch, no `xdotool`/`wmctrl` | No | `grep -rn DISPLAY_DRIVER src tests` returns nothing. `ENABLE_VIDEO_PLAYBACK=false` only gates `app.js:280-297`; `performSystemReset` re-inits display control unconditionally (systemReset.js:188-193; displayControlService.js:90-94) |
| `orphanMatch`: reap by argv0 basename (0fef6f7c, W9 P0.3) | `cvlc` execs to `vlc`; the old substring check never matched, so a SIGKILLed orchestrator leaked a fullscreen VLC | No | processMonitor.js:186 uses `cmdline.includes(this._command)`; vlcMprisService.js:113-122 passes no match list |
| Harness no longer spawns its own VLC (1fc9c589, W10 C1) | The orchestrator owns the only VLC; E2E exercises the production spawn path | No, different design | HEAD sets `VLC_SELF_SPAWN=false` (test-server.js:109) and spawns `cvlc` from the harness (vlc-service.js:95-105); no pid file, so a killed worker can leak it |
| (Not machine sharing, listed because the log asked) `dbusSignalParser` completion fix (f1e2ddf9) | VLC state parser | `src/utils/dbusSignalParser.js` exists here; not compared | `ls src/utils` |

HEAD's own machine-sharing fixes that blue's branch lacks: P21 (per-worker data and logs) and P22 (closed-pipe guard, logger.js:147-156; blue's logger has no `console transport silenced` string, `git show ... | grep -c` returned 0); the profile gate for fake physics (provision.js:82-114); the `refuse-foreign` rule for a real Home Assistant (provision.js:146-150).

## 7. Terms CONTEXT.md lacks

- **Observe token**: a per-serve, device-tier, display-class credential with function `observe` only, injected into the scoreboard page (auth.js:129-147). CONTEXT.md names the scoreboard but not this credential.
- **Display-class socket**: a socket whose verified tier is `device`; it receives broadcasts and is not a GM station (gmAuth.js:54-65).
- **Real posture**: a harness run whose profile assigns nothing to stand-ins, so nothing is provisioned and real devices are used (session-env.js:218-231).
- **Ambient-first**: the harness rule to adopt a live display, PipeWire and BlueZ before manufacturing stand-ins (session-env.js:10-12).
- **Witness register / witness Home Assistant**: CONTEXT.md has "witness lights"; the shared single HA container serving the union of all packs is not named.
- **Pid file (orphan reap)**: the `/tmp/aln-pm-*.pid` mechanism of `ProcessMonitor`.
- **Fixed path**: a `/tmp` path the engine hard-codes, the unit of machine sharing in section 4.
- **Frozen inventory, live bytes**: the state in which the manifest is frozen at activation but the served file bytes are read from disk (packService.js:1450-1460).
- **Player-scan team**: the team id a player scanner sends (ESP32 `TEAM_ID`, PWA `'001'`), which is not a session team.
- **Poison batch**: a queued batch that the server will never accept and the client keeps resending.

## 8. Completion check (counts and commands)

All commands run from `/home/user/ALN-Ecosystem`. Commands C1 to C9 are in the block below the table.

| What | Count | Command |
|---|---|---|
| Spawn and exec grep hits in `backend/src` + `backend/tests/e2e/setup` | 60 lines, classified as S1-S18 and H1-H8 | C1 |
| Fixed `/tmp` and pid grep hits | 44 lines: 19 literal paths (P1-P12) and 25 pid-property or `process.pid` lines | C2, then C3 for the literal subset |
| `ProcessMonitor` constructors in `backend/src` | 5 (vlc, mpris dbus-monitor, pactl, bluez dbus-monitor, mpd) | C4 |
| Backend test files | unit 110, contract 40, integration 38, e2e flows 26, e2e setup 3 | C5 |
| Contract files calling `initializeServices` | 8 | C6 |
| Integration files reaching `performSystemReset` | 21 | C7 |
| Flows pinning the venue profile `aln-full-kit` | 4 files (07d-03, 22 [@hardware], 30-full-game, admin-state-reactivity) | C8 |
| `@hardware` files | 3 (08, 22, 25) | C9 |
| Other clients' test files | ALNScanner unit 86, e2e specs 6, build-artifacts 1, contract 1; PWA 4; config-tool node 16, e2e 1; ESP32 dirs 8; pytest 5 test files plus conftest | `find` or `ls` per directory, as in section 3.2 |
| Test config files | 12 (11 from the `find` in section 3.1, plus `backend/jest.integration.config.js`) | section 3.1; `ls backend/*.js` |
| Parent CI jobs | 9 job definitions: 7 in test.yml (the Tier L job is one definition with a 4-leg matrix), 1 in rung1.yml, 1 in capability-probe.yml | `grep -nE "^  [a-z0-9-]+:$" .github/workflows/*.yml`, read under each `jobs:` |
| Token and manifest sizes | `tokens.json` 34,081 B for 81 tokens; compact `/api/tokens` body about 28,423 B (python estimate); asset manifest 13,294 B against the 131,072 B device limit | `wc -c ALN-TokenData/tokens.json aln-memory-scanner/assets/manifest.json`; python `json.dumps(separators=(',',':'))` |

```
# C1  (cd backend)
grep -rnE "spawn\(|spawnSync|execFile\(|execFileSync|exec\(|execSync|fork\(|child_process" src tests/e2e/setup --include=*.js | grep -v "\.test\.js" | grep -vE "^\S+:[0-9]+:\s*(//|\*)" | wc -l
# C2  (cd backend)
grep -rnE "/tmp|tmpdir|\.pid\b|/run/|XDG_RUNTIME|/var/run" src tests/e2e/setup --include=*.js | grep -v "\.test\.js" | grep -vE "^\S+:[0-9]+:\s*(//|\*)" | wc -l
# C3  (cd backend)  same as C2, then keep literal paths only:
... | grep -E "'/tmp|\"/tmp|`/tmp|/tmp'" | wc -l          # 19
# C4
grep -rn "new ProcessMonitor" backend/src | wc -l
# C5
for d in unit contract integration e2e/flows e2e/setup; do find backend/tests/$d -name '*.test.js' | wc -l; done
# C6
grep -rl initializeServices backend/tests/contract | wc -l
# C7
grep -rl "resetAllServicesForTesting\|performSystemReset" backend/tests/integration | wc -l
# C8
grep -l aln-full-kit backend/tests/e2e/flows/*.js
# C9
grep -rl @hardware backend/tests/e2e/flows | wc -l
```
