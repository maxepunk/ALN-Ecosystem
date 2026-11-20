# Apply log, version 11: the requirements, the promise data, the standalone lines and the cards (2026-11-10)

Written 2026-11-10 by the agent applying the merged report of the independent review (`../checks/v10-review.md`) to the requirements and the data, for the agent running the pass. A working file, so it calls the owner "the owner". Rulings R1 to R10 of the task win where they differ from the merged report.

## Scope

Files this task owns, and what happened to each:

| File | Result |
|---|---|
| `requirements/2026-11-01-quality-targets.json` | 49 fields changed; 10 "today" fields and one number's sort (QT42) added to existing targets; 4 targets added (QT45 to QT48, three of them with a "today" field). 47 targets. |
| `requirements/2026-11-01-extension-cases.json` | 27 fields changed, 7 "today" fields added. 28 cases. |
| `report/2026-10-31-engine-jobs.json` | 15 strings changed. |
| `2026-10-31-engine-jobs.md` | One dated note added; 13 sentences mirrored from the JSON. |
| `report/2026-10-31-standalone-lines.json` | 7 lines changed (C1, C3, C4, C5, C8, C10, C13). The 35 findings are untouched. |
| `report/2026-10-31-cause-cards.json` | No change. It names no question, reading or call, and never says "no engine". |

Every JSON file parses and round-trips with `json.dumps(indent=2, ensure_ascii=False)` plus a newline. No file holds an em dash, a visible id outside a marker, a bare sequencing number or a retired word in any text I wrote (checked with the builder's own patterns).

Nothing outside these six files was edited. No git command was run. `backend/.env` was not opened, and the stale copies beside the repository were not read.

## Counts after this task (R4)

- Quality targets: 47 under twelve qualities. 23 settled, 18 partly settled, 6 proposed. Before: 28, 13, 2.
- Moved from settled to partly settled: QT11, QT14, QT40, QT42, QT43. New and proposed: QT45, QT46, QT47, QT48.
- Targets that carry a number: 17. Before: 15. New numbers: QT42 (how long going back may take) and QT46 (how long before the engine stops a failing extension). QT30's sort changed from a production's setting to mixed.
- Extension cases: 28. 22 settled, 6 partly settled. Before: 23 and 5. EX17 moved.
- "Today" fields: 13 targets (QT2, QT5, QT13, QT16, QT17, QT22, QT35, QT37, QT40, QT41, QT45, QT47, QT48) and 7 cases (EX9, EX11, EX12, EX13, EX22, EX23, EX25). 20 in all.
- So the reading path in `decisions.json` `review[1].what` (merged report e4) reads: "Twenty-three of the forty-seven targets rest on rulings you have already made. Twenty-four are proposed or partly settled, and seventeen carry a number."

## Facts checked in the code before writing them

| Fact | Where checked | Result |
|---|---|---|
| The glossary's engine is all the game-independent software | `CONTEXT.md:25-29` | True. It names the show machine's program, the GM scanner, the player scanners, the scoreboard and the config tool. |
| Removing an ability is a major engine version | `CONTEXT.md:217-221` | True: "Ids are append-only: adding one is a minor engine version; removing one is a major engine version". |
| Both player scanners keep 100 scans and drop the oldest without a word | `arduino-cyd-player-scanner/ALNScanner_v5/config.h:64`, `services/OrchestratorService.h:1243-1246`; `aln-memory-scanner/js/orchestratorIntegration.js:15`, `:171-173` | True for both. The hardware scanner writes a log line only. |
| Both player scanners check on the engine every ten seconds | `config.h:42`; `orchestratorIntegration.js:468-470` | True. |
| A scoreboard screen's clock keeps counting by itself when the engine goes silent | `backend/public/scoreboard.html:949-953`, `:996`, `:1608-1611` | True. The page counts each second from its last sync; a disconnect only changes the status label. |
| The shared program watcher | `backend/src/utils/processMonitor.js:17-19`, `:136-150`; `new ProcessMonitor` in `vlcMprisService.js:113`, `musicService.js:603`, `audioRoutingService.js:794`, `bluetoothService.js:497`, `mprisPlayerBase.js:205`; `displayDriver.js:165` | True as the merged report words it. It starts the music player, the video player and three monitors. A silent death is retried after 10, 20, 40 and 80 seconds and gives up at the fifth. One that printed anything restarts every 5 seconds without limit. The video player uses the same watcher at a fixed 3 seconds. The TV's browser is started with a plain spawn and has no watcher. |
| The owner's lighting example can be written today in a networked game | `backend/src/gameRules/cueValidation.js:42-61`, `:91-116`; `backend/src/services/cue/standingEvaluator.js:32`; `ALN-TokenData/cues.json` | True. `player:scan` is a trigger, `in` takes a list, `lighting:scene:activate` takes a role. A player's scan carries only the token, the device and the device's kind. |
| Only a player's scan starts a video today | `backend/src/services/transactionService.js:236`, `:302` | True. |
| The pack is picked when the engine starts | `backend/src/services/packService.js:166-178` | By path only (`PACK_PATH`, or the default folder). Nothing picks a pack by id today. EX23 said "by path or id"; corrected. |
| Only a minimal check exists before a game starts | `backend/src/services/preflightService.js:16-21` | True: "T1a builds the MINIMAL arm"; it reads frozen data and the health list and touches nothing in the room. |
| The clean-machine test includes an install line | `report/2026-10-31-engine-jobs.json`, the venue promise's fourth test | True. |
| The roadmap's swap method is for one move, ratified 2026-08-29 | `docs/plans/ROADMAP.md:460-475` | True: "The cutover is a hardware swap, not an in-place upgrade (owner, 2026-08-29)". |
| A fault is studied today with a script | `backend/package.json:59`, `backend/scripts/validate-session.js:14-17` | True. The script reads the saved game and the logs. |
| The kit has no backup today | `DEPLOYMENT_GUIDE.md:2821-2825` | **Not exact.** The guide asks for a copy of the engine's data to another medium after every event, by a typed `rsync` command. Nothing runs it, checks it or restores it. QT48's "today" says that. See "For other files", item 9. |
| Taking back a published pack today | `DEPLOYMENT_GUIDE.md:2827-2845` | A written runbook for a developer: fetch the earlier pack with a typed command, restart the engine. QT45's "today" says that. |

### The three checks the merged report asks for before publishing

**1. What a cut-off tablet can do with the game's clock.** Checked, for the writer of `decisions.json` (question B, first option).

- A networked tablet's clock display counts each second by itself between the show machine's messages (`ALNScanner/src/ui/renderers/SessionRenderer.js:149-156`). While cut off it keeps counting. It is a display only: the tablet moves no phase and fires no cue (the phase label at `SessionRenderer.js:114-147` only shows what the show machine sent).
- A standalone tablet has no game clock. Its admin panel shows "Started:" with the time of day and "Duration:" with the time since the start (`ALNScanner/src/ui/renderers/GameAdminRenderer.js:48-49`, `:60-61`, `:84-85`). The duration is worked out when the panel is drawn (when standalone mode starts, `src/app/app.js:481-484`, and when a game is created, paused, resumed or ended, `src/app/domains/gameAdmin.js:40`, `:125`, `:158`, `:191`). It does not tick and does not stop for a pause.
- So the merged report's sentence "Today a tablet cannot keep the game's clock or its phases going" holds for phases and cues, and is too strong for the clock's display. Proposed wording is under "For other files", item 5.

**2. Each row of the standalone table (a5).**

| Row | Checked against | Result |
|---|---|---|
| The GM tablet decides teams, scores, group bonuses and the game's start, pause and end | `ALNScanner/src/core/storage/LocalStorage.js:187-245`, `:301-306` | True. End, pause and resume exist; a scan into a paused game is refused. |
| Nothing drives the room; each need reads grey | `ALN-TokenData/pack-manifest.json`, `stack` and `endpoints` | ALN's pack marks all seven needs `degrade` ("skip it"): four services and three endpoints. |
| A video token on the phone: "a blank screen" | `aln-memory-scanner/js/tokenDisplay.js:34-68`; `ALN-TokenData/tokens.json` (`kai001`, `rem001`: no image, no audio) | True, with one detail: the screen shows "New Memory! Token:" and the token's id, and nothing else. The phone never reads the picture meant for a video. |
| A video token on the hardware scanner: "says to rescan later" | `arduino-cyd-player-scanner/ALNScanner_v5/Application.h:590` | True. It shows the token's picture with "VIDEO UNAVAILABLE" and "Rescan later". |
| The clock: "today it shows only the time the game started" | `GameAdminRenderer.js:49`, `:60-61`, `:84-85` | **Not exact.** It also shows how long ago the game started. It keeps no game clock and no phases. Corrected wording under "For other files", item 4. |
| A game with player scanners only has no clock | both player scanners | True. Neither shows a game clock. |
| Exposed evidence: "today the GM sees the summary once" | `ALNScanner/src/ui/uiManager.js:497-502`; `src/app/domains/gameOps.js:434`; the standalone review's finding SG-07 | True. The summary shows on the result screen; the scoreboard screen opens only for a mode with rankings. |

QT37's "today" field uses the corrected facts.

**3. Every place in these six files that names a removed question, reading or call.** All found and changed; the list is the table rows marked "removed" below. After the change a search of the six files for "What a standalone game gives up", "Which hardware the first new engine", "exposed-evidence-and-video" and "Exposed evidence and video" finds nothing.

## Applied, by item of the merged report

"Verbatim" means the check's text was used as written, with "your" changed to "the owner's" in the texts the panel also reads (situations, cases) and kept as "you" in status lines.

| Item | File and field | Verified against | Verdict | The change |
|---|---|---|---|---|
| (c)4, H2-S | QT42 `title`, `situation`, `numberToSet`, `numberKind` | `ROADMAP.md:460-475`, `:585-586`; `v10-review-design-verify.md` H2-S | Applied, verbatim | Title "A release can be undone before the next game". Situation as H2-S. Number: "how long going back may take: an engine requirement, stated for each supported machine", sort `engine`. |
| (c)4, H2-T | QT42 `status`, `statusKind` | H2-T | Applied, verbatim | Kind "partly settled". The status does not begin with "settled by the owner", so the builder shows it as written. |
| (c)4, follow-on | QT42 `why` | The new title | Applied (mine) | "A release the owner cannot undo before the next game is a release the owner will not make." The old line said "in a minute", a number with no source. |
| (c)4, H2-E | EX17 `title`, `case`, `throughWhat`, `mustNotNeed` | H2-E | Applied, verbatim | Title "A new engine version reaches the kit and can be taken back". `mustNotNeed` starts "A release the owner cannot undo". |
| (c)4, follow-on | EX17 `when`, `status`, `statusKind`, `why` | "No requirement names a way to do later releases" (merged report, (c)4); H2-T marks the same sentence proposed | Applied (mine) | `when` names the first swap and leaves later releases to the design rounds. Status "partly settled": the first swap and the between-events rule are the owner's word; "that every later release can be taken back the same night" is proposed. `why` ends "take it back the same night", not "by moving a plug". For the lead to accept or revert. |
| (c)5 | QT11 `situation`, `status`, `statusKind` | Merged report (c)5; `status_grounds` in the builder | Applied | Situation starts "A show runs, and the designer rehearses a draft pack on a trial copy of the engine, wherever the owner's answer lets it run." Status is written as "settled by the owner that a trial copy never touches the show (...); open for you: whether it may run on the show machine while a show runs (your question “Where the trial copy runs while a show runs”)", which the page shows as "Your word that a trial copy never touches the show (...)". Kind "partly settled". |
| (c)5 | QT43 `status`, `statusKind`, `numberToSet` | Merged report (c)5 | Applied | Kind "partly settled". Number: "an engine requirement; whether it is one or two during a show waits on the owner's question “Where the trial copy runs while a show runs”, and beyond two the engine states its limit for each supported machine". |
| (c)6 | QT31 `situation`, `status` | Merged report (c)6 | Applied, verbatim | The sentence "A pass survives a reconnect and an engine restart, and the owner can take back the pass of a tablet that was lost." added. Status marks it proposed and leaves a change of machine to the design rounds. Kind stays "partly settled". |
| (c)6 | QT14 `situation`, `status`, `statusKind` | Merged report (c)6 | Applied | "A GM logs in once, before the show, and not again that night." Marked proposed. Kind "partly settled". |
| (c)7 | QT21 `status` | `CONTEXT.md:217-221` | Applied, verbatim | "ability names are only added within a major version of the engine; removing one is a major version; the pack lists what it needs". |
| (c)9 | QT37 `situation`, `why` | `CONTEXT.md:25-29` | Applied | "starts with no show machine", "the missing show machine", "every service the show machine runs", "A game with no show machine is a choice a game may declare". |
| (c)9 | EX12 `why`, `case` | The same | Applied | "A whole game with no show machine"; "No game mixes devices on a show machine with devices working alone". |
| (c)9 | Promise data: J8 `functional.people`, `functional.moment`, `tests[2]`, `standalone`, `flaws` (the three lines for the seventeenth flaw, the game boundary and the deciding devices), `meaning`; J6, J7, J10 `standalone`; J1 `flaws` (the seventeenth flaw's line) | The design check's list (`requirements.md:39, 593, 667, 699, 763, 767, 793, 961`) plus the same phrase at `:129, 759, 773` | Applied | "no engine", "a missing engine", "an engine-less device" and "the engine is absent" each say "no show machine" or "the missing show machine". Three of these (lines 129, 759, 773) were not on the check's list; they are the same sentences in the same promises. |
| (c)9, follow-on | QT38 `title`, `situation` | The same | Applied (mine) | Title "No game mixes networked and standalone devices", the decision's own words; the situation says "through a show machine" and "on a show machine". No other source names the old title in plain text. For the lead to accept or revert. |
| (c)9, follow-on | Standalone lines C5, C8, C10, C13 | The same; these show only on Today's engine, which the panel does not get | Applied (mine) | "no show machine runs", "the missing show machine", "no show machine, pass or connection exists". Done so the page agrees with the new entry "The engine" in the words list. For the lead to accept or revert. |
| (c)10 | QT5 `situation`, `status` | `backend/public/scoreboard.html` | Applied | Situation: "the TV shows its clock as unconfirmed; whether it stops counting or keeps counting with that mark is for the owner's review of this target." Status adds: "this target proposes that the TV's clock stops counting when the engine goes silent: say if you would rather it keep counting with its unconfirmed mark". |
| (b), the silent engine | QT5 `numberToSet` | Merged report (b), "Sort the ten seconds ... by kind of connection" | Applied | "a technical default, set for each kind of connection, since a device that checks in now and then (a player scanner) can only notice at its next check and a device on a live connection (a GM tablet) can notice sooner; the engine states the longest delay it allows". |
| (c)11 | QT40 `numberToSet`, `status`, `statusKind` | The two scanners' code | Applied; the status clause is mine | Number as the merged report words it, with today's limit moved to "today" (R6). Status adds "that a device at its limit says so on its screen is proposed, from the promise's need that nothing is silently lost". Kind "partly settled", because the sentence is new. |
| (c)12 | QT24 `title`, `situation`; EX16 `case`; promise data `purpose[5]`, J8 `meaning` | `report/site/v9/rules.json`, the rule with its bound | Applied | Title "A second kit or production needs no rework". Each place now reads "nothing in the engine assumes one kit, one pack or one production where avoiding it costs little; features for several kits come later, and the places for them are built now". `purpose[5]` is the source of the front page's paragraph (`index.md:97`). |
| d8 | QT44 `situation` | Merged report d8 | Applied; one clause is mine | The first sentence gains "the kit's whole network goes down" and "a tablet or scanner dies holding scans it has not sent". Added, because a dead device's scans cannot be "in the game once": "if a device died for good holding scans it had not sent, the record says which device and from when". |
| (b), readings lead | QT44 `status` | The readings lead says this reading goes to the panel "marked as the agent's reading" | Applied (mine) | "That “a device that goes down” includes the show machine itself is the agent's reading, listed for you to confirm." |
| d11 | EX12 `throughWhat`, `mustNotNeed` | Merged report d11 | Applied, verbatim | No "same rules module", no "second hand-kept copy". |
| d11, H6-27 | QT27 `situation` | H6-27 | Applied, verbatim | |
| d12 | QT45 "A published pack can be taken back", under "The designer's iteration speed" | The design review's D-M9, item 1 | Applied, verbatim | Proposed. No number. |
| d12, M9-2 | QT46 "An extension that fails leaves the game running", under "Easy to extend" | M9-2 | Applied, verbatim | Proposed. "Within a set time" needs a number, so: "how long before the engine stops a mechanic that fires without end, or marks a hung program down: an engine requirement". |
| d12, M9-3 | QT47 "A fault can be studied without having been there", under "Easy to understand and change, for people and for AI agents" | M9-3 | Applied, verbatim | Proposed. No number. |
| d12 | QT48 "The kit's data survives the loss of a machine", under "Safe release and rollback" | The design review's D-M1 | Applied, verbatim | Proposed. No number. |
| d12 | Promises, status and why of QT45 to QT48 | The ten promises' titles | Mine | Each serves two or three promises by title. Each status starts "proposed (the independent review you asked for, 2026-11-10: ...)" and names what it rests on. Each has a one-sentence "why". |
| R5 | QT30 `numberToSet`, `numberKind` | Ruling R5 | Applied | "how long each kind of data is kept, per game: a production's setting, and the engine keeps nothing past it; the default the engine ships with, used until a production sets its own: a technical default, for which the agent running the pass proposes 90 days for every kind of data". Sort `mixed`. |
| R6, d10 | "today" fields | The design check's count for D-L5 (why 7, numberToSet 4, case 4, status 1, when 1, throughWhat 1) | Applied | Moved out of `why`: QT16, QT17, QT22, QT37, QT41, EX9, EX12. Out of `numberToSet`: QT2, QT5, QT35, QT40. Out of `case`: EX11, EX12, EX22 (two sentences). Out of `status`: QT13. Out of `when`: EX13. Out of `throughWhat`: EX23. Each field it left reads whole without it. Each "today" is one or two sentences. |
| R6 | The two files' `intro` | Ruling R6 | Applied | One sentence each: the note on today's engine sits in a field of its own, and the panel's folder leaves it out. Neither intro holds a count that changed. |
| a2 | EX25 `when` | The cue code | Applied in R6's form | "now in a networked game, as one standing cue for each look that lists its tokens; the line beside the token comes later, with the players' phones block". The merged report's "works today" is in the "today" field, with what a cue's condition cannot use. |
| a5 | QT37 `status` | The row checks above | Applied | "proposed by the agent, for you to flag: a video token on a player's device shows its picture and a plain note, never an error; a GM tablet counts the game's clock and its phases; what a mode shows in public gets a public view on the GM's tablet". The "today" half of each row is in QT37's "today" (R6). |
| a5, removed call | Standalone line C3 | Task | Applied | The sentence that named the call “Exposed evidence and video with no engine” now reads: "What a video token shows on a player's device with no show machine is one of three rows the agent proposes under [[page:decisions#g-standalone-games|Standalone games]]: its picture with a plain note, never an error; the owner can flag it." |
| a5, removed question | QT39 `status` | Merged report a5, a6 | Applied | The record ask now names “Which standalone games the engine must run”. The effects follow the ratified rule, and the three proposed rows are named in “[[qt:QT37]]”. |
| a5, removed question and call | EX12 `case`, `status` | The same | Applied | The case states the rule for missing equipment and points to the three proposed rows. The status says the rule's use here is the agent's call “A standalone game follows the rule you ratified for missing equipment”. |
| a6 | QT37 `situation`, `status`; EX12 `case`, `status`; J2 `standalone`; standalone lines C1, C4 | Merged report a6: the question no longer asks which devices | Applied | "Which shapes ... is the owner's open question" is gone. The question is named by its title and asks about more than one GM tablet and one shared game. That player scanners alone may play one is named as a reading to confirm. In the standalone lines the title is a link: `“[[page:decisions#q-h|Which standalone games the engine must run]]”` (R1). |
| a7, removed question | EX28 `who`, `case`, `status` | Merged report a7 and the new call | Applied | `who`: "developer adds the support; the build plan says when". Status: "open: where the current roadmap draws the line, which the build plan proposes for each stage of the roadmap and brings to you (the agent's call “The design allows other hardware; what the first release requires comes with the build plan”)". |
| a3, moved ask | QT3 `situation`, `status` | Merged report a3 and the call "Who wins when two tablets claimed one token while apart" | Applied (mine) | "Who wins a conflict" left question A, so QT3 no longer lists it under that question. The situation states the rule (first claim holds, the later one is a red row the GM can overrule; which counts as first is for the design rounds). The status names the call. |
| (b) | EX12 `who`, `case` | The asks-2 check, A2-H4 | Applied | `who`: "whoever declares it (the owner's reading to confirm); the GMs run it, and that player scanners alone may play one is a reading for the owner to confirm too". Case: "The game is declared standalone." |
| (b) | QT38 `status` | Merged report (b), the fifth reading | Applied | "which would amend this decision" and the re-declaration are gone. Added: "The agent reads your decision so that such a game stays the networked game it was declared as; that reading is listed for you to confirm." |
| Open questions by title | QT21 `situation`; J10 `goal`; EX14 `case` | The questions' titles in `decisions.json` | Applied (mine, small) | "the owner's open question" now names “How an extension for all games reaches a production”; EX14 names “Where the trial copy runs while a show runs”. |
| Fact | EX23 `throughWhat`, `when` | `packService.js:166-178` | Applied (mine) | "by path or id" was not true of today's engine. `throughWhat`: "An installed pack picked by name or id; a selection page later." `when`: "now, by picking the pack when the engine starts". "today": "Today the pack is picked when the engine starts, by the path to its folder." |
| Twin | `2026-10-31-engine-jobs.md` | The record's own notes of 2026-11-01 and 2026-11-02 | Applied | A note dated 2026-11-10 says what "no engine" means in the record's older parts. Thirteen sentences that state the same thing as the changed JSON strings are changed the same way (the purpose paragraph; J1's line for the seventeenth flaw; the standalone lines of J2, J6 and J7; J8's meaning, three flaw lines, standalone line and third test; J10's goal). The rest of the record stays as written, as its vocabulary note says. |

## Listed, not applied, with the reason

1. **Orders of size for the engine times with no value (merged report (b), "The quality targets' numbers are sorted, not asked").** Not in this task's list, and the values are the agent's to choose in one place. If `review[1].numbers` gains an order of size for a time, the same words must go into that target's `numberToSet`. The targets are QT9 (publish to playing), QT33 (a scan's answer, a live message's delivery), QT44 (the fallbacks shown), QT19 (the newcomer's first change) and QT5 (the longest silence). Two more engine times now have no value: QT42 (going back) and QT46 (a failing extension). So the merged report's "six requirements have no value" is eight.
2. **The promise "A change is proven before it reaches anyone, and the owner alone sends it to the show" still names replugging.** Its `functional.need` ends "the owner can swap back by replugging a machine", and its `goal` ends "and can replug the old one". The merged report changes QT42 and EX17 only, and a promise's wording is reviewed by the owner. Left. If the lead wants the promise to match: "and the owner can take a version back" in both places.
3. **The promise "Anyone reading a screen can act on it without a second question" says "the TV's clock never counts on its own".** That is the same proposal QT5 now puts to the owner. It agrees with the proposal, so it stays. If the owner prefers the clock to keep counting with a mark, this clause changes with QT5.
4. **QT39's situation says the hardware scanner's "missing standalone mode is a parity gap to close".** A mention of today's engine without the word "today". Not on the design check's list for R6, and the same words are in the promise data and in the builder. Left.
5. **EX25's `case` and `throughWhat` still route the example through "The pack says what a scan causes".** That is the shorter way that comes later. `when` and "today" now say the example works already. Left as the long-term form.
6. **The promise data's `needs` and `tests` hold many "Today ..." sentences.** R6 names the requirements only. Left.
7. **`jobChanges` and `shapeChange` in the promise data** hold old letters ("question F", "question 23") and "with no engine". No page shows them and they are history. Left.
8. **The 35 findings in the standalone lines** say "no engine" and name the scanner by its chip. They are evidence, quoted as found. Left.
9. **`requirements/titles-log.md`** lists the old titles of QT24, QT38, QT42 and EX17. It is a dated log outside this task's files. Left.

## For other files

Each item names the file, the field and the exact change. Items 1 to 3 are counts and lines that must agree with the requirements as they now stand.

**1. `report/site/v9/decisions.json`, `review[1].what`.** "Forty-seven targets under twelve qualities". The four new targets by title: “A published pack can be taken back”, “An extension that fails leaves the game running”, “A fault can be studied without having been there”, “The kit's data survives the loss of a machine”. The reading path: "Twenty-three of the forty-seven targets rest on rulings you have already made. Twenty-four are proposed or partly settled, and seventeen carry a number. Read those first; the rest are there if you want them."

**2. `decisions.json`, `review[1].numbers`.** Seventeen lines, one for each target with a number. The lines that change or are new, worded to match each target's `numberToSet`:

- `[[qt:QT2]]`: "how many restarts the program watcher tries, and over how long. A technical default (today the shared program watcher, which starts the music player, the video player and three monitors (sound routing, Bluetooth and playback), restarts a program that died without printing anything four times, waiting ten seconds and doubling the wait, and shows red at the fifth failure, while one that printed anything is restarted every five seconds without limit; the video player uses the same watcher, set to a fixed three seconds, and the TV's browser has no watcher). Ten seconds for the controls to come back: an engine requirement."
- `[[qt:QT5]]`: "how long after the engine goes silent a screen must say so. A technical default, set for each kind of connection: today's ten seconds comes from how often the player scanners check, and it is slow for a GM tablet on a live connection. The engine states the longest delay it allows. Today a scoreboard screen's clock keeps counting by itself when the engine goes silent. This target proposes that it stops and shows as unconfirmed. Say if you would rather it keep counting."
- `[[qt:QT30]]`: "how long each kind of data is kept, per game. A production's setting. The default the engine ships with is a technical default: the agent proposes 90 days for every kind of data, until a production sets its own."
- `[[qt:QT40]]`: "how many scans each kind of device must keep while offline. An engine limit the engine states for each kind of device (today both player scanners keep 100 and drop the oldest without a word). A device that reaches its limit says so on its screen and never drops a scan silently. If a game may carry on without the show machine, each design says how many scans a device keeps and what that covers."
- `[[qt:QT42]]`, new: "how long going back to the version before may take. An engine requirement, stated for each supported machine."
- `[[qt:QT43]]`: "how many copies of the engine one machine must carry at once. An engine requirement; whether it is one or two during a show waits on your answer to “Where the trial copy runs while a show runs”."
- `[[qt:QT46]]`, new: "how long before the engine stops a mechanic that fires without end, or marks a hung program down. An engine requirement."

**3. `decisions.json`, the intro lines on answered conflicts and question F.**

- `groups[0].intro[2]` cites `[[qt:QT42]]` for "the engine changes only between events". The marker now shows the title "A release can be undone before the next game". The sentence still holds.
- Question F's `recommendation` (merged report a9) ends "This changes the wording of “[[qt:QT11]]”, which today has a trial copy start on the show machine while a show runs." QT11 no longer says that. Replace with: "The target “[[qt:QT11]]” waits on this answer: its trial copy runs wherever your answer lets it."
- Any sentence that leans on the old QT42 ("the way [[qt:QT42]] already asks devices to carry on when the old machine is replugged", in question B's old second option) must go with that option.

**4. `decisions.json`, `groups[1].intro`, the new paragraph "What a standalone game keeps and gives up" (a5).** Two corrections from the row checks:

- In place of "today the phone shows a blank screen and the hardware scanner says to rescan later": "today the phone shows a blank screen with the token's id, and the hardware scanner shows the token's picture and says to rescan later".
- In place of "today it shows only the time the game started": "today it shows when the game started and how long ago, with no game clock and no phases".

**5. `decisions.json`, question B, the first option's `means` (a1).** In place of "Today a tablet cannot keep the game's clock or its phases going, so the GMs keep time themselves unless the design gives a tablet the clock.": "Today a cut-off tablet's clock display keeps counting by itself, but nothing on a tablet moves the game's phases or fires the cues on the clock, so the GMs keep time themselves unless the design gives a tablet the clock."

**6. `decisions.json`, the anchors and titles these files now depend on.**

- The standalone lines link `[[page:decisions#q-h|Which standalone games the engine must run]]` twice and `[[page:decisions#g-standalone-games|Standalone games]]` once. The question must carry the letter H and the anchor `q-h` (R1), and the group must keep the title "Standalone games".
- Question titles named in plain text in the requirements, which the builder links when the title matches exactly: “A GM tablet cut off from the engine”, “The show machine fails mid-game”, “Release day: what must update together, and how long older devices work”, “What a game's maker may build inside the pack”, “How an extension for all games reaches a production”, “Where the trial copy runs while a show runs”, “Which standalone games the engine must run”.
- Call titles named in plain text: “Who wins when two tablets claimed one token while apart” (QT3 `status`), “A standalone game follows the rule you ratified for missing equipment” (EX12 `status`), “The design allows other hardware; what the first release requires comes with the build plan” (EX28 `status`). If a title changes, these three strings change with it.
- Readings the requirements name as "to confirm": that player scanners alone may play a standalone game (QT37, EX12); who declares that tonight's game is standalone (QT37, EX12); that a networked game that loses its show machine stays networked (QT38); that "a device that goes down" includes the show machine (QT44). The readings list must hold all four.

**7. `report/site/v9/front.json`.**

- (c)9, the three places the design check lists at `index.md:155, 167, 239`: line 85, the `when` of a moment, "also when the game runs with no engine" becomes "also when the game runs with no show machine"; line 91, "A GM running a game with no engine" becomes "A GM running a game with no show machine"; line 182, `standaloneLine`, "A whole game can run with no engine" becomes "A whole game can run with no show machine".
- The front page's length. Version 10 stood at 2,623 counted words against the builder's hard limit of 2,625. Two changes in this task's files add 23: EX17's new title, which a growth line links (+5), and `purpose[5]` with the rule's bound (+18). With version 10's overlays the build now fails on that one check, at 2,646, and on nothing else. `front.json` must give back at least 21 words before its own additions, or the lead changes `INDEX_LIMIT` in the builder.
- `intros.requirements`: one sentence for the new tag, for example: "Where a target or a case notes how today's engine behaves, the note sits under its own tag, “Today”; the panel's folder leaves it out."

**8. `report/build_site.py`.**

- R6: `qt_html` and `ex_html` show the optional `today` under its own tag, after "Why it matters" and "Why". 20 items carry it. A count check to match: the tag appears once for each target or case that has the field.
- `PARITY_WORDS['13'][3]` names the deleted call. Replace with: "Neither is right. The agent proposes the same for both, as one of three rows under “Standalone games” on Decisions: the token's picture with a plain note, never an error".
- `STANDALONE_P1`: "with no engine" becomes "with no show machine". The sentence "Which of those shapes the engine must run is your question “Which standalone games the engine must run” on [[page:decisions#q-g|Decisions]]." becomes: "Whether one such game may use more than one GM tablet, and whether its devices must play one shared game, is your question “[[page:decisions#q-h|Which standalone games the engine must run]]”; that player scanners alone may play one is a reading for you to confirm."
- `STANDALONE_P2`: "every device shows the missing engine as a failure" becomes "every device shows the missing show machine as a failure".
- Line 2471, the table head "Hardware scanner, no engine" becomes "Hardware scanner, no show machine". Line 2547, the fold's summary "with no engine" becomes "with no show machine".
- The seventeenth flaw's card (`N1_CALL`) names the call “The missing standalone declaration is a design flaw of its own”, which stays. Its lines come from the promise data and now say "the missing show machine". Nothing to change.
- `INDEX_LIMIT`: see item 7.
- No count of targets is written by hand in the builder; the lead-in counts from the data and will say forty-seven and seventeen.

**9. Any text that says "the kit has no backup today"** (merged report, part 3, item 8, and whatever carries it to the owner: the change log's entry for version 11, the front page, the message to the owner). The guide asks for a hand copy after every event (`DEPLOYMENT_GUIDE.md:2821-2825`). Say: "Today the kit's only backup is a copy the guide asks you to make by hand after every event. Nothing checks it or brings it back, and no requirement covered a dead memory card until this review."

**10. `report/site/v9/design.json`.**

- The four new targets drive no decision yet. Proposed homes: QT45 and QT46 under "How games and venues extend the engine"; QT47 under "The published protocol's form" (the file is one the protocol defines); QT48 under "How one engine runs as many separate copies", with the backup that d4 adds to it.
- (c)12: `ahead[3].settled` ("nothing in the engine assumes one kit, one pack or one production") takes the bound, as the merged report lists at `design.md:95`.
- Drivers that link QT42, QT24, QT38 and EX17 by marker pick up the new titles by themselves.

**11. `report/site/v9/changes.json`, the entry for version 11.** What changed in the requirements, for its items: four targets are new and proposed; five targets and one case moved from settled to partly settled (QT11, QT14, QT40, QT42, QT43, EX17); four titles changed (QT24, QT38, QT42, EX17); today's behaviour moved into a field of its own in 20 places; "no engine" reads "no show machine"; the engine's shipped default for keeping data is proposed at 90 days.

**12. `panel/2026-11-01-panel-brief.md` and the script that builds the panel's folder.**

- R6: the folder leaves out every `today` key of both requirements files, and the brief says so.
- The requirement texts hold five markers the folder must turn into titles: `[[qt:QT34]]` (EX10 `case`), `[[qt:QT37]]` (EX12 `case` and `throughWhat`, QT39 `status`), `[[qt:QT44]]` (QT47 `status`).
- Status lines name the agent's calls and the readings by title. They are part of each requirement's status, which the panel gets.

**13. `DECISIONS.md`.** No title of a target or case appears there in plain text, so nothing breaks. If the record's history for 2026-11-10 lists what changed in the requirements, item 11's list is the content.

**14. `report/2026-11-01-engine-shape.json`** (the earlier candidate's data, shown folded on Design; no writer was named for it). It says "no engine" at lines 54, 55, 129, 149, 151 and 485, one of them in a name ("Who decides when there is no engine"). The panel does not get it. For the lead to decide.

## Verification

- Each of the five JSON files: `json.loads`, then `json.dumps(indent=2, ensure_ascii=False)` plus a newline equals the file.
- A field-by-field comparison with the files as they stood before this run: only the fields in the tables above differ; nothing was removed.
- A build in a scratch copy (this task's six files with version 10's overlays, diagrams replaced by stand-ins because the drawing step needs the network): every check of the builder passes except the front page's length (item 7). All markers resolve, including `decisions#q-h` and `decisions#g-standalone-games`. With the length limit lifted for the test, the pages render, and the entries for QT3, QT5, QT11, QT14, QT30, QT31, QT37, QT38, QT39, QT40, QT42, QT43, QT44, QT46, EX12, EX17 and EX28 were read as rendered.
- The scratch build still shows version 10's questions. Under its letters `q-h` is the removed question, so the two links in the standalone lines land on the right question only once `decisions.json` follows R1.
