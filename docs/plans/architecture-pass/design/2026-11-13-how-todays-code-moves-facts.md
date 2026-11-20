# How today's code moves to the new design: the facts

Facts for one decision. Is today's code changed in place, or moved piece
by piece into a new structure? This file decides nothing and recommends
nothing.

Read on 2026-11-13 at parent commit `f6b48866`, with the GM scanner at
`b521774`, the pack data at `6f9bc30`, the web player scanner at
`e0bf299` and the firmware at `f81aba5`. From there to `215001d2` only
documents changed, no code. I ran no test, build, server or install, and
I did not open `backend/.env`. I counted with `find`, `wc` and `grep`.
"Inferred" marks a reading of something I did not see directly.

This is the second version. The first is commit `d1b441a7`, written
before the owner's correction of 2026-11-13 that a designer designs the
game's rules in the pack (`docs/adr/0011`). This version rebuilds the
table for change 6, adds the facts the correction makes relevant, and
corrects seven claims. The last section lists every change. The seven
changes carry the titles of the proposal page, version 28.

The 15 lines below are a three-minute read. Sections A to H give each
fact with its evidence, for checking. The whole file is longer than the
ten minutes it was meant to take.

```
files:  find <dir> -type f -name '*.js' | wc -l
lines:  find <dir> -type f -name '*.js' -print0 | xargs -0 cat | wc -l
cases:  grep -rEh --include='*.js' '^[[:space:]]*(it|test)(\.(each|only|skip|todo|concurrent|failing))?[[:space:]]*[(`]' <dir> | wc -l
```

The case count is static. One `it.each` line counts once. Recorded runs
are 3 to 5 percent larger: 3,127 backend unit and contract tests against
my 2,989, and 1,726 GM scanner tests against my 1,669
(`docs/plans/2026-09-12-block2-hardening-plan.md:991`, `:943`).

## The facts that bear most on the decision

1. The backend is 90 source files and 26,916 lines. The GM scanner is 67 files and 16,497 lines. Their tests are 88,538 and 27,608 lines, with about 3,440 and 1,720 cases. (A)
2. The backend stores a session as one object. Each change rewrites all of it, twice, through a key-value file store. No file in `backend/src` appends. A delete cuts a transaction out and a reset empties the list. (B, change 1)
3. One function already works the scores out from a list, `computeTeamScores` at `gameRules/scoring.js:220`. Only the delete path calls it. Score adjustments sit on the score object. Refused and duplicate scans are stored nowhere. (B, change 1)
4. `backend/src/gameRules/` is 11 CommonJS files and 1,877 lines. It uses no Node built-in and requires nothing outside its folder. Scoring, duplicates and modes are 679 of those lines, and 72 of the folder's 207 test cases. (B, change 2)
5. ALN's formulas are code, once in the backend and again in the GM scanner. A token's value is at `tokenService.js:50` and `ALNScanner/src/core/scoring.js:218`. The group bonus is at `gameRules/scoring.js:184` and `LocalStorage.js:430`. The pack names the formulas and sets their numbers. No code evaluates a formula written in a pack. (B, change 6)
6. The pack already sets, and the engine reads at run time, the modes and their flags, which kind of device may do what, the scoring tables, the groups, the clock's phases, and cues with conditions. The toy pack differs from ALN in names, numbers, a third mode and phases. It uses the same formulas. (B, change 6)
7. The GM scanner's copy of the rules is 1,478 lines in six files, and 30 of its 67 files carry a standalone game. Part of what it copies sits outside the rules folder, in `transactionService.js` and `tokenService.js`. The backend's rule functions take the game's config as an argument. The scanner's copies read it from module variables. (B, change 2, and C)
8. The backend has 17 service singletons, 45 module-level `let` variables and 13 call sites that type the list of services by hand. No circular require exists at load time. Seven files form one cycle through requires placed inside functions, 96 such lines in 25 files. (C)
9. Backend tests reach the inside directly. 59 of 110 unit files and 33 of 38 integration files require a file under `src/services/`. 34 unit files use `jest.mock`. Coverage floors are keyed by file path, 85 for the backend and 66 for the GM scanner. (C, E)
10. Three groups of tests require no service singleton. 26 Playwright flows, 110 declarations, start `node src/server.js` and use HTTP, WebSocket and the pages. 5 file-format test files hold 116 cases. The rules tests hold 207. CI runs the flows on four combinations of pack and profile. No recorded session is in the repository. (E)
11. New message definitions alone touch 33 of the 34 HTTP, WebSocket and scanner contract test files, 257 of their 259 cases. They also touch 30 of 38 integration files, at least 16 of 26 flows, 39 of the firmware's 125 cases and 101 of the web player scanner's 165. (E)
12. The backend is CommonJS with no build. The GM scanner is ES modules, bundled by Vite 7.2.2. There is no root package, no workspace and no dependency between the four packages. By default Vite's build converts CommonJS only under `node_modules`, and its dev server serves only files under `ALNScanner/`. (D)
13. The GM scanner's own CI and its GitHub Pages deploy see its repository and its `data` submodule, the pack data, and nothing else. The pack data repository is the one place the backend and the GM scanner both load today. It already holds one ES module. Three checkouts of it sit at two commits. (D)
14. Merged from the hardening work are the equipment families, the dormancy core and the harness minimum, 1,646 added lines in 24 backend source files. Not built are the profile check, credentials, the supervisor, the pack self-heal, and the preflight arms and panel. The dormancy-core fixes were lost. (F)
15. The firmware is 9,606 lines in 28 files. Its tests cover seven pure headers, 686 lines. All its HTTP is in one untested file of 1,424 lines. The config tool requires two backend rule files and one backend script, runs the backend's pack check as a child process, and writes `backend/.env`, `routing.json` and the pack. It has screens for the scoring tables and the cues, and none for modes or formulas. (G, H)

## A. Size and shape

Backend source, `backend/src`:

| Folder | Files | Lines | Largest files, lines |
|---|---|---|---|
| top level | 3 | 843 | `server.js` 485, `app.js` 351 |
| `config` | 1 | 189 | |
| `gameRules` | 11 | 1,877 | `cueValidation` 421, `scoring` 305, `resolution` 259, `modeSemantics` 251 |
| `middleware` | 1 | 370 | `auth.js` |
| `models` | 6 | 1,484 | `session` 426, `teamScore` 265 |
| `routes` | 8 | 1,151 | `scanRoutes` 422 |
| `services` | 35 | 16,505 | `packService` 1,484, `cueEngineService` 1,181, `audioRoutingService` 1,163, `videoQueueService` 1,074, `commandExecutor` 1,061, `transactionService` 897, `bluetoothService` 886, `sessionService` 857 |
| `storage` | 4 | 512 | |
| `utils` | 10 | 1,800 | `displayDriver` 447 |
| `websocket` | 11 | 2,185 | `broadcasts` 747 |
| total | 90 | 26,916 | |

Beside it are `backend/scripts`, 37 files and 6,559 lines, the scoreboard
page `backend/public/scoreboard.html`, 1,860 lines, and
`backend/contracts`, 5,173 lines.

Backend tests, `backend/tests`:

| Layer | `.js` files | Lines | Cases |
|---|---|---|---|
| unit | 110 | 44,520 | 2,612 |
| unit, `services` part | 45 | 28,973 | 1,724 |
| unit, `gameRules` part | 10 | 2,493 | 207 |
| contract | 40 | 7,929 | 376 |
| integration | 38 | 11,928 | 340 |
| e2e flows, Playwright | 26 | 9,376 | 110 |
| e2e helpers, page objects, set-up | 28 | 9,765 | 52, never run |
| `helpers`, `rung1`, `fixtures`, `visual`, one stray test | 24 | 5,020 | 1 |
| total | 266 | 88,538 | 3,439 that a runner runs |

Three test files in `tests/e2e/setup` run under neither runner. Jest
ignores `/tests/e2e/` and Playwright reads only `tests/e2e/flows`
(`jest.config.js:27`, `playwright.config.js:24`). Each Playwright
declaration runs in two browser projects (`playwright.config.js:83`,
`:104`).

GM scanner, `ALNScanner`:

| Source folder | Files | Lines | | Test folder | Test files | Lines | Cases |
|---|---|---|---|---|---|---|---|
| `admin` | 13 | 1,324 | | `unit/admin` | 17 | 2,586 | 178 |
| `app` | 8 | 2,736 | | `unit/app` | 16 | 3,019 | 167 |
| `core` | 14 | 5,180 | | `unit/core` | 19 | 5,686 | 407 |
| `network` | 5 | 1,717 | | `unit/network` | 4 | 3,547 | 230 |
| `services` | 1 | 194 | | `unit/services` | 1 | 338 | 27 |
| `ui` | 14 | 4,111 | | `unit/ui` | 18 | 6,339 | 435 |
| `utils` | 11 | 941 | | `unit/utils` | 10 | 1,382 | 92 |
| `main.js` | 1 | 294 | | `unit`, top level | 1 | 320 | 25 |
| | | | | `tests/app`, `integration`, `contract`, `build-artifacts` | 6 | 2,644 | 112 |
| | | | | `e2e/specs`, Playwright | 6 | 970 | 50 |
| total | 67 | 16,497 | | total, all `.js` under `tests` | 104 | 27,608 | 1,723 |

The other components:

| Component | Source | Tests |
|---|---|---|
| Web player scanner, `aln-memory-scanner` | `js/` 4 files, 1,489 lines. `index.html` 176, `config.html` 470, `sw.js` 306 | 4 files, 2,295 lines, 165 cases |
| Firmware, `ALNScanner_v5` | 28 code files, 9,606 lines. `hal` 6 files 2,164. `models` 3 files 267. `services` 9 files 3,325. `ui` 7 files 2,003. Top level 3 files 1,847. The folder also holds 16 report documents, 8,056 lines | 8 files, 1,549 lines, 125 `RUN_TEST` lines |
| Config tool | `server.js` and `lib/`, 10 files, 2,146 lines. Browser code 22 files, 4,364 lines | 16 files, 2,660 lines, 181 cases. One Playwright file, 2 cases |

## B. What already has the target shape

One table per change. "Matches" is what exists today and is close to
what the change describes. "Differs" is what today's code does instead,
or lacks. Paths without a prefix are under `backend/src`.

### Change 1. The backend keeps one complete record of each session, and updates every screen from it the same way

| | Fact | Evidence |
|---|---|---|
| Matches | `computeTeamScores` returns the whole score table from a transaction list. Its one caller is the rebuild after a delete. | `gameRules/scoring.js:220-294`, `services/transactionService.js:817-829` |
| Matches | `checkDuplicate` decides from the transaction list and a per-device list. | `gameRules/duplicatePolicy.js:83-117` |
| Matches | One function builds the whole state for a screen. It has 6 callers in the source and one in a test helper. One message, `service:state`, carries the state of all equipment. | `websocket/syncHelpers.js:36-159`, `websocket/broadcasts.js:491`. The callers are listed in C |
| Matches | Every session write passes through one ordered queue. | `services/sessionService.js:705-711` |
| Matches | A schema for a finished session's file exists, with 21 test cases. Nothing writes that file. | `backend/contracts/session-bundle.schema.json`. `grep -rnE "session-bundle\|sessionBundle" backend/src backend/scripts` finds nothing |
| Matches | The GM scanner saves a scan before it sends it, gives it an id built from the device id, the time and a random part, and resends after a reconnect. | `ALNScanner/src/network/networkedQueueManager.js:42-76`, `:161` |
| Differs | The session is one object changed in place. A save writes all of it under two keys with `node-persist`. Nothing appends. | `services/sessionService.js:718-731`, `storage/FileStorage.js:60-72`. `grep -rnE "appendFile\|createWriteStream" backend/src` finds nothing |
| Differs | A delete splices the transaction out. A reset empties the list and the adjustments. | `services/transactionService.js:721`, `:586-589`, `services/session/persistenceListeners.js:44-47` |
| Differs | An unknown token and a duplicate return before anything is stored. Score adjustments live on the score object. | `services/transactionService.js:179-190`, `:212-223`, `:132` |
| Differs | The seven equipment modules never touch the session. They write to the log. | `grep -c "sessionService\."` gives 0 in each |
| Differs | Scans and commands come in six ways: two scan routes, a device record on `GET /health`, a playlist write, and two socket events. The scan routes ask for no credential. | `routes/scanRoutes.js:6-19`, `:202`, `routes/healthRoutes.js:88`, `routes/musicRoutes.js:40`, `server.js:107`, `:112` |
| Differs | 40 listener lines send single messages to a connected screen. A connecting screen gets the whole state. | `grep -c "addTrackedListener(" websocket/broadcasts.js` gives 41, one the definition. `websocket/gmAuth.js:165` |

### Change 2. A standalone game runs the same game code as a networked one

| | Fact | Evidence |
|---|---|---|
| Matches | The rules folder is 11 CommonJS files. Its four `require` lines all point to its own files. It uses no Node built-in, only language features. One file keeps two variables for a one-time warning. | `grep -n "require(" backend/src/gameRules/*.js`, `gameRules/modeSemantics.js:134-135` |
| Matches | Its scoring, duplicate and mode functions take plain data and the game's config as arguments. They are 3 files and 679 lines. The other 8 files, 1,198 lines, check cues, work out equipment needs and permissions, and hold wording. | `gameRules/scoring.js:51`, `duplicatePolicy.js:83`, `modeSemantics.js:173`. `wc -l backend/src/gameRules/*.js` |
| Matches | The GM scanner loads the pack at run time and checks each file's sha1. 457 lines, 30 test cases. | `ALNScanner/src/core/packLoader.js:1-28` |
| Matches | The installation profile can say there is no backend. One backend line reads that field. No scanner reads the profile. | `gameRules/resolution.js:53` |
| Differs | The files use `require`, which a browser cannot run. See D, items 5 to 8. | |
| Differs | What the scoring and duplicate functions work out is ALN's own formulas, which `docs/adr/0011` moves into the pack. The table for change 6 has them. | |
| Differs | Rule code sits outside the folder. The session check, the unknown-token refusal and the score changes are in `transactionService.js`. A token's value is worked out in `tokenService.js`, which also requires `fs`, the config and the logger. | `services/transactionService.js:157`, `:179`, `:380-464`, `services/tokenService.js:1-4`, `:50-67` |
| Differs | All six model files require Joi through `utils/validators.js`. Three require `uuid`. | `grep -n "require(" backend/src/models/*.js`, `utils/validators.js:6` |
| Differs | The GM scanner has its own copy: `LocalStorage.js` 629 lines, `modeSemantics.js` 413, `scoring.js` 219, `gameActivityBuilder.js` 112, `formatCurrency.js` 73, `dormancyWording.js` 32. The copy reads module variables set when the pack loads. | `wc -l`. `ALNScanner/src/core/modeSemantics.js:71-93`, `scoring.js:38-64` |
| Differs | The backend rules read a token as `value`, `groupId` and `groupMultiplier`. The scanner reads the pack's raw `SF_*` fields. | `services/tokenService.js:135-190`, `ALNScanner/src/core/storage/LocalStorage.js:394-438` |
| Differs | The scanner's standalone store is one object written whole to one `localStorage` key. Its delete splices and its reset empties. | `LocalStorage.js:113-115`, `:455`, `:273` |

### Change 3. The messages between the backend and the devices are defined in one place and checked automatically

| | Fact | Evidence |
|---|---|---|
| Matches | Two files define today's messages, `openapi.yaml` with 16 paths and `asyncapi.yaml` with 25 messages. | `backend/contracts/`, `asyncapi.yaml:92-126` |
| Matches | 34 test files, 259 cases, are the contract tests for HTTP, WebSocket and the scanners. 26 of the 34 use the `ajv` helper. One reads the GM scanner's own list of message names. | `backend/tests/helpers/contract-validator.js:6-25`. `grep -rlE "contract-validator\|require\(['\"]ajv"` over the four folders. `tests/contract/scanner/client-contract-conformance.test.js:24` |
| Matches | Schemas for files exist: six for the pack, one for the profile, one for the session file. The six pack schemas sit in the pack data repository, beside ALN's own pack. The other two sit in `backend/`. | `find . -name '*.schema.json'`: `ALN-TokenData/*.schema.json`, `backend/config/profiles/installation-profile.schema.json`, `backend/contracts/session-bundle.schema.json` |
| Matches | A pack has a content hash. The GM scanner sends its own when it connects. | `services/packService.js:1432`, `websocket/socketServer.js:50` |
| Differs | The running backend never reads the two files. It checks with 14 Joi schemas typed by hand. | `grep -rnE "openapi\|asyncapi" backend/src` finds comments only. `utils/validators.js:32-213` |
| Differs | A pack mismatch at connect writes one log line. | `websocket/socketServer.js:139-148` |
| Differs | The GM scanner's own CI cannot see the two files. | `ALNScanner/tests/unit/network/orchestratorClient.test.js:347-349` |
| Differs | The firmware's replies are fixed in one header. What goes on a tag has no schema. | `ALNScanner_v5/services/ScanResponse.h:51-75`. `ALN-TokenData/tag-writer.html`, cited on the page and not re-read |

### Change 4. Video, music, sound and lights are controlled through one pattern, and their programs restart when they crash

| | Fact | Evidence |
|---|---|---|
| Matches | `ProcessMonitor` is a class of 220 lines with 39 test cases, built in five places. It kills a leftover copy by PID file, restarts with a growing delay, gives up after 5 failures in a row, and kills the child when the backend exits. | `utils/processMonitor.js:16-20`, `:60-61`, `:92-95`, `:136-155`. `grep -rn "new ProcessMonitor(" backend/src` |
| Matches | The health registry holds three words, `healthy`, `down`, `dormant`. 300 lines, 50 test cases. | `services/serviceHealthRegistry.js:35`, `:81-87` |
| Matches | Six of the seven modules have `init`, `getState`, `reset` and `cleanup`. One base class, 401 lines, serves players driven over D-Bus. | grep per file. `services/mprisPlayerBase.js:185` |
| Matches | "Check this now" is the command `service:check`. 31 commands are refused when the program they need is down. | `services/commandExecutor.js:884`, `:38-77` |
| Matches | Stand-ins for the gear exist for tests, 830 lines of set-up and a profile generator. | `backend/tests/rung1/provision.js`, `backend/scripts/lib/simulationProfile.js` |
| Differs | The seven differ in size. Audio routing 1,163 lines, Bluetooth 886, music 636, video 532, lights 522, display 447, sound 163. | `wc -l` |
| Differs | The check has two names, `checkConnection` on three and `checkHealth` on three. The display driver is no class and uses no `ProcessMonitor`. Sound starts one short process per sound. Music keeps its own `connected` field. | `utils/displayDriver.js:53`, `services/soundService.js:75`, `services/musicService.js:73`, `:231` |
| Differs | The failure count resets when the child wrote any output. No `restart()` exists. Restart, out of service and back in service have table rows and no switch case. | `utils/processMonitor.js:136-138`, `services/commandExecutor.js:98-101` |
| Matches | At start the backend restores the session, the clock, and which cues have fired or are switched off, from the saved session. | `services/sessionService.js:107-111`, `:154`, `:166` |
| Differs | GM logins and held items live in memory only. `docs/adr/0010` lists what else a restart loses today. | `middleware/auth.js:13-14`. `grep -n persist services/heldItemsStore.js` finds nothing |

### Change 5. The engine keeps separate what belongs to one session, to one installation and to the whole production

| | Fact | Evidence |
|---|---|---|
| Matches | The pack is read from one folder and fixed at start. 1,484 lines, 176 test cases. The check that refuses a pack is 415 of those lines. | `services/packService.js:166-178`, `:718-1132`, `:1215-1245` |
| Matches | The installation profile is one file fixed at start, with a schema. | `services/profileService.js:31-40`, `:105` |
| Matches | A session carries its pack's identity and its preflight result. | `services/sessionService.js:215-226` |
| Matches | A running copy can have its own folders for session data and logs. | `config/index.js:52-53`, `backend/tests/e2e/setup/test-server.js:234-247` |
| Differs | Session data and installation data share one store. Audio routes and volumes use it too. | `services/audioRoutingService.js:120`, `:288`, `:547` |
| Differs | Installation facts sit in 47 environment names, `routing.json`, `music-playlists.json`, the profile and 13 names under `/tmp`, one of them a pattern for PID files. | `grep -oE "process\.env\.[A-Z_0-9]+" config/index.js`, sorted and counted. `grep -rhoE '/tmp/[A-Za-z0-9._{}$-]+' backend/src`, sorted and counted. The pattern is at `services/mprisPlayerBase.js:209` |
| Differs | Start-up, reset, shutdown, and session start, pause and end are each a typed list of steps. | `app.js:178-347`, `services/systemReset.js:38-301`, `server.js:163-217`, `services/sessionService.js:284-559` |

### Change 6. A designer writes a game's rules in the pack, and the code has a known place for each new capability

This table is new in the second version. The proposal page says of
today that the rules of the game are in the engine's code, and that a
pack picks them by name and sets their numbers. The rows below give the
places.

| | Fact | Evidence |
|---|---|---|
| Matches | The engine lists 8 capabilities. A pack lists the ones it needs, and the backend refuses at start a pack that needs another. Four more sets hold the mode values the engine can run. | `services/packService.js:52-61`, `:78-83` |
| Matches | The pack's rules file already sets each mode with its verb, label and flags. ALN has 2 modes and the toy pack 3. It also sets which of three kinds of device may do each of seven functions, the entity's label, two scoring tables, the groups with their multipliers, and the clock's phases. The schema locks three functions to staff. | `ALN-TokenData/game.json`. `game.schema.json`, 19 top-level properties, `$defs/floorFunction` |
| Matches | The backend and the GM scanner read what a mode does from its flags. Literal mode names remain on 5 backend lines and 7 GM scanner lines, as defaults and in the built-in fallback tables. | `gameRules/modeSemantics.js:173-199`, `ALNScanner/src/core/modeSemantics.js`. `grep -rnE "['\"](blackmarket\|detective)['\"]"` over each `src`, comment lines left out |
| Matches | One kind of rule already runs from pack data, the cue. A cue names one of 16 events or a clock time, conditions with 7 operators over that event's fields, and commands from a table of 24. The backend refuses any other command from a cue. ALN's pack has 10 cues. | `services/cue/standingEvaluator.js:26-82`, `gameRules/cueVocabulary.js:23-56`, `gameRules/cueValidation.js:91`, `services/commandExecutor.js:136` |
| Matches | The same code checks a pack twice, when the backend starts and when the config tool publishes. | `services/packService.js:718-1132`, `config-tool/lib/publish.js:79-93` |
| Matches | The config tool has a screen for the two scoring tables, and screens for cues with a condition builder. | `config-tool/public/js/sections/economy.js`, 160 lines. `components/cueEditor.js` 350, `conditionBuilder.js` 130, `commandForm.js` 469 |
| Matches | The GM scanner draws equipment state from one store through seven renderer files. | `ALNScanner/src/core/stateStore.js`, `src/admin/MonitoringDisplay.js:4-10` |
| Differs | The formulas are code, written twice. A token's value is `floor(base * multiplier)` from the two tables. The group bonus is the sum of `value * (multiplier - 1)` over the group's tokens that the entity scored. A token used in a consuming mode is used up for the session. | `services/tokenService.js:50-67` and `ALNScanner/src/core/scoring.js:218`. `gameRules/scoring.js:184-197` and `ALNScanner/src/core/storage/LocalStorage.js:430`. `gameRules/duplicatePolicy.js:83-117` |
| Differs | The pack picks each formula by name. A mode's `scoringPolicy` is `standard` or `none`. The schema allows one name for the bonus formula. The start-up check refuses any group rule but `all` and any duplicate rule but `once`. | `services/packService.js:78-83`, `:774-799`. `ALN-TokenData/game.schema.json` |
| Differs | No code evaluates a formula written in a pack, and no package for that is installed. | `grep -rnE "\beval\(\|new Function\(\|jsonlogic\|mathjs\|expr-eval\|jexl" backend/src ALNScanner/src config-tool/lib` finds nothing. The `dependencies` of the four `package.json` files |
| Differs | What a token carries is fixed at ten named fields, and the schema allows no other. What an account holds is fixed at one score with its parts. | `ALN-TokenData/tokens.schema.json`, `additionalProperties: false`. `models/teamScore.js:15-40`, `utils/validators.js:139-157` |
| Differs | A cue's condition on a scan can read six facts: the token's id, the entity, the kind of device, the points, the score, and whether a bonus came. It cannot read the token's type, rating or group. | `gameRules/cueVocabulary.js:23-42` |
| Differs | The toy pack uses the same formulas as ALN. It differs in names, numbers, one more type, a third mode that scores nothing, and three phases. | `backend/tests/e2e/fixtures/packs/toy-heist/game.json` |
| Differs | The config tool has no screen for modes, functions, entities, group rules or the duplicate rule. | `grep -rnE "\.modes\b\|entityRole\|duplicatePolicy\|groupRules" config-tool/public/js config-tool/lib` finds two reads, `lib/configManager.js:79-80` and `sections/economy.js:18` |
| Differs | All commands are one switch of 64 cases in one function of 876 lines. A command can need a row in five other lists. | `services/commandExecutor.js:120-996`, `:38`, `:86`. `gameRules/cueValidation.js:91`, `gameRules/grants.js:61`, `backend/contracts/asyncapi.yaml:1763` |
| Differs | The scoreboard is one file with one script block. | `backend/public/scoreboard.html:739-1858` |

### Change 7. The backend is assembled in one place, and a copy started for a test or a rehearsal leaves the installed backend as it was

| | Fact | Evidence |
|---|---|---|
| Matches | Six modules export a class: `ProcessMonitor`, `MprisPlayerBase`, `HeldItemsStore`, `TimelineRuntime`, `DuckingEngine`, `DiscoveryService`. | the last `module.exports` line of each |
| Matches | Five functions take their parts as arguments: `createMusicRouter`, `setupCueEngineForwarding`, `buildSyncFullPayload`, `performSystemReset`, `dormancyService.compute`. | `app.js:118`, `:252`, `websocket/syncHelpers.js:36`, `services/systemReset.js:38`, `services/dormancyService.js:90` |
| Matches | The GM scanner is put together in one file, which builds the parts and passes them to `App`. | `ALNScanner/src/main.js:52-206` |
| Matches | The flows start a separate backend process with its own port, data folder and log folder. | `backend/tests/e2e/setup/test-server.js:234-295` |
| Differs | Names are fixed: the 13 names under `/tmp`, the video player's bus name, a kill by pattern in two places, display `:0`. | `services/vlcMprisService.js:16`, `services/audioRoutingService.js:603`, `utils/displayDriver.js:147`, `:56` |
| Differs | Static files resolve against the process's working folder. Integration tests run one at a time. | `app.js:143`, `backend/jest.integration.config.js:22` |

## C. Coupling that bears on "in place" against "new structure"

| Fact | Count | Evidence |
|---|---|---|
| Files with `module.exports = new X()` | 14 | `grep -rnE "^module\.exports\s*=\s*new\s+" backend/src`. All in `services/`: audioRouting, bluetooth, cueEngine, gameClock, heartbeatMonitor, lighting, offlineQueue, persistence, scoreboardControl, session, sound, transaction, videoQueue, vlcMpris |
| Service singletons spelled another way | 3 | `displayControlService.js:429-432`, `musicService.js:633-636`, `serviceHealthRegistry.js:295-300` |
| Other single instances | 4 | `websocket/listenerRegistry.js:124`. The logger, `utils/logger.js:71`. The config, `config/index.js:190`, which loads the environment file at line 10. The Express app, `app.js:42` |
| Module-level `let` variables | 45 in 15 files | `grep -rcE "^let " backend/src`. `packService.js` has 15, `server.js` 6 |
| Module-level collections | 9 in 5 files | `middleware/auth.js:13-20`, `dormancyService.js:41`, `broadcasts.js:14-23`, `scanRoutes.js:183`, `cue/standingEvaluator.js:171` |
| Source files that require `sessionService` | 16 | `grep -rlE "require\(['\"][^'\"]*sessionService['\"]\)" backend/src` |
| Source files that require `transactionService` | 10 | same pattern |
| Test files that require them | 66 and 55 | same pattern over `backend/tests` |
| Cycles among requires at load time | 0 | my static scan, see the end of this file |
| Requires inside functions | 96 lines in 25 files | `grep -rnE "^\s+.*require\(['\"]\.\.?/" backend/src`. `sessionService.js` has 17 |
| Cycles once those count | 1, of 7 files | below |
| Call sites that type the list of services | 13 | below |

The cycle. `commandExecutor.js:15-17` requires `sessionService`,
`transactionService` and `videoQueueService` at load.
`cueEngineService.js:27` requires `commandExecutor` at load, and
`commandExecutor.js:223` requires `cueEngineService` inside a function.
`transactionService.js:12-13` requires `sessionService` and
`videoQueueService`. `sessionService.js:14` requires
`session/persistenceListeners.js`, whose lines 26 and 72 require
`transactionService` inside functions. `sessionService.js:165`, `:335`,
`:457`, `:522` and `:726` require `cueEngineService` inside functions,
and `:223` requires `dormancyService`, whose line 171 requires
`cueEngineService`. `videoQueueService.js:746` requires
`transactionService`. The map of 2026-11-01 found the same seven files
(`relationships/2026-11-01-today-backend-modules.md`, section 5.1).

The 13 call sites:

| Call | Where | Services named |
|---|---|---|
| `buildSyncFullPayload` | `server.js:77`, `routes/stateRoutes.js:34`, `websocket/gmAuth.js:165`, `websocket/broadcasts.js:98`, `:312`, `:353` | 10 each |
| `setupBroadcastListeners` | `server.js:139`, `services/systemReset.js:138` | 13 each |
| `setupCueEngineForwarding` | `app.js:252`, `services/systemReset.js:170` | 7 each |
| `startRevalidation` | `app.js:333`, `services/systemReset.js:291` | 6 each |
| `performSystemReset` | `websocket/adminEvents.js:77-90` | 12, music left out |

More lists are typed by hand: the import blocks of `app.js:15-29` and
`server.js:27-41`, the reset order at `systemReset.js:85-124`, the
shutdown order at `server.js:186-198`, two maps of checks at
`serviceHealthRegistry.js:236-244` and `commandExecutor.js:885-895`, and
the nine service names at `serviceHealthRegistry.js:32`.

How the tests reach the singletons:

| Way | Unit | Contract | Integration | Evidence |
|---|---|---|---|---|
| Test files in the layer | 110 | 40 | 38 | |
| Require a file under `src/services/` | 59 | 23 | 33 | `grep -rlE "require\(['\"][^'\"]*src/services/"` |
| Name the path of one of the 17 singletons | 43 | 20 | 32 | `grep -rlE "src/services/(<the 17 names>)(\.js)?['\"]"` |
| Use `jest.mock(` | 34 | 0 | 4 | `grep -rlE "jest\.mock\("` |
| Call `resetAllServices` | 14 | 15 | 17 | `grep -rlE "resetAllServices\b"` |
| Call `resetAllServicesForTesting` | 0 | 0 | 20 | It runs the real `performSystemReset`, `tests/helpers/service-reset.js:273-282` |
| Use the shared mock factories | 2 | 0 | 0 | `grep -rl "helpers/mocks" backend/tests`. Eight factories exist |
| Name an event that passes only between services | 24 | 1 | 9 | pattern in E |

Jest never resets modules between tests (`jest.config.base.js:69`).
Coverage floors are per file and keyed by path, 85 entries for the
backend and 66 for the GM scanner, checked in CI
(`.coverage-thresholds.json` in each).

The GM scanner. `src/main.js` builds the data manager, `TeamRegistry`,
the state store and the UI manager, then passes them to `new App({...})`
at line 193. `App` builds four domain objects that each keep a reference
back to it (`src/app/app.js:80-83`). Eight modules build an instance
when first imported: `app/app.js:712`, `app/sessionModeManager.js:141`,
`core/packLoader.js:456`, `core/tokenManager.js:306`,
`services/StateValidationService.js:192`, `ui/settings.js:73`,
`utils/debug.js:78`, `utils/nfcHandler.js:189`. Five files keep what the
pack sets in module variables: `core/modeSemantics.js:71-75`,
`core/scoring.js:38`, `:137`, `core/strings.js:91`, `core/theme.js:66`,
`utils/formatCurrency.js:29`. The code asks which mode it is in at 20
places in 6 files
(`grep -rnE "\.(isStandalone|isNetworked)\(\)" ALNScanner/src`).

Which files a standalone game uses. The map of 2026-11-01 lists 30 of
the 67 (`relationships/2026-11-01-today-client-modules.md`, section
6.4). All 30 exist and total 9,112 lines. The other 37 serve only a
networked game and total 7,385 lines. Among them are all of `admin/` and
`network/`, `NetworkedStorage.js`, `stateStore.js`, nine files in
`ui/renderers` and the connection wizard. The page loads the socket
client from the backend's own address (`ALNScanner/index.html:570`).

## D. Module systems and where shared code could live

Constraints, not a layout.

1. Four submodules join the parent, each on `branch = main`: the GM scanner, the web player scanner, the pack data and the firmware. The two scanners each nest the pack data again at `data/`. `backend/` and `config-tool/` are folders of the parent (`.gitmodules`, `ALNScanner/.gitmodules`).
2. Four `package.json` files exist and none at the root. None has `workspaces`. None depends on another by `file:` or `link:`.
3. The backend has no `type` field, so Node treats it as CommonJS. No file in `backend/src` uses `import` or `export`. It has no build. `npm start` runs `src/server.js` under pm2 on Node 22 or later (`backend/package.json`).
4. The GM scanner's `package.json` says `"type": "commonjs"`, yet all 67 source files use `import` and `export` and none uses `require`. Vite reads them as ES modules. Jest turns them into CommonJS with Babel (`ALNScanner/jest.config.js:33-36`). The package has no run-time dependency.
5. Plain Node cannot load a GM scanner source file. I ran `node -e "require('<root>/ALNScanner/src/utils/escapeHtml.js')"` and got `SyntaxError: Unexpected token 'export'`.
6. Plain Node imports the rule files as ES modules and sees their named exports. I ran `node --input-type=module -e "import * as ns from '<root>/backend/src/gameRules/scoring.js'; console.log(Object.keys(ns))"` and got `computeTeamScores`, `pointsFor` and the six others. `duplicatePolicy.js` and `modeSemantics.js` gave the same result. That is Node, not a browser.
7. `vite.config.js` sets `root: './'`, `publicDir: 'data'` and six aliases under `/src`. It sets no `commonjsOptions`, no `optimizeDeps` and no `server.fs`.
8. Vite's defaults, read in the installed copy at `ALNScanner/node_modules/vite/dist/node/chunks/config.js`. The build converts CommonJS only where a file's path matches `/node_modules/`, lines 33974 to 33977. The dev server serves only files under the workspace root, lines 26325 and 26349. It finds that root by walking up for `pnpm-workspace.yaml`, `lerna.json` or a `workspaces` field, lines 25899 to 25929. None exists here, so the root is `ALNScanner/`. I ran neither the build nor the dev server.
9. `publicDir: 'data'` copies the whole pack data checkout into the build output unchanged and unbundled. The `dist/` in this tree holds `tokens.json`, the six schema files, `tag-writer.html` and `shared/`. The pack data repository already holds one ES module, `shared/aln-tools.js`, which its two HTML tools load with `<script type="module">`.
10. Three checkouts of the pack data exist. The parent's and the GM scanner's are at `6f9bc30`. The web player scanner's is at `15d8d2e` (`git submodule status --recursive`).
11. The GM scanner's own CI checks out its repository with `submodules: recursive`, so it sees its own tree and `data/`. Its tests, its build check and its GitHub Pages deploy run there. The deploy runs on every push to its `main` and publishes `dist/` (`ALNScanner/.github/workflows/test.yml`, `sync.yml:5-7`, `:38`, `:50`).
12. The parent's CI checks out all five repositories and builds the GM scanner before the flows. The backend serves `ALNScanner/dist` through the symlink `backend/public/gm-scanner` and builds it on `npm start` (`backend/package.json` `prestart`). It serves the web player scanner's whole repository through a second symlink, with no build.
13. Code crosses repository lines one way today. Backend Jest requires GM scanner source in 4 files and web player scanner source in 7, and one Babel rule lets it read the GM scanner's ES modules (`backend/jest.config.base.js:72-75`). The config tool requires backend files, see H. No GM scanner file imports or reads a path under `backend/` (`grep -rnE "(import |require\(|readFileSync\(|path\.(resolve|join)\().*backend/" ALNScanner/src ALNScanner/tests ALNScanner/scripts` finds nothing).
14. Two other file forms are already in the tree. Three web player scanner files end with a guard that sets `module.exports` under Node, and load in a browser as plain scripts (`aln-memory-scanner/js/scannerCore.js:103-108`). The config tool's browser code is 22 ES module files loaded with no build.
15. A change to the backend and the GM scanner together is commits in two repositories and a new pin in the parent. Inferred from item 1 and from ruling R4, "One PR per touched repo per block" (`2026-09-12-block2-hardening-plan.md:42`).
16. Blue's rule 3 forbids running the web player scanner's "Sync & Deploy" workflow before the cutover (`docs/plans/CURRENT-STATE.md`, section 4).

## E. The tests as an asset

I sorted test files by the names in their text. "Names a message" means
one of the 24 message names in `asyncapi.yaml:92-126` other than
`error`, in quotes. "Names a path" means `/api/` followed by scan,
state, session, tokens, admin, pack, assets, music or vocabulary, or
`/health` in quotes. An "inner event" is a name that passes only between
backend services, such as `transaction:accepted`, `session:updated` or
`health:changed`.

Tests that check behaviour through an outside edge:

| Group | Files | Cases | How it reaches the system | Tied to | Three examples |
|---|---|---|---|---|---|
| File formats | 5 | 116 | reads JSON files, checks with `ajv` | the pack, profile and session-file schemas | `contract/pack/pack-schemas.test.js`, `contract/profile/installation-profile-schema.test.js`, `contract/session-bundle.schema.test.js` |
| Pure rules | 10 | 207 | calls the functions in `gameRules/` | function names and argument forms | `unit/gameRules/scoring.test.js`, `duplicatePolicy.test.js`, `resolution.test.js` |
| HTTP, WebSocket and scanner contracts | 34 | 259 | 17 files drive the backend over HTTP or a socket. The other 17 check typed-in payloads, a scanner's own code or the two files' own text | today's messages. 21 of the 34 require a file under `src/services/` for set-up | `contract/http/scan.test.js`, `contract/websocket/transaction-events.test.js`, `contract/scanner/client-contract-conformance.test.js` |
| Backend flows, Playwright | 26 | 110 | start `node src/server.js` with environment variables, then drive the pages | the pages' DOM through 3,370 lines of page objects, today's messages and paths, the environment variable names | `e2e/flows/07c-gm-scanner-scoring-parity.test.js`, `30-full-game-session-multi-device.test.js`, `toy-pack-surfaces.test.js` |
| The audit against real programs | 1 | 13 checks | a running backend with real video and music players and stand-in gear | today's messages | `tests/rung1/audit-flows.js` |
| GM scanner in a browser, Playwright | 6 | 50 | the built page alone | the page's DOM | `ALNScanner/tests/e2e/specs/02-standalone-mode.spec.js`, `00-smoke.spec.js`, `phase2-validation.spec.js` |
| The session report's exact text | 1 | 28 | calls the report generator | a format the owner's own tooling parses | `ALNScanner/tests/contract/sessionReport.contract.test.js` |

One file-format file and one rules file also require
`services/cue/standingEvaluator.js`, to compare its table of events. That
module exports functions and tables, not an instance
(`contract/pack/cues-schema.test.js:22`,
`unit/gameRules/cueValidation.test.js:33`). The flows require one
backend source module, the logger, in six set-up files. CI runs the
flows on ALN, the toy pack, the toy pack with lighting not installed,
and the toy pack that requires lighting (`.github/workflows/test.yml`,
the `matrix`).

The scoring parity tests. The flow `07c-gm-scanner-scoring-parity`
plays the same tokens through a standalone GM scanner and a networked
one, in 5 declarations. `ALNScanner/tests/unit/core/scoring-parity.test.js`
pins 5 cases with expected values typed in, and imports no backend file.
The map of 2026-11-01 found no test that runs one input through both
copies and compares (`2026-11-01-today-client-modules.md`, section 1,
finding 2).

The toy pack is `backend/tests/e2e/fixtures/packs/toy-heist`, six files,
beside `toy-heist-require` and `parity-pack`. 11 unit files, 4 contract
files, 8 flow and set-up files and 3 config tool test files name it
(`grep -rl "toy-heist"`).

What pins ALN's scores today. Of the 207 rules cases, 72 are on the
scoring, duplicate and mode files. The other 135 are on cue checks,
equipment needs, permissions and wording. The GM scanner's copy has 128
cases in six files under `ALNScanner/tests/unit/core`. The post-session
checker scores a saved session again. It reuses the backend's mode
resolver and group functions
(`backend/scripts/lib/ScoringCalculator.js:22-23`, `:105`, `:257`), and
has 15 check files of 3,227 lines. No recorded session is in the
repository. The backend
writes sessions to `backend/data/`, which git ignores (`.gitignore:29`)
and this checkout does not have.
`git ls-files '*.json' | xargs grep -lE '"transactions"\s*:\s*\['` finds
nothing.

Tests tied to today's inside:

| Group | Files | Cases | Ties | Three examples |
|---|---|---|---|---|
| Backend unit, all but the rules | 100 | 2,405 | 58 require a file under `src/services/`, 34 use `jest.mock`, 23 name an inner event | `unit/services/transactionService.test.js`, `unit/services/sessionService.test.js`, `unit/websocket/broadcasts.test.js` |
| Backend integration | 38 | 340 | 33 require a file under `src/services/`, 20 run the real reset, 9 name an inner event | `integration/transaction-flow.test.js`, `session-lifecycle.test.js`, `reconnection.test.js` |
| GM scanner `tests/unit`, `tests/app`, `tests/integration` | 90 | 1,641 | each imports source files by path, 19 use `jest.mock` | `unit/core/storage/LocalStorage.test.js`, `unit/network/networkedQueueManager.test.js`, `unit/ui/renderers/HealthRenderer.test.js` |
| Web player scanner | 4 | 165 | each loads a source file by path | `tests/orchestratorIntegration.test.js`, `app.test.js`, `scannerCore.test.js` |
| Config tool | 16 | 181 | 4 require backend files | `tests/publishDraft.test.js`, `draftRoutes.test.js`, `routes.test.js` |
| Firmware, run on the host | 8 | 125 | each includes one header | `test/test_ndef/`, `test_scan_response/`, `test_payload/` |

What new message definitions alone invalidate. I counted files that name
one of today's messages or paths. A file that names `group:completed` as
a cue's trigger also matches, so these are upper bounds.

| Group | Files that name one | Cases in those files |
|---|---|---|
| Backend contract: HTTP, WebSocket, scanner | 33 of 34. 29 name a message or path, and 4 more read `asyncapi.yaml` itself. The last pins one field of the lighting state | 257 of 259 |
| Backend integration | 30 of 38 | 264 of 340 |
| Backend unit | 27 of 110 | 865 of 2,612 |
| Backend flows | 16 of 26 directly | 77 of 110. The other ten reach messages through helpers such as `helpers/gm-command.js` and `setup/websocket-client.js` |
| GM scanner unit | 15 of 86 | 444 of 1,561. The 17 `admin` test files, 178 cases, also pin the command each controller sends |
| Web player scanner | 2 of 4 | 101 of 165 |
| Firmware | 3 of 8 | 39 of 125: the payload, the scan reply, the batch id |

A message change does not touch the file-format tests, 116 cases, or the
rules tests, 207 cases. The firmware's 15 tag-parser cases are tied to
the tag's layout, which the new design also changes.

## F. The paused hardening work

Sources: `docs/plans/2026-09-12-block2-hardening-plan.md`, section 9, and
`docs/plans/CURRENT-STATE.md`, sections 2 and 5. I checked each "merged"
row against the tree. Against `main`, this branch adds 1,646 lines in 24
backend source files and 5,541 lines in 64 backend test files
(`git diff --shortstat main..HEAD -- backend/src`, then `backend/tests`).
The GM scanner's branch adds 433 lines in 12 source files.

| Piece, by the plan's name | State | Where | Matches |
|---|---|---|---|
| The equipment families and fixtures | merged | `gameRules/endpointServices.js`, the profile schema, `config/profiles/aln-full-kit.json`, the toy fixtures, two more CI combinations. Plan line 911 | change 5 |
| The dormancy core | merged | The three health words. `dormancyService.js`, 209 lines. `preflightService.js`, 158 lines, its smallest form. The refusal to start a session when required gear is missing, with a typed override, `sessionService.js:284-314`. The display as a ninth service. Two flows. Plan line 926 | changes 4 and 5 |
| Three follow-ups to the dormancy core | merged | CI browser launch, GM scanner review fixes, how the display reports an exit. Plan line 938 | change 4 |
| The harness minimum | merged at `209916b` | One data folder and one log folder per test worker, and a guard on the logger. Plan line 956 | change 7 |
| Green's three follow-ups | merged at `089dd527` | Plan line 986 | none |
| The dormancy-core fixes | lost | Seven local commits, never pushed. The brief stands, `docs/plans/briefs/2026-09-13-dormancy-survivors.md`. Plan line 980 | change 4 |
| The profile file check at boot | brief only | `briefs/2026-09-12-p1-profile-check.md`, one blocking finding open. Today the profile service checks only `schemaVersion`, `profileService.js:90` | change 5 |
| Credentials on every connection | brief only | `briefs/2026-09-12-credentials-lane.md`, thirteen findings never applied. Today the check covers only a connection that calls itself `gm`, `websocket/socketServer.js:53` | changes 1 and 5, `docs/adr/0004` |
| The supervisor and the fault buttons | brief only | `briefs/2026-09-12-supervisor-lane.md`, second revision. No `hostConfigService.js`. `utils/processMonitor.js` is unchanged from `main` | change 4 |
| The scanner's pack self-heal | brief only | `briefs/2026-09-12-self-heal-lane.md`, one blocking finding open. `packLoader.js` has no `refresh()` | changes 3 and 5 |
| The preflight arms and the command line | no brief | No `backend/scripts/preflight.js`. `packNeeds.js` has eight kinds of need and no video-file kind | changes 4 and 5 |
| The preflight panel, the wiring, the sweep rows, the close review | not started | No `PreflightRenderer.js`. Plan lines 334, 550, 564 | change 4 |
| The rest of the test set-up repair | briefs only | `briefs/2026-09-12-p2a-*.md`, `p2b-*.md`. Deferred by the owner, plan line 587 | change 7 |
| Blue's own fixes of September | on blue's branch | Checked against this engine in `docs/plans/2026-10-30-production-fixes-triage.md`. I did not read that branch | |

This clone holds no worktree and knows four remote branches of the
parent: `main`, the working branch, an older branch at `main`'s commit,
and blue's. The state page says the merged pieces stay, changed only
where a rule requires, and the unbuilt ones are rebuilt in the build
half (`CURRENT-STATE.md`, section 5).

## G. The hardware scanner firmware

Code files in `arduino-cyd-player-scanner/ALNScanner_v5`:

| File | Lines | What it holds today | Host tests |
|---|---|---|---|
| `Application.h` | 1,656 | start-up order, the scan loop at 484, the timestamp at 619, what to show for each scan result at 689, the serial commands at 1059 to 1516 | none |
| `config.h`, `ALNScanner_v5.ino` | 191 | pins, timings, paths, limits, and the entry point | the smoke test includes `config.h` |
| `hal/RFIDReader.h` | 954 | the tag reader. It reads pages 3 to 10, 32 bytes, in one exchange, lines 620 to 649 and 674 | none |
| `hal/NDEFParser.h` | 141 | finds the id on a tag. It reads the first record only and requires a Text record, lines 105 to 122 | 15 |
| `hal/SDCard.h`, `DisplayDriver.h`, `AudioDriver.h`, `TouchDriver.h` | 1,069 | the card, the screen, sound, touch | none |
| `models/Config.h` | 96 | the settings and their checks | 22 |
| `models/Token.h` | 89 | a token and a scan | 23 |
| `models/ConnectionState.h` | 82 | three connection states | none |
| `services/OrchestratorService.h` | 1,424 | Wi-Fi, the time, the health check, sending a scan, the stored-scan queue, batch upload, and three HTTP helpers that every other service uses | none |
| `services/ScanResponse.h` | 77 | sorts a reply into four outcomes | 15 |
| `services/PayloadBuilder.h` | 89 | the scan and batch bodies | 17 |
| `services/BatchId.h` | 42 | the batch id | 7 |
| `services/AssetService.h`, `AssetManifestDiff.h` | 472 | downloads pictures and sound, each to a `.part` file, checks the sha1, renames | 19, on the diff only |
| `services/TokenService.h` | 381 | fetches `GET /api/tokens` to the card, line 213 | none |
| `services/ConfigService.h` | 562 | reads and writes `config.txt` | none |
| `services/SerialService.h` | 278 | the serial command list | none |
| `ui/`, 7 files | 2,003 | five screens and the screen state | none |

The tests run on the host with a 149-line stand-in for the Arduino
library, `mock/Arduino.h`. 118 cases cover seven headers, 686 lines. The
other seven check the stand-in and `config.h`. No workflow compiles the
firmware. Its own workflow and the parent's run only
`pio test -e native`. The layout `PartitionScheme=no_ota` is in no build
file. `platformio.ini` defines only the host test target, and the
compile command is typed by hand from the repository's guide, line 99.
`baseline_flash.txt` records 1,209,987 bytes of 1,310,720, measured for
version 4.1.

The decided changes, and the files each touches:

| Decided change | Files, and what they do today |
|---|---|
| A credential on every request, `docs/adr/0004` | `OrchestratorService.h`. All HTTP passes through its three helpers at 711, 940 and 974. They set one header, `Content-Type`, line 985, and accept any certificate, lines 714, 945, 979. The settings live in `models/Config.h` and `ConfigService.h` |
| A version number | No constant exists. The text "v5.0" is typed into four strings, `Application.h:873`, `:1557`, `ui/screens/ReadyScreen.h:124`, `services/SerialService.h:57`. The health check sends the device id only, `OrchestratorService.h:344` |
| The time from the backend | The scanner asks two internet time servers, `OrchestratorService.h:120`. It already reads the timezone from the health reply, lines 370 to 388. The backend's health reply already carries `timestamp`, `backend/src/routes/healthRoutes.js:36-38`. The stamp is built at `Application.h:619-680`, with a 1970 placeholder |
| Firmware over the air, `docs/adr/0006` | No update code. `grep -rnE "Update\.\|ArduinoOTA\|esp_ota"` finds nothing. Download, check and rename exist for pictures and sound, `OrchestratorService.h:692` and `AssetService.h:90`. The layout is chosen on the compile command |
| A tag whose first record is a web link, `docs/adr/0005` | `hal/NDEFParser.h:105-122` and its 15 cases. `hal/RFIDReader.h:620-680`, one read of 32 bytes |
| The new scan replies | `services/ScanResponse.h:51-75` and its 15 cases. `OrchestratorService.h:193`. `Application.h:484-600`, `:689-760`. The screens `ScanFailedScreen.h`, `TokenDisplayScreen.h`, `ProcessingScreen.h` |
| Also decided: a setting for a game with no backend, `0008`. A stored scan handed over late goes into the session it was made in, `0003`. The backend sends a device only what its kind may show, `0004` | The settings are `models/Config.h` and `ConfigService.h`. The stored-scan queue is `OrchestratorService.h:256` and `:473`, and a stored scan carries no session id, `PayloadBuilder.h:25-36`. The token list and the media come from `TokenService.h:213` and `AssetService.h:103` |

## H. The config tool

Engine files it reads and writes:

| File | Read | Written | Evidence |
|---|---|---|---|
| `backend/.env` | yes | yes, by `PUT /api/config/env` and by loading a preset | `lib/configManager.js:26`, `:54`, `:121-135`, `lib/routes.js:44` |
| `backend/config/environment/routing.json` | yes | yes, by `PUT /api/config/routing` and a preset | `configManager.js:38`, `:308-311`, `routes.js:69` |
| The pack: `game.json`, `cues.json`, `tokens.json`, `pack-manifest.json` | yes | through a draft and a publish. The two direct write routes answer 409 | `configManager.js:30-39`, `routes.js:61-67` |
| A draft, a full copy of the pack under `config-tool/data/drafts` | yes | yes: scoring, cues, `strings.json`, `theme.json` | `server.js:42-46`, `routes.js:137-182` |
| The live pack, at publish | yes | copies each file beside its target, renames, manifest last, deletes files the new manifest drops | `lib/publish.js:169-192` |
| The live pack's `game.json`, at preset load | yes | yes, the scoring block, after a check on a staged copy | `configManager.js:434`, `:455` |
| `backend/public/audio`, `backend/public/videos` | lists them | uploads and deletes | `configManager.js:40-41`, `routes.js:263-287` |
| `backend/ssl/key.pem`, `cert.pem` | yes | no | `server.js:105-116` |

Engine code it runs:

| Call | Where | What it uses |
|---|---|---|
| `require('../../backend/src/gameRules/cueValidation')` | `configManager.js:21`, `routes.js:11` | `validateCuesBlock` before a cue write. The cue vocabulary it serves at `GET /api/vocabulary`, `routes.js:206-212` |
| `require('../../backend/src/gameRules/grants')` | `lib/toolAuth.js:27` | `computeGrants` for its own login token, line 131 |
| `require('../../backend/scripts/build-pack-manifest')` | `configManager.js:228`, `lib/draftStore.js:26`, `lib/publish.js:32` | `build` and `contentHash` |
| Child process `backend/scripts/validate-pack.js` | `publish.js:79-93`, `configManager.js:198`, path at `server.js:47` | The script requires `backend/src/services/packService` and runs the start-up check on a folder. Its header gives the reason for a child process: the pack service's module state and logger stay out of the tool |

It copies four values from the backend by hand: the default password and
signing secret, the token lifetime and the cue schema version
(`toolAuth.js:31-34`, `configManager.js:254`). It signs its own tokens
with the secret it reads from `backend/.env` (`toolAuth.js:117-140`).

It sends four requests to the backend: a login at `POST /api/admin/auth`
and three music calls, `GET /api/music/tracks`,
`GET /api/music/playlists` and `PUT /api/music/playlists`
(`toolAuth.js:86`, `routes.js:399`, `:411`, `:428`). It also calls Home
Assistant itself with the token from `backend/.env` and runs `ffprobe`
(`routes.js:291-308`, `configManager.js:346`).

When a written file takes effect. The backend reads `backend/.env` once,
when its config module loads (`backend/src/config/index.js:10`). It
fixes its pack at start, in the one call of `activatePack`
(`backend/src/app.js:192`). It reads `routing.json` at start and after a
system reset, and takes only the `ducking` list (`app.js:265-271`,
`services/systemReset.js:199-204`). It watches the playlists file and
reloads it on a change (`services/musicService.js:150`), and the tool
changes playlists through the backend's own route. The tool sends the
backend no notice of a publish or of any other write. Its only calls to
the backend are the four above. So a published pack and a changed
`backend/.env` wait for the next backend start, and changed ducking
rules wait for a start or a reset. Inferred from these lines. I did not
run it.

Four of its test files require backend files or use the toy pack
(`tests/draftRoutes.test.js:20-26`, `draftStore.test.js:17`,
`publishDraft.test.js:16-21`, `routes.test.js:319`, `:333`). The parent's
CI installs the backend's packages before it runs them.

## What I did not check

- I ran no test, build or server. Every case count is static.
- I did not run a Vite build or its dev server with a file from outside the GM scanner's repository, and I loaded no rule file in a browser. D, items 7 and 8, report the config and Vite's own source.
- I did not read blue's branch, and I did not ask the remote for branches this clone has not fetched.
- I read these files in full. Backend: the rule files `scoring`, `duplicatePolicy`, `modeSemantics`, `grants` and `resolution`, then `sessionService` and its two helper files, `persistenceService`, the session model, `transactionService`, `syncHelpers`, `adminEvents`, `systemReset`, `app.js`, `server.js`, `processMonitor`, `serviceHealthRegistry` and `FileStorage`. GM scanner: `LocalStorage.js` and `main.js`. Config tool: `configManager`, `routes`, `publish`, `toolAuth` and `server`. Firmware: `NDEFParser`, `ScanResponse`, `PayloadBuilder`, `BatchId` and `config.h`. I read the rest by header, export lines and grep.
- The cycle count and the count of typed lists come from two short scripts of mine that match text. They treat a `require` on an indented line as one inside a function. The scripts are not in the repository. C lists the edges and the call sites so each can be checked by eye.
- The 30 files of a standalone game come from the map of 2026-11-01. I checked that list and its line total, not each file's role.
- I did not compile the firmware. No file records its size today.
- I looked at the scoreboard page and the web player scanner only for size and for how they load code.
- I did not work out what a designer's formula would have to read or do. The table for change 6 gives only where today's formulas, tables and flags are.
- I did not look for recorded sessions outside this repository.
- The fourth working note, on how the engine is extended, and decision notes `0009` to `0011` were committed while I worked. I read them before this version.

## What changed from the first version

The first version is commit `d1b441a7`.

New in this version:

- The table for change 6, under the change's new title.
- Summary lines 4 to 8. Lines 5 and 6 are new. The old lines 5 and 6 are now line 7, and the old lines 7 and 8 are now line 8. Lines 10 and 15 each gained a sentence.
- The split of the rules folder and of its test cases, in B and E.
- What the backend restores at start, in the table for change 4.
- "What pins ALN's scores today", in E.
- "When a written file takes effect", in H.
- The count of test files that name a singleton, in C.
- Where the eight schema files sit, in the table for change 3.

Moved or removed. The row on GM logins moved from change 5 to change 4.
Two facts nobody asked for are gone: the Notion sync scripts' sizes in
A, and which modules the tests mock most in C.

Corrected:

- Change 1. `buildSyncFullPayload` has 6 callers in the source and one in a test helper. The first version said 7 callers.
- Change 3. 26 of the 34 contract test files use the `ajv` helper. The first version said all 34 check with `ajv`.
- Summary line 15. The config tool requires two backend rule files and one backend script. The first version said three source files.
- G. A stored scan handed over late goes into the session it was made in. The first version said late scans go into their own session.
- C and E. "Require a service singleton" became "require a file under `src/services/`", which is what the grep counts.
- E and summary line 11. 33 of the 34 contract test files name a message or path or read `asyncapi.yaml`, 257 cases. The first version said all 34, 259 cases.
- Changes 5 and 7. The backend source holds 13 names under `/tmp`, one of them a pattern. The first version said 13 fixed paths.
