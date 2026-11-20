# Decision record: check of DECISIONS.md

Written 2026-11-01. This checks `docs/plans/architecture-pass/DECISIONS.md`
against `decision-record/inventory.md` and the sources: Appendix A of
`docs/plans/2026-10-30-architecture-pass.md`, section 0 of
`docs/plans/CURRENT-STATE.md` and its git history (commits `26fc2f20` to
`a548d0f2`), the cause analysis, the engine-jobs document, the
after-game report, the owner site's `report/site/decisions.json`, and
the working log `.superpowers/sdd/2026-10-30-architecture-pass/progress.md`
(the only record of several owner quotes). Each finding was checked
against its source; nothing was assumed right.

Result: 20 conflicts in 116 items checked. None changes what the owner
decided. Most are wording that states an unconfirmed reading as settled,
numbers that survive as ordinals or letters, and three dates or counts
that do not match the source.

## Conflicts

| # | Where | What it says | What it should say | Source |
|---|---|---|---|---|
| 1 | "Promises, qualities, moments, venue technician", standing statement | "The pass states the engine's requirements as ten promises." | The owner's page is organized around the promises. The draft has ten; whether they are the right ten is still open ("Are these the right ten promises?"). | State page history, decision 27: "the page is organized around the ten promises"; `decisions.json`, question "promises", status open |
| 2 | Same entry, standing statement | "The seventh title is itself a promise." | The title "The game fits the venue it is in tonight" becomes a promise. "Seventh" counts by an old list order, which a title-only record should not need. | Decision 27: "The seventh title becomes a promise"; decision 36 |
| 3 | "Superseded and withdrawn", entry "2026-10-31. 'Job' and 'installer'." | Dates both words to 2026-10-31. | "Job" dates from 2026-10-31. "Installer" is older: "venue installer" entered the roadmap on 2026-09-04. Date the two separately, or date the entry by its replacement (2026-11-01). | `engine-jobs.md` (2026-10-31); commit `3a8272ab` (2026-09-04) adds "A venue installer" to `ROADMAP.md` |
| 4 | Title "Green's follow-ups ship before the pass" (entry and number table, row 4) | "before the pass" | "Green's follow-ups ship when the definition session ends". The body itself says "alongside the pass". | Appendix A, decision 4: "as soon as this planning session ends"; program document section 7: "alongside the pass" |
| 5 | "The architecture pass is the next work": title and history | Title says "next"; the statement says "current"; no history line says when it became current. | Add a history line: 2026-10-30, at ratification, the pass became the current work, design half first ("The owner ratified the program document"). Make the title match, for example "The architecture pass is the work now". | Appendix A, decisions 1 ("the next unit") and 16 ("became the current unit") |
| 6 | "The night's record and the after-game article", first sentence | "The after-game article and emailer are the game's business, outside the engine." | What the players receive after the show, and their contact details, are the game's business, outside the engine. The Director Console stays a separate program for now, and the record keeps open its later move into the engine's Review stage. | State page, decision 28 (2) and (5); `CONTEXT.md` Review entry: "What reaches the players after the show, and their contact details, stay the game's business" |
| 7 | Same entry, history ("the owner answered them all the same day"); number table intro ("All six were answered on 2026-11-01") | All six answered. | The owner answered five, and the first half of the third; whether paper documents join the pack was not answered and waits for the design rounds. | State page, decision 28 (3): "was not answered"; after-game report, answer 3 |
| 8 | "Five documents the design half hands over", standing statement | Names "the published protocol, which took the place of contract proposals" and drops "one per question" from the rules, as settled. | Keep the decision as made (the rules, one per question; contract proposals for the two contract files) and say in the statement that both are read as overtaken by the top-down order and the published protocol, to be confirmed. The entry's own history and the "Read as overtaken" list say this is unconfirmed. | Appendix A, decision 10; inventory row 10 ("Overtaken in part (inferred)") |
| 9 | "When the design half is finished", standing statement | "The condition that the rig reproduces each finding marked for live proof no longer applies." | That condition is read as overtaken by "Build the test rig when building starts", to be confirmed. The entry's history and the "Read as overtaken" list say the same reading is unconfirmed. | Appendix A, decision 13; inventory row 13 ("overtaken by 30 (inferred)") |
| 10 | Same entry, standing statement and history | Adds "and standalone games" to "every rule says how it serves the planned capabilities", with no history line. | Add a history line: 2026-10-31, "Standalone games: declared, never mixed" put standalone games on the list every rule must serve. | Appendix A, decision 13 (no standalone clause); state page, decision 22 ("widens decision 12's list") |
| 11 | "The design half's method and tools", history line for the correction of 2026-10-30 | Says only "The order corrected". | Also say the readers changed: decision 12 had readers grouped by cause; the correction split them by source, then merged by cause, then checked. | Appendix A, decisions 12 and 15 (c); inventory row 12 ("Amended by 15 (the order and the readers)") |
| 12 | Same entry, standing statement | "one fleet at a time" | "one group of reviewers at a time". "Fleet" is workflow jargon. | Style rule for owner pages |
| 13 | "One program: design half, then build half", history | "Made as two phases, the third of three options the owner was shown." | "Made as two phases, the third option the owner was shown." No record says how many options there were. | Appendix A, decision 7: "option c"; working log has no option count |
| 14 | Histories throughout: "first round" to "seventh round" (entries for the pass being next, blue's fixes, the four words, the nine questions, the role question, one program, run like the re-charter, the truth sweep, five documents, method, finished, corrections, green's follow-ups, decide in rounds, ratified) | Ordinal round names. | Rounds go by date. All seven fell on 2026-10-30, so name each by what it settled, for example "2026-10-30, the definition session, when the method was settled", or "2026-10-30, the definition session" with lines in order. An ordinal is a round number in words. | "Name each step by what it does": "question rounds by date"; decision 36 |
| 15 | "The nine questions the pass answers": numbered list and histories | The nine are numbered 1 to 9, and histories say "the fourth", "the sixth", "a seventh", "the eighth and ninth", "the first, sixth, eighth and ninth". | Use the titles the record already gives: "Only the live engine touches the show", "Each fact at a game boundary", "Each component gets what its role needs", "How copies update and show their age", "Reconnect snapshot built like live update", "Who decides each fact". Use a bulleted list, not a numbered one. | Decision 36: questions go by title; ids stay only inside records |
| 16 | "Corrections to the readers and the hardening pieces", history; "Superseded and withdrawn", first-order entry | Parts named "(a)", "(b)", "(c)", "Part (a)", "Parts (b) and (c)", "part a". | Name the parts: "the order", "the hardening pieces", "the readers". | Decision 36 |
| 17 | "Superseded and withdrawn", dates | Says "By date" but mixes dates: three entries carry the day they were made (2026-10-30, 2026-10-30, 2026-10-31) and others the day they were replaced. "The design half's corrected order" (made 2026-10-30), "How much the rig proves before design" (asked 2026-10-30) and "'Phase 1' and 'phase 2'" (in use since 2026-10-30) are dated 2026-11-01. | Date every entry the same way, either by the day it was made or the day it was replaced, and say which. | Appendix A, decisions 7 and 15 (round 6, 2026-10-30); working log 12:20Z 2026-10-30 (question 21 asked) |
| 18 | "Still open", "Kept for the design rounds" | "The Decisions page's list of design choices for the design rounds (eleven, from where standalone is declared to the order of the work)." | Twelve, from where standalone is declared to whether paper documents join the pack. The two items listed just above it are on that list too. | `decisions.json`, `step3` (12 entries; the 12th is paper documents) |
| 19 | "The owner's site: five linked pages", standing statement | "The site is reframed fully to the long-term frame, and its decisions, questions and design flaws go by title." Reads as done. | The site is to be reframed to the long-term frame and to put titles in place of numbers. Not yet done: version 8 still asks the owner to answer "by the question's letter or number" and names "round 8" and "step 2 of phase 1". | `decisions.json` intro and question 21; state page "In flight" (version 8 live, unchanged) |
| 20 | "Run the pass like the re-charter" and "Decide in question rounds, never at sign-off", standing statements | "ratification", "Ratification is a skim". | Use the step's name, "the owner's sign-off", in the standing statements, as "When the design half is finished" already does. Keep "ratification" only in history lines that quote the old wording. | "Name each step by what it does": steps include "the owner's sign-off" |

Conflicts: 20.

## What was checked and found right

116 items: the 28 entries (standing statement, date made, every history
line), the 36 rows of the decision table, the 9 rows of the questions
table, the 8 rows of the owner site's questions, the 6 after-game rows,
the 9 superseded entries, the 4 "read as overtaken" entries, the 15
"Still open" items, and the opening frame and quote.

- **Every number is placed.** Decisions 1 to 36 each appear once in the
  table and point to the right section. 5 and 11 sit in the history of
  "The nine questions the pass answers"; 17, 18 and 23 are folded where
  the owner site folds them (the promises question, question F,
  question C); 19, 24 and 25 are open; 21 is withdrawn; 22's ESP32
  reading is open. Q1 to Q9, the promises question with A to G, and
  AG1 to AG6 all map correctly. No title repeats.
- **Dates made match the commits.** Rounds 1 to 7 on 2026-10-30
  (`26fc2f20` to `12baf920`); 20 and 22 on 2026-10-31 (`c40d70c0`,
  `e42d4398`); 26 on 2026-10-31 (`42dd2c4c`); 27 to 36 on 2026-11-01.
  Question 20 was asked on 2026-10-30 (working log, 12:20Z).
- **Owner quotes are the owner's recorded words.** "ok, I think?" (green's
  follow-ups, round 1), "how is the truth sweep different from the
  architecture pass?", "sure" (widening two questions), the 17-part
  quote, the goal in the owner's words, and the numbers quote all match
  the working log or the state page. The owner's "yes to all three"
  corrections and "why new" on the ESP32 match the working log.
- **Amendments carried into standing statements.** 31's top-down order
  in the method, the rounds rule, the corrections and the program's
  order; 30's rig timing; 26's "never the driver" on blue's fixes; 34's
  half names; 36's widening of 27; 22's widening of the method's list;
  33 settling the "Pending" note and 36 the "Under discussion" note
  (`5dc79eaf`, `a548d0f2`).
- **Superseded content is not written as standing.** The two old
  question wordings, the first and corrected orders, the approved flow,
  the withdrawn rig question and "Joins and proofs" are all in history
  or the superseded list. The rule that every decision is made in a
  round still stands, correctly.
- **The inferred overtakings are flagged** in the entry histories and
  the "Read as overtaken" list, matching the inventory (rows 7, 10, 11,
  13); only conflicts 8 and 9 above state two of them as settled in the
  standing text.
- **Facts match.** The four unrun findings, the five handover
  documents, the five end conditions, the six hard-to-reverse design
  rounds, the panel's context plan, the roadmap's block names (checked
  against `ROADMAP.md`), the merge `089dd527`, the recommendation on
  refused GM scans ("Yes. Record every attempt and its answer, and show
  it nowhere until a feature needs it"), and the protocol's scope.
- **Topics hold together.** Each of the six topics holds decisions of
  one kind; the placement follows the inventory's proposal.
- **Style.** No em dashes. No decision, question, step, phase or block
  number in any title or standing statement, except the ordinals and
  letters in conflicts 2 and 14 to 16. No metaphors found beyond the
  jargon in conflict 12.
