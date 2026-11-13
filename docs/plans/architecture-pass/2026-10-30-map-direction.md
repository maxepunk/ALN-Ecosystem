# Map of the engine's direction (fact sheet for the architecture pass)

Written 2026-10-30 by a read-only reader. Tree: branch `claude/nice-curie-hescfv`. The task named commit `26fc2f2`. HEAD is now `8e14e82`, whose only change is six lines in `CURRENT-STATE.md` section 0 [git diff 26fc2f2 HEAD]. Every CURRENT-STATE line number below is the `26fc2f2` text. In HEAD, lines after line 56 sit six lines lower.

Citation key. Paths are under `/home/user/ALN-Ecosystem/`. A citation reads `key:line` or `key:first-last`.

- CTX = `CONTEXT.md`
- RM = `docs/plans/ROADMAP.md`
- PRG = `docs/plans/2026-06-11-phase3-program.md`
- UXF = `docs/plans/2026-09-04-ux-foundation.md`
- PGS = `docs/plans/2026-09-04-phase3-design-workspace-pages.md`
- C23 = `docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md`
- CS = `docs/plans/CURRENT-STATE.md`
- KO = `docs/plans/briefs/2026-10-30-architecture-pass-kickoff.md`
- HP = `docs/plans/2026-09-12-block2-hardening-plan.md`
- TRI = `docs/plans/2026-10-30-production-fixes-triage.md`
- REC = `docs/plans/2026-10-30-recovered-review-findings.md`
- T3C = `docs/plans/2026-09-12-block3-truth-sweep-census.md`
- BILL = `docs/plans/2026-07-17-bill-capability-scoping.md`
- CMD = `CLAUDE.md` (root), BCM = `backend/CLAUDE.md`, SCN = `ALNScanner/CLAUDE.md`
- Code paths are relative to the repo root. "Inference" marks my own reasoning.

## Conclusions

- The engine is going toward an open-source show platform. A designer builds a game as a pack in a tool with no code and tunes it in an edit, apply, play loop. A venue installer binds the pack to a profile and runs one preflight. A GM runs the show from the scanner's four domains. [RM:40-69, RM:128-135]
- Truth sweep versus architecture pass. The sweep is Block 3. It audits "every path from engine event to what the admin panel shows" on the store-fed path only, leaves three transaction-path renderers out, and fixes each false display with a rig test. [RM:328-346] The pass asks who decides each fact the GM sees across the whole engine, plus five more questions: service state with health, reading outside programs, tests touching the live show, one answer per question, and re-checking after a reset. [CS:16-26]
- Inference: the sweep audits a delivery design that already exists. The pass chooses that design. The kickoff says the sweep and the paused hardening pieces "would be re-planned from the answer." [KO:91-93] The sweep's recorded reason to wait for Block 2, locking in the final health words, is spent. [KO:80-84]
- The screens the sweep excludes hold blue's worst defects. [KO:76-79] Inference: the triage rows A-1 to A-4, E-1 and E-2 sit in the message router, the unified data manager, the Game Ops renderer, the activity builder and the report generator, which serve the transaction path and the report. [TRI table "GM scanner"]
- One truth covers verdicts only, meaning what the show needs against what the kit has. [CTX:181-197] Runtime state now has four words and no rule. [CTX:377-400, KO:85-86] CTX 4b "decide nothing about how the engine should hold them." [CTX:381-383]
- Five planned capabilities change who may hold or change runtime state: hot-apply (a pack change under a running engine, four named steps), the preview engine (a second engine on the same machine), the capture block, the supervisor, and phones plus the second game (server-side projection, hidden state). [PGS:344-352, PGS:357-364, RM:348-367, HP:198-215, PRG:244-249, BILL:75-82, BILL:93-100]
- None of the five is built. Greps for `hot-apply`, `pack:applied`, `ALN_RUNTIME_PREFIX` and `HOST_CONFIG_PATH` find nothing in `backend/src`, `backend/contracts`, `config-tool/lib`, `config-tool/public` or `ALNScanner/src`. Section 3 shows the commands.
- A second engine on the live machine is unsafe today. Eight fixed `/tmp/aln-*` paths exist in `backend/src`. `audioRoutingService.js:603` runs a machine-wide `pkill -f 'pactl subscribe'`. `displayDriver.js:147` runs `pkill -9 -f chromium.*--kiosk`. The same file's comment at `:124` says its kill is "PID-scoped (not system-wide pkill) so concurrent orchestrators don't interfere." PGS:302 predicted exactly this harm.
- Contradiction. CTX:198-202 says the active pack is "fixed for the life of the process" and edits on disk are ignored. Hot-apply re-enters `activatePack()` by design. [PGS:344-346, CTX:140, RM:131-135] The profile stays boot-frozen. [C23:277-278, HP:161] Inference: after hot-apply, a pack can change under a running engine and a profile cannot, yet dormancy reads both.
- Contradiction. CTX:333-337 and BCM:498 say a held cue auto-discards after 10 seconds. C23:234-238 and HP:76-79 say only `video_busy` holds carry that timer and `service_down` holds never expire today.
- Contradiction. RM:203-206 still states the September run calendar and swap windows with no supersession mark, while RM:263 and RM:648 mark the clock superseded on 2026-10-30.
- Contradiction. UXF:417-418 says the nav is "Author, Rehearse, Run, Review." UXF:466-469 and CTX:497-503 say the tool's fourth nav item is Deploy and the four stages stand.
- Contradiction. CTX:367-370 and CMD:261 count 10 service domains. HP:192-197 adds an eleventh, `preflight`, operator-only. Not built: the preflight service header says the domain push is T4's [backend/src/services/preflightService.js:15-18].
- Contradiction. RM:102-111 forbids "one kit, one pack, one production" assumptions where avoiding them costs little. The fixed `/tmp/aln-*` paths and the machine-wide kills are such assumptions.
- The test loop is slower than the roadmap implies. Hot-apply is refused while a game session is active or paused. [PGS:490-492] GM transactions are accepted only when the status is `active`. [backend/src/services/transactionService.js:157] Player scans are accepted in `setup` on purpose. [BCM:202] Inference: a rehearsal by player scan can run in `setup`; a GM-transaction rehearsal needs end, apply, create, start, and `session:start` runs the require gate. [HP:162-174]
- Gap. No document says where a preview engine runs. PGS:196-205 has the tool spawn it. PGS:502-505 says hardware-shaped needs resolve dormant "on a laptop." UXF:452-458 says only "some orchestrator." Whether it can share the show Pi decides how much isolation the pass must build.
- Gap. No document lists every copy of the active pack. PGS names baked token values, the cue engine's boot copy, the GM scanner's start-up load and the setup game session's stamp. [PGS:84-100, PGS:301] The ESP32 downloads it too. [PRG:66-67]
- Gap. No document defines what a copy must do at a game-session boundary. The triage finds the ended session's view wiped on the next sync (C-1) and the reload that restores transactions without claiming tokens (A-9). [TRI table, rows C-1 and A-9]
- Gap. Whether an outside program counts as an authority is unconfirmed by the owner. [CS:34-36] CTX:393-395 already says it does.
- Gap. Phone load: "kit capacity work precedes phone load," with no capacity number anywhere. [RM:526]
- Status. Block 2 pieces paused: the profile check, dormancy-core fixes, credentials, supervisor, self-heal, preflight checks and panel, wiring, close review, three green follow-ups. [CS:125-129] The dormancy core, equipment families and harness minimum are merged. [CS:120-121]
- Count. ROADMAP section 8 has 19 rows (8.1 to 8.19). Ten bear on the five dimensions, nine do not. Section 6 has the list.

## 1. What the engine is for

The final outcome and the standing constraints, each with its citation.

- Final outcome. "The end goal is an open-source show platform," released to the community, usable by non-technical game designers, extensible by technical people. [RM:40-44]
- Designer. Builds a complete game as a pack inside the design tool, never touches code or configuration files, and tunes through the design-iteration loop. [RM:48-54]
- Venue installer. Fills in an installation profile, connects the pack's abstract names to real instruments on one page, then runs a one-button preflight that answers go or no-go with every line traceable. [RM:55-65]
- GM. Runs the show from four domains: Game Ops, Show Control, Environment, Game Admin. The post-game report builds itself from material captured during play. [RM:62-65]
- Player. Taps tokens on a phone or a shared station with no account, no login, no app install and no recorded identity unless the game designs an identification moment. [RM:66-70]
- Business shape. One production, one kit, many games on it. A second kit or operator is a named possibility the program deliberately does not plan for, and it must stay cheap to start. [RM:71-75]
- Constraint 2.1, identity. Players never get accounts or logins. The engine's only built-in identity is the device or session id. Person-level identity is game policy. Game data stays on the kit unless the owner moves it. The owner decides retention per game. [RM:81-100]
- Constraint 2.2, growth without corners. The pack and profile are selected by path or id. No kit-unique identifiers in engine code. The DNS and IP model works per kit. Media bundles can move between machines. Multi-kit features wait for the operations era. The seams are built now. [RM:102-111]
- Constraint 2.3, media model. Media files never live in git packs. The pack names its files with hashes. A managed media bundle carries them. [RM:112-126]
- Constraint 2.4, the design-iteration loop. Edit, apply, playtest, repeat. The mechanics editor and hot-apply are one deliverable. [RM:128-135]
- Constraint 2.5, platform parity. Phone clients and hardware scanners stay equal in engine capabilities. "Never design a mechanic whose iteration loop requires re-flashing a fleet of devices." Everything a designer iterates on is pack data. [RM:137-149]
- Constraint 2.6, the engine holds no opinion. Identification, rosters, station scarcity and tracking policy are pack and kit parameters. [RM:151-154]
- Authority split. Backend decides the scores in networked mode. The GM scanner computes locally in standalone mode. The backend's `gameRules` functions are the parity surface. [CMD:89-93, CMD:121-123, CTX:241-244]
- Frozen production. Nothing deploys to the live venue machine until the owner's show-ready decision. [CTX:638-643, RM:160-166] The owner restated on 2026-10-30 that the game runs on blue until the new engine is ready on green, with no governing date. [CS:59-68, RM:648]
- Blue containment. Work on the new engine never touches blue's branch. Lessons from blue go into architecture and interfaces, never into patches on blue or one-for-one ports. [CS:100-114, CS:59-66]
- Floor. Session lifecycle, show control and score intervention stay operator-only. [CTX:564-581]
- Honesty rule. The preflight states its own limits and labels every check paper or live. [RM:309-317, CTX:434-442]
- Alarm integrity. Red always means act now. Intentional absence shows grey. [CTX:350-352]
- Pre-previewable safety. The committed live Home Assistant token and admin password rotate before the first outside person touches the system. [RM:222-226]
- Toy pack proof. A second game stays in the repo forever. Every slice passes the dual-pack run. [CTX:245-250, PRG:277-286]

## 2. Capabilities, built and planned

Status words: built, partly built, planned in Block N, chartered later, deferred to row 8.x. Code checks are marked "code" and I ran them read-only.

| ID | Capability | What it is | Status | Citation |
|---|---|---|---|---|
| C1 | The pack | The data defining one game: tokens, rules, modes, strings, theme, cues. Media is named, never stored. | built | CTX:31-35, RM:112-126 |
| C2 | The activation gate | At boot the backend adopts one pack and refuses to start with a pack that fails the gate. | built | CTX:198-224 |
| C3 | Pack channel and identity reporting | The backend serves the active pack. Every consumer reports its loaded pack identity. | built | CMD:119-120, PRG:62-70 |
| C4 | Draft and publish pack store | The config tool copies the pack to a private draft. Publish runs the engine's gate and lands it. | built | CTX:582-589, PGS:41-47 |
| C5 | Installation profiles | The venue document: bindings, endpoints, network. Plural. Every environment is partial. | partly built (loader, schema, in-repo profile built; the profile-file check at boot paused) | CTX:129-135, C23:379-380, HP:49, CS:125-129 |
| C6 | One truth: collectPackNeeds and resolve() | One pure function turns needs and a profile into verdicts. Every surface quotes it. | partly built (core built; editor badges, CLI and cue-time uses not) | CTX:181-197, C23:418-430, RM:379-380 |
| C7 | The preflight | One go/no-go list. The machine checks everything it can observe and lists what it cannot. | partly built (minimal evaluator only; arms, domain push, CLI, panel, human checklist and scoreboard-liveness check paused) | CTX:421-433, RM:306-317, CS:128-129, code `backend/src/services/preflightService.js:15-18`, code `ls backend/scripts` shows no `preflight.js` |
| C8 | Dormancy | Third health word, sticky, two doors, silences dependent cues. | built, with 12 standing findings whose fixes were lost; operator door planned in the paused supervisor lane | CTX:338-349, RM:296-304, CS:119-127, REC:34-54, HP:55 |
| C9 | The supervisor | Bounded auto-restart with backoff for crashed stack programs, then a red row with a Restart verb. | planned in Block 2 (paused) | CTX:362-366, RM:299-302, HP:198-215 |
| C10 | The host-config file | Plain file for restart strategies; modes `self` and `adopt`. | planned in Block 2 (paused) | RM:318-319, HP:55, HP:216-231 |
| C11 | Self-heal | Software fixes what it can silently: stale scanner pack, crashed programs. | planned in Block 2 (paused) | CTX:357-361, C23:349-355, HP:256-271 |
| C12 | Credentials on every connection | Every socket presents a verified operator or observe token; handshake `deviceType` retired. | planned in Block 2 (paused) | HP:42, HP:56, HP:272-285 |
| C13 | Auth tiers, the floor, the observe token | Operator, device and session tiers; floor functions; read-only scoreboard credential. | built (operator-tier v1) | CTX:553-597 |
| C14 | Held items | Cues and videos blocked by an outage or a busy video, parked for the GM. | built; hold-expiry policy for service-down holds planned | CTX:331-337, HP:248-255 |
| C15 | Service domains and `service:state` | The only push channel for service status, `{domain, state}`. | built (10 domains); `preflight` an eleventh planned | CTX:367-370, CMD:261, HP:192-197 |
| C16 | Hot-apply (E10) | Reload a pack without restarting the orchestrator. | deferred to row 8.6 (lands in Block 5); code: nothing exists | RM:598, RM:128-135, PGS:177-187, PGS:344-352 |
| C17 | The five Design workspace pages | Pack manager, mechanics editor, strings and theme editor, show designer, content view. | planned in Block 5 (pack manager, mechanics) and Block 6 (the rest); B0 store, auth, harness and show-designer prototypes built | CTX:603-607, RM:375-416, PGS:49-75 |
| C18 | The design-iteration loop | Change a value, apply, play, observe. | planned in Block 5 | CTX:371-375, RM:128-135 |
| C19 | Live verdict badges in the editor | resolve() run against the draft and loaded profile, labeled paper or live. | planned in Block 5 | PGS:483-489, RM:379-380 |
| C20 | Rehearsing on a preview engine | The draft runs on a second orchestrator under a preview profile; player actions performed in simulated form. | planned in Block 5 (affordance); full Rehearse surface later | CTX:508-514, RM:380-382, UXF:351, PGS:196-205 |
| C21 | Simulation and preview profiles | A simulation is an ordinary profile bound to software stand-ins, generated from a pack's needs. | partly built (generator exists; preview profile planned) | CTX:515-521, PGS:502-505, code `backend/scripts/lib/simulationProfile.js` |
| C22 | The Deploy stage | Config tool's fourth nav item: the handoff from designer to venue technician to GM. | planned in Block 6; nav words half-ruled | CTX:497-503, UXF:466-478, RM:409-411 |
| C23 | Bindings page and thin profile-manager page | Connect pack roles to venue instruments; list, open, save, version, export, import profiles. | planned in Block 6 | RM:409-411, PRG:216-217 |
| C24 | Hardware/roles editor, tech rider, capability catalog, reference kit | The designed venue's surface, the rider for the technician, the palette, the published demo kit. | planned in Block 6 (editor, rider); catalog census first; reference kit with the toy pack | RM:407-409, UXF:359-362, CTX:534-545 |
| C25 | Planning view | "If I bring hardware X, what unlocks?" | deferred to row 8.4 | RM:596, CTX:461-464 |
| C26 | The GM scanner's four domains | Game Ops, Show Control, Environment, Game Admin as four structural domains. | built | SCN:464-470, RM:62-64 |
| C27 | The GM scanner redesign | New information architecture for mid-game; manual phase-advance control; phase-relative cue timing. | deferred to row 8.17 (design opens in Block 5) | RM:395-397, RM:609 |
| C28 | The truth sweep | Audit and repair of the store-fed path to the admin panel. | planned in Block 3 (not started; scope and order under review) | RM:328-346, CS:66-67, CS:130 |
| C29 | Screen baselines and screen-capture tests | Reference images of the pinned release; image tests of the panel. | planned in Block 3 (moved from Block 1) | RM:213-216, RM:343-344, HP:59, CS:118-120 |
| C30 | Capture: roster, notes, accusation | Roster before play; one-tap notes during; accusation and whiteboard after. | planned in Block 4 | RM:348-373 |
| C31 | Photo capture and the photo store | The engine has no binary upload path; one must be designed under the privacy defaults. | planned in Block 4 (second sub-scope) | RM:365-369 |
| C32 | The session-bundle emitter | The structured bundle contract exists; nothing writes bundles. | planned in Block 4 | RM:358-361 |
| C33 | Report pipeline migration to the bundle | The external pipeline consumes the bundle instead of the markdown report. | deferred to row 8.10 | RM:602 |
| C34 | The Review stage | Telling the story of the night; the platform owns the record, intake and handoff; the game owns the telling. | partly built (bundle contract); workspace chartered later | CTX:522-530, UXF:355 |
| C35 | Players' phones | Tap-to-web, receiving experience, device-tier tokens, session-tier identity. | chartered later (section 7.1); rows 8.11, 8.13, 8.19 | RM:514-527 |
| C36 | Interaction primitives v1 | Compound-scan engine, both platforms, specified by the second game's tap grammar. | chartered later (section 7.1) | RM:518-520, PRG:250-256 |
| C37 | Entity-field wire migration | Remove the `teamId` alias in favor of the entity field. | chartered later (section 7.1) | RM:522-524, CTX:163-170 |
| C38 | The second game's modules | Compound-scan engine, hidden-state module, graph state and scoring, constellation display. | chartered later (section 7.2); row 8.8 | RM:529-544, BILL:83-110 |
| C39 | Remote displays | A second display on the kit network showing only the scoreboard page. | partly built (Pi 4 runs today on an observe token; the `display.remote` family and preflight count planned) | CTX:465-470, CTX:590-597, HP:58 |
| C40 | Media bundle and asset channel | Files copied to known directories; a managed bundle later. | partly built (asset channel built; checking in Block 5, upload later) | CTX:36-42, CTX:55-59, RM:112-126, RM:593 |
| C41 | Content tooling and the source adapter | Replace Notion; the full narrative corpus; AI-assisted authoring. | chartered later (section 7.3); row 8.9 | RM:546-558, RM:601 |
| C42 | Seams for more kits and packs | Pack and profile chosen by path or id; multi-game kits, steady-state releases, fleet growth later. | partly built (`PACK_PATH`, `PROFILE_PATH`); features chartered later | RM:102-111, RM:560-575, CTX:225-232 |
| C43 | Kit network, DNS and certificate | Pi runs dnsmasq; router gives three settings; certificate for tablets and phones. | deferred to row 8.19 | RM:611, CTX:471-479 |
| C44 | Blue/green cutover | Unplug blue, plug in green; physical rollback. | built (method ratified); green not started | RM:442-460, CTX:480-485, CS:86 |
| C45 | Block 1 deliverables | Whole-train review and merge, deployment-docs repair, boot-to-running posture, home hardware pass, screen baselines. | built except the home hardware pass (owner's, not started) and baselines (moved to Block 3) | RM:273-292, RM:180-181, RM:783, CS:118-120 |
| C46 | Test environment | Environment ladder, rung-1 rig, dual-pack Tier L, harness minimum, witness lights. | partly built (Tier L and harness minimum built; the rig was lost with the container) | CTX:248-250, CTX:443-460, CS:82-85, HP:955 |
| C47 | Open-sourcing and the release block | Secrets hygiene, license, human-facing docs, privacy defaults, stranger-can-stand-it-up. | chartered later (section 7.4); the Adoptable state | RM:228-232, RM:576-583 |
| C48 | First-run state | Persistent checklist, teaching empty states, templates at the threshold. | planned in Block 5 (toy-pack threshold) | RM:381-382, CTX:546-549 |
| C49 | Hardware-scanner parity | ESP32 scanners drive the same pack-declared interactions as phones. | partly built (asset sync built); primitives chartered later | RM:137-149, RM:518-520 |
| C50 | Ledger retirements L7, L8, L12 | Retire the loud fallbacks and the last venue-hardware literal in pack content. | planned in Block 5 (L8) and Block 6 (L7, L12) | RM:400-401, RM:411-413, RM:594-595 |
| C51 | Block 6 close | The pages-unit close through the dual-pack run, the ledger sweep, the bounded doc triage (row 8.7), the era close record. | planned in Block 6 | RM:412-415, RM:599 |
| C52 | Preset-load differential gate | The config tool's preset load refuses only newly introduced problems. | deferred to row 8.18 (Block 5) | RM:610 |

Coverage check for the task. Block 1 items are in C44 and C45. Block 2 items are in C5 to C12. The health-state change is in C8. Block 3 is in C28 and C29. Block 4's three deliverables are in C30 to C32. Block 5 items are in C16 to C21, C27, C48, C50 and C52. Block 6 items are in C17, C22 to C24, C50 and C51. Section 7.1 is in C35 to C37, section 7.2 in C38, section 7.3 in C41, section 7.4 in C42, C43, C47. Open-sourcing is C47. Remote displays are C39. Seams are C42.

## 3. What each capability asks of the runtime architecture

Format. "Demand" quotes or closely paraphrases a document. "Inference" is my reasoning. The five dimensions are authorities, copies and delivery paths (A); supervising programs (S); reading outside programs (R); keeping a second engine or a test run off the live machine (T); and game-session boundary, system reset, pack change (B).

Programs the engine runs, from the documents. VLC, started by the engine. MPD, started by the engine. The Chromium kiosk. `pactl subscribe`. Two D-Bus monitors, one for VLC and one for BlueZ. The Home Assistant WebSocket and its container. `pw-play` for sound. [HP:216-231, BCM:445-446, BCM:500, C23:484-489]

### 3.1 The pack, the gate, the channel, the draft store (C1 to C4)

- A. Demand: "If someone edits the pack on disk while the process runs, the running system ignores the edit." [CTX:200-201] The authority is `packService`, frozen by `activatePack()`. [CMD:106-120]
- A. Copies of the active pack, as the documents name them. Baked token values: `tokenService.loadTokens()` bakes value, group multiplier and token noun, then persistence saves, then `transactionService.init(tokens)`. [PGS:84-90] "the cue ENGINE holds a boot-time COPY of the cues." [PGS:97-100] The GM scanner loads its pack at app start only. [PGS:92-96] The setup game session carries a pack stamp. [PGS:301] ESP32 pack files ride the asset-manifest sync. [PRG:66-67]
- A. Inference: no document lists every consumer of the active pack in one place. Hot-apply is only as safe as that list is complete.
- A. Delivery path: `GET /api/pack/manifest` and `/api/pack/files/*`, the `sync:full` pack block and the handshake `packHash`. [CMD:119-120, PGS:301]
- T. Demand: `PACK_PATH` injects an alternate pack for testing, preview and rollback. [CTX:225-228] The config tool "never EDITS via PACK_PATH." [PGS:200-201] The tool binds one pack at a time. [PGS:332-333]
- B. Pack change today means restart. The tool's wording is "applies at next boot." [PGS:186-187]
- R. Publish runs the engine's own gate through a child-process runner. [CTX:586-587]

### 3.2 Profile, one truth, preflight, dormancy (C5 to C8, C21)

- A. Demand: the profile is "boot-frozen." "Profile changes still require a restart." [C23:277-278, HP:161] The authority is `profileService`; `PROFILE_PATH` is its seam. [CTX:228-231]
- A. Demand: `dormancyService` owns `compute()`, `apply()`, `recompute()` and the operator-latch set. "the registry entry is its projection." [HP:153-158] Latches "survive `system:reset` and are lost on a process restart, recorded." [HP:159-160]
- A. Demand: `report()` is ignored while a service is latched dormant. [HP:144-149] That makes the registry a copy of dormancyService's decision for those entries. Inference.
- A. Demand: the preflight service "holds the last evaluation (the one source); the session stamp and the domain push derive from it." [HP:189-191]
- A. Failure the pass must prevent. A missing or wrong-schema profile makes `profileService.getProfile()` return null, and the feed then reads "this venue installed nothing," latching six services dormant against the real ALN pack. [REC:65-80] The ruled fix is a failed-check row and a start refusal, not a change to `compute()`. [HP:49]
- A. Demand: "the SERVICE verdict gates its resource verdicts"; an unqueryable inventory gives UNKNOWN, "never fault." [C23:251]
- R. The preflight reads asset directories, playlist ids, Home Assistant scenes, `pactl` sinks, DNS and the gateway, plus disk, temperature, load, processes and ports. [C23:113-116, C23:254-255, CTX:421-429] Demand: "Every shell-out goes through `execHelper` with a bounded timeout; no sync fs on the evaluate path." [HP:186-188]
- S. Demand: supervision is dormancy-aware: "a profile-dormant service's child is neither started nor restarted." [HP:204-206]
- B. Demand: the feed runs "at the end of `initializeServices`, at session create, inside system reset after cues reload." [HP:158-161] After a reset the feed re-runs from the boot-frozen pack and profile. [C23:246, C23:274-276]
- B. Standing finding: system reset marks `display` down and "nothing ... ever re-reports it, so the row and Show-Scoreboard read falsely red after every reset." [REC:183-197, KO:152-154]
- B. Demand: fault holds "expire at SESSION END"; dormant never holds. [C23:249, HP:248-255]
- B. Demand: the start-of-session gate "re-run and re-stamped with `restoredAt`" on restore at boot. [HP:171-173]
- Contradiction seen in code vs plan: `dormantServicesFor` throws on a manifest endpoint key outside the five known families, while the manifest schema allows any key. The boot pass swallows the throw and `session:create` fails hard. [REC:83-100]

### 3.3 Supervisor, host config, self-heal, credentials, holds, domains (C9 to C15)

- S. Demand: "Four supervision shapes exist; Chromium has none and no red row." `ProcessMonitor` resets its failure counter on any output; VLC retries at a flat 3 seconds. [HP:80-83] Today the engine "retries every 3 seconds, forever, silently." [RM:299-301]
- S. Demand: services get a sliding flap window and a `gave-up` state; observers keep unbounded restart with backoff and never escalate. [HP:198-208] Chromium becomes a `ProcessMonitor` consumer. "One supervision path" is owner-ruled. [HP:57]
- S. Demand: child identity. The D-Bus monitor "keys on the generic org.mpris.MediaPlayer2.vlc name and confused a stranger VLC for its child"; "child identity is a supervisor requirement." [C23:444-459]
- S. Demand: the engine self-hosts MPD and VLC; "a harness-owned instance CONTENDS with the engine's child." Which user runs the engine is host config. [C23:458-459, C23:484-489]
- S. Demand: host modes are `self` and `adopt`. Whether a program runs tonight is the profile's truth, never the host file's. [HP:55]
- S. Triage requirements the supervisor must absorb: stale-process cleanup that can match the wrong process (W9 P0.3), a music-server crash not visible at once (FB), shared process-ID files (W10 P2). [TRI table "Backend and test harness"]
- A. Demand: verbs are commands, `service:restart`, `service:out-of-service`, `service:in-service`, `preflight:run`. [HP:232-247]
- A. Code: `musicService.js:73` and `:231` keep a private `connected` flag beside the registry. [KO:126-128, code `backend/src/services/musicService.js:73,231`] CMD:265 records the exception.
- A. Demand for self-heal: the scanner "replaces its copy" through `packLoader.refresh()`, at a session boundary, once per `{connection, serverHash}`. [HP:256-271, KO:91-93]
- B. Demand: credentials. "Every live connection must present a credential." [HP:42, HP:272-285] The collision check stays GM-scoped.
- A. Demand: `health` and service state travel separately today, so one can change without the other. [KO:140-142] Hold expiry has two stores: the cue store and `videoQueueService`'s own. [CTX:335-337, BCM:498]

### 3.4 Hot-apply (C16)

- A, B. Demand: "E10 = FOUR named steps": `activatePack()` re-entry; the token re-bake with persistence save and `transactionService.init`; engine re-init "per the systemReset recipe," reloading cues and "naming every boot-copy consumer"; and the `pack:applied` client directive. [PGS:344-352]
- B. Demand: the guard. "hot-apply REFUSES while a session is active or paused." A per-session playtest opt-in is "a recorded later addition, not built now." [PGS:490-492]
- A. Demand: clients. GM scanners re-run their pack load, kiosk pages reload, and the setup game session's pack stamp is re-stamped. [PGS:348-352] The scanner path composes with self-heal; "each orchestrator authoritative for its own stations." [PGS:504-506]
- A. Demand: three identities are visible to the designer: the live tree, the draft, and the running orchestrator's activated hash. [PGS:328-330]
- R. Contract-first: the `pack:applied` addition goes to AsyncAPI first. [PGS:349-350, CMD:238]
- Code facts, run read-only. `grep -rniE "hot-apply|hotapply|pack:applied" config-tool/lib config-tool/public ALNScanner/src backend/src backend/contracts` returned no lines. Inference: the pass designs hot-apply from scratch.
- Inference: a hot-apply that works must not leave `dormancyService`, `preflightService` and the cue engine's disabled sets computed from the old pack. They are all derived from the frozen snapshot [HP:153-161], so the list of step-three consumers grows with Block 2.

### 3.5 Design pages, the loop, badges, preview, rehearse (C17 to C21)

- A. Demand: editing "never touches the live pack." Draft stamps the live `base` contentHash; publish refuses on a base mismatch. [CTX:582-589]
- A. Demand: badges are "computed by running the C2 pure resolve() against the DRAFT + the loaded profile." [PGS:483-489]
- T. Demand, the isolation seam. "the preview KILLS the live orchestrator's helpers; it shares dataDir (writes into live persistence) and secrets (mints tokens the live server accepts)." [PGS:302] The fold: an `ALN_RUNTIME_PREFIX` seam namespacing "every /tmp/aln-* PID/socket/conf/db path AND the persistence dataDir"; loopback bind; video, music, bluetooth, audio and lighting disabled; own JWT secret; no discovery broadcast; tool-owned child lifecycle with orphan sweep. [PGS:354-364]
- T. Code facts. `grep -rn "ALN_RUNTIME_PREFIX" backend/src backend/tests docs` hits only `PGS:358`. `grep -rn "aln-pm-\|/tmp/aln-" backend/src --include=*.js` finds fixed paths in `vlcMprisService.js:117`, `audioRoutingService.js:793`, `musicService.js:47,48,607`, `bluetoothService.js:501`, `mprisPlayerBase.js:209`, `mpdConfigBuilder.js:20-24`, `app.js:225` and `displayDriver.js:53`. Seams that exist: `DATA_DIR` and `LOGS_DIR` (`backend/src/config/index.js:52-53`), `PACK_PATH` (`packService.js:167`), `PROFILE_PATH` (`profileService.js:48`), `CHROMIUM_BIN` (`displayDriver.js:165`).
- T. Code facts. Boot-time machine-wide kills: `audioRoutingService.js:603` (`pkill -f 'pactl subscribe'`), `displayDriver.js:147` (`pkill -9 -f chromium.*--kiosk`). HP:964 records the first as a finding carried: "every orchestrator boot runs `pkill -f "pactl subscribe"` and card probing machine-wide; pre-existing."
- T. Demand: the preview ships with a preview profile so hardware-shaped needs "resolve dormant on a laptop." [PGS:502-505] A generated simulation profile can meet every need in software. [CTX:515-521, UXF:445-451]
- A. Demand: the preview engine has its own hash, so the handshake mismatch warn keys on the live engine only. [C23:207-209, PGS:504-506]
- B. Inference: the loop is edit, publish, hot-apply, play. Apply needs the game session in `setup`, `ended` or none. [PGS:181-187] Player scans pass in `setup` [BCM:202]; GM transactions do not [code `backend/src/services/transactionService.js:157,767`]. A rehearsal that scores through the GM path needs `session:start`, which runs the require gate. [HP:162-174]
- B. Open: whether the cue engine fires standing cues in `setup`. BCM:373 says pausing suspends it; nothing I read says what `setup` does. Gap.
- Demand: the full Rehearse surface is a seam now: "preview orchestrator + simulation profile + editor rehearse-affordance." [UXF:351]

### 3.6 Deploy, bindings, rider, planning view (C22 to C25)

- A. Demand: Deploy is the handoff chain made visible: pack, tech rider, bindings, a system ready to Run. [CTX:497-503] The rider is derived from `collectPackNeeds`, "never a second source of truth." [CTX:534-538]
- B. Demand: profile changes need a restart. [C23:277-278] Inference: Deploy's "bind and go" flow ends with a restart or a profile reload, and the pass must say which, because the pack side has hot-apply and the profile side does not.
- A. Demand: the planning view answers for a hypothetical profile and never touches live state. [CTX:461-464, RM:596] Inference: pure paper, no runtime demands.

### 3.7 GM scanner, redesign, sweep, baselines (C26 to C29)

- A. Demand: "The client mirrors backend state ... and the mirror has add-only or one-shot update paths." [KO:104-106] Lesson: "The scanner keeps its own copies of backend state, and those copies mostly only grow." [KO:138-139]
- A. Demand: the audited surface. 10 service-state domains; 55 producer edges; 10 reconnect-restore paths with a non-uniform section-to-domain key mapping; 5 reshaping places; 22 accepted event types; one forwarded event with no consumer. [RM:338-343, T3C:1-60] I re-ran two counts: `MESSAGE_TYPES` has 22 entries at `ALNScanner/src/network/orchestratorClient.js:26` (command: awk over the const block, counting quoted strings), and `KNOWN_SERVICES` holds 9 ids at `backend/src/services/serviceHealthRegistry.js:32`.
- A. Demand: new backend events "MUST be added to this list or they silently won't arrive." [SCN:484]
- A. Demand: every `sync:full` emitter must pass every service; the bug "has recurred 4 times." [BCM:529]
- A. Demand: sweep scope is "the store-fed path only"; the three renderers on the transaction path are out. [RM:333-337]
- A. Triage: scanner copies of backend state that go stale include token claims after a transaction delete (A-3), after Reset All Scores (A-4), and after reload (A-9). [TRI table]
- B. Demand: the retained ended session changes what the scanner sees at a game-session boundary (C-1 backend half), "so the two are designed together" with self-heal. [TRI rows C-1, A-9]
- A. New runtime state in the redesign. The "manual phase-advance control and phase-relative cue timing" put a new writable fact, the current phase, in the GM's hands. [RM:609, BCM:170 for the existing `phase:changed` event]
- Inference: the pass's rule for "who decides each fact" should be applied to the sweep's 10 domains and 22 event types before the sweep audits them.

### 3.8 Capture, bundle, photos, report, Review (C30 to C34)

- A. Demand: capture touches "the GM scanner (five files, including the event ingress list where an unregistered event silently never arrives); the game-session model and its validation schema (which today silently strips undeclared fields); persistence across restart; delivery in the reconnection payload plus its completeness test; the engine's permission tables ... and three contracts." [RM:351-358]
- A. Demand: "the engine has no binary upload path at all; one must be designed under the privacy defaults." [RM:365-367]
- A. Demand: the bundle emitter is owned by no one yet; it is owned in Block 4. [RM:358-361]
- B. Demand: the record is generated when the game session ends. [UXF:244-246] Inference: the emitter reads authorities at the end boundary, so any copy-only fact (a notes draft on a tablet) must reach an authority before the session ends.
- B. Demand: data stays on the kit; retention is the owner's call per game. [RM:96-98]
- R. Review's built-in story-of-the-night reading "must stand alone." [CTX:527-530]

### 3.9 Phones, primitives, second game, remote displays (C35 to C39, C49)

- A. Demand: "surfaces receive SERVER-SIDE projections scoped to their granted functions"; mandatory for hidden-information games. [PRG:244-249] "ALN's scoreboard receives full transaction data and filters CLIENT-side. That is fatal for any hidden-information game." [BILL:75-79]
- A. Demand: function resolution accepts actor identity presented in the interaction, with the device as transport. [PRG:244-248, CTX:553-558]
- A. Demand: the second game needs hidden per-player and per-token state, graph state and a second scoring model selected by the pack; the module lives in the `gameRules` library. [BILL:93-106] "BILL is networked-only by nature." [BILL:37-39]
- A. Demand: a constellation display plugs into the display-surface seam. [RM:529-537, CTX:146-162]
- B. Demand: game state persists across restart in the session. Inference: new hidden state needs its authority named, its persistence path and its reconnect payload, the same three demands as the capture block.
- A. Demand: observe tokens are minted per page serve into a capped store, never beside operator tokens. [CTX:590-597]
- Capacity. "kit capacity work precedes phone load." [RM:526] No number exists.
- Parity. Hardware scanners and phones stay equal in capabilities. [RM:137-149] Inference: any new interaction primitive adds firmware work for the ESP32, and the pack cannot rely on re-flashing.

### 3.10 Media, seams, DNS, open-sourcing (C40 to C43, C47)

- R. Demand: the pack names files; the live check reads them from known directories on the orchestrator. [CTX:55-59, C23:113-116] The preflight needs a `video-file` need kind. Not built: `ls backend/scripts` shows no `preflight.js`, and the C23 note at `C23:526-531` records the gap.
- T. Demand: ROADMAP 2.2 asks that "the pack is selected by path or id, never assumed to be the only one; the profile likewise." [RM:102-111] Inference: the runtime-namespace seam of 3.5 is the same demand applied to process files and sockets.
- B. Demand: after cutover "engine updates only between events; pack updates any time." [RM:567-570]
- A. Demand: DNS lives on the Pi (dnsmasq), not the router. [CTX:471-479] Inference: dnsmasq is a program the host runs and the engine does not drive; the preflight's network arm reads it. [C23:254-255]

### 3.11 The test environment (C46)

- T. Demand: tests must not share the machine with the live system: "the files that track running programs, the TV, and the running video and music programs." [KO:147-149] "a unit test can kill the live video player." The triage marks this "required before tests run on a Pi." [TRI W10 P2, P3, P4]
- T. Demand: the rung-1 rig runs the real software stack as one non-root user, with fake physics (Xvfb, null sinks, mocked BlueZ, witness lights). [C23:475-487, CTX:443-460]
- T. Demand: tests "skip LOUDLY with recorded reasons, never silently." [C23:385-388]
- T. Built: per-worker data and log directories and the log guard. [HP:955] Not built: an audio-init off switch for harness children. [HP:964]
- Lost: the rig itself, with the container. [CS:82-85] The recipe is in `docs/plans/2026-09-12-container-baseline.md` section 7. [CS:164-165]
- B. Demand: a system reset in tests and production share one code path. [BCM:137]
- Inference: a test run and a preview engine need the same namespace seam. Build it once.

### 3.12 Rows of section 2 with no runtime-state demand of their own

These rows add nothing I found beyond the sections above: C25 (planning view, pure paper), C33 (the external pipeline's migration), C41 (content tooling), C44 and C45 (cutover method and Block 1 docs and merge work), C47 (license and human docs; its secrets half sits in 3.10 only as the pre-previewable rotation), C50 to C52 (pack-content edits, close sweeps, a config-tool load rule). C13, C14 and C15 appear inside 3.2 and 3.3.

## 4. Ratified decisions the pass must respect

Who ratified is the owner unless noted. "Under review" means the pass may re-cut it.

- The pass is the next unit and is a roadmap revision run like the September re-charter. Owner, 2026-10-30. [CS:16-31]
- The owner's condition: the orchestrator must understand the engine and the roadmap, starting with how the truth sweep differs from the pass. Owner, 2026-10-30. [CS:23-26] The owner's 2026-10-30 reply to this round repeats it.
- The goal: the game runs on blue until the new engine is ready on green; lessons go into architecture. Owner, 2026-10-30. [CS:59-68]
- The order Block 2 before Block 3 is under review. [CS:66-67, KO:59-60 quote "potentially backwards"]
- One truth, three loops. Ratified 2026-09-04. [CTX:181-194]
- Activation fixed for the process. Ratified in A2; hot-apply is in the gate. [CTX:198-202, PRG:544-547]
- Gate flavors i and ii; gate reads only pack files. [CTX:203-212]
- Health words `healthy | down | dormant`; sticky dormant with two doors. Ratified 2026-09-04. [CTX:338-349, C23:369-370]
- Supervisor with bounded restarts, restart strategies in host config. Ratified 2026-09-04. [CTX:362-366, C23:371-377]
- Scanner self-heal replaces a dismissible banner; refusal only as the backstop. Ratified 2026-09-04 (R-C2-1). [C23:349-355]
- Preflight machine-runs everything observable, including a Host arm. R-C2-2, 2026-09-04. [C23:356-359]
- The require gate with a typed, logged override. R-C3-1, 2026-09-04, widened to profile failure by R12, 2026-09-12. [C23:360-368]
- The price principle: "the design we grilled into shape gets built as designed; the estimate follows the design." 2026-09-04. [C23:343-346]
- Pages: mechanics editor owns `game.json`; hot-apply refuses active or paused sessions; the ENDGAME literal is retired; create-new-pack is in; preview ships with a preview profile; per-page mock gate. Owner, 2026-09-04 "ratify all". [PGS:477-514]
- UX foundation: hats not humans; the loop model; first-success is "scan, then the show reacts"; "a simulation" and an undeployed show pack are the same thing; target-profile-as-lens withdrawn; hardware/roles editor joins the pages. Owner, 2026-09-04. [UXF:107-113, UXF:124-137, UXF:434-463]
- Deploy is the tool's fourth nav item, not a fifth stage. Owner, 2026-09-05. [CTX:497-503]
- The roadmap's standing constraints 2.1 to 2.6. Owner, 2026-08-29, reaffirmed in r4 on 2026-09-05. [RM:77-154]
- Q-ratifications in r4: whole-train review (Q1r), truth sweep after the health-state change (Q2), capture block priced first (Q3), roster+notes+accusation before photos (Q6), candidate Block 5 slice (Q7), screen baselines (Q8), docs repair first (Q9), secrets rotation before previewable (Q12), honesty rule and boot-to-running (Q13). [RM:172-175, RM:345-346, RM:368-373, RM:378-382, RM:213-216, RM:222-226, RM:309-317, RM:283-287]
- Blue/green cutover; borrow/restore protocol. Owner, 2026-08-29. [RM:442-510]
- Frozen production until show-ready; the cutover has no date. Owner, 2026-09-05, restated 2026-10-30. [CTX:638-643, RM:648]
- Hardening rulings R1 to R27 (owner-ruled 2026-09-12, for example R5 credentials on every connection, R6 and R13 supervisor ships enabled, R18 host modes `self` and `adopt`, R19 handshake `deviceType` retired, R20 one supervision path, R21 remote display family, R26 adversarial review at three points). Owner. [HP:36-64] Status: the pieces are paused and the pass re-plans them. [HP:3-6, CS:125-129] Ruling 34 says the on-hold briefs are not edited until the pass rules. [HP:983]
- The extraction brake and the dual-pack gate. [CTX:653-659, CTX:248-250]
- Media never in git; the media bundle. Owner, 2026-08-29. [RM:112-126]
- Unconfirmed: the "authority" addition that an outside program can be one. Orchestrator wording, not yet owner-confirmed. [CS:34-36]

## 5. Open design questions the pass touches

- The six questions of the pass. Who decides each fact the GM sees; does a service's state travel with its health; how does the engine read the programs it drives; can a test touch the live show; does one question get one answer; who re-checks after a reset. [CS:18-26]
- The pass's outputs and the path for blue's lessons (the owner did not follow them; to be re-asked in plain words). [CS:37-40, KO:163-165, KO:180-181]
- Whether the three green follow-ups ship before green's hardware pass; the owner leans yes. [CS:39-40, CS:139-142, KO:182-185]
- Method: which parts get their own investigation, with small batches. [KO:166-174]
- Which paused Block 2 briefs survive. [KO:175-177, HP:983]
- Where the truth sweep's boundary goes. [KO:178-179]
- Open from the foundation: whether Design and Author are separate nav items (UXF:470-478), the Rehearse button versus a walkable page (UXF:479-487), Review's first contents (UXF:488-490), the new-pack threshold with three doors (UXF:491-496), hosted demo, tech-rider phase and export, first-run landing (UXF:497-500).
- Players' phones entry questions. Invisible device-tier tokens (8.11), the tier-ladder roster (8.12), the team and player-management and interaction batches (8.13). [RM:603-605, RM:660-661]
- Capture slot against the preview block, decided once the capture block is priced. [RM:370-373, RM:642-643]
- Pack-reload integration was moved from Block 2 to Block 5. [RM:325-326, RM:398-399]
- Whether the packHash mismatch behavior survives the self-heal ruling (8.5). [RM:597]
- The playtest opt-in for hot-apply during a session. A later addition, not built. [PGS:496-497]
- Where a preview engine runs, and how many engines one machine may host. Gap, not asked anywhere. See Conclusions.
- Whether the cue engine fires standing cues in `setup`. Gap.

## 6. The deferral registry

Count command: `grep -cE '^\| 8\.[0-9]+ \|' docs/plans/ROADMAP.md` printed 19. `grep -nE '^\| 8\.[0-9]+ \|' docs/plans/ROADMAP.md` lists RM:593 to RM:611, one row per line, 8.1 through 8.19.

The five dimensions: runtime state (RS), process supervision (PS), outside programs (OP), test isolation (TI), lifecycle (LC).

| Row | Item | Bears? | Why |
|---|---|---|---|
| 8.1 [RM:593] | Media reference validation and the "what this pack needs" surface | yes, OP | The live check lists asset directories, playlists and bindings. [C23:113-116, PGS:145-150] |
| 8.2 [RM:594] | Ledger L8, the ENDGAME speaker literal | no | A pack content edit; the audio role resolves through the profile. Inference. |
| 8.3 [RM:595] | The idle-loop video's pack home | no | The channel-name half shipped; the rest rides 8.1. |
| 8.4 [RM:596] | Planning view UI | no | Pure paper against a hypothetical profile. [CTX:461-464] |
| 8.5 [RM:597] | PR-review residue: packLoader timeout, staging-cache race, packHash mismatch | yes, RS and LC | They concern the scanner's copy of the pack and its replacement at a boundary. [HP:256-271] |
| 8.6 [RM:598] | Hot-apply | yes, RS, LC, TI | A pack change under a running engine; four steps; a guard on game session state; a preview engine. [PGS:344-352, PGS:302] |
| 8.7 [RM:599] | The 2026-06-18 documentation audit | no | A document triage. |
| 8.8 [RM:600] | Pack-defined new display surfaces and the constellation renderer | yes, RS | Needs server-side projection and hidden state per surface. Inference, from [BILL:75-82]. |
| 8.9 [RM:601] | The source-adapter interface | no | A content-pipeline interface. |
| 8.10 [RM:602] | Report pipeline migration to the bundle | no | The external consumer's migration. The emitter it waits on bears on LC. |
| 8.11 [RM:603] | Invisible device-tier tokens | yes, RS | Who may act, and where tokens are minted and capped. [CTX:553-563, CTX:590-597] |
| 8.12 [RM:604] | Tier-ladder roster and scripted capability profiles | yes, TI | They are the acceptance instrument and the harness uses them. [CTX:134-135] |
| 8.13 [RM:605] | Team and player-management and interaction questions | yes, RS | They decide who holds team and player state. Inference. |
| 8.14 [RM:606] | Hardware-scanner UDP discovery plan | no | Parked indefinitely. |
| 8.15 [RM:607] | A second ALN-class game | no | Operations-era feature; the seams are the only runtime link. [RM:102-111] |
| 8.16 [RM:608] | GM-scan video cueing | yes, RS | The scan-to-video trigger is engine-keyed to player scanners, a decision about which authority fires video. [CTX:328-330] |
| 8.17 [RM:609] | The GM-scanner redesign | yes, RS | The scanner holds the most copies; the phase-advance control is new writable state. |
| 8.18 [RM:610] | Preset-load differential gate | no | A config-tool load rule. |
| 8.19 [RM:611] | Kit DNS and the certificate | yes, OP | dnsmasq becomes a host program the preflight network arm reads. [C23:254-255, CTX:471-479] Inference. |

Tally. Ten rows say yes (8.1, 8.5, 8.6, 8.8, 8.11, 8.12, 8.13, 8.16, 8.17, 8.19). Nine say no (8.2, 8.3, 8.4, 8.7, 8.9, 8.10, 8.14, 8.15, 8.18). Total 19.

## Completion check

- Counted: ROADMAP section 8 rows. Count: 19. Command: `grep -cE '^\| 8\.[0-9]+ \|' docs/plans/ROADMAP.md`. Section 6 lists all 19.
- Counted: capability rows in section 2. Count: 52 (C1 to C52). Command: `grep -cE '^\| C[0-9]+ \|' docs/plans/architecture-pass/2026-10-30-map-direction.md`.
- Counted: `MESSAGE_TYPES` entries. Count: 22. Command: `awk '/const MESSAGE_TYPES/,/\];/' ALNScanner/src/network/orchestratorClient.js | grep -o "'[a-zA-Z:_-]*'" | wc -l`.
- Counted: `KNOWN_SERVICES`. Count: 9. Command: `grep -n "KNOWN_SERVICES =" backend/src/services/serviceHealthRegistry.js`.
- Checked absence: `grep -rniE "hot-apply|hotapply|pack:applied" config-tool/lib config-tool/public ALNScanner/src backend/src backend/contracts` returned nothing. `grep -rn "ALN_RUNTIME_PREFIX\|RUNTIME_PREFIX" backend/src backend/tests docs` returned PGS:358 only. `grep -rn "HOST_CONFIG_PATH\|host.json" backend/src backend/config` returned nothing.

## Terms CONTEXT.md lacks

- Preview orchestrator (the pages doc's second orchestrator process on a draft pack; the task called it a preview engine). [PGS:196-205]
- Preview profile (PGS:502-505) and runtime-namespace seam (PGS:357-364).
- Session bundle. CTX:523-524 uses "the B9 session bundle" without an entry.
- Boot copy (PGS:97-100) and boot-frozen.
- Game-session boundary (my use for the moments a game session starts, ends or restores; HP:256-271 says "session boundary").
- Session stamp: pack stamp, preflight stamp, restore stamp (HP:171-173, C23:246).
- Tier zero (C23:562-566).
- Truth sweep and hardening block. CS:30-31 says the "architecture pass" entry waits.
- Reconnect-restore path (RM:339).
- Operator latch (HP:159-160).
- Child identity (C23:455-459).
- Ledger-class constructs such as "debt ledger" appear in CTX:648-652; no gap.
