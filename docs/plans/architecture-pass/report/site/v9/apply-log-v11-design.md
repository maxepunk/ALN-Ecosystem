# Apply log, version 11: Design, the front page, the change log and the panel's brief (2026-11-10)

Written 2026-11-10 by the agent applying the merged report of the independent review (`../checks/v10-review.md`) to four files, for the agent running the pass. A working file, so it calls the owner "the owner". Rulings R1 to R10 of the task win where they differ from the merged report.

## Scope

| File | Result |
|---|---|
| `report/site/v9/design.json` | 37 strings changed, 1 added (`panel.sections[1].after[1]`). `later` is untouched (R8). Round-trips. |
| `report/site/v9/front.json` | 23 strings changed, as text, one at a time; the file parsed after each change. One entry added to `words` ("The engine", first in the list). |
| `report/site/v9/changes.json` | New first entry in `versions` (version 11, twelve items and a prompt). New top-level `lettersV10` (ten rows, plain text, no marker). 6 rows of `letters`, 5 rows of `numbers`, 2 promise notes and 3 recommendation notes reworded where they named a call that version 11 merged or removed. One line added to `vocabulary`, one sentence changed in `intro[1]`. Round-trips. |
| `panel/2026-11-01-panel-brief.md` | Rewritten in place: same sections, the changes listed below. |

Nothing outside these four files and this log was edited. No git command was run. `backend/.env` was not opened, and the stale copies beside the repository were not read.

## Counts on the front page and in the change log (R4)

- Front page, "What you can do now": nine questions, five readings, thirteen calls. No other count of questions, readings, calls, targets or cases is written on the front page.
- Change log, version 11: nine questions (ten before), five readings (three before), thirteen calls (fourteen before), forty-seven targets, twenty "today" notes. Extension cases stay twenty-eight and are not counted again in the entry.
- The front page's counted prose is 2,609 words in a trial build against the limit of 2,625 (see "The front page's length").

## Facts checked before writing them

| Fact | Where checked | Result |
|---|---|---|
| The hardware scanner does not check the certificate | `arduino-cyd-player-scanner/ALNScanner_v5/services/OrchestratorService.h:714`, `:945`, `:979` (`setInsecure()`) | True. |
| The kit uses a certificate it made itself, accepted once per staff device | `backend/CLAUDE.md` ("Self-signed certificate", "Certificate Trust (One-Time Per Device)") | True. |
| The roadmap gives the kit a public name and a trusted certificate with the players' phones block | `docs/plans/ROADMAP.md:629` (row 8.19, owner-ruled 2026-09-12) | True. |
| A web page reads NFC or the camera only over a secure connection | `ALNScanner/src/utils/nfcHandler.js:23-44` (`NDEFReader`), `aln-memory-scanner/js/app.js:146` (`getUserMedia`); both are browser features limited to secure contexts | True. |
| Both player scanners keep 100 scans and drop the oldest without a word | `arduino-cyd-player-scanner/ALNScanner_v5/config.h:64`, `services/OrchestratorService.h:1243-1246`; `aln-memory-scanner/js/orchestratorIntegration.js:15`, `:171-173` | True. The hardware scanner writes a log line only. |
| The kit's only backup is a hand copy the guide asks for after every event | `DEPLOYMENT_GUIDE.md:2821-2825` | True. Nothing runs, checks or restores it. The change log says it that way, not "the kit has no backup". |
| The show machine drives the TV | `backend/src/services/displayControlService.js:5-12` | True. |
| About four lines in ten of the program on today's show machine drive the room | `wc -l` over `backend/src`: 26,916 lines in all; the video, music, sound, Bluetooth, audio, lighting and display services, the cue engine, held items, the health registry, the program watcher and the command executor come to about 11,600 | True (43 per cent). Used in the brief's text on the seventh decision and in the draft below. |
| The record's nine questions and their titles | `DECISIONS.md:192-214` | "How the engine reads its programs" is the third. No decision on Design named it before this version. |
| The settled roles, in the record's words | `DECISIONS.md:258-266` | "with no scoring and no live game feed". Used in the setting. |
| The owner's request for the review | `docs/plans/CURRENT-STATE.md:21-24` | The quote in the change log's prompt matches it word for word. It is not in `rework/2026-11-02-owner-comments.md`, which holds the comments of 2026-11-02 only. |
| Version 10's titles for A to J, and the old titles of the four renamed requirements | the version 10 text pages (`decisions.md:65-629`, `requirements.md:195`, `:493`, `:725`, `:935`) | Used as written. |

### The three checks the merged report asks for before publishing, as they touch these files

1. **What a cut-off tablet can do with the game's clock.** None of the four files states it. The front page's line under "During play" no longer says the TV's clock waits on the question about the show machine. It says the clock shows as unconfirmed, and that whether it stops or keeps counting is for the owner's review of the target “Screens say when the engine goes silent”, which is what that target now says.
2. **Each row of the standalone table.** None of the four files carries the table. The change log's rows that point to it say "three rows marked as the agent's proposals" and name two of them (what a video token does, what a mode shows in public); the third is the tablet's clock. That matches `decisions.json` `groups[1].intro`.
3. **Every place that names a removed question, reading or call.** Found and changed in these files:
   - `front.json` `now` ("the ten questions", "three readings"); `standaloneLine` ("Which shapes the engine supports, and how many GM tablets, is your open question"); the promise line under "During play" (the TV's clock and the question about the show machine).
   - `design.json` `panel.sections[1].items[2].text` (the hardware question); `items[3].text` and `sections[4].paragraphs[0]` (the two readings that were withheld, one of which left the list); `decided[4].paragraphs[1]` ("Two readings follow", one of them the removed reading); `ahead[2].settled` (the shapes of standalone game; who wins a conflict as part of the owner's question).
   - The brief: lines 110 to 120, 172 to 174 and 233 to 238 of the version of 2026-11-02.
   - `changes.json`: `letters` rows H, I, J, K, M and N; `numbers[17]`, `[24]`, `[50]`, `[51]`, `[52]`; the first change note of the venue promise and of the change promise; the three `recommendations[*].why`.
   - Left on purpose: `design.json` `later[11]` still names the hardware question, because R8 leaves `later` to the integration step. Version 10's own entry in `changes.json` still describes version 10's ten questions, as history. Rows of `lettersV10` name version 10's titles in `was`, as they must.

## Applied, by item of the merged report

### design.json

| Item | Field | What changed |
|---|---|---|
| d1 (wording only), design check H5-D, outside check V2 | `ahead[0].decides` | The sentence on the state of the room. |
| | `ahead[0].settled` | Six of the nine questions, with “How the engine reads its programs”. |
| | `ahead[0].drivers` | Adds the promise “The room does what the designer cued and the GM asked”, QT2, QT15, QT44. |
| | `ahead[3].drivers` | Adds EX24, EX25, EX26, EX27, EX28. |
| | `ahead[4].drivers` | Adds QT13, QT14, QT25. |
| | `panel.sections[0].items[0].text` | The first lens gains "how the engine drives outside programs that crash, hang or answer late". |
| d2 | `panel.sections[1].after[1]` | "on which devices the game's rules and its record run, and whether one body of rules serves the show machine, a standalone tablet and a failure". |
| | `panel.sections[1].items[4].text` | "Each architect also says whether they would merge or reorder any of the six, and why. A change to your list comes back to you with the synthesis." |
| | `ahead[0].panel`, `panel.sections[3].paragraphs[0]` | Says that the first and third decisions both decide who decides a fact, that each architect is asked, and that a change comes back as a question. |
| d3, design check H4-D | `ahead[1].decides` | The sentence on how each kind of device shows who it is. |
| | `panel.sections[1].after[1]` | "how each kind of device and each kind of staff gets its pass and loses it". |
| d4 (Design's parts) | `ahead[0].decides` | How the game in progress is kept on the kit so that a newer engine reads what an older one wrote. |
| | `ahead[1].decides` | What a newer engine or the Director Console does with a night's record an older engine wrote. |
| | `ahead[4].decides` | What belongs to the kit and moves with it; how a kit is backed up and brought back. |
| | `ahead[0].drivers` | Adds QT30 and EX24. |
| d5, design check V-6 | `ahead[4].decides` | A supported machine, start at power-on, a new version put on and taken back, where the design tool runs. |
| | `ahead[4].drivers` | Adds QT41, QT42, QT13, QT14, EX17, EX28. |
| | `ahead[5].decides` | "What the hardware scanners run during the events when the old machine is still the fallback." |
| | `ahead[5].drivers` | QT41 leaves. QT42 and EX17 stay "for the first swap" (see "Judgement calls", 1). |
| d6 | `ahead[3].decides`, `panel.sections[1].items[4].text` | One round, two parts, each with its own designs. Every subject of the old paragraph is kept, sorted into the two parts. |
| d7 | `panel.sections[1].after[0]`, `after[1]` | What the design leaves out; what each mechanism costs to keep; one rejected alternative that differs in kind for the state and extension decisions; any requirement that says how to build; the largest kit; what parity of phones and hardware scanners costs. |
| | `panel.sections[0].items[1].text` | The growth lens asks whether an add-on runs inside the engine or as a separate program. |
| | `panel.sections[0].paragraphs[0]` | Says the three run on the same model and read the same folder, so they are independent in what they have read and not in habit. |
| | `ahead[0..4].panel` | Each says the designs come with what moving today's engine to them would cost. |
| d8 | `panel.sections[1].after[0]`, `ahead[0].panel` | "(one tablet's connection, the kit's whole network, a device that dies, the show machine, an outside program)". |
| d9 | `panel.sections[1].items[2].text` | The four sentences on the secure connection. |
| d14 | `ahead[0].decides` | How a pack and its media reach each device in a game with no show machine. |
| R6, d10 | `panel.sections[1].items[1].text`, `sections[2].items[0].text`, `sections[4].paragraphs[0..1]` | The folder leaves the field "today" out of the blind round; the second round gets the notes back. |
| (c) 9 | `ahead[2].decides`, `ahead[2].panel` | "the show machine in a networked game"; "who decides when there is no show machine". |
| (c) 12 | `ahead[3].settled` | The one-kit rule with its bound. |
| (c) 13 | `decided[0].paragraphs[0]` | "kept in one place and versioned. Whether the messages and each file format share one version or carry their own is part of the decision on the protocol's form." |
| (e) 6, design check V-5 | `ahead[2].decides` | "This round puts the ways to build it in front of you, each with its cost, against what you said must be true at a show." |
| (e) 6 (paper documents) | `ahead[3].settled`, `decided[3].paragraphs[2]` | The owner's to answer, as a question in the extension round. |
| a8 | `panel.sections[1].items[3].text`, `sections[4].paragraphs[1]` | An open question goes to the panel as its “What it decides” paragraph only, with the reason. |
| a11, asks-2 check A2-M4 and A2-M5 | `panel.sections[1].items[3].text` | The settled roles leave the binding list. How a confirmed, a refused and an unanswered reading reach the panel. The one reading already inside a requirement. The sorting of the numbers. |
| | `panel.sections[1].items[2].text` | The roles of ALN's devices join the setting, in the record's words. The sentence on the hardware question is replaced by the one line a7 keeps (a device the owner expects to use soon). |
| | `ahead[1].settled`, `ahead[2].settled` | The roles are ALN's facts for the panel, not a binding decision. |
| a11, outside check O6 | `panel.sections[1].items[4].text`, `panel.intro[0]` | Each architect lists the decisions before opening the six; the step is named among the agent's calls. |
| R7 | `panel.sections[1].items[4].text` | One sentence: if the owner says yes, the seventh decision joins the agenda after where authority lives. `ahead` still has six entries. |
| a3, a6, (b) | `ahead[2].decides`, `ahead[2].settled` | Who wins a conflict is the agent's call. The standalone question's three asks. The reading on a game with no GM tablet. Where the standalone fact is held follows `decisions.json` `later[0]` (the pack waits on a reading). |
| (b) readings | `decided[4].paragraphs[1]` | Three readings to confirm (the show machine; stays networked; no second machine required), and the two questions by title. |
| a7 | `decided[5].paragraphs[0]` | One sentence that names the agent's call on hardware. |
| a9 | `ahead[4].decides`, `ahead[4].panel` | The trial copy's place is the owner's question, by title. A test run is kept from the show or refused while a game runs, as the reworded target has it. |
| a10 | `ahead[1].decides`, `ahead[3].decides` | One clause each: what a scan carries, and what the pack holds for each token, wait on the new question if the owner answers it. |
| R1 | every reworded sentence | Each link to a question is `[[page:decisions#q-x|exact title]]`, with letters a to i. The one link version 10 already had (`q-e`) stays right. |
| Requirements log, item 10 | `ahead[1].drivers`, `ahead[3].drivers`, `ahead[4].drivers` | The four new targets get a home: QT47 under the protocol's form, QT45 and QT46 under extension, QT48 under separate copies. |

### front.json

| Item | Field | What changed |
|---|---|---|
| R1, R4, a8 | `now` | Three things let the panel run, with the question by title and link. Nine questions, five readings, thirteen calls. |
| R4 | `timeline.done` | Versions 8 to 10 published; version 11 applies the review. |
| (c) 9 | `words` | New first entry, "The engine", in the merged report's words. |
| (c) 9 | `moments[2].when`, `moments[2].people[4]`, `standaloneLine`, `intros.requirements[1]` | "no show machine". |
| (c) 12 | `words`, "The standing rules" | The bound: "where avoiding it costs little, so features for several kits come later and the places for them are built now". |
| (c) 10 | `moments[2].promises[5].why` | The TV's clock, as above. |
| (c) 4 | `moments[5].promises[0].why`, `qualities[10].line` | "a release that fails can be undone before the next game" in place of "replugging the old machine brings everything back". |
| a6, R1 | `standaloneLine` | The standalone question by title and link, with what it now asks. |
| a7 | `decidedLately[2].line` | The line is open "for the design rounds and the build plan". |
| R7, design check H5-D | `intros.design[1]` | One sentence on the proposed seventh decision. One sentence naming the four targets that are checks on every design (QT8, QT29, QT33, QT34). The agent's call on listing the decisions. |
| R6 | `intros.requirements[1]` | One sentence on the tag “Today”. |
| a8 | `siteGuide[1].line`, `siteGuide[5].line` | "What the panel waits for"; "old questions". |

### The front page's length

The build counts the front page's sentences without the moments and the words, and it counts the page's status line too. With the requirements writer's changes and version 10's overlay the count was 2,646, over the limit of 2,625. This task's additions (the new "now", the timeline, the release line) came to about 60 words. Ten cuts brought it to 2,609 in a trial build. Each cut is a clause the page says in full in another place:

- `timeline.next[0]`: "It also does the hardening block's remaining pieces and the truth sweep's work ..." (the two "Done" items say it).
- `timeline.next[2]`: "Until you say the new engine is ready, shows run on the machine in use now." (the purpose and the release line say it).
- `timeline.done`: the item of 2026-11-02 is shorter, and "Versions 8 and 9" merged with the new item.
- `timeline.now[1]`: "its brief comes to you first" became "and approve its brief".
- `growth[0].line`: "a mechanic made from what the engine already does should probably be the designer's own" (Decided lately and the line under "Easy to extend" say it).
- `growth[1].line`: "how an addition joins the main release is your open question" (Decided lately says it).
- `decidedLately[2].line`: the clause on what the roadmap sets, which the purpose says in the same words two sections above. The decision stays in the list with its core.
- `qualities[7].line`: "unless the game designs an identification moment" (the purpose says it).
- `qualities[9].line`: "no game mixes the two kinds of device" (Decided lately says it).
- `qualities[10].line`: "at the first swap by replugging the old machine" (the words list says it; the same clause stays in the uncounted line under "Release day").

No decision was removed from "Decided lately". The four new proposed targets are not named in the quality lines, for length; Decisions names them under the review.

### changes.json

- `versions[0]`: version 11, dated 2026-11-10, titled "An independent review, applied before you answer". Twelve items: what the review was; its verdict and the three things it changed; the nine questions and the three corrected facts; the new question and the two that left; the marks, "What the panel waits for" and the answer sheet; the five readings; the thirteen calls; the requirements (four new targets, six moved, four renamed); "no show machine", the "Today" notes and the 90-day default (R5, marked as the agent's proposal); Design; the brief; four facts about today's engine. The prompt quotes the owner's request and names no model (R9).
- `lettersV10`: ten rows, A to J, `was` as "X. <version 10's title>", `where` in plain text with no marker. A to F stay; G is now H; H and I are no longer questions and each row says where its parts went; J is now I. The row for G also says the letter G now belongs to the new question.
- `intro[1]`: "Five tables at the end map them: where version 10's ten questions went, ...". Plain words, because the new table's anchor is the builder's to choose.
- The rows listed under check 3 above. Each says "In version 10 ...; since version 11 ...".
- `vocabulary`: one line on "no show machine".

### The brief

- Header: revised 2026-11-10 after the independent review the owner asked for; the three things the panel waits for.
- The lenses: d1 and d7. One paragraph on the three running on the same model.
- The requirements item: each requirement says its status; the field "today" is left out of the blind folder (R6).
- The setting: the roles of ALN's devices (a11), the secure connection (d9), the line on a device the owner expects to use soon (a7).
- The binding decisions: the roles left out; an open question as its “What it decides” paragraph only (a8); how each reading reaches the panel (asks-2 check A2-M4, lines 110 to 120); the sorting of the numbers.
- The agenda: the staging step (O6), merge or reorder (d2), the two parts of the extension decision (d6), the conditional seventh (R7).
- What each architect writes: d2, d3, d7, d8, and each design's own time from power back to a running game.
- The second round, the synthesis, "What is withheld, and how" (lines 172 to 174) and "What the owner gets back": the "today" notes, a proposed change to the owner's list, the cost of moving today's engine.
- The owner's question: also asks the seventh decision, with the reason. The agent's calls: the lenses as changed, the new call on listing the decisions, the second round. "Anything else" asks the one line a7 keeps.
- Titles and quotes now take typographic quotes throughout.

## Judgement calls

1. **QT42 and EX17 stay as drivers of the last decision, "for the first swap".** The merged report (d5) says to move them to the fifth decision and keep the last for the one move. Both now cover two things: the first swap, whose method is ratified, and every later release. The last decision gains the sentence on what the hardware scanners run while the old machine is the fallback, which is the first-swap half of those two. So both are listed under the fifth decision in full and under the last "for the first swap". QT41 moved outright.
2. **QT30 drives the first decision and is not in the sentence on checks.** The design check lists QT8, QT29, QT30, QT33 and QT34 as checks on every design. The merged report's d4 adds QT30 to the first round's drivers. A target with a home is not a check without one, so the sentence in `front.json` `intros.design[1]` names four.
3. **Each design's time from power back to a running game is in the brief.** The call “The quality targets' numbers are sorted, not asked” says each design states it. No architect would know unless the brief asks, so it is the last item of what each design says.
4. **The seventh decision is named in three places beside question I.** R7 asks for one sentence in Design's introduction. The brief's agenda line and the brief's own text on the owner's question also say what happens on a yes, because the owner approves the brief and it must be complete. None of the three asks the question again.
5. **Two follow-on clauses for the new question G** in `ahead[1].decides` and `ahead[3].decides`, since the question names those two decisions as the ones that depend on it.
6. **Rows of the older tables in `changes.json` were reworded**, beyond the two things the task names for that file. They told the owner where a question went, and four of the calls they named no longer exist under those titles.

## Listed, not applied, with the reason

| Item | Reason |
|---|---|
| d1, the seventh entry in `design.json` `ahead` | R7. The full draft is below. |
| (e) 6, the round named in each later choice; the later choice on the fallback | R8. `design.json` `later` is left as it was; `decisions.json` `later` is the source. See "For other files", 1. |
| d7, "the third lens becomes living with it, and the least engine" | The merged report did not keep it. It kept the ask "what the design leaves out", which is applied. |
| A count of "eight" or "six" asks in the brief | The call on Decisions says "six more things"; the brief lists more. The brief names no count. See "For other files", 3. |
| The four new targets in the front page's quality lines | Length. They are proposed, and Decisions names each under the review. |
| The flaws “Engine trusts its stale picture of outside programs”, “Screens show a normal value when nothing is known” and “Service health and service state travel on separate paths” as test situations of the first decision | The merged report moves them only if the seventh decision is added (outside check, O5). They stay where they are. |
| d11, d12, d13, (c) 1 to 8, 10, 11, 14, 15, (a) 1 to 7, 9, 10, 12, (b) the readings and calls themselves, (e) 1 to 5 and 8 | Other files. |

## For other files

**1. `report/site/v9/design.json` `later`, at integration (R8).** Make it identical to `decisions.json` `later`, and keep each item's `alt` key, which `decisions.json` does not carry and the builder reads (`x.get('alt')`, and the check that an item with `alt` finds its row). By position the `alt` values are: item 1 `alt-delivery`, 2 `alt-lifecycle`, 3 `alt-rules`, 4 `alt-equipment`, 5 `alt-standalone-tablet`, 7 `alt-scoreboard` (counting from 0), and `""` for the rest. Until then `later[11]` names the removed hardware question and `later[6]` says "the fallback you choose".

**2. `report/build_site.py`.**

- Render `changes.json` `lettersV10`. Suggested: a section with id `letters-v10` and the heading "Where version 10's ten questions went", above the table for version 9, with the lead "Version 10 put ten questions to you, by letter. Version 11 follows the independent review you asked for; this table says where each went. The letters in the left column are version 10's." Check that there are ten rows, that each `was` matches `[A-J]\. \S`, and that no row links to a question. Add `letters-v10` to the plan's anchors for the change log.
- When that anchor exists, `changes.json` `intro[1]` can link it: replace "where version 10's ten questions went," with "[[page:changes#letters-v10|Where version 10's ten questions went]],".
- The heading and lead of the older table say "the letters of the questions on Decisions now"; they still hold.
- The tag for the new field must read exactly “Today”: `front.json` `intros.requirements[1]` and `design.json` `panel.sections[1].items[1].text` both name it.
- `design.json` `panel.sections[1].after` now has two paragraphs. `paras()` already renders a list; nothing to change.
- The sentence above the later choices on Design ("Each is settled inside one of the decisions ahead, or by the build plan.") still holds after item 1.
- The builder's docstring and any text that says "version 10" or "ten questions".
- `INDEX_LIMIT` does not need to change: the trial build counts 2,609. If the purpose paragraphs or a title linked from the growth lines grow by more than 16 words, the build fails on length again.

**3. `report/site/v9/decisions.json`.**

- `calls`, “The panel's three lenses”, `call`: "Each architect is also asked for six more things." The brief asks for those six and for three more (where the rules and the record run; how each device and each kind of staff gets its pass; the design's own time from power back to a running game). Replace the sentence with: "Each architect is also asked for more, and the brief on Design lists all of it. Six of the asks are these." The six sentences that follow can stay.
- `groups[0].questions[2]` (release day), practice items: d4's sentence on the night's record ("The night's record is a file that is kept. ...") belongs there; check it is in.
- `decided`, the entry “No technical failure stops a game”: `design.json` now says "Three readings of your words follow" and lists them. The line on Decisions should agree.
- Question I, `evidence`: it says "the six decisions ahead" and that each architect says whether they would merge or reorder; Design and the brief now say the same, and add that the first and third both decide who decides a fact.
- `later[4]` already says the equipment's interface moves to a round on the room if the owner adds that decision. It matches the draft below.

**4. `DECISIONS.md`.** History lines dated 2026-11-10, in the record's voice:

- “What the architects' panel sees, and when”: the brief was revised after the independent review the owner asked for. The settled roles go to the panel in the setting unless the owner says they bind every design. An open question goes to the panel as its “What it decides” paragraph only. Each architect lists the decisions before seeing the agenda (the agent's call). The setting gains the secure connection. The failures each architect answers include the kit's whole network. The blind folder leaves out the requirements' notes on today's engine.
- “Design top-down, hardest-to-reverse choices first”: the six keep their titles and order. Four say more in "What it decides" (the first, the protocol's form, extension in two parts, separate copies), and the last gains the scanners during the fallback events. A seventh, “How the engine drives the room”, is proposed and put to the owner under “What the panel gets in its blind round”. Each architect is asked whether the first and third are one decision.
- “The nine questions the pass answers”: “How the engine reads its programs” is placed under the first decision until the owner answers on the seventh.
- “The role question starts from settled roles”: goes to the panel as ALN's facts, in the setting, unless the owner says otherwise.
- The owner's request for the review, dated 2026-11-09, in the words `CURRENT-STATE.md` holds.

**5. The script that builds the panel's folder (not written yet).** It must: leave out every `today` key of both requirements files in the blind round and give them back in the second; write each open question as its “What it decides” paragraph only; put the settled roles under the setting, not under the binding decisions; put a confirmed reading with the owner's decisions and take a refused one out; turn each marker in a requirement's text into its title.

**6. `report/2026-10-31-engine-jobs.json`, the change promise.** Its "need" still ends with swapping back by replugging a machine (line 702). The front page's line for release day now says "a release that fails can be undone before the next game, at the first swap by replugging the old machine", after the reworded target. The two should agree; the promise's wording is the agent's call.

**7. `report/site_smoke.js`.** Its list of the change log's sections (line 34) needs the new table's id if the builder adds one.

**8. The message to the owner.** The merged report's part 3, item 2 (the order of the rounds is likely to change) is now also on Design, under the first decision, and in the change log.

## R7: the full draft of the seventh decision, for later

To add as a new entry of `design.json` `ahead` after “Where authority lives across devices, offline and standalone included”, only if the owner says yes under “What the panel gets in its blind round”.

- `slug`: `how-the-engine-drives-the-room`
- `title`: "How the engine drives the room"
- `decides`: "How the engine starts, watches and restarts the outside programs: video, music, sound, speakers, lights and the TV's browser. Which of them is the authority for what it alone knows, and how the engine learns it. How a cue runs, and what happens to a running cue, a queued video or a held item at a pause, a failure, a restart and the end of a game. What the GM sees and can press when a program is slow, wrong or gone."
- `drivers`: "The promises [[promise:J4]] and [[promise:J9]]. The quality targets [[qt:QT2]], [[qt:QT6]], [[qt:QT15]], [[qt:QT23]] and [[qt:QT44]]. The extension cases [[ex:EX6]], [[ex:EX15]] and [[ex:EX26]]." (The outside check lists QT2, QT6, QT23, QT44 and the three cases. QT15, “Every red row carries its own actions”, is from the design review's list for the same decision.)
- `settled`: "An outside program can be an authority ([[dec:four-words-for-the-game-s-live-facts]]). The engine starts each program itself or uses one already running (“[[qt:QT23]]”). One of the nine questions the pass answers is this decision's own: “How the engine reads its programs” ([[dec:the-nine-questions-the-pass-answers]]). A failed outside program is one of the failures every architect must answer ([[dec:no-technical-failure-stops-a-game]])."
- `panel`: "The panel brings two or three ways of driving the room side by side, tested against the requirements, each with what moving today's engine to it would cost, and against these situations: [[flaw:C3]], [[flaw:C10]] and [[flaw:C2]]. Your second example, audio in several rooms, is the working example: each design says what a new program must offer to be driven like the others, and how a stand-in takes a program's place in a rehearsal or a test."

What changes with it, in the same step:

- `design.json` `ahead[0].decides` loses the sentence that starts "The state of the room is part of it". `ahead[0].settled` goes back to five questions. `ahead[0].drivers` loses the promise J4 and QT2, QT15 and QT44 (QT44 may stay in both, since it covers every failure).
- `[[flaw:C3]]` and `[[flaw:C10]]` leave `ahead[3].panel`; `[[flaw:C2]]` may stay under the protocol's form as well.
- `front.json` `intros.design[1]`: the list of decisions gains "how the engine drives the room" after authority, and the sentence "A seventh ... is proposed" goes.
- `design.json` `panel.sections[1].items[4]`: the lead becomes "The seven decisions ahead, as the agenda" and its last sentence goes. The brief: the same, with the seventh in the list.
- `decisions.json`: a seventh entry in `designRounds`; `later[4]` (the equipment's interface) names the new round; "six" becomes "seven" in question I and in the call “Each architect lists the decisions before seeing the agenda”.
- `DECISIONS.md`, “Design top-down, hardest-to-reverse choices first”: the list and a history line with the owner's answer in the owner's words.
- The evidence for it, as question I gives it: about four lines in ten of the program on today's show machine do this work; none of the six decides it; one of the nine questions has no decision of its own.

## Verification

- `design.json` and `changes.json`: `json.loads`, then `json.dumps(indent=2, ensure_ascii=False)` plus a newline equals the file. `front.json` parses; it was edited as text and parsed after each of its changes.
- `design.json` `later` is byte for byte what it was before this run.
- A field-by-field comparison with the three files as they stood before this run: only the fields in the tables above differ.
- A trial build in memory, with the builder as it stands, the other writers' files as they stand and stand-ins for the diagrams: every page renders, every marker in every source resolves (the new links to `decisions#q-a` to `q-i`, `decisions#readings`, `design#panel` and the three call markers among them), and every check of the builder passes. The one failure reported is the trial's own page title, which the real build sets. The front page counts 2,609 words.
- Every quality target now drives a decision or is one of the four named as checks on every design; every extension case drives a decision.
- No em dash and no model or vendor name in any of the four files. "No engine" is left only in the change log, as history, and in `design.json` `later`, which R8 leaves alone.
