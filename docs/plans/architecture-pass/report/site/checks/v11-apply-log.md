# Version 11: the four checks applied (2026-11-10)

Written for the agent running the pass. It says what became of each row
of the four checks of version 11: `v11-check-decisions.md` (17 rows),
`v11-check-requirements.md` (13 rows), `v11-check-design.md` (16 rows and
one item below its table) and `v11-check-record.md` (16 rows).

## Result

- 62 rows. 59 applied, 3 not applied.
- Six rows of the record check and one of the requirements check name
  the same words as a row of another check. Each pair got one wording,
  given below.
- The site builds and the smoke test passes: 1,775 links resolve; 24
  loads, 24 screenshots, 124 section anchors followed. The front page
  counts 2,610 words in sentences, one more than before, under the limit
  of 2,625. The build prints its standing warning that this is over
  2,500.
- The text copies in `scratchpad/v11text` match this build.
- Nothing is committed or published. No question became a call and no
  call became a question. The counts of R4 stand: nine questions, five
  readings, thirteen calls, forty-seven targets, twenty-eight cases.
- Two counts moved, both because a row asked for it. The split of the
  targets is now 22 settled, 19 partly settled and 6 proposed
  (requirements row 10). The notes under “Today” are now 21, on 14
  targets and 7 cases (requirements row 7).

Paths are under `docs/plans/architecture-pass/`. “Decisions” is
`report/site/v9/decisions.json`. Scripts and backups of every source as
it stood before this step are in
`/tmp/claude-0/-home-user/5a982c73-3a26-5297-92bd-9dd1027a1b1a/scratchpad/v11apply`
(`apply_json.py`, `apply_record.py`, the folder `before`).

## The Decisions check

| Row | Result | What was done, and where |
|---|---|---|
| 1 | Applied | The bullet on the seventh decision now says what a yes and a no do to the room, in the check's words. `groups[3].questions[0].evidence[5]`. Design's introduction and first decision were read first; they say what the row says they say. |
| 2 | Applied, one wording for this row and record row 2 | Added after the sentence on a question the owner leaves: "That is the agent's reading of your decision on what the panel sees, which withholds the agent's recommendations. Say so with the last question if an open question should stay out of the blind round, or if the panel should get the options as well." The last clause is the record check's offer, so the owner can overrule in either direction. `intro[3]`. Not added to the readings, so five stands (R2). |
| 3 | Applied, one wording for this row and requirements row 5 | The line for “A release can be undone before the next game” now ends "No value yet: the agent proposes the same night, before the next game, as the order of size, which is what the target's title asks." It follows the form of the other lines. `review[1].numbers[14]`. The target's number says the same, in the form the target on fallbacks uses. QT42 `numberToSet`. |
| 4 | Applied, one wording for this row and record row 8 | "Three readings of your words go with this question ...: that a device going down includes the show machine, that the engine may not make a second machine a requirement, and that a game carrying on from its devices stays the networked game it was declared as." The middle clause uses the reading's own words, as the record check asks. `groups[0].questions[1].recommendation`. |
| 5 | Applied, in words of my own; see item 5 below | Both checks' replacements still said who decides a game, and question B's first outcome has tablets deciding a networked game. The line now says only what the decision says, in the target's own words: "a game is declared networked or standalone and never mixes the two, so no game ever has some devices on a show machine and some alone." Then the pointer to “Which standalone games the engine must run”. The next sentence said "the two"; it now says "the show machine and a tablet". `groups[0].intro[3]`. |
| 6 | Applied | "So the GMs call the phases and the end themselves unless the design gives a tablet the clock." `groups[0].questions[1].options[0].means`. Checked in `ALNScanner/src/ui/renderers/SessionRenderer.js` (`renderGameClock`): the tablet goes on counting from the last value it was sent. |
| 7 | Applied | The check's text. `groups[0].questions[1].evidence[3]`. |
| 8 | Applied | The check's text. `groups[0].questions[1].evidence[6]`. |
| 9 | Applied, with record row 9 | "A yes makes it your decision, and it goes to the panel as one." And the lead now says the reading is inside a requirement's test, and that three more are named in a requirement, each as a reading to confirm. I checked the three: the targets “A standalone game is normal, never a fault” and “No game mixes networked and standalone devices”, and the case “A game with no show machine”. `report/build_site.py`, `READINGS_LEAD`. |
| 10 | Applied | The repeated sentence is gone from the first bullet. The seventh bullet keeps it with the rule and the link. `groups[0].questions[0].evidence[0]`. |
| 11 | Applied | The three sentences on the first option, after "If no ...". `groups[0].questions[0].recommendation`. |
| 12 | Applied | The check's text. `groups[0].questions[2].recommendation`. |
| 13 | Applied | The check's text. `groups[0].questions[3].evidence[1]`. |
| 14 | Applied | "The agent's recommendation is “yes, later”." `answerSheet[3].form`. |
| 15 | Applied | "unless the GM types the override that rule allows". `calls[3].call`. |
| 16 | Applied | The check's text in place of "swap points". `groups[0].questions[4].recommendation`. |
| 17 | Applied | The last sentence of the status of “The GMs know their fallbacks at a failure” now asks what question B asks. QT44 `status`. |

## The Requirements check

| Row | Result | What was done, and where |
|---|---|---|
| 1 | Applied | The change promise: "and a release that fails can be undone before the next game, at the first swap by replugging the old machine", and its goal ends "and can take a version back; at the first swap that is done by replugging the old machine." `report/2026-10-31-engine-jobs.json`, the tenth promise, `functional.need` and `goal`. The markdown twin's goal says the same, with a sentence added to its note of 2026-11-10. This also meets the item below the Design check's table. |
| 2 | Applied | "the TV's clock shows as unconfirmed while the engine is silent", and the fourth test ends "as unconfirmed." The ninth promise, `functional.need` and `tests[3]`. The twin's fourth test follows. |
| 3 | Applied, with record row 14 | "That your words “a device goes down mid-game” include the show machine itself ...". Checked against comment 2 of the owner's comments. QT44 `status`. |
| 4 | Applied | "The game needs the show machine by nature and its pack says so." EX20 `case`. |
| 5 | Applied | See Decisions row 3. |
| 6 | Applied | The check's text: the keeping time is a production's setting, the shipped default is a technical default, 90 days as the agent's proposal. `review[1].numbers[9]`. |
| 7 | Applied | The situation says "so a hardware scanner that plays a standalone game is parity with the phone, not a new feature." New QT39 `today`: "Today the hardware scanner has no standalone mode." True: the project's guide lists the hardware scanner as always networked. The change log says "twenty-one places". `changes.json`, `versions[0].items[8]`. |
| 8 | Applied | The two cells now say "no show machine". `report/build_site.py`, `PARITY_WORDS`, rows 1 and 3. |
| 9 | Not applied | The row changes "an engine of its own" to "rules of its own" in thirteen standalone lines. The same words stand in places the row does not name: the later choice “The standalone tablet” on Decisions and Design, the decision ahead on separate copies, two promises' lines for the earlier candidate, one line the builder holds, and the candidate's table of alternatives, which is in a file outside this task. Changing Today's engine alone would make the pages disagree. The check calls it your choice. Design row 4, applied, now tells the reader that “the engine” beside a device means the program on the show machine, which covers this use. See item 1 below. |
| 10 | Applied, the second of the row's two ways; see item 3 below | QT38 `statusKind` is "partly settled". Its status already said "Open for you". The reading path on Decisions reads "Twenty-two of the forty-seven ... Twenty-five are proposed or partly settled" (`review[1].what`). The change log lists six targets and one case, with this target among them (`versions[0].items[7]`). The record says 22 and 25, and a sentence in the standalone entry's last line of 2026-11-10 says why. The build checks both counts against the data and passes. |
| 11 | Applied | The check's text. EX4 `why`. |
| 12 | Applied | All three. QT17 `today`, QT47 `today`, EX12 `who`. The page drops a note's leading "Today", so the first reads "At a show, ..." under its tag. |
| 13 | Not applied | The words are in `report/2026-11-01-engine-shape.json`, which is not among the files this task may edit. See item 2 below. |

## The Design check

| Row | Result | What was done, and where |
|---|---|---|
| 1 | Applied, the first of the row's two ways; see item 4 below | The brief and Design now say which parts of a promise the blind folder holds: who counts on it and when, what they count on and the long-term goal. The other lists under a promise wait for the second round. I added "what a standalone game does today" to the row's list, because that line also states today's behaviour. I checked the promise data: no promise's people, moment, need or goal uses the word "today"; the lists of needs and tests of seven promises do. Changed: the brief (the item "The requirements", the second round's first item, both paragraphs of "What is withheld, and how"); `design.json`, `panel.sections[1].items[1].text`, `panel.sections[2].items[0].text`, `panel.sections[4].paragraphs[0]` and `[1]`; one sentence in the change log's item on the brief; one sentence in the record's line of 2026-11-10 on the brief, marked as the agent's call. |
| 2 | Applied | "became the decisions that head Decided lately". `front.json`, `timeline.done[4].text`. |
| 3 | Applied | "It runs on the show machine or on a device." `front.json`, `words[18].def`. |
| 4 | Applied; the row leaves it to you | The sentence was added to the entry “The engine”. It explains a word the pages use two ways, and the words are outside the front page's count. `front.json`, `words[0].def`. |
| 5 | Applied | "picks one and updates the engine" in `front.json`, `worldKey`. The picture's labels read "packs; updates the engine between events" and "updates the engine" (`report/build_site.py`, `WORLD_PEOPLE`). I looked at the picture at 1,100 and 400 pixels: both labels fit their boxes. |
| 6 | Applied | "the panel's blind round does not get it, and the second round does." `front.json`, `intros.requirements[1]`. |
| 7 | Applied | "five say more", and the sentence on the last decision. `changes.json`, `versions[0].items[9]`. |
| 8 | Applied | "Four facts came out of the review ...", and the sentence on the copy kept off the memory card. Checked in `DEPLOYMENT_GUIDE.md` (the section on backups) and `backend/src/services/persistenceService.js` (`backupSession`). `changes.json`, `versions[0].items[11]`. |
| 9 | Not applied | The words are in `report/2026-11-01-engine-shape.json`, outside this task's files. See item 2 below. |
| 10 | Applied | The paragraph "How:" is re-wrapped at 72. No line of the brief is over 72 characters. |
| 11 | Applied | "**The panel's three lenses**" and "**The second round reads today's code**". |
| 12 | Applied | The three wordings, as the row gives them. |
| 13 | Applied | "The three architects run on the same model and read the same folder and the same agenda". It names no model (R9). `calls`, “The panel's three lenses”, `why`. |
| 14 | Applied, one wording for this row and record row 6 | "waits on a reading you are asked to confirm, on who says which way tonight's game runs ([[page:decisions#readings\|the readings to confirm]])". It reads the same on both pages, and the link lands on the readings. `later[0].text` in `decisions.json` and `design.json`; the fifteen texts are still identical (R8). |
| 15 | Applied | "The first round and this one put the ways to build it in front of you". `design.json`, `ahead[2].decides`. |
| 16 | Applied | One "and" removed. `report/build_site.py`, the change log's footer. |
| Item below the table | Met | By requirements row 1. |

## The record check

Every change to the record is re-wrapped at 72. The owner's quoted words
are untouched.

| Row | Result | What was done, and where |
|---|---|---|
| 1 | Applied | "Still open" lists the five readings as one numbered list in the page's order, each with the decision it is read from. |
| 2 | Applied | See Decisions row 2. |
| 3 | Applied | "Two readings by the agent follow ... The first is read from the owner's words ... The second is read from how ALN runs today, not from the owner's words". The body of “Standalone games: declared, never mixed”. |
| 4 | Applied | "Two of those three rows, the video token and the public view ... The third, the tablet's clock, is new", in the entry's first line of 2026-11-10; "two of the three proposals" in "Still open" and in row 25 of the table of old numbers; and in the change log's entry (`versions[0].items[6]`). Checked against version 10's page: its call held the public view and the video token, and nothing on the clock. |
| 5 | Applied | The call's exact title, “The tap promise is to be split in two”. `changes.json`, `numbers[49].where` and `promises[2].changes[0]`. |
| 6 | Applied | See Design row 14. |
| 7 | Applied | Both halves of the reading. `decided[2].entries[5].line`. |
| 8 | Applied | See Decisions row 4. |
| 9 | Applied | See Decisions row 9. |
| 10 | Applied | See Decisions row 5. |
| 11 | Applied | "that computer is the game's show machine. The game is then a networked game on other hardware, as this page uses the words." `groups[1].questions[0].evidence[7]`. |
| 12 | Applied | The sentence on what "standalone" means, in the change log's row G (`lettersV10[6].where`, plain text) and in the record's first line of 2026-11-10 under the standalone entry. |
| 13 | Applied | "The decision record keeps the older question “One GM tablet per standalone game?” in its table of old numbers, which points to this question". `groups[1].questions[0].evidence[0]`. |
| 14 | Applied | See requirements row 3. |
| 15 | Applied | The five changes to the calls, added to the line of 2026-11-10 under “The Decisions page holds only your decisions”, in the row's words. |
| 16 | Applied | "The agent added passes ... The owner can overrule any of it." and "The agent also set the decision ... in two parts". The line of 2026-11-10 under “Design top-down, hardest-to-reverse choices first”. |

## Files changed

- `report/site/v9/decisions.json`, `design.json`, `changes.json`,
  `front.json` (five strings, edited as text; it still parses)
- `requirements/2026-11-01-quality-targets.json` (QT17, QT38, QT39, QT42,
  QT44, QT47) and `2026-11-01-extension-cases.json` (EX4, EX12, EX20)
- `report/2026-10-31-engine-jobs.json` (the ninth and tenth promises) and
  its twin `2026-10-31-engine-jobs.md`
- `DECISIONS.md`, `panel/2026-11-01-panel-brief.md`
- `report/build_site.py` (four places), and the six built pages
- Not changed: `report/2026-10-31-standalone-lines.json`, the cards,
  `report/site_smoke.js`

## For the agent running the pass

1. **Requirements row 9, "an engine of its own".** Not applied. If you
   want "rules of its own", change it everywhere in one step: the
   thirteen standalone lines the row names; the later choice “The
   standalone tablet” in `decisions.json` and `design.json`
   (`later[5].text`, kept identical); `design.json`
   `ahead[4].settled`; the lines for the earlier candidate in the
   promise data (`standaloneCandidate` of the second and tenth
   promises); one line the builder holds itself
   (`report/build_site.py`, line 398, "The other way is an engine of its
   own, kept equal by tests"); and the candidate's table of alternatives
   in `report/2026-11-01-engine-shape.json`.
2. **Requirements row 13 and Design row 9, the earlier candidate's
   data.** `report/2026-11-01-engine-shape.json` was not among this
   task's files, and the build log already holds it for you. The
   changes that show on Design: `qualities[2].plain`, "Nothing in the
   engine assumes ALN, or one kit, one pack or one production where
   avoiding it costs little." (the check counts this as line 146);
   `qualities[3].name`, "Who decides when there is no show machine",
   with "no show machine" in `qualities[3].plain`; and one place neither
   check names, `parts[11].plain`, which ends "the declared fact that a
   game runs with no engine" and shows in the candidate's list of parts.
   Five more places in the file say "no engine" and show on no page:
   `functional[7].people`, `mechanisms[10].plain`,
   `questionNotes[6].note`, `ownerChoices[2]` and a label in
   `relationsMermaid`. The builder checks nothing against these words.
3. **Requirements row 10, the target “No game mixes networked and
   standalone devices”.** The row offered two ways and I took "partly
   settled", because it is the same case as the two targets item 5 of
   (c) moved. To undo it: QT38 `statusKind` back to "settled"; "Twenty-
   three" and "Twenty-four" in `decisions.json` `review[1].what`; "Five
   targets" and the list without this target in `changes.json`
   `versions[0].items[7]`; "23 settled and 24" in the record's "Still
   open"; and the last sentences of the record's line of 2026-11-10 that
   starts "The reading on who decides which way tonight's game runs".
   The build fails if the two counts on Decisions disagree with the
   data.
4. **Design row 1, what the blind folder holds of each promise.** I
   applied the first way: the folder holds who and when, what they count
   on and the goal, and the other lists wait for the second round. That
   keeps the test situations from the shows out of the blind round. The
   row's other way keeps them in: move each sentence on today's engine
   in the promise data into a field of its own, as R6 did for targets
   and cases. The brief, Design, the change log and the record now state
   the first way, and the record marks it as your call. The folder
   script, when written, must follow whichever stands. One more place
   holds a statement on the TV's clock: the old `roles` list of the
   ninth promise ("the audience, whose TV clock must not count on its
   own") in the promise data and its twin. No page shows it. If the
   folder script reads `roles`, reword it as requirements row 2 does.
5. **Decisions row 5, my own wording.** The sentence in the first
   group's introduction is neither check's text. Both said who decides a
   game, which question B's first outcome and question H leave open. If
   you prefer one of the two, they are in Decisions row 5 and record
   row 10.
6. **Decisions row 3, the order of size for going back.** "The same
   night, before the next game" is now on Decisions and in the target as
   the agent's proposal. The check says you may prefer another.
7. **Decisions row 2.** The added sentence invites the owner to overrule
   in either direction: keep an open question out of the blind round, or
   give the panel the options as well. The record already files the
   point as your reading.
8. **The record, two sentences in my words.** The sentence on the target
   marked partly settled (item 3) and the sentence on the promise's
   lists in the line on the brief (item 4). Both are dated 2026-11-10
   and say they follow the check of version 11.
9. **One difference between the brief and its copy on Design that no row
   names.** The brief says "Where a requirement's text points to another
   requirement, the script writes that requirement's title in its
   place." Design's "What is withheld, and how" does not.
10. **Logs now behind.** `report/site/v9/build-log-v11.md` still gives
    23 settled and 18 partly settled, 20 notes under “Today”, 1,773
    links and 2,609 words. This log has the new figures. The writers'
    logs were left as they were.
11. **Not done here.** Publishing, the state page
    `docs/plans/CURRENT-STATE.md`, and a commit.
