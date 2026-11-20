# Version 11 verify: the apply round, row by row (2026-11-10)

Written for the agent running the pass. Read only. Nothing but this file was written.

## Scope

I read `v11-apply-log.md` and every row of the four checks of version 11 (`v11-check-decisions.md`, 17 rows; `v11-check-requirements.md`, 13 rows; `v11-check-design.md`, 16 rows and one item below its table; `v11-check-record.md`, 16 rows). For each row I read the changed words where they land: on the rebuilt pages as text (`v11text/*.md`), in the built `report/site/*.html`, and in the record, the brief and the promise data's markdown twin. To see every line the apply round touched, I compared each source with its copy from before the round (`scratchpad/v11apply/before`), string by string for the JSON files and line by line for `DECISIONS.md`, the brief, the twin, `front.json` and `build_site.py`. I then read each changed string in its place and against the sentences around it. I checked the new or reworded facts about today's engine in the code and the guide, the counts against the data, every internal link on the six built pages, and the front page's word count with the builder's own function. I did not run the build or the smoke test, because both write files.

Result: of 62 rows, 58 are resolved, 1 is partly resolved and 3 are unresolved (the three the apply log lists as not applied). The item below the Design check's table is met. I found 11 slips the apply round made and 2 things it left that no row names. All are low. None is a wrong fact about today's engine, a wrong count, a wrong letter or a changed quote of the owner.

Field names are from `report/site/v9/decisions.json` unless a file is named. Paths are under `docs/plans/architecture-pass/`.

## Verdict on each row

### The Decisions check

| Row | Verdict | Read where it lands |
|---|---|---|
| 1 | Resolved | Question I's sixth bullet says what a yes and a no do to the room, and agrees with Design's introduction and first decision. The brief still gives the old reason: conflict 5. |
| 2 | Resolved | The introduction's fourth paragraph marks the sentence as the agent's reading and offers both ways to overrule it. The answer sheet has no line for it: conflict 15. |
| 3 | Resolved | The line for “A release can be undone before the next game” gives an order of size, in the form of the other lines. The target's number says the same. |
| 4 | Resolved | "Three readings of your words", with the show machine first. It matches the Decided entry and the readings list. |
| 5 | Resolved | The apply round's own wording. It is the target's own last sentence ("No game ever has some devices on a show machine and some alone"), it credits the decision with nothing the decision does not say, and it sends the open part to “Which standalone games the engine must run” by its exact title. |
| 6 | Resolved | "So the GMs call the phases and the end themselves". True in the code: `ALNScanner/src/ui/renderers/SessionRenderer.js`, `renderGameClock`, goes on counting from the last value sent. |
| 7 | Resolved | The bullet names sound and the cues and phases on the clock. The first option's list under it still leaves sound out: conflict 8. |
| 8 | Resolved | The bullet and the second option now say the same. The change log's last item still gives one of the two ways: conflict 9. |
| 9 | Resolved | "as one", "inside a requirement's test", and "Three more are named in a requirement". I counted from the data: the readings on player scanners alone, on who declares the game and on staying networked are named in “A standalone game is normal, never a fault”, “No game mixes networked and standalone devices” and “A game with no show machine”. The fifth is in none. Three is right. |
| 10 | Resolved | The sentence appears once, in the seventh bullet, with the rule and the link. |
| 11 | Resolved | The three sentences are in. One of them uses a figure of speech: conflict 7. |
| 12 | Resolved | "and still be accepted, in months". The answer sheet agrees. |
| 13 | Resolved | "a rule such as “only for a token in this group”". |
| 14 | Resolved | The sheet's line D ends with the form the agent's recommendation takes. |
| 15 | Resolved | "the override that rule allows", as the record has it. |
| 16 | Resolved | "swap points" is gone from every page. |
| 17 | Resolved | The target's status asks what question B asks. |

### The Requirements check

| Row | Verdict | Read where it lands |
|---|---|---|
| 1 | Resolved | Requirements and the front page word the change promise the same way. The twin's goal follows, with a dated note. The change log does not mention it: conflict 14. |
| 2 | Partly | The promise's "What they count on" and its fourth test are right on Requirements, and the twin's fourth test follows. The same statement stays in the promise data's `roles` and in the twin's "Who relies on it", so the twin now disagrees with its own note of 2026-11-10: conflict 4. |
| 3 | Resolved | The owner's words are quoted exactly, checked against comment 2. |
| 4 | Resolved | "The game needs the show machine by nature and its pack says so." Both places on Decisions that cite the case now land on a sentence that says the same. |
| 5 | Resolved | See Decisions row 3. |
| 6 | Resolved | The line sorts the keeping time as a production's setting and the shipped default as a technical default, as the target does. The value and "the agent proposes" agree in both (R5). |
| 7 | Resolved | The situation reads whole without the fact, and the note under “Today” is true: the hardware scanner has no standalone mode. The data holds 21 notes, on 14 targets and 7 cases, and the change log says twenty-one. |
| 8 | Resolved | Both cells of the comparison table say "no show machine". |
| 9 | Unresolved | Not applied, for a sound reason: the words stand in places the row does not name. It is the lead's choice: conflict 2. |
| 10 | Resolved | The second way. The data gives 22 settled, 19 partly settled and 6 proposed. Decisions says twenty-two and twenty-five, the change log lists six targets and one case, and the record says 22 and 25 with the reason. I checked all seven against the data at 9f7f8a31: each was settled there. |
| 11 | Resolved | The case's "Why" no longer states one body of rules as a fact. |
| 12 | Resolved | All three. The page drops a note's leading "Today", so the notes read "At a show, ..." and "A developer studies a fault ..." under the tag. |
| 13 | Unresolved | Not applied: the words are in `report/2026-11-01-engine-shape.json`, which the writers do not own. It shows on Design: conflict 1. |

### The Design check

| Row | Verdict | Read where it lands |
|---|---|---|
| 1 | Resolved | The first of the row's two ways. The brief, Design (three places), the change log and the record all say which parts of a promise the blind folder holds. I read every promise's people, moment, need and goal: none states a fact about today's engine. Two small things follow from the choice: conflicts 10 and 11. |
| 2 | Resolved | "became the decisions that head Decided lately". |
| 3 | Resolved | "It runs on the show machine or on a device." |
| 4 | Resolved | The sentence is in the entry “The engine”, outside the counted words. Its first example is a near copy of a question's title, in quotes: conflict 6. |
| 5 | Resolved | The key and both labels of the picture say "updates the engine". I looked at the apply round's two pictures: both labels fit their boxes. The front page counts 2,610 words by the builder's own function, which I ran on the built page. |
| 6 | Resolved | "the panel's blind round does not get it, and the second round does." |
| 7 | Resolved | "five say more", with the sentence on the last decision. |
| 8 | Resolved | "Four facts came out of the review", and the copy kept off the memory card. True: `DEPLOYMENT_GUIDE.md`, "Backups & pack rollback", and `backend/src/services/persistenceService.js`, `backupSession`. |
| 9 | Unresolved | Not applied: the same file as requirements row 13. Conflict 1. |
| 10 | Resolved | No line of the brief is over 72 characters. |
| 11 | Resolved | Both calls carry their exact titles in the brief. |
| 12 | Resolved | The three wordings are in, and the three internal phrases are gone. |
| 13 | Resolved | The call's reason says "run on the same model", and names no model. |
| 14 | Resolved | One wording, the same string in `decisions.json` and `design.json`. The link lands on the readings from both pages. The fifteen later choices are still text for text identical (R8). |
| 15 | Resolved | "The first round and this one". It agrees with the introduction and question B on Decisions. |
| 16 | Resolved | One "and". |
| Item below the table | Met | By requirements row 1. |

### The record check

| Row | Verdict | Read where it lands |
|---|---|---|
| 1 | Resolved | "Still open" lists the five readings as one numbered list in the page's order, each with its decision. I compared it with the page: the order is the same. |
| 2 | Resolved | See Decisions row 2. |
| 3 | Resolved | The second reading is said to be read from how ALN runs today, not from the owner's words. |
| 4 | Resolved | "Two of those three rows" in the record's three places and in the change log. The added words "is new" are loose: conflict 13. |
| 5 | Resolved | The call's exact title in both places of the change log. No page says “The tap promise is split in two” any more. |
| 6 | Resolved | See Design row 14. |
| 7 | Resolved | The Decided entry carries both halves of the reading. |
| 8 | Resolved | See Decisions row 4. |
| 9 | Resolved | See Decisions row 9. |
| 10 | Resolved | See Decisions row 5. |
| 11 | Resolved | "as this page uses the words". Nothing credits the owner with the definition. |
| 12 | Resolved | The sentence is in the change log's row G, as plain text, and in the record's first line of 2026-11-10 under the standalone entry. |
| 13 | Resolved | True: the title is in row 24 of the record's table of old numbers, which points to question H. |
| 14 | Resolved | See requirements row 3. |
| 15 | Resolved | The five changes to the calls are in the dated line, in the row's words. |
| 16 | Resolved | The line says the agent added to what the decisions decide, and that the owner can overrule it. |

## Conflicts

Rows 1 and 2 are the unresolved rows. Row 3 is left by the apply round and named in its log. Row 4 is the partly resolved row. Rows 5 to 15 are slips of the apply round. Row 16 is the logs. All are low.

| No. | Page | The exact words | Why it is wrong | The exact replacement | The exact place |
|---|---|---|---|---|---|
| 1 | Design, the earlier candidate (the table of qualities and the part “Venue fit”) | "Who decides when there is no engine" (twice in one row), "the declared fact that a game runs with no engine", and "Nothing in the engine assumes ALN, one kit, one pack or one production." | Unresolved (requirements row 13, Design row 9). The change log's word list tells the owner that the pages say “No show machine” from version 11 "where the pages said a standalone game runs with “no engine”". Design still says it three times. The fourth sentence states the one-kit rule without its bound, which six other places now carry. The file is not among the writers' files, so the lead applies it. | "Who decides when there is no show machine"; "Every design choice says who decides when there is no show machine, and a standalone game is a declared fact, never mixed." (the rest of the sentence stays); "the declared fact that a game runs with no show machine."; "Nothing in the engine assumes ALN, or one kit, one pack or one production where avoiding it costs little." | `report/2026-11-01-engine-shape.json`: `qualities[3].name`, `qualities[3].plain`, `parts[11].plain`, `qualities[2].plain`. Five more places in the file say "no engine" and show on no page (`functional[7].people`, `mechanisms[10].plain`, `questionNotes[6].note`, `ownerChoices[2]`, a label in `relationsMermaid`); change them in the same step if the file goes into the second round's folder. |
| 2 | Today's engine, the line "In a standalone game" on the cards (thirteen standalone lines); also Decisions and Design, the later choice “The standalone tablet” | "an engine of its own" (Today eleven times, Design four, Decisions once, the change log once), with "its own engine" and "an engine kept equal by tests" once each on Today | Unresolved (requirements row 9), and rightly not applied in part: the row named only the standalone lines. Under the word list, a tablet already runs the engine, so "keeps an engine of its own" reads as a second engine. What is meant is rules of its own. The new sentence in the entry “The engine” does not cover this use, because it speaks of the engine set beside a device, not held by one. | Either leave it and accept the two uses, or change it everywhere in one step: "rules of its own" for "an engine of its own", "with rules of its own" for "with its own engine", "or rules of its own kept equal by tests" for "or an engine kept equal by tests". | The apply log's item 1 lists every place: thirteen lines of `report/2026-10-31-standalone-lines.json`; `later[5].text` in `decisions.json` and `design.json`, kept identical; `design.json` `ahead[4].settled`; `standaloneCandidate` of the second and tenth promises in the promise data; `report/build_site.py`, line 398; and the table of alternatives in `report/2026-11-01-engine-shape.json`. |
| 3 | Design, "The panel's brief", "What is withheld, and how" | "and writes each open question of yours as its “What it decides” paragraph only. Each architect is told to read only its folder" | Left by the apply round and named in its log (item 9). The brief has a sentence between these two that Design's copy lacks, so the copy the owner reads on the site says less than the brief the owner approves. | Add after "paragraph only.": "Where a requirement's text points to another requirement, the script writes that requirement's title in its place." | `report/site/v9/design.json`, `panel.sections[4].paragraphs[1]` |
| 4 | The promise data and its twin, the ninth promise (no page shows either line) | "the audience, whose TV clock must not count on its own" | Partly resolved (requirements row 2). The row changed the need and the fourth test, because whether the clock stops is open for the owner's review. The same statement stays, flat, in the list of people. In the twin it now stands 25 lines above a test and under a note of 2026-11-10 that both say the opposite. If the folder script reads `roles`, the panel gets it as decided. | "the audience, whose TV clock must show when it is unconfirmed" | `report/2026-10-31-engine-jobs.json`, `jobs[8].roles[3]`; `2026-10-31-engine-jobs.md`, line 320, the last clause of "Who relies on it." |
| 5 | The panel's brief, "The owner's question, and the agent's calls", first paragraph | "about four lines in ten of the program on today's show machine drive the room, none of the six decides how, and one of the nine questions the pass answers, how the engine reads the programs it drives, had no decision of its own." | Slip. Decisions row 1 changed this reason on Decisions because Design now puts the room's state under the first decision. The brief was not changed with it, and its own next sentence says "the room's state stays part of the first decision". The owner approves the brief, and it now gives the reason the check called no longer true. | "about four lines in ten of the program on today's show machine drive the room. Until this version none of the six named it, and one of the nine questions the pass answers, how the engine reads the programs it drives, had no decision. The first decision now holds the room's state. If the owner says yes, the room gets a round of its own." Then the sentence that follows, unchanged: "If the owner says no, the list stays at six and the room's state stays part of the first decision." | `panel/2026-11-01-panel-brief.md`, lines 317 to 322, re-wrapped at 72 |
| 6 | Front page, "The words", “The engine” | "as in “a tablet cut off from the engine” or “the engine's edge”" | Slip, from Design row 4's own text. The first phrase in quotes is a near copy of the title “A GM tablet cut off from the engine”. The owner's rule is that a title in quotes is the title. | "Where a page sets the engine beside a device, as in the question “A GM tablet cut off from the engine” or in “the engine's edge”, it means the program on the show machine." | `report/site/v9/front.json`, `words[0].def`, last sentence. The words are outside the front page's count. |
| 7 | Decisions, question A, "What we need from you" | "because every wifi drop then holds the line" | Slip, from Decisions row 11's own text. "Holds the line" is a figure of speech with a second meaning, to stand firm. The same question says it plainly above: "the line waits". | "The agent does not put it forward, because every wifi drop then makes the teams wait." | `groups[0].questions[0].recommendation` |
| 8 | Decisions, question B, first option, "What it means" | "Video, music, lights, the TV and the cues on the clock are gone for the rest of the night." | Slip. Decisions row 7 added sound to the bullet above ("video, music, sound, lights, the TV, and the cues and phases that run on the game's clock"). The option under it lists the same effects without sound, so the two lists the row set out to make agree differ by one. | "Video, music, sound, lights, the TV and the cues on the clock are gone for the rest of the night." | `groups[0].questions[1].options[0].means` |
| 9 | Change log, version 11, last item | "not the TV, the sound or the lights, unless a GM moves them" | Slip. Decisions row 8 made question B say twice that they come back when a GM moves them or the kit connects them to both. The change log, which the round edited in the same item, still gives one way. | "not the TV, the sound or the lights, unless a GM moves them to it or the kit connects them to both" | `report/site/v9/changes.json`, `versions[0].items[11]` |
| 10 | The panel's brief, "The requirements"; Design, "The blind round"; the record's line of 2026-11-10 on the brief | "The other lists under a promise (where today's engine falls short, what a standalone game does today, what the planned capabilities need from it, the test situations taken from the shows) carry facts about today's engine and wait for the second round." | Slip, two points. "What a standalone game does today" is not a label on Requirements; the label is "In a standalone game", and it is one line, not a list. And a promise has two more lists, the targets and the cases that serve it. They carry no fact about today's engine, so "the other lists" says too much, and nothing says what becomes of them. | "The targets and cases that serve a promise name it themselves. The rest under a promise (where today's engine falls short, the line “In a standalone game”, what the planned capabilities need from it, the test situations from the shows) carries facts about today's engine and waits for the second round." | `panel/2026-11-01-panel-brief.md`, the item "The requirements", lines 84 to 88; `report/site/v9/design.json`, `panel.sections[1].items[1].text`, last sentence; `DECISIONS.md`, lines 1012 to 1016, with straight quotes |
| 11 | The panel's brief and Design, "What is withheld, and how" | "For the blind round the script leaves out the field “today” of every target and case and the lists under each promise that describe today's engine" | Slip. The promises' tests are now withheld from the blind round, and the targets still point to them. Thirteen statuses name "the promise's tests", and two numbers say "(from the promise's test)": “Crashed programs restart on their own” and “A tablet reconnects to the same facts”. An architect in the blind round reads a pointer to a text the folder does not hold. | Add after "writes that requirement's title in its place." in the brief, and after the sentence of row 3 on Design: "Where a target's status or number names a promise's test, the test itself waits for the second round." | `panel/2026-11-01-panel-brief.md`, the paragraph "How:"; `report/site/v9/design.json`, `panel.sections[4].paragraphs[1]`. The folder script, when written. |
| 12 | The record, “What the architects' panel sees, and when”, the last line of 2026-11-10 | "That is the agent's call on how the panel runs, made after the check of version 11, and the owner can overrule it." | Slip. The record's own rule is that the agent's calls are listed on the Decisions page, and "Still open" lists thirteen by title. This one is on no list, so a later reader counts fourteen. It is a detail of the brief, which the owner approves. | "That is a choice the agent made within the brief after the check of version 11. It is not one of the thirteen calls on the Decisions page. The owner approves or changes it with the brief." | `DECISIONS.md`, lines 1016 to 1017, re-wrapped at 72 |
| 13 | The record, “Standalone games: declared, never mixed”, the first line of 2026-11-10; the change log, version 11, the item on the calls | Record: "The third, the tablet's clock, is new." Change log: "the third, the tablet's clock, is new." | Slip, from record row 4's own text. Version 10's question “What a standalone game gives up, and what it keeps” named "the game clock with its phases" and said the clock has no reader on a standalone tablet. So the subject is not new. The proposal is. The row's own reason says the row "came from version 10's question". | Record: "The third, the tablet's clock, was a subject of version 10's question "What a standalone game gives up, and what it keeps" and is new as a proposal." Change log: "the third, the tablet's clock, was a subject of version 10's question on what a standalone game gives up and is new as a proposal." | `DECISIONS.md`, lines 389 to 390; `report/site/v9/changes.json`, `versions[0].items[6]`, last clause |
| 14 | Change log, version 11, the item "The requirements." | "Four titles changed." and what follows it | Slip. The apply round changed what two promises say under "What they count on" and one goal. The promises are offered to the owner for review, and the log of this version names no change to a promise. The twin has a dated note; the site has none. | Add at the end of the item: "Two promises changed with them. “[[promise:J10]]” now says a release that fails can be undone before the next game, and names replugging for the first swap only. “[[promise:J9]]” now says the TV's clock shows as unconfirmed while the engine is silent, and no longer says it never counts on its own; whether it stops counting is for your review." | `report/site/v9/changes.json`, `versions[0].items[7]` |
| 15 | Decisions, the answer sheet, line I | "Say so if you want the decisions given with no agenda, or the decision on settled roles to bind every design." | Slip. Decisions row 2 added an offer to the introduction: "Say so with the last question if an open question should stay out of the blind round, or if the panel should get the options as well." The sheet is the place that gives the exact form of each answer, and its line for the last question does not carry the offer. | "Say so if you want the decisions given with no agenda, the decision on settled roles to bind every design, an open question kept out of the blind round, or the agent's options given to the panel with it." | `answerSheet[8].form` |
| 16 | The build log | "23 settled", "18 partly settled", 20 notes under “Today”, 1,773 links, 2,609 words | Left by the apply round and named in its log (item 10). The figures are behind the build: 22, 19, 21, 1,775 and 2,610. No page shows them. | Add one line at the top: "Superseded on the counts by `checks/v11-apply-log.md`: 22 settled, 19 partly settled, 6 proposed; 21 notes under “Today”; 1,775 links; 2,610 words." | `report/site/v9/build-log-v11.md` |

## What is right

Read where it lands, with nothing wrong found.

**The apply log's own claims.**

- Every one of the 59 rows it calls applied is applied, at the place it names. I found each replacement on the text page and on the built page, and each replaced phrase gone from both. The two history lines that still hold old words ("can swap back by replugging a machine" in the change log's entry on an older version, "Your comments became five decisions" in version 10's entry) are history and were not in any row.
- Its counts hold against the data: 47 targets, 22 settled, 19 partly settled and 6 proposed; 28 cases, 22 settled and 6 partly settled; 21 notes under “Today”, on 14 targets and 7 cases; nine questions, five readings, thirteen calls, fifteen lines on the answer sheet, fifteen later choices.
- 1,775 internal links on the six built pages, none broken, by my own pass. All 57 links to a question land on `q-a` to `q-i` and carry that question's exact title. No marker is left unrendered on any page.
- The front page counts 2,610 words by the builder's `index_sentences_without`, under the limit of 2,625.
- The text copies in `v11text` match the built pages: every phrase I searched appears the same number of times in both.
- The six JSON files that round-trip still do, byte for byte. `front.json` parses, and its five changed strings are the only differences from the copy before the round.
- No em dash or en dash in any changed source or on any page. No model name, model id or vendor name in any changed string. The only hits for a vendor's name are older than this round and are not text a reader sees: a meta tag in the page head, the file name of the project's guide in the builder's comments, a branch name and the published address in the record.
- No question became a call and no call became a question. The readings stay at five: the sentence added to the introduction is marked as the agent's reading of one decision and is listed under neither the readings nor the calls, as R2 and R3 require.

**The pairs that got one wording.** Each reads the same in both places: the line and the number for “A release can be undone before the next game”; the three readings named under question B; the later choice on where “this game is standalone” is held, on Decisions and Design; the owner's exact words in the status of “The GMs know their fallbacks at a failure”; the readings' lead; and the record's and the change log's "two of the three".

**Decisions row 5, the apply round's own wording.** Sound. Both checks' replacements said who decides a game, which question B's first outcome and question H leave open. The sentence now uses the target's own words, the pointer to question H uses the exact title, and the next sentence no longer says "the two".

**Facts about today's engine in the changed strings.**

- A cut-off tablet goes on counting the clock from the last value it was sent (`ALNScanner/src/ui/renderers/SessionRenderer.js`, `renderGameClock`).
- The hardware scanner has no standalone mode (the project's guide: always networked, with an offline queue).
- The guide asks for a copy off the memory card after every event, and nothing checks or restores it (`DEPLOYMENT_GUIDE.md`, "Backups & pack rollback"); the engine's own backups sit on the same card (`backend/src/services/persistenceService.js`, `backupSession`).

**The owner's words.** “a device goes down mid-game”, “player scanners (phone or hardware)”, “gm and/or player scanners” and “the worst possible scenario” match `rework/2026-11-02-owner-comments.md`. The record's diff touches no quoted block. Every title the round wrote in quotes is an exact title, except the one in conflict 6.

**The record.** Every change is in a line dated 2026-11-10 or in "Still open", wrapped at 72, with straight quotes. The list of readings follows the page's order, so an answer of five yes or no lands on the right readings. The sentence on the target now marked partly settled says why and says it came from the check of version 11.

**The brief.** Wrapped at 72 throughout. The three internal phrases are gone, both calls carry their exact titles, and its statement of what the blind folder holds of a promise is the same as Design's, apart from conflicts 3, 10 and 11.

**The picture on the front page.** At 1,100 and at 400 pixels both new labels for the operator fit their boxes.

## Not done

I did not run the build or the smoke test. The apply log says both pass; my link check, the count of words and the comparison of the text copies with the built pages agree with what it reports.
