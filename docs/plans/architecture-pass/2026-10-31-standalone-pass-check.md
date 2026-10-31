# Standalone pass check: refute by default

**What this is.** The refute-by-default check of `docs/plans/architecture-pass/2026-10-31-standalone-pass.md`, sections 1 to 5. Every claim was read against the cited code or record. A claim I could confirm is marked **holds**. A claim I could not confirm, or found wrong, is marked **corrected**, and the last column gives the text to put in its place, in full. Nothing here is decided; the design changes stay "candidate, not decided".

- **Date:** 2026-10-31.
- **Tree:** `/home/user/ALN-Ecosystem`, branch `claude/nice-curie-hescfv`, HEAD `8e436c2a`. Submodules at their pins: `ALNScanner` `b521774`, `aln-memory-scanner` `e0bf299` (nested `data/` at `15d8d2e`), `arduino-cyd-player-scanner` `f81aba5`, `ALN-TokenData` `6f9bc30` (`git submodule status`). The stale clones beside the repository were not read. `backend/.env` was not opened.
- **What was run:** `git rev-parse`, `git submodule status`, `sed -n`, `grep`, `ls`, and two short `python3` reads of `ALN-TokenData/game.json` and the token files. No test, build, server or device. ESP32 behaviour is read from the `ALNScanner_v5` headers; timings are arithmetic from constants.
- **Sources read:** the pass; both sheets (`2026-10-31-standalone-gm.md`, `2026-10-31-standalone-players.md`); the cause analysis lines the pass cites; `docs/plans/CURRENT-STATE.md` section 0; `CONTEXT.md` section headings and lines 344-356, 418-426.

## The corrections that matter most

1. **The ESP32 already runs a game with no engine, if its card was filled earlier.** The pass says it "cannot be set up for a game with no engine" (SP-11, parity row 2). The config check does want a WiFi name, an engine address and a 3-digit team id, but a failed check stops nothing: setup logs "using defaults" and carries on (`ALNScanner_v5/Application.h:1598-1604`). With no WiFi name it skips WiFi and the health check (`services/OrchestratorService.h:69-72`), loads the token list already on its card (`Application.h:997`), and scans, shows the picture, plays the audio and queues every scan (`Application.h:539-597`). So the ESP32's standalone gap is narrower than the pass says: what is missing is a declared standalone setting, a way to fill the card without an engine (SP-13, SP-14), and screens that do not read as an outage. This supports the owner's parity reading of decision 22: the hardware scanner already half-does what the web scanner does, and the gap is finishing it.
2. **A test already feeds the same scans to the tablet and the backend.** C16 and its card line say no test does. Backend end-to-end test `07c` scans the same tokens on a standalone tablet and on the engine and compares the scores (`backend/tests/e2e/flows/07c-gm-scanner-scoring-parity.test.js:174-229`). It covers scoring only, and its group case skips on the shipped pack (`:302-307`; A-82).
3. **"Eleven candidates assume the engine" is eight.** C9, C14 and C16 fall short for reasons that stay with no engine, not because they assume one (section 1 paragraph 2; section 5 bullet 1).
4. **The tablet does run one of the engine's pack checks.** It refuses a pack whose schema version differs (`ALNScanner/src/core/tokenManager.js:60-66`); it reads neither `requires` nor `engine.minVersion` (C12).
5. **The delete-and-rebuild is half in `gameRules`.** The score recompute is `gameRules/scoring.js:220` (`computeTeamScores`); only the adjustment replay and the rebuild floor live in `transactionService.js` (C9, SG-11, section 5).
6. **Eight card lines ran over the 45-word limit the pass sets itself** (C1 48, C4 47, C6 49, C7 47, C9 47, C12 47, C14 48, C16 47, counted with `wc -w`). Each is rewritten below at 45 words or fewer; four of them (C11, C12, C15, C16) also change in content, and C13 gains a qualifier.
7. **Smaller facts:** "Dormant vs fault" is in CONTEXT.md section 4, not 5; question 19 is still open, not a decision; the tablet's Pages build runs on push, not by a hand-run `sync.py`; the PlatformIO tests cover more than the pass lists; a pause on a standalone game is reachable only by End-then-Pause.

## Section 1. In short

| # | Claim | Verdict | Evidence | Corrected text |
|---|---|---|---|---|
| 1.1 | The tablet decides claims, scores, teams, phase and every boundary from hand-kept copies; nothing under `ALNScanner/src` imports `backend/src/gameRules/`; the four mentions are comments at the cited lines. | holds | `grep -rn gameRules ALNScanner/src` returns exactly `modeSemantics.js:8`, `LocalStorage.js:368`, `dormancyWording.js:4`, `formatCurrency.js:5`, all comments. | — |
| 1.2 | The player devices decide only known-or-unknown and, on the phone, seen; no shared fact, no channel to the tablet. | holds | `aln-memory-scanner/js/app.js:399-405,448-451`; `ALNScanner_v5/Application.h:539-548`. No code path joins either to the tablet. | — |
| 1.3 | "Nothing records what players found, no video plays, no evidence is shown in public, and the pack's game clock has no reader." | corrected | The ESP32 does keep a record: up to 100 queue lines on its card (`OrchestratorService.h:256-307`; `config.h:64`). The rest holds (SG-07, SG-10; `js/tokenDisplay.js:66-68`). | No record of what players found reaches anyone: the phone keeps only a seen set, and the ESP32 keeps up to 100 queue lines on its card, readable only by serial command. No video plays, no evidence is shown in public, and the pack's game clock has no reader (`2026-10-31-standalone-gm.md` section 1.3; `2026-10-31-standalone-players.md` conclusion 4). |
| 1.4 | Counts: four no, four partly, eight yes; candidate survives unchanged for five. | holds | Matches the section 2 entries and the counts paragraph. | — |
| 1.5 | "For the other eleven it assumes the engine as the sender of a message or the holder of a record." | corrected | C1 (backend claim list), C4 (boundary message), C5 (`assembleEngine()`), C6 (engine-side `describe()`), C7 (server reply ids), C10 (pushed facts, heartbeat), C12 (engine pack view and event), C15 (engine reports identity at boot) assume the engine (`2026-10-30-cause-analysis.md:89,233,269,309,353,520,629,783`). C9 fails because no shared module exists, C14 because its check misses shapes, C16 because rules sit in two code bases and the ESP32 boot is out of reach (pass section 2 entries; analysis `:468,739,831`). | For the other eleven it holds only in part. Eight of them assume the engine as the sender of a message, the holder of a record or the thing being assembled (C1, C4, C5, C6, C7, C10, C12, C15), and each needs a one-sentence change so that the tablet, or each device for its own private facts, takes that place. Three fall short for reasons that remain with no engine: C9 (no shared rules module exists), C14 (the check misses the shapes two producers build and the pack-to-device file shape), C16 (rules copied across two code bases, and the ESP32's boot path, are out of reach). |
| 1.6 | No candidate fails outright on every device. | holds | No "no" in the merged candidate column; both sheets' tables (GM sheet lines 121-136; players sheet lines 161-176). | — |
| 1.7 | Nothing says a game is standalone: tablet tap, phone URL, ESP32 nothing, pack has no field. | holds | `ALNScanner/src/app/sessionModeManager.js:30-42,105-110`; `aln-memory-scanner/js/orchestratorIntegration.js:33-34`; `game.json` top-level keys are `kind, schemaVersion, requires, id, title, modes, scoring, groupRules, groups, duplicatePolicy, entities, functions, gameClock, strings, cues, lightingRoles, lightingRoleFallbacks, surfaces, theme`. | — |
| 1.8 | The ESP32 treats a missing engine as an outage that never ends (`OrchestratorService.h:1289-1313`). | holds | The background task re-checks health every 10 s while WiFi is up (`:1282-1313`); with WiFi down it does nothing and the state stays disconnected (`:1315`). Note for the reader: the device still scans from its card meanwhile (correction 1 above). | — |
| 1.9 | Both sheets propose N1. | holds | GM sheet line 113; players sheet lines 17, 179. | — |
| 1.10 | Every device draws the missing engine as a failure (Offline, red DISCONNECTED and queue count, VIDEO UNAVAILABLE), and the tablet has no readiness verdict. | holds | `aln-memory-scanner/index.html:25`; `StatusScreen.h:153-192`; `Application.h:586-593`; SG-09. The tablet also draws one: a red "Disconnected" header link (`ALNScanner/index.html:58-61`, A-35). | — |

## Section 2. The sixteen causes

Each cause has five rows: applies, authority, candidate, change, card line.

### C1

| # | Claim | Verdict | Evidence | Corrected text |
|---|---|---|---|---|
| C1-a | Applies partly; one tablet keeps the claim list beside the transactions; no event on a new game; player devices share nothing. | holds | `LocalStorage.js:97-107,320-326`; `createSession` at `:163-177` saves but dispatches nothing; `js/app.js:195-215`. | — |
| C1-b | Authority: the one GM tablet (`LocalStorage.js:31-37`); a second tablet is a second authority. | holds | `LocalStorage.js:31-37`; each tablet's store is its own browser storage (`:113-115`). | — |
| C1-c | Candidate (a) partly. | holds | Analysis `:89`. | — |
| C1-d | Change: one rebuild function, same rule as `computeTeamScores` (`scoring.js:220`). | holds | `backend/src/gameRules/scoring.js:220`. | — |
| C1-e | Card line (48 words). | corrected | Over the 45-word limit the pass sets. | In a standalone game: one GM tablet holds the only copy, so tablets cannot drift, but it keeps a claim list beside its transactions and refreshes screens only on wired events. Two standalone tablets are two separate games; one tablet per game is undecided. |

### C2

| # | Claim | Verdict | Evidence | Corrected text |
|---|---|---|---|---|
| C2-a | Applies no; panels carry `data-requires="networked"` at the six lines and are hidden by `admin.css:10`; phone and ESP32 show only a connection word. | holds | `ALNScanner/index.html:346,366,429,476,504,517`; `src/styles/screens/admin.css:10`; `aln-memory-scanner/index.html:23-27`; `StatusScreen.h:150-192` (WiFi, engine and queue lines, no service state). | — |
| C2-b | Authority: none. | holds | As above. | — |
| C2-c | Candidate yes. | holds | Analysis `:127`. | — |
| C2-d | Change: none. | holds | — | — |
| C2-e | Card line. | holds | 36 words; content matches. | — |

### C3

| # | Claim | Verdict | Evidence | Corrected text |
|---|---|---|---|---|
| C3-a | Applies no; phone plays audio itself, ESP32 through its own I2S. | holds | `js/tokenDisplay.js:93-113`; `TokenDisplayScreen.h:153-166`. | — |
| C3-b | Authority: none. | holds | — | — |
| C3-c | Candidate yes. | holds | Analysis `:178`. | — |
| C3-d | Change: none. | holds | — | — |
| C3-e | Card line. | holds | 31 words. | — |

### C4

| # | Claim | Verdict | Evidence | Corrected text |
|---|---|---|---|---|
| C4-a | Applies yes; each boundary runs its own code on the tablet; the phone's seen set and the ESP32's queue and token list outlive every game. | holds | `LocalStorage.js:75-86,163-177,187-249,262-293,300-307`; `js/app.js:195-215`; `OrchestratorService.h:445-458` (queue counted, kept at boot). | — |
| C4-b | Authority: the tablet decides phase and boundaries; nothing carries a boundary to a player device; nothing triggers one. | holds | No code on either player device reads a game id; the ESP32 queue clears only by upload or serial `CLEAR_QUEUE` (`Application.h:1353`). | — |
| C4-c | Candidate (a) partly. | holds | Analysis `:233`. | — |
| C4-d | Change: tablet column, local calls, device-private lifetimes. | holds | Candidate, not decided. | — |
| C4-e | Card line (47 words). | corrected | Over the limit. | In a standalone game: the GM tablet decides every boundary, but start, pause, end, reset, reload, a day change and a pack change each run their own code; the phone's seen list and the ESP32's queue outlive every game. The table needs a tablet column. |

### C5

| # | Claim | Verdict | Evidence | Corrected text |
|---|---|---|---|---|
| C5-a | Applies partly; new game and Reset All Scores clear different things and raise different events; fresh start and reload share one function. | holds | `createSession` replaces the whole record and raises nothing (`LocalStorage.js:163-177`); `resetScores` keeps teams, zeroes them and raises `scores:cleared` and `data:cleared` (`:262-293`); `app.js:455-495` serves both fresh start and restore (`initializationSteps.js:451-459`). | — |
| C5-b | Authority: the tablet. | holds | — | — |
| C5-c | Candidate partly. | holds | Analysis `:269`. | — |
| C5-d | Change: one begin-game function. | holds | Candidate. | — |
| C5-e | Card line. | holds | 40 words. | — |

### C6

| # | Claim | Verdict | Evidence | Corrected text |
|---|---|---|---|---|
| C6-a | Applies partly; reading the saved record back fires no live event, so the History badge stays hidden after a reload (A-22). | holds | The badge is refreshed at phase 1H before any strategy exists and hides itself (`initializationSteps.js:80-82`; `uiManager.js:322-326`); `_loadSession` and `initializeStandaloneMode` raise no event (`LocalStorage.js:74-91`; `unifiedDataManager.js:67-85`); the only later refreshes are event listeners (`main.js:131-170`). Confirmed by reading; not run. | — |
| C6-b | Authority: the saved `standaloneSession` record. | holds | `LocalStorage.js:113-115`. | — |
| C6-c | Candidate partly. | holds | Analysis `:309`. | — |
| C6-d | Change: load goes through the live apply function. | holds | Candidate. | — |
| C6-e | Card line (49 words). | corrected | Over the limit. | In a standalone game: there is no snapshot and live pair. The saved game is the one snapshot; reading it back fires no live event, so the History badge stays hidden after a reload. Loading should use the same apply function as a live change. |

### C7

| # | Claim | Verdict | Evidence | Corrected text |
|---|---|---|---|---|
| C7-a | Applies partly; refused scan still paints "Transaction Complete!" and marks the token; refused duplicates and unknown tokens recorded nowhere; ESP32 queued scan looks recorded; phone's latent `logged:true`. | holds | `gameOps.js:358-362` ignores the result; `uiManager.js:466`; duplicate exits at `gameOps.js:253-257`, unknown at `:350-357`; `Application.h:579-597`; `orchestratorIntegration.js:92-95`, never reached (`js/app.js:434`). | — |
| C7-b | Authority: the device that took the scan. | holds | — | — |
| C7-c | Candidate partly. | holds | Analysis `:353`. | — |
| C7-d | Change: "...the tablet records refused attempts, giving decision 19 its standalone counterpart. This is the analysis's candidate (b) for C7 applied locally." | corrected | Item 19 is an open question, not a decision: "19 (record every scan attempt's outcome) waits for the owner's yes" (`docs/plans/CURRENT-STATE.md` section 0, "Open in round 8"). Candidate (b) is at analysis `:354`. | Change (candidate, not decided): each device's local record step returns the same result words the engine would (stored, rejected with a reason, retry), and the scan path reads that verdict before painting a result. If the owner says yes to question 19 (record every scan attempt's outcome, still open), the tablet also records refused attempts as its standalone counterpart. This is the analysis's candidate (b) for C7 applied locally. |
| C7-e | Card line (47 words). | corrected | Over the limit. | In a standalone game: no network reply exists, but each device's own store answers and the caller ignores it: a refused scan still shows Transaction Complete, and the ESP32 shows a queued scan as recorded. Each device's record step must return the same result words. |

### C8

| # | Claim | Verdict | Evidence | Corrected text |
|---|---|---|---|---|
| C8-a | Applies no. | holds | No helper process is started by the tablet or the player devices; D-61 is test-only. | — |
| C8-b | Authority: none. | holds | — | — |
| C8-c | Candidate yes. | holds | Analysis `:418`. | — |
| C8-d | Change: none. | holds | — | — |
| C8-e | Card line. | holds | 34 words. | — |

### C9

| # | Claim | Verdict | Evidence | Corrected text |
|---|---|---|---|---|
| C9-a | Applies yes; no scan gate outside the networked branch; `addTransaction` checks only paused; no id, report or team name; two id-matching rules. | holds | `gameOps.js:233-241`; `LocalStorage.js:302-307`; `gameOps.js:305-317` (no `id`); `scannerCore.js:28-44`; `TokenService.h:160-167`. | — |
| C9-b | Authority: tablet for every rule fact; each player device for known/unknown; phone also seen. | holds | As above; `js/app.js:448-451`. | — |
| C9-c | Candidate partly, because "the scan gate, the GM adjustment and its floor, the delete-and-rebuild live in `transactionService.js:113-130,157-163,817-894`". | corrected | The rebuild's recompute is `gameRules/scoring.js:220` `computeTeamScores`, which `rebuildScoresFromTransactions` calls (`transactionService.js:824`); what lives only in the service is the adjustment replay and the rebuild floor (`:843-860`), the adjustment and its floor (`:113-130`) and the active-game gate (`:155-163`). | Candidate (a) still works: partly. "Standalone is the one place the tablet decides, from a shared rules module the backend also loads" is the right shape, but no sharing exists (no import of `gameRules` under `ALNScanner/src`); `gameRules` lacks three rule pieces the tablet needs: the active-game scan gate (`backend/src/services/transactionService.js:155-163`), the GM adjustment and its floor (`:113-130`), and the adjustment replay and floor of the delete-and-rebuild (`:817-894`; the recompute itself is `gameRules/scoring.js:220`); SG-11. The player rules sit in JavaScript on the phone and C++ on the ESP32, which cannot load the backend's module. |
| C9-d | Change: the shared module also holds the gate, floor and rebuild; player rules shared as data. | corrected | Same correction as C9-c. | Change (candidate, not decided): the shared module also holds the scan gate, the adjustment and its floor, and the adjustment replay and floor of the rebuild, in a form both the backend and the browser load; the player-side rules are shared as data, not code: one list of test cases for id normalisation and lookup, run against both player devices, so the ESP32 adopts the phone's normalisation. |
| C9-e | Card line (47 words). | corrected | Over the limit. | In a standalone game: the GM tablet alone judges claims, scores and the scan gate, from hand-kept copies of every rule, and each player device alone decides whether a token is known, by two different matching rules. No shared rules module exists yet. |

### C10

| # | Claim | Verdict | Evidence | Corrected text |
|---|---|---|---|---|
| C10-a | Applies yes; outage drawings on phone and ESP32; plausible-but-wrong values on the tablet; no readiness verdict. | holds | `aln-memory-scanner/index.html:23-27`; `js/app.js:595-603`; `StatusScreen.h:153-192`; `Application.h:586-593`; `GameOpsRenderer.js:221` (standalone reads its own sum, bonus from `getTeamCompletedGroups`, empty in standalone, `unifiedDataManager.js:569-575`); `gameActivityBuilder.js:55-64`; `GameAdminRenderer.js:51,76-95` (only "paused" is checked, so "ended" draws "Active"). | — |
| C10-b | Authority: "the tablet for the game, the publisher of the Pages pack for pack identity, each player device for its pack, time and queue." | corrected | The phone keeps no time and, in standalone, no queue (`orchestratorIntegration.js:54-61`); its copy is a token file, not a pack (`ls aln-memory-scanner/data`). | Authority: each device for what it knows about its own copies: the tablet for the game and the pack it adopted (published at its Pages origin); the phone for its seen set and its token file; the ESP32 for its token list, its clock and its queue. |
| C10-c | Candidate partly. | holds | Analysis `:520`. | — |
| C10-d | Change: stamps, standalone label, tablet readiness line. | holds | Candidate. | — |
| C10-e | Card line. | holds | 45 words; content confirmed above. | — |

### C11

| # | Claim | Verdict | Evidence | Corrected text |
|---|---|---|---|---|
| C11-a | "On the tablet, group completion has four places (`LocalStorage.js:394-438`; `unifiedDataManager.js:582-675,685-741`; `tokenManager.js:146`)", claims two, teams three, may-I-scan none; the phone's URL test three times; config page tests an unused connection. | corrected | The two `unifiedDataManager` builders read one answer, `getTeamCompletedGroups` (`:569-575`), which LocalStorage does not define, so it returns `[]`; LocalStorage keeps its own list (`LocalStorage.js:434`). `tokenManager.js:146` builds group membership, not completion. The rest holds: `teamRegistry.js:236-240,264-283`; `gameOps.js:233-241`; `orchestratorIntegration.js:33-34`; `scannerCore.js:51-54`; `config.html:423`. | Applies: yes. On the tablet, group completion has two answers that disagree: the list LocalStorage builds (`LocalStorage.js:394-438`, stored at `:434`) and `getTeamCompletedGroups` (`ALNScanner/src/core/unifiedDataManager.js:569-575`), which LocalStorage does not implement, so it hands an empty list to both Team Details builders (`:582-675`, `:685-741`). Claims have two places (the Set and the transactions), teams have three (C-24) and "may I scan" has none (`gameOps.js:233-241`). On the phone, "am I standalone" is one URL test written three times (`orchestratorIntegration.js:33-34`; `scannerCore.js:51-54`; `config.html:423`; SP-01) and the config page tests a connection the page will never use (SP-04). |
| C11-b | Authority: tablet for game questions; each device's own setting for deployment mode. | holds | As C11-a. | — |
| C11-c | Candidate yes. | holds | Analysis `:581`. | — |
| C11-d | Change: none required; optional deployment-mode resolver. | holds | Players sheet line 171. | — |
| C11-e | Card line ("group completion in four places"). | corrected | Content per C11-a. | In a standalone game: the tablet answers group completion in two places that disagree, teams in three and may-I-scan in none; the phone decides am-I-standalone by one URL test written three times. One resolver per question still fits; deployment mode should become one. |

### C12

| # | Claim | Verdict | Evidence | Corrected text |
|---|---|---|---|---|
| C12-a | Applies yes; the tablet "applies none of the engine's gate checks (`packService.js:728-735,762-763` have no reader under `ALNScanner/src`)"; reload adopts a newer pack; phone's nested copy lacks `game.json` and `pack-manifest.json`; ESP32 reports no identity. | corrected | The tablet does apply the exact schema-version check (`ALNScanner/src/core/tokenManager.js:60-66`, "the backend gate's EXACT-match mirror") and two warnings (`tokenManager.js:126-140`; `modeSemantics.js:119-133`); `grep` finds no reader of `requires` or `minVersion` in `ALNScanner/src`. The rest holds: `packLoader.js:23-26,144-166`; `LocalStorage.js:31-37,164-172`; `ls aln-memory-scanner/data` lists `CLAUDE.md scoring-config.json shared tag-writer.html token-checkin.html tokens.json`; `AssetService.h:148-158,229-231`. | Applies: yes. The tablet reads the pack once at app start (`ALNScanner/src/core/packLoader.js:23-26`), compares nothing afterwards and stamps nothing on the game (`LocalStorage.js:31-37,164-172`). Of the engine's gate checks it applies only the exact schema-version match (`ALNScanner/src/core/tokenManager.js:60-66`), plus two warnings (`tokenManager.js:126-140`; `ALNScanner/src/core/modeSemantics.js:119-133`); it reads neither `requires` nor `engine.minVersion` (`backend/src/services/packService.js:728-735,762-767` have no counterpart under `ALNScanner/src`). A reload while online mid-game adopts the newest published pack under the old game (SG-03, SG-08, B-29). The phone serves its own nested copy, pinned at `15d8d2e` while `ALN-TokenData` is at `6f9bc30`, with no `game.json` and no `pack-manifest.json` (`ls aln-memory-scanner/data`; D-05 / A-94, SP-10); the ESP32 serves whatever its card last held and reports no identity (`AssetService.h:148-158,229-231`; D-06). |
| C12-b | Authority: Pages pack and the tablet's adoption at start; each device's loaded copy; nobody decides the game's pack. | holds | `packLoader.js:130-175`. | — |
| C12-c | Candidate partly; the tablet has a comparison point (the manifest at start). | holds | `packLoader.js:144-146` compares the fetched manifest hash with the active pointer. | — |
| C12-d | Change: game record carries pack hash; between-games check; device stamps. | holds | Candidate. | — |
| C12-e | Card line: "...The player devices show no pack line, so tablets are compared by eye." (47 words) | corrected | The phone has a pack line on its config page that reads "unknown (pre-pack deploy or offline)" in standalone (`aln-memory-scanner/config.html:233-234`); the ESP32's is serial-only and empty with no engine (`Application.h:1075-1083`). What nothing compares is the devices. Also over the limit. | In a standalone game: each device loads whatever pack copy its source holds; the tablet can adopt a newer pack on a mid-game reload, and the game carries no pack stamp. No player device shows a pack identity, so nothing compares the devices. |

### C13

| # | Claim | Verdict | Evidence | Corrected text |
|---|---|---|---|---|
| C13-a | Applies no; each device its own identity; tablet's id stays `001`, set only by the networked wizard. | holds | `orchestratorIntegration.js:20-29`; `ALNScanner/src/ui/settings.js:19,35`; `connectionWizard.js:388` is the only setter in `src`. | — |
| C13-b | Authority: nobody. | holds | — | — |
| C13-c | Candidate yes. | holds | Analysis `:675`. | — |
| C13-d | Change: none. | holds | — | — |
| C13-e | Card line: "The tablet keeps device id 001". | corrected | A tablet that once ran the networked wizard keeps the station id it saved (`settings.js:35` reads `localStorage.deviceId`; `connectionWizard.js:388-391`). | In a standalone game: no engine, no credential and no connection exist, so this cause produces no fault. A tablet never set up for a networked game keeps device id 001 and is known to nobody (see C1). The candidate design needs no change. |

### C14

| # | Claim | Verdict | Evidence | Corrected text |
|---|---|---|---|---|
| C14-a | Applies yes; Team Details reads what standalone never fills; Game Activity reads the lookup wrapper; transaction lacks `id`, `status`, `summary`, `owner`; `requires` unread; ESP32 wants `tokens` wrapper; audio rule differs; phone ignores `processingImage`. | holds | `GameOpsRenderer.js:221-242`; `unifiedDataManager.js:569-575`; `tokenManager.js:276-285` returns `{token, matchedId}`, read as a token at `gameActivityBuilder.js:55-60`; `gameOps.js:305-317`; `TokenService.h:125-129`; `resourceRoutes.js:57-61`; `Token.h:40-42`; `grep processingImage aln-memory-scanner/js` finds nothing. | — |
| C14-b | Authority: tablet for its joins; schema files decide shapes. | holds | `ALN-TokenData/tokens.schema.json`. | — |
| C14-c | Candidate partly. | holds | Analysis `:739`. | — |
| C14-d | Change: one transaction shape; `requires` at load; real-pack check per player device. | holds | Candidate. | — |
| C14-e | Card line (48 words). | corrected | Over the limit. | In a standalone game: both sides of each join sit on one device and still disagree: Team Details reads scores standalone never fills, the ESP32 wants a wrapped token file the pack lacks, the phone ignores processingImage. One shape per join, checked against every producer. |

### C15

| # | Claim | Verdict | Evidence | Corrected text |
|---|---|---|---|---|
| C15-a | Applies yes; for the tablet "a hand-run `sync.py --deploy`, the pack pinned at build time (`vite.config.js:28`)"; no precache; no build id; phone from Pages and `unpkg.com`; fresh ESP32 card holds one file. | corrected | The tablet's Pages build runs on every push to ALNScanner `main` (`ALNScanner/.github/workflows/sync.yml:3-7,37-48`); the pack it serves is the `data` pin, copied by `publicDir: 'data'` (`vite.config.js:25`; line 28 is a comment). The phone's deploy is the hand-run or manually triggered one (`aln-memory-scanner/.github/workflows/sync.yml:3-4,26`). The rest holds: `ALNScanner/sw.js:3-7`; `aln-memory-scanner/index.html:138`; `sw.js:27-30`; `sd-card-deploy/assets/images/placeholder.bmp` is the only file. | Applies: yes. A standalone game's whole supply chain is this cause. For the tablet: the Pages build runs on every push to the scanner's `main` (`ALNScanner/.github/workflows/sync.yml:3-7,37-48`), so the hand step is moving the scanner's `data` pin, which fixes the pack the Pages tree serves (`ALNScanner/vite.config.js:25`); a service-worker cache with no precache (`ALNScanner/sw.js:3-7`); no build id on screen (SG-09). For the phone: a hand-run `sync.py --deploy` or manual workflow publishes the page to GitHub Pages (`aln-memory-scanner/.github/workflows/sync.yml:3-4,26`), and the QR library comes from `unpkg.com` (`aln-memory-scanner/index.html:138`; `sw.js:27-30`; SP-21, D-19). For the ESP32: a fresh card holds one file and only the engine's sync fills it (`arduino-cyd-player-scanner/sd-card-deploy/assets/images/`; `TokenService.h:203-264`; SP-13). |
| C15-b | Authority: the person who publishes or copies. | holds | As above. | — |
| C15-c | Candidate partly. | holds | Analysis `:783`. | — |
| C15-d | Change: per-device check at load; one deploy command builds standalone bundles. | holds | Candidate. | — |
| C15-e | Card line ("a Pages publish for tablets and phones"). | corrected | Per C15-a. | In a standalone game: the supply chain is mostly hand work: a pinned pack and a Pages publish for tablets and phones, a card copy for each ESP32, no build id on screen, no check that the app is cached for an offline start. |

### C16

| # | Claim | Verdict | Evidence | Corrected text |
|---|---|---|---|---|
| C16-a | Applies yes; "no test feeds one input to both the tablet's rule and the backend's (`grep gameRules ALNScanner/tests` finds comments only)"; A-82; phone's fixture test; ESP32 boot untested; D-47. | corrected | The grep is right for unit tests, but backend E2E `07c` scans the same tokens on a standalone tablet and on the engine and compares team scores (`backend/tests/e2e/flows/07c-gm-scanner-scoring-parity.test.js:174-229,238-291,400-420`); its group case skips when the pack has no group of two or more tokens (`:302-307`), and the shipped pack has one group of one token (`game.json` `groups`: `{"Marcus Mention": {"multiplier": 1}}`). Parent CI Tier L runs every E2E test not tagged `@hardware` (`backend/package.json:39`; `.github/workflows/test.yml:222-309`); whether 07c's mobile-only gate (`:76`) lets it run there: not verified. The rest holds: `aln-memory-scanner/tests/app.test.js:688-700`; `arduino-cyd-player-scanner/CLAUDE.md:155-160`. The D-47 attribution is corrected at row 3.3-D-47. | Applies: yes. The tablet's unit tests pin each rule from hand-copied expectations, and no unit test feeds one input to both the tablet's rule and the backend's (`grep gameRules ALNScanner/tests` finds comments only). One end-to-end test does: `backend/tests/e2e/flows/07c-gm-scanner-scoring-parity.test.js` scans the same tokens on a standalone tablet and on the engine and compares team scores, but only for scoring, and its group-completion case skips because the shipped pack has no group of two or more tokens (`:302-307`; A-82). The phone's pack-identity test passes on a fixture the deployed folder lacks (`aln-memory-scanner/tests/app.test.js:688-700`; SP-10). The ESP32's boot and queue path has no test (`arduino-cyd-player-scanner/CLAUDE.md:155-160`; SP-23). No parent CI job runs either player device's standalone path end to end (`.github/workflows/test.yml:117-119,133-154`). |
| C16-b | Authority: the tests' authors. | holds | — | — |
| C16-c | Candidate partly. | holds | Analysis `:831`. | — |
| C16-d | Change: one cross-implementation proof per rule family; real-folder proofs; ESP32 native boot test. | corrected | Must start from 07c, which exists. | Change (candidate, not decided): extend the one existing cross-mode proof (07c, scoring only) to every rule family, the scan gate, duplicates, the adjustment and its floor, and the delete-and-rebuild, on a pack with a group of two or more tokens; or run the same transactions through the backend's `gameRules` and through `LocalStorage` in a unit test, results equal. One standalone proof per player device against the real deployed folder (the phone with the network blocked; for the ESP32, a native test of the boot decision with no engine). |
| C16-e | Card line: "...no test feeds one input to both the tablet's rule and the backend's..." (47 words) | corrected | Per C16-a; also over the limit. | In a standalone game: tests are the only check on the tablet's rules; one end-to-end test compares tablet and backend scores, but its group case skips on the real pack. The phone's pack test passes on a missing file; the ESP32 boot has no test. |

### Counts and merge notes

| # | Claim | Verdict | Evidence | Corrected text |
|---|---|---|---|---|
| 2.counts | Applies 8/4/4; candidate 5 yes, 11 partly, 0 no. | holds | Matches the entries. | — |
| 2.merge | Six rows differed between the sheets: C1, C5, C6, C7, C10, C12. | holds | GM sheet lines 121-136 against players sheet lines 161-176: applies differ for C1, C5, C6, C10; candidate differs for C5, C6, C7, C12. (C5 and C6 also differ on the candidate, tablet partly against players yes; the merge rule gives partly either way.) | — |

## Section 3. The findings

### 3.1 GM tablet (SG-01 to SG-12)

| # | Claim | Verdict | Evidence | Corrected text |
|---|---|---|---|---|
| SG-01 | Opening game unnamed and "Active"; the only standalone create button never draws; other create buttons are networked; Pause fails on the opening game; `createSession` raises no event. | holds | `LocalStorage.js:31-37,147-155,163-177,203-207`; `GameAdminRenderer.js:33-46`; `SessionRenderer` is built only by `MonitoringDisplay` (`src/admin/MonitoringDisplay.js:27`), which is created only in networked mode (`app.js:332-337`). | — |
| SG-02 | The only way to start over is Reset All Scores; no report, no export. | holds | `ALNScanner/index.html:538`; `LocalStorage.js:262-293`; `gameOps.js:492`. Note: `gameAdmin.js:288` is the networked reset's dialog text; its networked-only gate is `:301-304`. | — |
| SG-03 | Mid-game reload adopts the newest pack; game carries no stamp; the design record's never-mid-session rule is not enforced. | holds | `packLoader.js:23-26,144-166`; `LocalStorage.js:31-37,164-172`; `docs/plans/2026-07-09-phase3-1-standalone-pack-loading.md:62`; backend stamp `sessionService.js:212-216`. | — |
| SG-04 | The game's only copy is one browser's storage; a full store would throw after the claim was marked (inference). | holds | `LocalStorage.js:113-115`; the claim is added at `:325` before the save at `:332`. | — |
| SG-05 | Nothing declares standalone or stops mixing. | holds | `ALNScanner/index.html:120-153` (two mode buttons); `sessionModeManager.js:30-42,105-110`; `game.json` keys. | — |
| SG-07 | Exposure has no standalone effect. | holds | `gameOps.js:434-437`; `uiManager.js:264-269`; `main.js:123`; `ALNScanner/index.html:517`; `admin.css:10`; `game.json` detective `displayBehavior.surface: "scoreboard-evidence"`. | — |
| SG-06 | Two tablets are two games; "every record carries device id `001`". | corrected | `settings.js:35` reads a saved id; the wizard saves one (`connectionWizard.js:388-391`). | Two standalone GM tablets are two separate games: each holds its own claim list, so one token can be sold on both; each holds its own score table; every record carries device id `001` unless the networked wizard once ran on that tablet and saved a station id. Whether a standalone game means one GM tablet is not stated in decision 22. |
| SG-08 | No `requires`/`minVersion` reader; three partial client defences. | holds | As C12-a. | — |
| SG-09 | No readiness verdict; no precache; registration failures hidden by design; no build id. | holds | `ALNScanner/sw.js:3-11`; `initializationSteps.js:129-135`; `ALNScanner/index.html:76-79`; no build id is defined in `vite.config.js`, `src` or `index.html` (grep). | — |
| SG-10 | Pack game clock has no standalone reader; panel counts wall time including pauses. | holds | `game.json` `gameClock` = `{duration 7200, overtimeAt 7200, phases [...]}`; `grep -rln "gameClock\|overtime" ALNScanner/src` lists `MonitoringDisplay.js`, `SessionRenderer.js`, `orchestratorClient.js`, `messageRouters.js`, `admin.css`; `GameAdminRenderer.js:49`. | — |
| SG-11 | The gate, the adjustment and floor, and "the delete-and-rebuild live in the backend's services". | corrected | Per C9-c. | The rules standalone copies are not all in the backend's `gameRules`, the surface the documents call the parity surface (CONTEXT.md section 2): the "game must be active" gate (`transactionService.js:155-163`), the GM score adjustment and its floor (`:113-130`), and the adjustment replay and floor of the delete-and-rebuild (`:817-894`) live in the backend's services; only the rebuild's recompute is in `gameRules` (`scoring.js:220`). A shared module of `gameRules` alone would leave those as second copies. |
| SG-12 | Transaction lacks `id`, `status`, `summary`, `owner`. | holds | `gameOps.js:305-317`; `gameActivityBuilder.js:90`; backend enriches at `transactionService.js:195-202`; `syncHelpers.js:79-81`. | — |

### 3.2 Player devices (SP-01 to SP-23)

| # | Claim | Verdict | Evidence | Corrected text |
|---|---|---|---|---|
| SP-01 | One URL test in three places. | holds | `orchestratorIntegration.js:33-34`; `scannerCore.js:51-54` (used at `js/app.js:100`); `config.html:423`. | — |
| SP-02 | No record says standalone; tag URL record defaults to an engine address. | holds | `ALN-TokenData/shared/aln-tools.js:10,15,20`; `tag-writer.html:444`. | — |
| SP-03 | Phone header "Offline" all night; config page "Not Connected". | holds | `aln-memory-scanner/index.html:25`; standalone never starts monitoring (`orchestratorIntegration.js:54-61`); `config.html:289-299`. | — |
| SP-04 | Config page saves and tests an unused URL. | holds | `config.html:302-356`; mode fixed by path (`orchestratorIntegration.js:34`). | — |
| SP-05 | Nothing records player discoveries for anyone. | holds | `js/app.js:208-215`; `OrchestratorService.h:256-307`; `Application.h:1347-1350`; `backend/src/models/session.js:202-212`. | — |
| SP-06 | Video token on the phone: blank display with "Token: kai001"; `processingImage` never read. | holds | `kai001` and `rem001` have `image: null`, `audio: null`, `processingImage: "assets/images/<id>.bmp"` in `aln-memory-scanner/data/tokens.json`; `tokenDisplay.js:66-68`. | — |
| SP-07 | ESP32 tells every video scanner "VIDEO UNAVAILABLE, Rescan later". | holds | `Application.h:579-593`; `ProcessingScreen.h:88-89,158-190`. | — |
| SP-08 | Demo database with no on-screen sign. | holds | `js/app.js:70-86,127-139`. | — |
| SP-09 | Offline placeholder returned as the memory. | holds | `aln-memory-scanner/sw.js:11,192-213`. | — |
| SP-10 | "the pack line is empty in every standalone game". | corrected | The config page shows "unknown (pre-pack deploy or offline)" (`config.html:233-234,271-277`). | The phone's tests prove the standalone pack-identity path with a fixture the deployed `data/` folder does not have (`aln-memory-scanner/tests/app.test.js:688-700`; `js/app.js:100-102`; `ls aln-memory-scanner/data`); in every standalone game the config page's pack line reads "unknown (pre-pack deploy or offline)" (`config.html:233-234`), and the green test says otherwise. |
| SP-11 | "The ESP32 cannot be set up for a game with no engine: the config check requires a WiFi name, an orchestrator URL and a 3-digit team id." | corrected | The check fails but stops nothing (`Application.h:1598-1604`); empty WiFi name skips WiFi and health (`OrchestratorService.h:69-72`); tokens load from the card (`Application.h:997`); scans display and queue (`:539-597`). A failed check also drops the config's `DEBUG_MODE` (`:1602-1603`). | The ESP32 has no standalone setting, but a config with no engine does not stop it. Its check wants a WiFi name, an orchestrator URL and a 3-digit team id (`ConfigService.h:322-382`; `models/Config.h:30-72`); when the check fails, setup logs "using defaults" and carries on (`Application.h:1598-1604`). With no WiFi name it skips WiFi and the health check (`OrchestratorService.h:69-72`), loads the token list on its card (`Application.h:997`), and scans, shows the picture, plays the audio and queues every scan (`Application.h:539-597`). So an ESP32 whose card was filled earlier already plays a standalone game, drawn as an outage (SP-20), with the config's `DEBUG_MODE` ignored (`Application.h:1602-1603`). The team id is stamped on queued scans (`Application.h:558-563`) and used by nobody. |
| SP-12 | Failed config logs "using defaults" and carries on; no defaults for the three fields. | holds | `Application.h:1598-1604`; `ConfigService.h:199-209`. | — |
| SP-13 | "nothing but an engine can fill it". | corrected | The engine sync is the only code that writes the card's token file (`TokenService.h:203-264`, writes at `:243-249`) or pictures (`AssetService.h:90-224`); no tool or documented step fills it by hand (`sd-card-deploy` holds one file; `aln-memory-scanner/convert-arduino-assets.py` converts the other way). A hand copy is possible in principle. | A new SD card has no token list and no pictures, and the engine's sync is the only code or tool that fills it; a hand copy would need the token file wrapped (SP-14) and the pictures from `aln-memory-scanner/assets/images`, and no step documents it. Without a token list every real scan reads "UNKNOWN TOKEN", which the player reads as a bad tag (`TokenService.h:104-108`; `Application.h:542-547`). |
| SP-14 | Pack token file is flat; ESP32 reads only a `tokens` object; wrapper only in `/api/tokens`. | holds | `ALN-TokenData/tokens.json` has no `tokens` key; `TokenService.h:125-129`; `resourceRoutes.js:57-61`. | — |
| SP-15 | Audio rule differs; latent: no pack token has audio. | holds | `Token.h:40-42`; `tokenDisplay.js:58-59`; no token in `ALN-TokenData/tokens.json` has `audio`; `aln-memory-scanner/assets/manifest.json` lists `rat031` with `ext: mp3`. | — |
| SP-16 | Phone lowercases, ESP32 exact match; latent. | holds | `scannerCore.js:33`; `TokenService.h:160-167` (the ESP32 lowercases only for file paths, `Token.h:28`). | — |
| SP-17 | "every boot waits 30 seconds ... WiFi can wait 10 more, and with WiFi up the health check retries for about 61 seconds". | corrected | The 30 s window runs only with `DEBUG_MODE` off (`Application.h:766-777`); with no WiFi name both waits are skipped (`OrchestratorService.h:69-72`); with an empty URL the health check returns at once (`:342`). The 61 s is 1+2+4+8+16 s of backoff plus six 5 s timeouts (`:345-347,1021-1043`). | Start-up with no engine is slow. Every boot with `DEBUG_MODE` off waits 30 seconds for a serial character, and a config that fails its check drops `DEBUG_MODE`, so an engine-less ESP32 always waits (`Application.h:766-811,1598-1604`). With a WiFi name set, WiFi can wait 10 more seconds, and with WiFi up and an engine address set the health check retries for about 61 seconds (`OrchestratorService.h:97-103,128,341-347,1019-1052`); with no WiFi name both are skipped (`:69-72`). No scans until `setup` returns. Arithmetic from constants, not measured. |
| SP-18 | Queue lines stay across games; "in a later game that has an engine, those lines are uploaded into it". | corrected | Upload is at `OrchestratorService.h:1299-1307`, but the engine refuses lines dated before 2020 (`backend/src/routes/scanRoutes.js:176-178,266-283`), and every line taken with no WiFi is dated 1970 (SP-19). | Every ESP32 queue line stays on the card across games (`OrchestratorService.h:445-458`). In a later game that has an engine, the lines are sent to it: those stamped 1970, which is every line taken with no WiFi (SP-19), are refused by the engine's date floor (`backend/src/routes/scanRoutes.js:176-178,266-283`), and lines with real times are stored into the later game (`OrchestratorService.h:1299-1307`). In a standalone game nothing drains or resets them except a serial command (`Application.h:1353`). |
| SP-19 | No WiFi, no time; 1970 stamps; the engine drops them on replay. | holds | `Application.h:619-672`; NTP is requested only on WiFi connect (`OrchestratorService.h:120`); drop at `scanRoutes.js:266-283`. | — |
| SP-20 | Status screen reads as failure. | holds | `StatusScreen.h:153-192`. | — |
| SP-21 | Phone first load needs Pages and `unpkg.com`. | holds | `aln-memory-scanner/index.html:138`; `sw.js:27-30`. | — |
| SP-22 | Latent `logged:true`. | holds | `orchestratorIntegration.js:92-95`; `js/app.js:434`. | — |
| SP-23 | "PlatformIO covers models, payload, response classification and the NDEF parser only". | corrected | `ls arduino-cyd-player-scanner/test`: `test_asset_manifest test_batch_id test_config test_ndef test_payload test_scan_response test_smoke test_token`. | The ESP32's production firmware build and boot path have no test; PlatformIO covers the config and token models, payload building, response classification, batch ids, the asset-manifest diff and the NDEF parser, plus a smoke test (`arduino-cyd-player-scanner/test/`; `platformio.ini:11-20`; `CLAUDE.md:155-160`). |

### 3.3 Existing findings

| # | Claim | Verdict | Evidence | Corrected text |
|---|---|---|---|---|
| A-02 / C-09 | Paused scan says complete, records nothing, locks the token until reload; ended or opening game records. | holds | `LocalStorage.js:302-307`; `gameOps.js:358-362`; reload rebuilds the Set from transactions (`LocalStorage.js:97-107`). Note: "paused" is reachable only by End-then-Pause (row A-13). | — |
| A-13 / C-42 | "With SG-01, no pause works for a whole standalone game." | corrected | After End, `status` is `ended`; the panel still draws "Active" with Pause (`GameAdminRenderer.js:51,76-95`), and `pauseSession` accepts any status but `paused` (`LocalStorage.js:203-215`). Not run. | The panel draws every state but "paused" as "Active" with Pause and End (`GameAdminRenderer.js:51-96`); Pause on a fresh game answers "No active session to pause" (`LocalStorage.js:203-207`). With SG-01, Pause never works on a live standalone game; the only way to reach "paused" is to press End and then Pause, which the panel still offers (`LocalStorage.js:187-190,209-215`). Not run. |
| C-10 | Group completion never announced; "a repeatable counting mode would be added twice". | corrected | The tablet turns `countsTowardGroups` off for any non-consuming mode (`ALNScanner/src/core/modeSemantics.js:119-133,247`), so such transactions never enter `groupTxs` (`LocalStorage.js:402-404`); consuming claims cannot repeat (`gameOps.js:253-257`). | A completed group is never announced in standalone (`GameOpsRenderer.js:90` is fed only by a backend event). The two bonus sums differ in method, the tablet summing recorded points (`LocalStorage.js:429`) and the backend summing distinct catalog values (`backend/src/gameRules/scoring.js:184-198`), but the double count is not reachable today: the tablet turns `countsTowardGroups` off for any non-consuming mode (`ALNScanner/src/core/modeSemantics.js:119-133,247`), and a consuming claim cannot repeat. |
| A-36 / C-11 | No id, so no Delete button. | holds | `GameOpsRenderer.js:330`; `gameOps.js:305-317`. | — |
| A-37 | No standalone report. | holds | `unifiedDataManager.js:337-339`; `gameAdmin.js:219-228`; the report button exists only in `SessionRenderer.js:307`, networked-only. | — |
| A-34 | Duplicate refusal never names the team. | holds | `gameOps.js:253-257,266`; claimant stored at `LocalStorage.js:318`. | — |
| C-41 | A game across midnight is dropped at reload. | holds | `LocalStorage.js:79-86`. | — |
| A-03 / A-04 / C-06 | Team Details: no bonus, no adjustment, all groups "In Progress"; scoreboard includes both; adjustments hidden by `isNetworked`. | holds | `GameOpsRenderer.js:221,242`; `unifiedDataManager.js:569-575`; `LocalStorage.js:129-141`. | — |
| A-07 / C-15 | Game Activity "Unknown, $0" for every claimed row. | holds | `gameActivityBuilder.js:55-64`; `tokenManager.js:284`; `LocalStorage.js:42-43` (no player scans). | — |
| A-22 | History badge hidden after reload. | holds | As C6-a. | — |
| C-24 | Three answers for "which teams exist". | holds | `teamRegistry.js:236-240,264-283`; `LocalStorage.js:353-363`. | — |
| B-29 | Mid-game swap unrefused; no stamp. | holds | As SG-03. | — |
| B-20 / C-08 / D-18 | Noticed only by a person comparing hashes; "the players sheet lists D-18 as not applying to the player devices, which have no pack line to compare". | corrected | The phone has a pack line (`config.html:233-234`); in standalone it reads unknown. | A device on a different pack is noticed only by a person comparing hashes; in standalone there is no engine to compare with (`initializationSteps.js:242-265`; design record section 4). (The players sheet lists D-18 as not applying to the player devices: the phone's config-page pack line reads "unknown" in standalone, `config.html:233-234`, and the ESP32 shows none on screen.) |
| B-08 and decision 19 | "Decision 19 ... needs a standalone counterpart." | corrected | Item 19 is an open question (`CURRENT-STATE.md` section 0). | A refused duplicate and an unknown token are recorded nowhere in standalone either (`gameOps.js:253-257,350-357`). Question 19 (record every scan attempt's outcome) is still open; if the owner says yes, it needs a standalone counterpart; see C7's change. Cause: set aside in the analysis (owner's question, analysis line 863); C7 carries the standalone counterpart. |
| A-82 | One group of one token at multiplier 1. | holds | `game.json` `groups`. | — |
| A-89 | No-type token scores nothing; no warning. | holds | `gameOps.js:312`; `ALNScanner/src/core/scoring.js:212-214`. | — |
| A-35 | Red "Disconnected" link in standalone. | holds | `ALNScanner/index.html:58-61`; analysis line 861. | — |
| D-05 / A-94 | Phone shows its own nested file; `nat001` still `Marcus Mention (x1)`; no `game.json`. | holds | `aln-memory-scanner/data/tokens.json` `nat001.SF_Group`; `js/app.js:64`. | — |
| D-06 | ESP32 reports no pack identity even when synced. | holds | The code would record and print one (`AssetService.h:148-158`; `Application.h:1075-1083`), but the manifest the engine serves carries none (`backend/src/routes/resourceRoutes.js:19-22,71-83`; no `packId` in `aln-memory-scanner/assets/manifest.json`). | — |
| D-09 / B-62 | Phone sends no team in standalone; ESP32 stores its fixed team on unread lines. | holds | `js/app.js:434-435`; `Application.h:558-563`. | — |
| D-10 | Seen set never resets; no session id to key on. | holds | `js/app.js:18,195-215,448-451`. | — |
| D-11 | 101st queued scan drops the oldest silently. | holds | `OrchestratorService.h:263-265,1243-1247`; `config.h:64`. | — |
| D-14 | "A replay drops 1970-stamped scans" (`scanRoutes.js:317-352`). | corrected | The drop is at `:176-178,266-283`; `:317-352` is the no-session branch. | A replay drops 1970-stamped scans (`backend/src/routes/scanRoutes.js:176-178,266-283`); in standalone every ESP32 scan is 1970-stamped (SP-19), so if the queue later reaches an engine those lines are refused (SP-18). |
| D-17 | Queued ESP32 scan looks recorded. | holds | `Application.h:579-597`. | — |
| D-19 | Proposed move from section 3 to C15. | holds | Analysis line 858 sets it aside; the move is a proposal for the owner. | — |
| D-47 | "The parent CI does not run the phone's or the ESP32's standalone path end to end" (analysis line 814). | corrected | True of the CI (`.github/workflows/test.yml:117-119,133-154` run units only), but D-47 at line 814 names other things (Tier H, config-tool smoke, GM Playwright, `test:build`, `test:docker`). | The parent CI runs only the phone's Jest units and the ESP32's native units (`.github/workflows/test.yml:117-119,133-154`); no job runs either device's standalone path end to end. This reading is added here; D-47 itself (analysis line 814) names Tier H, the config-tool smoke, the GM scanner's Playwright, `test:build` and `test:docker`. Cause: C16. |
| 3.3 tail | Players sheet's not-applying list. | holds | Players sheet section 2.2, last paragraph. | — |

### 3.4 N1

| # | Claim | Verdict | Evidence | Corrected text |
|---|---|---|---|---|
| N1-a | Both sheets propose N1; eight instances. | holds | GM sheet line 113 (SG-05, SG-07, SG-10); players sheet rows SP-02, SP-05, SP-06, SP-11, SP-17 marked N1 (lines 116-131). SP-11 stays an instance after its correction: the ESP32 still has no declared standalone setting. | — |
| N1-b | Why new; fallback homes. | holds | Reasoning consistent with the cause definitions (analysis section 1). | — |
| N1-c | "CONTEXT.md section 5, 'Dormant vs fault'". | corrected | "Dormant vs fault" is at `CONTEXT.md:344`, in section 4 ("Show control", from line 284); section 5 uses the word at lines 418-426. | The nearest existing idea, from the players sheet (candidate, not decided): the engine already says a service can be **dormant** with a stated door, "not installed tonight" (CONTEXT.md section 4, "Dormant vs fault", line 344, and section 5, lines 418-426; root `CLAUDE.md`, `dormancyService`). A game could declare standalone as a profile with no engine equipment, so that every engine duty (recording player scans, video, evidence on the TV, the game clock) reads as dormant by the same words on every device, and each device shows its answer instead of an outage. |
| N1-d | The four owner questions. | holds | Questions only. | — |

## Section 4. The ESP32 parity gap

| # | Claim | Verdict | Evidence | Corrected text |
|---|---|---|---|---|
| Row 1 | Phone by URL; ESP32 not chosen, an outage. | holds | As 1.7, 1.8. | — |
| Row 2 | ESP32: "WiFi SSID, orchestrator URL and 3-digit team id all required". | corrected | Per SP-11. | ESP32, no engine: the config check wants a WiFi name, an orchestrator URL and a 3-digit team id (`ConfigService.h:322-382`), but a failed check only logs; the device boots and scans from its card (`Application.h:1598-1604`). ESP32 would need: a declared standalone setting under which the check passes with none of the three. |
| Row 3 | Token list from `./data/tokens.json`; ESP32 card file written only by engine sync. | holds | `js/app.js:64`; `TokenService.h:203-264`. | — |
| Row 4 | Flat against wrapped. | holds | As SP-14. | — |
| Row 5 | Demo fallback; zero tokens and "UNKNOWN TOKEN". | holds | `js/app.js:80-85,127-139`; `TokenService.h:104-108`. | — |
| Row 6 | Phone "absent, so blank"; ESP32 "RAM only, filled from the engine's asset manifest, so blank". | corrected | Phone reads "unknown (pre-pack deploy or offline)" (`config.html:233-234`); the engine's asset manifest carries no identity today (D-06 row). | Web: reads `./data/pack-manifest.json`, which is absent, so the config page reads "unknown (pre-pack deploy or offline)" (`app.js:100-102`; `config.html:233-234`). ESP32: RAM only, filled from the engine's asset manifest, which today carries no identity, and shown only by serial `CONFIG` (`AssetService.h:148-158,229-231`; `Application.h:1075-1083`). ESP32 would need: read identity from a file on the card and show it on the status screen. |
| Row 7 | Id matching differs. | holds | As SP-16. | — |
| Row 8 | Unknown token: 3 s toast; 1.5 s screen. | holds | `tokenDisplay.js:141-143`; `config.h:41`. | — |
| Row 9 | Picture sources reach the same names. | holds | `tokenDisplay.js:38-46`; `Token.h:34-36`. | — |
| Row 10 | Missing picture: placeholder; driver error (message not verified). | holds | `sw.js:209-213`; `TokenDisplayScreen.h:145-148`. | — |
| Row 11 | Audio rule. | holds | As SP-15. | — |
| Row 12 | Seen mark; "candidate (d) for C9 (`cause-analysis.md:467`)". | corrected | Line 467 is the heading; (d) is line 471. | ... The analysis's candidate (d) for C9 removes it from the player role instead (`cause-analysis.md:471`). |
| Row 13 | Video token on both. | holds | As SP-06, SP-07; `config.h:40` (2.5 s). | — |
| Row 14 | What a scan leaves. | holds | As SP-05. | — |
| Row 15 | Time on a scan. | holds | `Application.h:661-671`. | — |
| Row 16 | Persistence across games. | holds | `js/app.js:195-215`; `Application.h:1353`. | — |
| Row 17 | Status display. | holds | As SP-03, SP-20. | — |
| Row 18 | ESP32 start-up: "30 s window, up to 10 s WiFi, up to about 61 s health retry"; would need "skip WiFi and health when standalone; shorten the window". | corrected | Per SP-17: an empty WiFi name already skips WiFi and health. | ESP32: a 30 s window on every boot with `DEBUG_MODE` off (`Application.h:766-811`); with a WiFi name set, up to 10 s WiFi and up to about 61 s health retry (`OrchestratorService.h:97-103,341-347,1019-1052`); with no WiFi name both are skipped (`:69-72`). ESP32 would need: shorten or drop the window when standalone (an empty WiFi name already skips WiFi and health). |
| Row 19 | Input. | holds | `js/app.js:265-359,538-560`; `Application.h:1206`. | — |
| Row 20 | Dismiss. | holds | `js/app.js:246-248`; `UIStateMachine.h:364-379`; `TokenDisplayScreen.h:136`. | — |
| Row 21 | Needs internet. | holds | As SP-21. | — |
| Row 22 | Media offline. | holds | `sw.js:192-202`; `AssetService.h:90-224`. | — |
| Row 23 | ESP32 team field "still required". | corrected | The check does not stop boot. | ESP32: required by the config check, which does not stop boot; whatever value parsed, or nothing, is stamped on queued scans (`Config.h:55-64`; `Application.h:558-563,1598-1604`). ESP32 would need: make it optional when standalone. |
| Row 24 | Connection test. | holds | `config.html:302-356`; `Application.h:1139-1180`. | — |
| 4.sum | "The ESP32 is behind the phone in rows 1 to 4, 17, 18, 23 and 24, where it has no standalone handling at all..." | corrected | Rows 2, 18 and 23 per above. | The ESP32 is behind the phone in rows 1 to 4, 17, 23 and 24, where it has no declared standalone handling, though a failed config check does not stop it (row 2). In row 18 an empty WiFi name already skips WiFi and the health check, but the 30-second window stays. It is ahead in rows 21 and 22. Both are weak in rows 5, 6, 10, 13, 14, 15 and 16. Rows 7 and 11 are differences in rules; rows 8, 9, 12, 19 and 20 are differences in presentation or hardware. |

## Section 5. What this means for the rule design

| # | Claim | Verdict | Evidence | Corrected text |
|---|---|---|---|---|
| 5.1 | "Eleven of the sixteen first candidates assume the engine sends a message or holds a record." | corrected | Per 1.5. | **Every rule names its authority with the engine absent.** Eight of the sixteen first candidates assume the engine sends a message, holds a record or is the thing assembled (C1, C4, C5, C6, C7, C10, C12, C15). Each rule must say who takes that place in a standalone game: the GM tablet for every game fact (claims, scores, teams, phase, boundaries, the pack stamp), and each player device for its own private facts (known tokens, seen set, queue, pack copy). A rule that only works when the engine is present fails decision 22. |
| 5.2 | Standalone must be declared; C4, C11, C10 and "the identity rule (C13)" have an undefined input. | corrected | C13 does not apply in a standalone game and its candidate needs no input (section 2, C13). | **"Standalone" must be a declared fact somewhere, and the rules must say where.** Today it is a tap, a URL or nothing (SG-05, SP-01, SP-02). Until the owner answers N1's questions, the boundary rule (C4), the resolver rule (C11) and the staleness rule (C10) each have an undefined input. The dormancy idea (a profile with no engine equipment, so every engine duty reads as "not installed tonight") is the one candidate in the tree that already carries the right words. |
| 5.3 | Parity surface must grow: gate, floor, delete-and-rebuild. | corrected | Per C9-c. | **The parity surface must grow or the sharing fails.** The shared rules module C9 proposes must hold the scan gate, the adjustment and its floor, and the adjustment replay and floor of the delete-and-rebuild as well as `gameRules` (SG-11), in a form a browser loads; the player-side rules (id normalisation, lookup, audio extension) can only be shared as data run against JavaScript and C++ alike (SP-14, SP-15, SP-16). |
| 5.4 | Per-device stamp and between-games check. | holds | Candidate; facts per SG-03, SP-10, D-05, D-06. | — |
| 5.5 | Test rule: one proof per rule family through both. | corrected | 07c exists (C16-a). | **The test rule needs cross-implementation and real-folder proofs.** Extend the one existing cross-mode proof (backend E2E `07c`, scoring only, group case skipped on the shipped pack) to every rule family, or run the same transactions through the backend's `gameRules` and the tablet's `LocalStorage` in a unit test; one proof per player device against the deployed folder with no network; a native test of the ESP32's boot decision with no engine. The ESP32's standalone mode itself is a parity item (section 4), and it starts from a device that already scans with no engine (SP-11). |

## Tally

Claims checked: 188. Holds: 141. Corrected: 47 (section 1: 2; section 2: 20, of them 11 card lines; section 3: 15; section 4: 6; section 5: 4). The completion check (section 6 of the pass) was outside this check's scope, but its "card line of at most 45 words" statement is false for the eight lines listed in correction 6.
