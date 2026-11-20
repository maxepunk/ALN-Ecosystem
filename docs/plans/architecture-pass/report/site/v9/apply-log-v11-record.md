# Apply log, version 11: `DECISIONS.md`

Written 2026-11-10 for the agent running the pass. A working file, so it calls the owner "the owner".

## What this run did

It applied to `docs/plans/architecture-pass/DECISIONS.md`, and to no other file, every change of the merged
report `site/checks/v10-review.md` that lands in the record, under rulings R1 to R10. The record went from 1,236
to 1,533 lines. No entry title changed, so every `[[dec:slug]]` marker on the site still resolves. The builder
does not read the record.

The edits were made by one script with exact, counted replacements, kept in the session's scratchpad:
`/tmp/claude-0/-home-user/5a982c73-3a26-5297-92bd-9dd1027a1b1a/scratchpad/v11rec/apply.py`. Version 10's record
is beside it as `DECISIONS.v10.md`, for a diff.

No line says version 11 is published. The entry "The owner's site: five linked pages" is untouched; add the
publication line there after publishing.

## Changes, by item of the merged report

Line numbers are the record's new ones.

| Item | Where in the record | What changed |
|---|---|---|
| (b) reading removed (A2-M3) | "No technical failure stops a game", body and history | The reading that a GM tablet which loses the engine keeps taking scans is out of the body. One sentence says it is the owner's question "A GM tablet cut off from the engine". The 2026-11-02 history line now names the two readings recorded that day, so the old wording is not lost. A 2026-11-10 line says why the first left. |
| (b) reading reworded | same entry | "The owner's words "a device goes down mid-game" include the show machine itself". The quote follows the owner's words, as the decisions writer's log found, not the report's "A device that goes down mid-game". |
| (b) two new readings on the failed show machine (B-4, D-M4, O3) | same entry | The game stays the networked game it was declared as. The engine may not make a second machine a requirement, and a game that needs the show machine by its nature may end in an orderly way. Both marked to be confirmed. |
| (b) reading kept, new tail | "Standalone games: declared, never mixed", body | "This one reading covers GM scanners alone, player scanners alone, and both together." |
| (b) new reading on who decides which way tonight's game runs (A2-H4) | same entry, body and a 2026-11-10 line | Marked to be confirmed. "Where the fact is held" no longer lists the pack as an option; it says the pack waits on this reading, as `later[0]` does. |
| (b) call "Four readings of earlier decisions are confirmed" (D-H3) | "The nine questions the pass answers", body and a 2026-11-10 line; "Read as overtaken, confirmed as the agent's call", lead and second bullet | The four questions on the game's live facts all bear on the first decision and are designed together there. The 2026-11-02 history line keeps its words, and the new line says they were corrected. |
| (b) "which would amend this decision" (O3) | "Still open", question B | The clause is gone. The re-declaration is now the reading above. |
| (c) item 9 (design check V-4) | "Standalone games: declared, never mixed", first sentence | "run with no engine" is now "run with no show machine". The owner's quote is unchanged. A 2026-11-10 line gives the reason. |
| a5, a6 (H removed) | same entry, body and a 2026-11-10 line | The question left the page. The call "A standalone game follows the rule you ratified for missing equipment" is in the body, marked as the agent's call. The history line says where the rule, the ask on the record and the list went, and that the call "Exposed evidence and video with no engine" is deleted. The 2026-11-02 line is put in the past tense. |
| a7 (I removed) | "The engine is hardware-flexible; the roadmap sets the bounds", body and a 2026-11-10 line | The call "The design allows other hardware; what the first release requires comes with the build plan" is in the body. The history line says the question left and what one line is still asked. |
| a8 (an open question goes to the panel as its "What it decides" paragraph only) | "What the architects' panel sees, and when", first 2026-11-10 line | Written as the agent's reading of the decision's rule that the agent's recommendations are withheld, which the owner can overrule. It also says what happens to a reading that is confirmed, refused or left. |
| O6, A2-L4 (staging the agenda) | same entry, second 2026-11-10 line | The agent's call "Each architect lists the decisions before seeing the agenda". |
| a8 (what the panel waits for) | same entry, third 2026-11-10 line; "Still open" | Three things: the answer to the panel question, "reviewed", approval of the brief. |
| "Still open", R1 to R4 | the whole section, lines 1244 to 1424 | Nine questions by group, letter and title, each with what it asks and its mark. No hardware question. The block on what the panel waits for. Five readings. The three small facts. The reviews with their counts. Thirteen calls by title. Where the four calls that left went. Fifteen later choices. |
| e7 (tables of old numbers) | "Decisions 1 to 36", rows 18, 24, 25; "The owner site's questions", rows E, F, G | Row 25 points to the three proposals and to the new call. Rows 18, E, F and G point to "Three choices about how the promises are worded". Row 24 says the question is lettered H on version 11. |
| e7 (version 10's letters) | after the site-questions table | One paragraph: version 10's ten letters, version 11's nine, where H and I went, and the change log's table "Where version 10's ten questions went". |

## Changes I made that the report does not list for the record

Each is a dated history line of 2026-11-10 and changes no decision. Strike any you do not want.

1. "The role question starts from settled roles". The panel question now says this decision goes to the panel in
   the setting, as ALN's facts, and is left out of the binding list unless the owner says otherwise (a11). A
   reader of the entry should meet that there.
2. "The engine says what is fixed and what each production sets". The call on the numbers gained two sentences,
   three calls on defaults moved into the numbers list, and the agent proposes 90 days as the shipped default
   for kept data (R5).
3. "Design top-down, hardest-to-reverse choices first". Four subjects had no decision. The six titles stand. A
   seventh decision is proposed inside the panel question (R7). Each architect is asked whether they would merge
   or reorder (d1 to d5).
4. "The Decisions page holds only your decisions". The owner asked for the review on 2026-11-09, in the owner's
   words as the state page has them. The line gives the verdict in four sentences and the new counts: nine,
   five, thirteen. It says the page was reworked as version 11. It does not say version 11 is published.

## Checks

- Wrapping. Every line is 72 characters or shorter, except table rows and one bold title that was 75
  characters before this run ("The new show machine's follow-ups ...").
- The owner's words. Each quote was compared with `rework/2026-11-02-owner-comments.md`: "a device goes down
  mid-game", "For more or less all use cases", "if at all possible", "gm and/or player scanners", "Generally
  speaking, yes". The request for the review is quoted from `docs/plans/CURRENT-STATE.md`, lines 22 to 24, which
  also gives its date, 2026-11-09.
- Titles. The nine question titles and the thirteen call titles in the record equal those in
  `report/site/v9/decisions.json` as it stood at 01:08 UTC. The four new targets' titles and "A standalone game
  is normal, never a fault" equal those in the quality targets file.
- Counts. Nine questions, five readings, thirteen calls, forty-seven targets, twenty-eight cases, fifteen later
  choices. The split "23 settled and 24 proposed or partly settled; 17 carry a number" was counted from the
  quality targets file as it stood now (23 settled, 18 partly settled, 6 proposed) and equals the sentence in
  `decisions.json` `review[1].what`.
- No em dash or en dash. No model name, model id or vendor name. The only match for a vendor's name is the
  site's own address, which was there before.
- Today's engine. The record states few facts about it. I checked each: the GM picks networked or standalone
  on the tablet at the start (`ALNScanner/src/app/app.js:397`, `selectGameMode`); ALN's pack marks every need
  "skip it" (`ALN-TokenData/pack-manifest.json`, seven `onAbsent: degrade`); the pack declares a token is
  claimed once and the engine gives it to the first team (`ALN-TokenData/game.json:88-91`,
  `backend/src/gameRules/duplicatePolicy.js:4-8`); the rule for missing equipment was ratified on 2026-09-04
  with a typed override (`CONTEXT.md:184-192`, `:443-448`); the glossary's engine includes the GM scanner and
  the player scanners (`CONTEXT.md:26-28`); the second game needs the show machine by its nature
  (`docs/plans/ROADMAP.md:560-562`).
- The three checks the merged report names before publishing. The decisions writer made the first two (the
  clock on a cut-off tablet; each row of the standalone table) and logged them. The record repeats neither
  "today" fact, so nothing here depends on them. For the third, I searched the record for both removed question
  titles, the removed reading, the deleted call, the three merged calls and the three calls that moved. Each
  remaining mention is in a dated history line or a table row that says where it went.

## Items of the merged report not applied here, with the reason

- (c) items 1 to 8 and 10 to 15, (d) d2 to d14, (e) 1 to 6 and 8. None changes a text in the record. Where one
  bears on a decision's history it is in the lines listed above.
- Part 3, for the owner. It is the lead's report to the owner, not record.
- A dated line on the two facts the decisions writer corrected from the code (what a standalone GM tablet shows
  for the clock; where the GM sees an exposed token's summary), which that writer's log suggested. The record's
  line on the three proposals says what is proposed and leaves out what the engine does today, so it has
  nothing to correct.
- "Two kinds of game extension". Its two questions keep their titles, so the entry stands. I did not add that
  the owner's lighting example can be written today in a networked game; that fact is on the page, in question
  D.
- "The night's record and the after-game article". It says paper documents wait for the design rounds, which
  still holds. "Still open" now adds that the choice is the owner's when its round comes.
- The 2026-11-02 history line under "The Decisions page holds only your decisions" (ten questions, three
  readings, fourteen calls). It is version 10's history and is true of version 10.
- Everything under "Parts the checks refused".

## For other files

The record now states these as facts. Each depends on another writer's file. The integration step should check
them, and change the record's sentence if a file ends up different.

1. `report/build_site.py` and `report/site/v9/changes.json`. The record names the change log's new table by the
   title "Where version 10's ten questions went" in two places ("Still open" and the paragraph after the
   site-questions table). The builder must give the `lettersV10` table that exact heading. Today it has only
   "Where version 9's eighteen questions went" (`build_site.py:2656`).
2. `report/build_site.py`, `READINGS_LEAD`. The record says a reading left unanswered goes to the panel as an
   open question, and that the reading on the show machine is already inside the target "The GMs know their
   fallbacks at a failure" and goes marked as the agent's reading. That is the merged report's text for the
   lead ((b), first bullet). The lead is still version 10's (`build_site.py:1721-1722`).
3. `report/site/v9/design.json`. The 2026-11-10 line under "Design top-down, hardest-to-reverse choices first"
   says three things the Design writer applies: `ahead[0].settled` names the question "How the engine reads its
   programs" (d1); passes, the kit's stored data, and installing and releasing are added to what the existing
   decisions decide (d3, d4, d5); each architect is asked whether they would merge or reorder the six (d2). The
   file was still version 10's when I wrote this.
4. `panel/2026-11-01-panel-brief.md`. The record says an open question goes to the panel as its "What it
   decides" paragraph only, and that "The role question starts from settled roles" goes in the setting. The
   brief must say both (a8, a11). Its lines 110 to 113 and 172 to 174 still carry the removed reading.
5. `requirements/2026-11-01-quality-targets.json`. "Still open" gives the split 23 and 24, and 17 with a number.
   If a status or a number line changes at integration, change the sentence in "Still open" and the one in
   `decisions.json` `review[1].what` together.
6. `docs/plans/CURRENT-STATE.md` (the lead's). The record's source for the date the owner asked for the review
   is its line 22. After publishing, the lead adds the publication line to "The owner's site: five linked
   pages" and may want "Still open" to say "as published".
