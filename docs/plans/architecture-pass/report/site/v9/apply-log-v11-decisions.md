# Apply log, version 11: `decisions.json`

Written 2026-11-10 for the agent running the pass. A working file, so it calls the owner "the owner".

## What this run did

It applied to `report/site/v9/decisions.json`, and to no other file, every change of the merged report
`site/checks/v10-review.md` that lands there, under rulings R1 to R10. The file parses and round-trips
(`json.dumps(indent=2, ensure_ascii=False)` plus a newline gives the same bytes). It went from 115,488 to
132,886 bytes.

Counts in the file now: nine questions (A to G in the first group, H in the standalone group, none in the
hardware group, I in the panel group), five readings, thirteen calls, four review items with eighteen number
lines, six design rounds, fifteen later choices, fifteen answer-sheet lines, thirty-three decided entries.

Checks I ran:

- Every marker resolves against the decided slugs, the thirteen call slugs, QT1 to QT48, EX1 to EX28, J1 to
  J10, the flaw ids and the page names. No `[[q:X]]` marker is used; see "R1" below.
- No em dash, en dash, straight double quote or curly apostrophe in any text. Typographic quotes balance.
- No text names a removed question, reading or call, and none says "no engine" for "no show machine".
- Every quoted question title is the exact title.
- I rendered the file through the builder's own `page_decisions` in a scratch copy of the report folder, with
  the sibling files as they stood at 01:06 UTC. Nine questions, thirteen calls and five readings were drawn and
  no marker failed. The other five pages also rendered against the new file. The builder does not yet draw
  `neededBy`, `waitsFor` or `answerSheet`; that is in "For other files".

The texts were built by scripts kept in the session's scratchpad, in the folder `v11dec` (`q_abc.py`,
`q_defg.py`, `q_hi.py`, `rest.py`, `assemble.py`, `check.py`). Version 10's file is beside them as
`decisions.v10.json`.

## What I checked in the code

The merged report names three checks to make before publishing. All three are done. Two of them changed the
text the report proposed.

### 1. What a cut-off tablet can do with the game's clock

The report's sentence was "Today a tablet cannot keep the game's clock or its phases going". That is half
right, so I rewrote it.

- A networked GM tablet draws the clock from the last value the show machine sent and then counts on by
  itself, one second at a time (`ALNScanner/src/ui/renderers/SessionRenderer.js:113-156`). Nothing stops that
  timer when the connection drops: the disconnect handler pauses only the session and video modules
  (`ALNScanner/src/network/networkedSession.js:183-188`, `ALNScanner/src/app/adminController.js:94-104`). So
  the number on a cut-off tablet keeps counting.
- The phase is the show machine's. `backend/src/services/gameClockService.js:28-30`, `:116-160` holds the
  phase table and moves the phase. The tablet only shows the label it was sent
  (`SessionRenderer.js:183-193`). Nothing in `ALNScanner/src` reads the pack's clock rules; the only use of
  `gameClock` is the copy taken from the engine's full update (`ALNScanner/src/network/messageRouters.js:132`).
- Pause, resume and end are commands sent over the live connection and time out after five seconds with no
  answer (`ALNScanner/src/admin/SessionManager.js:57`, `ALNScanner/src/admin/utils/CommandSender.js:29-34`).

Text now in B's first option: "Today a cut-off tablet goes on counting the clock on its own screen from the
last value the show machine sent. It cannot move the game's phases, pause the clock or end the game, because
the show machine does all three. So the GMs keep time themselves unless the design gives a tablet the clock."

### 2. Each row of the standalone table

| Row | What the code says | What I wrote |
|---|---|---|
| The GM tablet decides teams, scores, group bonuses, start, pause and end | True. `ALNScanner/src/core/storage/LocalStorage.js:187-245` (end, pause, resume), its group completion and scoring. | As the report has it, marked settled. |
| Nothing drives the room; each service reads grey | A requirement, not a fact about today. It is in the target "A standalone game is normal, never a fault". | As the report has it, marked settled. |
| A video token on the phone | Both of ALN's video tokens have no picture and no sound of their own (`ALN-TokenData/tokens.json`, `kai001` and `rem001`: `image` and `audio` are null). The phone then hides the picture and shows only a status line with the token's id that fades after four seconds (`aln-memory-scanner/js/tokenDisplay.js`, `displayMemory`). The phone never reads `processingImage`. | "today the phone shows a blank screen". |
| A video token on the hardware scanner | It shows the picture with "VIDEO UNAVAILABLE" and "Rescan later" whenever the scan is kept and not sent (`arduino-cyd-player-scanner/ALNScanner_v5/Application.h:582-590`). The scanner has no standalone mode today. | "the hardware scanner says to rescan later, which can never work". |
| The game clock on a standalone GM tablet | The report said "it shows only the time the game started". The panel shows two things: "Started:" with the time of day, and "Duration:" with the time since the start, worked out when the panel is drawn. It does not tick, it does not stop for a pause, and there are no phases (`ALNScanner/src/ui/renderers/GameAdminRenderer.js:48-49`, `:60-61`, `:84-85`). | "today it shows when the game started and how long ago, with no phases". |
| A game with player scanners only has no clock | True. Neither player scanner has any clock code. | As the report has it. |
| Evidence exposed in public | The report said "today the GM sees the summary once". The GM sees it on the result screen (`ALNScanner/src/ui/uiManager.js:497-500`) and again in the tablet's activity list, which is built in standalone games too (`ALNScanner/src/core/gameActivityBuilder.js:90`, `ALNScanner/src/ui/renderers/GameOpsRenderer.js:640-644`, `ALNScanner/src/core/storage/LocalStorage.js:615`). No screen shows it to the public. | "today only the GM sees the summary, on the tablet's own result screen and activity list". |
| ALN's pack marks every need "skip it" | True. `ALN-TokenData/pack-manifest.json`: the four entries under `stack` and the three under `endpoints` all say `onAbsent: degrade`. | As the report has it. |

### 3. Every place in this file that names a removed question, reading or call

All are changed. The list is under "Follow-on edits" below. The same search over the sibling files is under
"For other files".

### Other facts I checked before writing them

- The TV goes dark when the show machine dies: the show machine's own HDMI output is the TV
  (`backend/src/services/displayControlService.js:5-12`).
- The second scoreboard screen says offline and its clock keeps counting
  (`backend/public/scoreboard.html:994-997`, `:1608-1611`). It also keeps cycling through the evidence pages it
  already holds (`:1330-1333`). So I wrote "keeps the last scores and evidence it had", not "keeps its last
  page".
- Both player scanners keep 100 scans and drop the oldest without a word
  (`aln-memory-scanner/js/orchestratorIntegration.js:15`, `:171-172`;
  `arduino-cyd-player-scanner/ALNScanner_v5/services/OrchestratorService.h:1239-1243`).
- First come, first served (`backend/src/gameRules/duplicatePolicy.js:4-8`); the pack declares
  `claim: once` (`ALN-TokenData/game.json`, `duplicatePolicy`).
- Today's cue rules: sixteen triggers (`backend/src/gameRules/cueValidation.js:42-59`), twenty-four actions,
  none a score (`:91-116`), and the reason score changes are left out (`:17-25`). What a rule can read: the
  token, device and device type for a player's scan (`backend/src/services/cue/standingEvaluator.js:32`); the
  team, points, the team's score and whether a group bonus fired for a sale
  (`backend/src/gameRules/cueVocabulary.js:35-42`); the new phase for a phase change
  (`standingEvaluator.js:54-60`). ALN's first two cues react to a video loading and ending
  (`ALN-TokenData/cues.json`).
- The engine refuses a pack whose format version is not exactly its own
  (`backend/src/services/packService.js:45`, `:725`, `:759`).
- The phones' page is served straight from its own folder (`backend/public/player-scanner` is a link to
  `../../aln-memory-scanner`).
- The program watcher: five failures, a five-second base, doubled (`backend/src/utils/processMonitor.js:15-19`,
  `:136-149`); the video player uses the same watcher at a fixed three seconds
  (`backend/src/services/vlcMprisService.js:113-121`).
- A trial copy runs with video, music, speakers and lights off
  (`docs/plans/2026-09-04-phase3-design-workspace-pages.md:356-361`, ratified 2026-09-04).
- A token's code is its plain id on the tag and in the link (`ALN-TokenData/tag-writer.html:444`), the phone
  opens that link (`aln-memory-scanner/js/app.js:538-550`) and takes a typed code (`:506`).
- A standalone GM tablet checks no login (nothing in `LocalStorage.js` asks for one).
- "About four lines in ten": the room's services, the cue engine and the watcher are about 10,100 of the
  26,900 lines under `backend/src`, close to the outside review's 11,000 of 27,000. That count is of the
  program on the show machine, not of the whole engine, so the sentence in question I says "of the program on
  today's show machine".
- The roadmap keeps the old machine as the rollback and then as the test machine
  (`docs/plans/ROADMAP.md:461-475`); the second game needs the show machine by its nature (`:560-562`).
- Every quote of the owner matches `rework/2026-11-02-owner-comments.md`. Two were corrected; see (b).

## Changes, by part of the merged report

Field names are version 11's. Where a field moved, version 10's place is in brackets.

### R1. Letters, anchors, markers

- `groups[0].questions[0..5]`: A to F keep their letters, anchors and titles.
- `groups[0].questions[6]`: new, letter G, anchor `q-g`, "A player who sends a scan without the token".
- `groups[1].questions[0]`: letter H, anchor `q-h`, "Which standalone games the engine must run" (was G,
  `q-g`).
- `groups[1].questions[1]` (was H) and `groups[2].questions[0]` (was I): removed. `groups[2].questions` is
  now `[]`.
- `groups[3].questions[0]`: letter I, anchor `q-i`, "What the panel gets in its blind round" (was J, `q-j`).
- `[[q:X]]` markers: version 10's file used none, and version 11's uses none. Every place that names a
  question names it by its exact title in typographic quotes, as the file did before. The check script
  compares every quoted phrase with the nine titles.

### (a) The questions

**a1, question B.** B-1 to B-6, asks-1 check V-1, V-3, V-5, D-H1, D-M4, O3, outside check V1.

- `decides`: added the clause on easy to understand and change and the sentence on what each fallback costs;
  added the three sentences on the kit's network failing; removed the last sentence on changing from networked
  to standalone (now a reading). Also dropped "on the public screens" after "every screen telling the truth",
  since the TV question left B.
- `evidence[0]`: "Open: how the game goes on." The clause on the audience's screens is gone.
- `evidence[1]`: the TV goes dark; the second scoreboard screen keeps what it had, says offline and keeps
  counting. Added one sentence: each player scanner keeps up to 100 scans and then drops the oldest (item 11
  of (c), part 3 item 9).
- `evidence[2]`: "Each is a different engine." became "Which of them the engine offers follows from your
  answer." (D-H1 cites the old sentence as a design word.)
- `evidence[3]`: no longer points to the removed question; it points to the standalone group's introduction.
- `evidence[5]`, new: the "For you" item on the two show machines. The report adds it to `evidence[4]`. I made
  it its own item, because every other "For ..." item is one item.
- `evidence[6]` (was `[5]`): the sentence on the TV's clock is removed. The rest now says that what the players
  lose follows from the answer, and names what they must never lose as the agent's reading.
- `evidence[7]`, `[8]`, new: "How often" and "For a game that needs the show machine by its nature".
- `evidence[9]` (was `[6]`): the design words are plainer ("a copy of the game kept somewhere other than the
  first machine"). The pass sentence stays "whether a pass issued by one machine holds on another". The asks-1
  check wanted "how"; the merged ruling "A pass and a change of machine" leaves a change of machine to the
  design rounds, so "whether" is the word that agrees with it.
- `evidence[10]` (was `[7]`): sources. The second reading is no longer named as one reading; QT5 left, QT44
  joined; today's code facts added.
- `options`: two levels and the line that pausing is out. "(a numbered log of facts)" went with the old
  options (item 15 of (c), D-L6). The clock sentence is the one from check 1 above.
- `recommendation`: the report's text. `recKind` stays "What we need from you".

**a2, question D.** D-1 to D-4, O2, outside check V3, D-H1.

- `decides`: the report's text. I also removed the parity clause from its first sentence and the closing
  sentence on rules with no engine (D-3 and its follow-on in the asks-1 check).
- `evidence[0]`: "Open: how far the pack's rules reach."
- `evidence[1]`: the report's first part, then "A video for each token still needs one cue for each token",
  then the two sentences on rules and scripts, reworded for the four steps.
- `evidence[3]`: now starts from today's rules (sixteen things the engine sees, twenty-four things the room
  can do, none a score). The old text set "tables" against "a rule format", which the corrected fact makes
  wrong.
- `evidence[4]`: the report's two sentences added; the two sentences on the hardware scanner's rule runner
  removed (D-3).
- `evidence[6]`: reworded for the four steps; the round's full title.
- `evidence[7]`: sources gain the ruling of 2026-07-09 and today's code.
- `options`: the four steps, as the report has them. `recommendation`: the report's text. `recKind` stays
  "Recommendation".

**a3, question A.** A-1 to A-5, I-4, O1.

- `decides`: the added clause and sentence; the last sentence replaced.
- `evidence[0]`, `[1]`: they no longer say that who wins a conflict is asked here.
- `evidence[2]`, new: "How often two tablets can disagree".
- `evidence[3]`, `[4]` (were `[2]`, `[3]`): "a provisional verdict" became "a result shown at once", and "a
  provisional bonus can be undone" became plain words.
- `evidence[5]` (was `[4]`): the last two sentences replaced.
- `evidence[6]` (was `[5]`): replaced; it links the call by its marker.
- `evidence[7]` (was `[6]`): "the engine decides kept scans in a stated order"; "Provisional verdicts mean ...
  a reconciliation exists" became plain words.
- `evidence[8]` (was `[7]`): the clause on the first reading removed; the last sentence replaced; QT37 added.
- `options[1].means`: one sentence added, "A team hears no result until the engine is back." (O1 part 2, A-1.)
- `options[1].cost`: the report's replacement, with the call's marker.
- `options[2].means`: "marked provisional" became "marked “not yet confirmed”", to match the new cost and the
  ask.
- `options[2].cost`, `recommendation`: the report's texts. `recKind`: "What we need from you".

**a4, question C.** C-1 to C-6, asks-1 check V-2, D-H1, D-H2, design check V-6, O12.

- `decides`: "and packs" removed in both places; one sentence added so the pack ask is named ("Whether a pack
  built for an older engine must always open on a newer one.").
- `evidence[0]`: the replug is now said for the first swap, and "every later release can be undone the same
  night" is marked proposed, to agree with the reworded target.
- `evidence[1]`: "a device or a pack" became "a device", with "Packs have their own rule, below."
- `evidence[3]`: "straight from the page's own folder".
- `evidence[5]`: the report's first sentences and its added sentences. I kept the links to the two targets and
  the case inside it.
- `evidence[7]`: the pack sentences replaced.
- `evidence[8]`, new: "What undoing a release needs".
- `evidence[9]`, new: the practice item on the night's record (d4, D-M1).
- `evidence[12]` (was `[10]`): sources gain the glossary's entries and the exact-format check.
- `options[0].cost`, `options[1].means`, `options[2].means`: the report's texts.
- `options[1].label`: "Together for what the engine serves, a window for devices updated by cable.", so the
  label says what the recommendation says.
- `recommendation`: the report's text. `recKind` stays "Recommendation".

**a5, version 10's H removed.** A2-H2, A2-H3, A2-M6, asks-2 check V2, V8, O8.

- The question is gone. Its rule is the call "A standalone game follows the rule you ratified for missing
  equipment". Its record ask is in question H. Its table is in `groups[1].intro[1]` and `[2]`: two settled
  rows, three proposed, and the sentence on ALN. Two rows are corrected from the code (check 2 above).
- The call "Exposed evidence and video with no engine" is deleted.

**a6, question H (version 10's G).** A2-H5, A2-H6, A2-L5, asks-2 check V3, O9, D-H6.

- `decides`, the four new `evidence` items, the three `options`, the `recommendation`: the report's texts,
  with "the show machine" where the report says so.
- `evidence[0]`: reworded; it no longer says the reading is asked again here.
- `evidence[2]` ("At a show"): the sentence on a hotspot and a tablet acting as the engine is removed. The fact
  about tablets replaces it.
- `evidence[4]`, `[9]`: plain words for "a merge rule" and "the shapes".
- Version 10's `evidence[5]` (the aside) removed.
- `recKind`: "Recommendation".

**a7, version 10's I removed.** A2-M1, O7.

- The question is gone. `groups[2].intro[0]` ends with the report's three sentences, with the call's marker.
  The call is in `calls`.

**a8, what the panel waits for.** A2-H1, A2-M2, D-H1, O4.

- `intro`: now seven paragraphs. `[2]` holds the four tests, the reworded fourth test and the sentence on
  options that are ways to build. `[3]` holds the two marks. `[4]` is the paragraph on the three linked
  questions. The report puts the marks inside the tests' paragraph; I gave them their own paragraph, with the
  same sentences in the same order.
- `waitsFor`: the block, one paragraph.
- `neededBy` on all nine questions, with the report's marks. Version 10's G is H and its J is I.

**a9, question F.** F-1 to F-4, I-3, D-H6, O10.

- `decides`: the third way is now "only on another computer: a laptop, or the kit's second machine".
- `evidence[0]`: rewritten. The target on the trial copy is no longer called settled on where it runs.
- `evidence[1]`: the trial copy plays on stand-ins. The old sentence had its video player and music able to
  take the TV and the speakers, which F-1 shows is wrong.
- `evidence[3]`: the report's text. `evidence[4]`: "or a second machine" added.
- `evidence[6]`: the report's added sentence, changed in one way. The report says the agent rewords two targets
  if the owner answers anything but "during the show". Item 5 of (c) already makes both targets wait on this
  question. So the text says "Two targets wait on this question", then the report's sentence.
- `evidence[7]`: sources gain QT9, QT25 and the ratified pages.
- `options`: the three reworded, and the fourth added.
- `recommendation`: the report's text, with "which until this version had" for "which today has", for the same
  reason. `recKind`: "Recommendation".

**a10, new question G.** O11.

- The report's texts. `decides` names the promise by its marker ("The promise “[[promise:J7]]” against easy to
  extend"), because "Each person doing only their part" is not the promise's exact title.
- Two `evidence` items added: why this is a question (it is new, so it comes to the owner first), and sources.

**a11, question I (version 10's J).** A2-M4, A2-M5, A2-L4, asks-2 check V1, V7, D-H3, D-H5, D-M6, design
check V-2, O5, O6, outside check V2.

- `decides`: the clause on the readings removed. One sentence added so the seventh decision is in what the
  question decides.
- `evidence[1]`, `[2]`: the list without the settled roles, and the new item on that decision. The two cases
  are named by their markers.
- `evidence[3]`: replaced. `evidence[4]`: the sentence on merging or reordering added.
- `evidence[5]`, new: the seventh decision. Two wording changes: "the program on today's show machine" for
  "today's engine", and "one of the nine questions the pass answers" with its link, because this page now holds
  nine questions of its own.
- `evidence[6]`: the sentence that named the hardware question removed.
- `options[0].means`, `recommendation`: the report's additions.
- `decided`, "The role question starts from settled roles": "with no scoring and no live game feed".

**a12, question E.** E-1 to E-4, O12.

- `decides`: cut to two paths, with the sentence on a production's own build.
- `evidence[4]`: now carries the old third option as two sentences. `evidence[5]`: no longer says the owner
  must test against code they did not write.
- `options`: two. `options[1].means` and `.cost`: the report's texts. `recommendation`: the report's text.

### (b) The readings and the calls

**Readings, five (R2).** A2-M3, A2-H4, asks-2 check V4, B-4, D-M4, O3.

- `readings[0]`: kept, new tail.
- Version 10's `readings[1]` (a cut-off tablet keeps taking scans): removed.
- `readings[1]`: reworded. The report quotes “A device that goes down mid-game”. The owner's words are "a
  device goes down mid-game", so the reading says: Your words “a device goes down mid-game” include the show
  machine itself.
- `readings[2]`, `[3]`, `[4]`: new, the report's texts. In `[4]` the quote is “For more or less all use cases”,
  with the owner's capital letter. In `[3]` "no device is on a show machine".

**Calls, thirteen (R3).** In this order:

1. "Four readings of earlier decisions are confirmed": the clause on the four questions replaced (D-H3).
2. "The quality targets' numbers are sorted, not asked": the two sentences added (A2-M7, D-M8). The list of
   technical defaults gains "how long data is kept until a production sets its own" (R5).
3. "The missing standalone declaration is a design flaw of its own": kept.
4. "A standalone game follows the rule you ratified for missing equipment": new (A2-H2, O8, asks-2 check V5).
   The two targets in its reason are named by their markers.
5. "In a standalone game, whoever holds the GM tablet holds the game's controls": new (I-4 part 5).
6. "Who wins when two tablets claimed one token while apart": new (A-4, O1).
7. "Every refused GM scan attempt is recorded": kept.
8. "The design allows other hardware; what the first release requires comes with the build plan": new (O7,
   A2-M1). Its reason links the decision.
9. "The tap promise is to be split in two": the sentence on the panel's synthesis added (A2-L1).
10. "Three choices about how the promises are worded": merged from three, one sentence and one reason each
    (A2-M9, A2-L3). The clause on the flaw card left with the old third call.
11. "The panel's three lenses": the items of d7 and the lens sentences of d1 and d7 added. The reason says the
    three are independent in what they have read and not in habit. It names no model (R9).
12. "Each architect lists the decisions before seeing the agenda": new (O6, A2-L4). One sentence added: it
    applies if the owner gives the blind round the agenda.
13. "The second round reads today's code": kept.

Left the list, with their content kept in `review[1].numbers`: "The program watcher's retries" (the line for
QT2), "How long before a screen says the engine is silent" (QT5), "The show machine's limits" (QT33). Each
line now carries the reason the call gave. Deleted: "Exposed evidence and video with no engine".

Call anchors: `call-` plus the builder's slug of the title. The thirteen slugs are unique.

### (c) Facts

- Items 1 to 3: inside a1, a2, a9.
- Item 6: `groups[0].intro[4]` and `[6]`, the report's texts.
- Item 7: `groups[0].intro[2]`, the report's text. "abilities are only ever added" is gone from this file.
- Item 8: `groups[0].intro[7]`, the report's text, with one sentence naming the conflict.
- Item 9, as it lands here: "no engine" became "no show machine" in `designRounds[2]`, in the decided entry
  "Standalone games: declared, never mixed", and in every new text.
- Item 10: the line for QT5 in `review[1].numbers`.
- Item 11: the line for QT40 in `review[1].numbers`, and the sentence in B's scene.
- Item 14: `review[2].what`, "before the panel's folder is built".
- Item 15: gone with B's old options.

### (d) The design approach

- d1, d2: the seventh decision is put to the owner in question I only (R7). `designRounds` stays at six.
- d3, d5: `designRounds[1]` and `[4]` each gain one clause (how each kind of device gets its pass; how a release
  is put on a kit and taken back), so the short lines on this page agree with the wider "What it decides" on
  Design.
- d4: the practice item in C.
- d12: `review[1].what` names the four new targets by their markers and says they are proposed. "Forty-seven".
- d13: the first line of `review[1].numbers`.

### (e) Smaller fixes

- e1: `groups[0].intro[1]` to `[9]` each keep their first sentence and gain the conflict, the answer and what
  it rests on. `[10]` is the new answered line on hidden facts and standalone games. `[0]` says what each line
  holds.
- e2: `groups[0].intro[11]`, "Seven questions follow."
- e3: `answerSheet`, fifteen lines: nine questions, the readings, the requirements, the brief, three facts.
- e4: the reading path in `review[1].what`, with counts taken from the requirements file as it stood at 01:03
  UTC: 23 settled, 24 proposed or partly settled, 17 with a number. See "For other files" for the recheck.
- e6: every later choice names its round, by the owner's titles. `later[0]` starts "Where the night's set-up
  holds". `later[6]` is the reworded choice on B. `later[9]` is "How a changed pack is taken up between games
  with no restart". `later[11]` no longer names the removed hardware question. `later[13]` says paper documents
  are the owner's to answer when the round comes. `later[7]` says "the second scoreboard screen" for "the Pi 4".
  The six items that link to the alternatives table still start with the builder's six opening phrases.
- e7, follow-on edits in this file: see below.

### R5

`review[1].numbers`, the line for QT30: "The agent proposes 90 days for every kind of data, until a production
sets its own." The requirements file's number line for QT30 already says the same.

### Follow-on edits in this file

Every place that named a removed question, reading or call, or a letter that moved:

- `intro`: version 10's sentence on "two of version 9's eighteen questions" is replaced by a paragraph on
  version 11, which sends the owner to the change log for where version 10's ten questions went.
- `groups[1].intro[0]`: the first reading is no longer called "the fuller version" of a question. It names both
  readings of the standalone decision.
- `groups[1].intro[3]`: no longer says a part "belongs to the second question here".
- `groups[3].intro[0]`: names the new call on how the panel runs.
- B `evidence[3]`, A `evidence[8]`, I `evidence[3]` and `[6]`, `later[11]`: covered above.
- `review[0].what`: unchanged; "listed above" still holds.
- `decided`, "Standalone games: declared, never mixed": "no show machine"; "which standalone games the engine
  must run is your question above"; names the two readings and the call.
- `decided`, "No technical failure stops a game": three readings, named; the question on a cut-off tablet is
  named as a question; "new" dropped before the quality target.
- `decided`, "The engine is hardware-flexible; the roadmap sets the bounds": the call in place of "your
  question above".
- `review[1].numbers`, the line for QT43: it waits on the owner's question, to agree with the reworded target.
  New lines for QT42 and QT46, which now carry a number.

### Changes I made that the report does not list

Each is small. Overrule any of them.

- `intro[0]`: "Each question stands alone" became "You can answer any of them, in any order", because a later
  paragraph says three questions are linked. It also points to the answer sheet.
- `groups[1].intro[0]`: one sentence saying what "standalone" means on this page (no show machine; the engine's
  own software still runs on the devices). It is the definition item 9 of (c) adds to the front page.
- `review[1].numbers`: six lines give an order of size the agent proposes, as the changed call promises (the
  merged ruling "Engine times with no value"). A few minutes for publish to playing (QT9). A few hours, inside
  one working day, for a newcomer's first change (QT19). Well under a second for a scan's answer and about a
  second for a live message (QT33). About ten seconds for the fallbacks to show (QT44) and for a failed
  extension to be stopped (QT46). A few seconds on a live connection and ten seconds on a player scanner for a
  silent engine (QT5). None is taken from one of today's time-outs. They are mine to defend; change any.
- `review[1].what`: "None waits on you as a decision now", and one sentence on where the measured values come
  (A2-M7 found the old sentence left that open).
- `review[3].what`: two sentences on the rule that phones and hardware scanners stay equal in ability (the
  merged report's note under "The standing rules", part 3 item 12).

## Items not applied, with the reason

- The asks-1 check's "how a pass issued by one machine holds on another" in B (I-2). The merged ruling leaves a
  change of machine to the design rounds, so B keeps "whether".
- The outside check's separate evidence item "If the gap does not end" in A. The merged report puts the same
  content in A's `decides`.
- The design check's M8-J (a sentence on size in the panel question). The merged report puts the size in the
  numbers list (d13) and does not list M8-J.
- The asks-2 check's third option in the panel question (A2-L4). The merged ruling keeps two options.
- A seventh entry in `designRounds` (R7).
- A new later choice for "which of two kept scans counts as first". The call leaves it to the design round. I
  did not add an item, because `design.json` holds a copy of the list (R8) and the count of fifteen may be
  written elsewhere.
- Everything under "Parts the checks refused".
- `READINGS_LEAD`, `CALLS_LEAD`, `REVIEW_LEAD`: the builder's. See below.

## For other files

### `report/build_site.py`

1. Draw `neededBy` under each question's title. The introduction says "shown under its title".
2. Draw `waitsFor` (`title`, `text` paragraphs) before "Open now". The introduction says "First comes a short
   block on what the panel waits for".
3. Draw `answerSheet` (`label`, `form`) at the end of "Open now". The introduction says "The answer sheet at the
   end of “Open now”". The lines hold no markers.
4. A group may have no questions (`groups[2]`). The current renderer already draws it; the count checks should
   not expect one question for each group.
5. `READINGS_LEAD`, first sentence: "Each of these is the agent's reading of your words or of how ALN runs
   today, not something you said." Second sentence replaced by: "Answer each with yes or no. A yes makes it your
   decision, and it goes to the panel in your words. A no takes it out of the requirements and the panel's brief
   before the panel runs. One you leave unanswered goes to the panel as an open question. One reading is already
   inside a requirement: that a device going down includes the show machine is in the target “The GMs know their
   fallbacks at a failure”, and it goes to the panel marked as the agent's reading until you answer."
6. `CALLS_LEAD`, add: "You do not need to answer these. If you say nothing, each stands."
7. `REVIEW_LEAD`, add: "When you have read them, say “reviewed” in the chat. The panel does not run before that.
   If you flag nothing, the requirements go to the panel as they stand, each with its status. Your OK of
   2026-11-01 said the panel runs after you confirm the requirements. The agent reads that as after you review
   them."
8. Line 6, the module's own description: "ten questions in four groups" is now nine. `STATUS_LINE` says
   "Updated 2026-11-02".
9. Line 234: a constant names the call “Exposed evidence and video with no engine” in plain text. The call is
   gone. Its content is the three proposed rows in the standalone group's introduction on Decisions.
10. Lines 208 and 773 use `[[call:every-refused-gm-scan-attempt-is-recorded]]` and
    `[[call:the-missing-standalone-declaration-is-a-design-flaw-of-its-own]]`. Both calls and both titles are
    kept, so both still resolve.
11. The sentence above the list of design rounds on Decisions could say that a seventh decision is proposed
    under “What the panel gets in its blind round”. R7 asks this of Design's introduction only; I note it so
    the two pages agree.

### `report/site/v9/changes.json`

1. `lettersV10`, where each of version 10's ten went, as this file has it:
   - A. A GM tablet cut off from the engine: still A. One ask is left, whether a GM may tell a team a result
     before the engine has confirmed it. Who wins a conflict is the agent's call “Who wins when two tablets
     claimed one token while apart”.
   - B. The show machine fails mid-game: still B. Two outcomes to choose between and how long the players may
     wait. The TV's clock is in the review of the target “Screens say when the engine goes silent”. Whether the
     game becomes standalone, and whether a second machine is ever required, are two of the readings to confirm.
   - C. Release day: what must update together, and how long older devices work: still C. Packs are out of the
     window and have their own ask. The window is asked in months.
   - D. What a game's maker may build inside the pack: still D. It starts from the rules today's pack already
     holds. Rules with no show machine follow the agent's call “A standalone game follows the rule you ratified
     for missing equipment”.
   - E. How an extension for all games reaches a production: still E, with two options.
   - F. Where the trial copy runs while a show runs: still F, with a fourth option and a recommendation.
   - G. Which standalone games the engine must run: now H.
   - H. What a standalone game gives up, and what it keeps: no longer a question. Its rule is the agent's call
     “A standalone game follows the rule you ratified for missing equipment”. Its list is in the introduction to
     the standalone group, with three rows proposed for the owner to flag. Its ask on the record is in “Which
     standalone games the engine must run”.
   - I. Which hardware the first new engine requires, and what it must allow replacing: no longer a question.
     The agent's call “The design allows other hardware; what the first release requires comes with the build
     plan” replaces it. One line is still asked: any device the owner expects to use soon.
   - J. What the panel gets in its blind round: now I, with a seventh decision to accept or refuse.
2. The older `letters` rows (version 9's eighteen) name calls that changed. Rows I, J and K name “The venue
   promise stays one”, “Proof and release stay one promise” and “The route for equipment state is named in
   neither promise”: all three are now inside “Three choices about how the promises are worded”. Row N names the
   deleted call and the removed question (line 1165). Row M's question is now H. Lines 753-754, 884, 889 and 894
   name the same calls "since version 10".
3. The version 11 entry can use: nine questions, five readings, thirteen calls; the new question G; the two
   removed questions; the three calls that moved into the numbers list; the four new targets.

### `requirements/2026-11-01-quality-targets.json` (as it stood at 01:03 UTC)

1. QT37 `today` says what a mode shows in public "reaches the GM once, as a summary on the result screen". The
   GM also sees it in the tablet's activity list (check 2 above). Suggested: "reaches only the GM, on the
   tablet's result screen and activity list".
2. The orders of size are in `review[1].numbers` on Decisions only. For an architect to read them, the number
   lines of QT9, QT19, QT33, QT44, QT46 and QT5 need the same proposals, each marked as the agent's: a few
   minutes; a few hours, inside one working day; well under a second for a scan's answer and about a second
   for a live message; about ten seconds; about ten seconds; a few seconds on a live connection and ten seconds
   on a player scanner.
3. The reading path on Decisions counts 23 settled, 24 proposed or partly settled, and 17 targets with a number.
   If any `statusKind` or `numberToSet` changes after 01:03 UTC, change the three counts in `review[1].what`.
   Every target with a number has a line in `review[1].numbers` (17 lines and the line on size). A target that
   gains a number needs a line there.
4. Decisions links QT45 to QT48 by marker and names none by a hard-coded title, so their titles can change
   freely. The same holds for QT24, QT42 and EX17.

### `report/site/v9/design.json`

1. `later`: make it identical to `decisions.json` `later` (R8). Six items changed their endings, `later[0]`,
   `[6]`, `[9]`, `[11]` and `[13]` changed more, and `[7]` says "the second scoreboard screen".
2. Lines 95 and 272 name the removed hardware question.
3. `groups[3].intro[0]` on Decisions says the brief was "revised on 2026-11-10 after the review you asked for".
   Design's own sentence on the brief should carry the same date.
4. Decisions' short lines for the protocol round and the copies round now mention passes and how a release is
   put on a kit and taken back (d3, d5). They assume `ahead[1].decides` and `ahead[4].decides` gain those
   sentences.

### `report/site/v9/front.json`

Line 29 (`now`) says ten questions and three readings. It is nine and five. The count of calls is thirteen.

### `DECISIONS.md`

1. Line 872: "ten questions in four groups, three readings ..., fourteen calls" is version 10's history and can
   stay. The version 11 history line needs nine, five and thirteen.
2. "Still open" (lines 1086 and 1091), the table of older numbers (line 1178), lines 325-326, and lines
   1214-1216 name the two removed questions, the deleted call and the three merged calls.
3. "No technical failure stops a game": the entry's "Two readings follow" becomes three, and none of them is the
   removed reading on a cut-off tablet. The reading on the show machine quotes the owner as "a device goes down
   mid-game".
4. The record's summary of the standalone decision says "run with no engine" (item 9 of (c)); Decisions now says
   "no show machine" in its entry for that decision.
5. A dated line for the two facts corrected from the code would help the next reader: a standalone GM tablet
   shows when the game started and how long ago; the GM sees an exposed token's summary on the result screen
   and in the activity list.

### `panel/2026-11-01-panel-brief.md`

1. Line 236 names the removed hardware question.
2. The call "The panel's three lenses" on Decisions lists six added asks and two added lens sentences. The
   brief's own list should hold the same ones (d1, d7).
3. The call "Each architect lists the decisions before seeing the agenda" says the step applies if the owner
   gives the blind round the agenda.
4. Question I's second and third bullets say the settled roles go to the panel in the setting, as ALN's facts,
   and are not in the binding list.

### `report/2026-10-31-standalone-lines.json`

At the start of this run line 5 held `[[call:exposed-evidence-and-video-with-no-engine]]`. That call is gone and
the marker would fail the build. By 01:06 UTC the marker was no longer in the file, so another writer has
already changed it; I list it so the integration step checks.

### The built pages and the smoke test

`site_smoke.js` and any check that counts questions, letters A to J, readings or calls needs the new counts:
nine questions (A to I), five readings, thirteen calls.
