# Check: version 9's `changes.json`

Checked 2026-11-01. File under check: `site/v9/changes.json`. Read
against version 8's `site/changes.json`, the jargon table
(`checks/jargon-table.md`, its wording rows and its changes.json rows C2
to C78), the decision record (`DECISIONS.md`, every entry and its last
four tables), plan v2 (sections 2 to 6), `site/v9/decisions.json`,
`site/v9/design.json`, the two requirements files, `ROADMAP.md`,
`CURRENT-STATE.md` section 0, `CONTEXT.md` ("Environment ladder") and
the program document's section 4.1. The writer's log
(`site/v9/changes-log.md`) was read for the sources it names. Refute by
default: each item was compared with its sources, not with the log's
account of them.

Result: 7 conflicts in 269 items checked.

## Conflicts

| # | Where | What it says | What it should say | Source |
|---|---|---|---|---|
| 1 | `versions[0].items[3]` (version 9, fourth item) | "Four new questions ask the owner to confirm the quality targets, the extension cases and four readings of earlier decisions that the decision record marks to be confirmed." | "Three new questions ask the owner to confirm the quality targets, the extension cases and four readings of earlier decisions that the decision record marks to be confirmed." Only A, B and C are new. D is the old question about the list of promises, E to K are the old A to G, and L to O are the old standalone and record questions. That makes fifteen, A to O. | `site/v9/decisions.json` (A "Do the quality targets say how well the engine must work?", B "Do the extension cases say how the engine must grow?", C "Four readings of earlier decisions, to confirm"; D to O match the record's table "The owner site's questions" and its open list). The writer's log cites the same three questions. |
| 2 | `versions[0].items[5]` (version 9, sixth item) and `intro[1]` | "The earlier entries on this page keep the numbers and letters they were written with" (both places). | Version 9 replaced several numbers in the earlier entries, as the jargon table requires: finding X-08 (version 8's fourth item, the C9 card note), decision 12 (version 1's prompt, now "an earlier decision"), round 8 (the prompts of versions 1 and 2), architecture pass question 4 (version 4's second item, now the question's wording) and sections 7 and 8 of the cause analysis (versions 2 and 4). Should read, in both places: "The earlier entries on this page keep most of the decision and question numbers and the letters they were written with; the few the jargon check replaced (finding X-08, decision 12, round 8, architecture pass question 4) are in the tables at the end." | v8 `changes.json` against v9, entry by entry; jargon table rows C3, C19, C20, C28, C29, C33, C34, C54. |
| 3 | `vocabulary[10]` (new line) | "The earlier candidate, from version 9, for the candidate shape of 17 parts drawn bottom-up from today's engine for version 8." | "... for the candidate shape of 17 parts, drawn bottom-up from today's engine in version 5 and shown on version 8's Parts page." The 17-part shape first appeared in version 5 and was drawn whole in version 7. Version 8 only moved it to its own page. | v8 `changes.json`: version 5's first item ("a candidate shape of 17 parts"), version 7's title and first item, version 8's first item; plan v2 section 3.4 item 5 ("version 8's Parts page content"). |
| 4 | `intro[0]` | "the three recommendations the candidate shape changed" | "the three recommendations the earlier candidate changed". The writer's log treats the intro as this version's own text, not a kept history entry (it swaps decision 27 for a `[[dec:]]` marker for that reason). On this same page, `jargon[5]` gives the recommendations heading as "Recommendations the earlier candidate changed", and `vocabulary[10]` says "candidate shape" stays only in the earlier entries. The Decisions page tag that links here reads "Recommendation changed by the earlier candidate". | v9 `jargon[5]`; v9 `vocabulary[10]`; `site/v9/decisions.json` intro; writer's log, section "intro" item 1. |
| 5 | `versions[0].items[7]` (version 9, eighth item) | "...: the design rounds for step 3, the earlier candidate for the map, ... The earlier entries on this page are reworded the same way" | "...: the design rounds for step 3, the candidate shape for the map (called the earlier candidate on the new pages), ... The earlier entries on this page are reworded the same way". The jargon table's wording for "the map" is "the candidate shape". The earlier entries on this page use that wording, not "the earlier candidate" (for example version 5: "The candidate shape changed three recommendations"; recommendation E: "Two titles fit the candidate shape"). | Jargon table row 6 and rows C14, C15, C61, C62, C68, C70, C77, C78; v9 `jargon[5]` ("the candidate shape (the result), called the earlier candidate from version 9"); v9 `vocabulary[10]`. |
| 6 | `jargon[23]` (row 24, architecture pass question numbers) | `was`: "questions 6, 5, 8", "question 4", "its question 5"; `now`: nine names with no numbers ("who decides each fact; whether a service's state travels with its health; ...") | Keep the jargon table's numbers 1 to 9 in front of the nine names. This page may show the old numbers. Without them, the row no longer says which name replaces "question 4" or "questions 6, 5, 8". Or point to the `numbers` rows "Architecture pass question 1 (Q1)" to "(Q9)", which give the record's titles. The row's names also differ from those titles (for example "whether anything but the live engine can touch the live show" against "Only the live engine touches the show"). | Jargon table row 24 ("1 who decides each fact; 2 whether ...; ... 9 whether the catch-up ..."); `DECISIONS.md` table "The program document's nine questions". |
| 7 | `jargon[1]` (row 2, "step 1") and `sequence[3]` ("Step 1, the cause analysis; \"this first step\"") | Step 1 is "the review of today's engine, which named the design flaws (the cause analysis); it is done" (jargon) and "...; done, and now evidence and test situations" (sequence). | Add the step's other half: "the review of today's engine, which named the design flaws (the cause analysis), done and now evidence and test situations; the promises it also drafted are confirmed in the requirements, the step now under way." Decision 26 widened step 1 to the promises (the old status line "phase 1, step 1" stood for both). Those promises are still open and belong to the requirements now, so "it is done" is true only of the review. | Jargon table row 2 ("this first step (the promises and the design flaws) ... widened by decision 26 to the promises"); `DECISIONS.md` "The design half's method and tools" (the requirements include "the owner's answers on the promises"); `CURRENT-STATE.md` section 0 ("Now: the requirements ... the ten promises"; "Done so far ... The review of today's engine"). |

## What was checked and found right

Every version 8 entry is kept. All 8 earlier versions keep their date,
item count and order. The ten promise notes keep their ids, order and
byte-identical `earlierTitle`. The sixteen card notes keep their ids
and order. The three recommendations keep their keys. The ten earlier
vocabulary lines keep their order. Nothing was lost.

Changes to kept entries (versions 8 to 1, promises, cards,
recommendations, vocabulary):

- Every change is one of the jargon table's changes.json rows, applied
  as its "Should read" column says, or a marker or letter change.
  Checked by matching each row's "Should read" text against the v9
  file. All 74 rows match apart from expected differences: a marker in
  place of a title, a `[[q:]]` letter remapped, or "decision 27" as a
  `[[dec:]]` marker in the intro. Rows C39 and C44 ("No change") were
  left unchanged.
- No meaning changed. Checked one by one: the X-08 sentence, the
  verdict "which asks no other part", the 54 links "none running in a
  circle", the route in recommendation G, rows C18, C21 and C28 on the
  working documents, "the passwords and keys stored in the code are
  changed before outsiders get access", "only by sending it requests,
  never by writing its files" (jargon row 42), the trial copy, the
  tests' stand-ins, and blue and green spelled out. Each says what
  version 8 said, in the table's wording.
- Quoted earlier wordings are unchanged: "ALN Cause Analysis", "What
  the Engine Must Do", "What the Engine Promises", "green run", every
  quoted title in the recommendations' `before`, `after` and `why`
  texts, the quoted "shared mechanisms" and "job", and the restated
  venue title. The prompts of versions 8, 7 and 5 are byte-identical.
  So are the owner's quoted words in versions 3 and 1 ("cause
  analysis" does not land as a name).
- Question links: the seven `[[q:]]` markers in the promise notes are
  remapped A to E, B to F, C to G, D to H, E to I, F to J. This matches
  `site/v9/decisions.json` and the record's table "The owner site's
  questions". Each recommendation's new `question` field links I, J
  and K, which is right for E, F and G. Plain-text letters in the
  history ("questions A, B, C", "inside question C") are kept as
  written.
- Retired markers: `[[page:promises]]`, `[[page:parts]]` and
  `[[page:flaws]]` are gone. Version 8 now names those pages as plain
  text. `[[flaw:C9|C9]]` and `[[flaw:C2|C2]]` became bare `[[flaw:]]`
  markers, as plan v2 section 2 says.

Version 9's new entry:

- Title, items 1, 2, 3, 5, 7 and 9 and the prompt match their sources.
  The proactive frame, the six pages and where the three removed
  pages went, and the six decisions ahead in the record's order all
  match. So do the four decided directions and Joins and proofs
  replaced, the sequencing names and status line, and the front-page
  strip, picture and latest decisions.
- Requirements counts: 42 quality targets in twelve groups and 14 with
  a number to set (counted in the quality-targets file), and 24
  extension cases (counted). All correct.
- The owner's words in the prompt match the record word for word: the
  goal with "(proactive)", the replaced "(reactive)" goal, "which
  phase 1?", and "I've been using them because you've been using them,
  but they're not necessarily clear or the best approach." Each one is
  tied to the right decision.

The three new tables:

- `jargon`: 69 rows, one per wording row of the jargon table, in
  order. Rows 1, 3, 5, 30 and the "kept, and defined in the words"
  rows differ from the table where plan v2 and the record outrank it:
  "Name each step by what it does", "Build the test rig when building
  starts", and "Titles, not numbers, and a topic record". The other
  rows follow the table, except 2 and 24 (conflicts 7 and 6) and 6
  (conflicts 4 and 5).
- `numbers`: 76 rows. All 36 decision rows, the 9 architecture pass
  questions, the 8 owner-site questions and the 6 after-game
  questions match the record's four tables, by title and place. The
  17 flaw rows (C1 to C16, N1) are added correctly. All 28 `[[dec:]]`
  slugs resolve to a record title. The new letters for the open
  questions are right (D, J, O, L, G, M, N, and E to K for the old A to
  G). Decisions 5 and 11 stay plain text because they live only in a
  history.
- `sequence`: 23 rows. Steps 1 to 6 and ratification match the program
  document's section 4.1 table. Blocks 1 to 7 and the later blocks
  match `ROADMAP.md` sections 4 and 7. Phases 3 to 5 match its
  Appendix A and section 3. Rungs 0 to 3 and Stages A to C match
  `CONTEXT.md` and Appendix A. Round 8 and the dated rounds match the
  record's histories and jargon row 23.

Wording: no em dash in the file. Outside the mapping tables, the old
numbers and sequencing words appear only where version 9 names the term
it replaces ("step 3", "which phase 1?"). Every `[[dec:]]`, `[[q:]]`,
`[[flaw:]]`, `[[part:]]` and `[[promise:]]` marker resolves.

Notes on the writer's log, not on the file:

- The log says "nine versions become ten". The file correctly holds
  nine (version 9 and the eight before it).
- The log lists "the recommendations' `before` texts" among the
  quoted wordings left unchanged. In fact recommendations E and F's
  `before` texts were reworded, as jargon rows C60 and C65 and the
  table's open call 7 say. Their quoted titles are unchanged.

## Counts

269 items checked: 2 intro paragraphs; version 9's title, 9 items and
prompt (11); versions 8 to 1, 31 items plus 8 titles and 8 prompts
(47); 10 promise notes; 16 card notes; 3 recommendations; 12 vocabulary
lines; 69 jargon rows; 76 numbers rows; 23 sequence rows. Conflicts: 7,
as in the table.
