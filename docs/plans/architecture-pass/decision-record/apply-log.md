# Apply log: the check's conflicts against DECISIONS.md

Written 2026-11-01. This log settles each of the 20 conflicts in
`decision-record/check.md` against `docs/plans/architecture-pass/DECISIONS.md`.
Each conflict was verified against its named source before anything
changed; the verification is noted with the outcome. Old numbers are
used here on purpose: this is a working record, not an owner page.

Result: 20 applied, 0 rejected. Judgment calls are listed at the end.

| # | Verified against | Outcome | What changed |
|---|---|---|---|
| 1 | `decisions.json` (the promises question, `status: open`); state page decision 27 ("the page is organized around the ten promises") | Applied | The standing statement of "Promises, qualities, moments, venue technician" now says the owner's page is organized around the promises, the draft has ten, and whether they are the right ten is still open. |
| 2 | State page decision 27 ("The seventh title becomes a promise") | Applied | "The seventh title is itself a promise" became 'The title "The game fits the venue it is in tonight" is itself a promise.' The ordinal is gone. |
| 3 | `engine-jobs.md` (dated 2026-10-31); commit `3a8272ab` (2026-09-04) adds "A venue installer" to `ROADMAP.md` (confirmed with `git show`) | Applied | The superseded entry is dated by its replacement (2026-11-01) and says "job" dates from 2026-10-31 and "venue installer" from 2026-09-04. See conflict 17 for the dating rule. |
| 4 | Appendix A decision 4 ("as soon as this planning session ends"); the entry's own body ("alongside the pass") | Applied | Retitled "Green's follow-ups ship when the definition session ends", in the entry and in the number table's row 4. |
| 5 | Appendix A decisions 1 ("the next unit") and 16 ("became the current unit, phase 1 first") | Applied | Retitled "The architecture pass is the work now" (entry and table row 1). The statement says "the current work, design half first". A history line dated 2026-10-30, the definition session's sign-off, records when it became current. |
| 6 | State page decision 28, answers (2) and (5); `CONTEXT.md` Review entry ("What reaches the players after the show, and their contact details, stay the game's business") | Applied | The first sentence now says what the players receive after the show, and their contact details, are the game's business, and the record is designed so the game's own tools can read it. The Director Console sentence says "for now". |
| 7 | After-game report, answer 3 ("was not answered: a question for step 3"); state page decision 28 (3) | Applied | The history says the owner answered five, and the first half of the third, and that paper documents were not answered. The after-game table's intro says the same; the AG3 row says "kept for the design rounds". |
| 8 | Appendix A decision 10 (the rules "one per question"; "contract proposals, drafted for the two contract files before code"); inventory row 10 ("Overtaken in part (inferred)") | Applied | The standing statement of "Five documents the design half hands over" keeps the decision as made and adds that two parts are read as overtaken, to be confirmed. The history says the protocol "would turn" the proposals into one protocol. |
| 9 | Appendix A decision 13 ("the rig reproduces each finding marked for live proof"); inventory row 13 ("overtaken by 30 (inferred)") | Applied | The standing statement of "When the design half is finished" keeps all five conditions as made and says two are read as overtaken, to be confirmed. "No longer applies" is gone. |
| 10 | Appendix A decision 13 (no standalone clause); state page decision 22 ("widens decision 12's list") | Applied | A history line dated 2026-10-31 says "Standalone games: declared, never mixed" put standalone games on the list every rule must serve. |
| 11 | Appendix A decision 12 ("readers grouped by cause") and decision 15 (c) ("split by source ... a merge groups every finding by cause; then the skeptical check") | Applied | The method entry's first history line now names the readers grouped by cause; the record check's line says the order corrected and the readers changed, with the new reader order. |
| 12 | Appendix A decision 12 says "one fleet at a time"; the style rule for owner pages | Applied | "one fleet at a time" became "one group of reviewers at a time" in the standing statement. |
| 13 | Appendix A decision 7 ("option c"); the working log (`progress.md`, ~08:15 entry) records the reframe into two phases and no option count; `grep -i option` over the log finds none | Applied | "the third of three options the owner was shown" became "the third option the owner was shown". |
| 14 | "Name each step by what it does" ("question rounds go by date"); decision 36 | Applied | Every "first round" to "seventh round" became "2026-10-30, the definition session", with a clause naming what the round settled where one entry has two lines on that day (the round that reworded the questions, the round that settled the method, the record check's round, the sign-off). "The round after" is used where the order of lines carries the meaning. |
| 15 | Decision 36 (questions go by title) | Applied | The nine questions are a bulleted list led by their titles. Every history line that said "the fourth", "the sixth", "a seventh", "the eighth and ninth" or "the first, sixth, eighth and ninth" now names the questions by title. |
| 16 | Decision 36 | Applied | "(a)", "(b)", "(c)", "Part (a)", "Parts (b) and (c)" and "part a" became "the design half's order", "the hardening pieces", "the readers", "the correction to the order" (also in the number table's row 15 and in "Superseded and withdrawn"). |
| 17 | Appendix A decisions 7 and 15 (made 2026-10-30); the working log's 12:20Z entry (question 21 asked 2026-10-30) | Applied | "Superseded and withdrawn" is dated by the day each item was replaced or withdrawn, and says so. Each entry also says when it was made. The two question wordings and the first order keep 2026-10-30 (replaced the same day); the approved flow moves to 2026-11-01 (replaced then); the corrected order, the rig question and the phase names stay at 2026-11-01 with their made or asked dates in the text. |
| 18 | `decisions.json` `step3`: 12 entries, the 12th "Whether paper documents join the pack" | Applied | "Kept for the design rounds" is one paragraph: twelve design choices, from where "this game is standalone" is declared to whether paper documents join the pack, with the ten between them named in short. The two items that were listed above it are now inside that paragraph. |
| 19 | `decisions.json` intro ("Answer in the chat, by the question's letter or number"; "Three questions from round 8"); the state page's "In flight" (version 8 live, unchanged) | Applied | The standing statement of "The owner's site: five linked pages" says the site is to be reframed and to go by titles, and that neither is done: the live site still asks for answers by letter or number and names a round and a step by number. The history says both wait for the next version. The same tense is used in "Design top-down, hardest-to-reverse choices first" ("is to be reframed"). |
| 20 | "Name each step by what it does" (the steps include "the owner's sign-off") | Applied | "Run the pass like the re-charter" and "Decide in question rounds, never at sign-off" say "the owner's sign-off" in their standing statements. "Ratification" stays only in history lines that quote the old wording, and in the entry "The owner ratified the program document", which records the event by the word used that day. |

## Judgment calls

- **Conflict 14, how rounds are named.** The check offered two forms.
  Both are used: "2026-10-30, the definition session" alone where an
  entry has one line for that day or the order of lines carries the
  meaning, and a clause naming what the round settled where two lines
  on the same day must be told apart. "The round after" and "two rounds
  later" appear where the distance between two lines is the point. No
  ordinal names a round.
- **Conflict 17, which dating rule.** Dated by the day replaced or
  withdrawn, because the section's purpose is to say when each item
  stopped holding; the day made is kept inside each entry's text. The
  check allowed either rule as long as the section says which.
- **Conflict 18, the twelve choices.** The paragraph names all twelve
  in short rather than only the first and last, so the owner can see
  the list without opening the site. The names are shortened from
  `decisions.json` `step3` and decide nothing.
- **Conflict 20, "The owner ratified the program document".** Its title
  and statement keep "ratified": the entry records a dated event under
  the word used on that day, which the check's rule for history lines
  covers. The two standing statements the check named were changed.
- **Conflicts 8 and 9, how the overtaken parts read.** The decision as
  made comes first and the inferred overtaking after, in one sentence
  that names the later decision, so the owner sees both without
  reading the history. "Read as overtaken, not yet confirmed" is
  unchanged.
- **One sentence added to the opening.** The record's opening now says
  how inferred changes are written (kept as made; the later decision's
  implication stated and flagged), since conflicts 8 and 9 rest on that
  rule. It describes the record's method, not a decision.
