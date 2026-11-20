# Write log for the topic decision record

Written 2026-11-01 alongside `docs/plans/architecture-pass/DECISIONS.md`.
For each entry: the sources read, and any judgment made in merging. Old
numbers are used here on purpose; this is a working record, not an
owner page.

Sources, with the short keys used below:

- PD: `docs/plans/2026-10-30-architecture-pass.md` (Appendix A, decisions
  1 to 16 word for word; section 3, the nine questions; sections 4 to 7
  for the surrounding statements).
- CS: `docs/plans/CURRENT-STATE.md` section 0 at `a548d0f2`, and its git
  history (`git log -p -- docs/plans/CURRENT-STATE.md`): commits
  `26fc2f20`, `a3db4ddf`, `4610b2d8`, `44f94a7a` (the definition
  session's open notes), `df46faf9` (the "Pending" note), `5dc79eaf`
  (the "Under discussion" note), `a548d0f2` (decision 36).
- CA: `docs/plans/architecture-pass/2026-10-30-cause-analysis.md`
  (header, section 1).
- EJ: `docs/plans/architecture-pass/2026-10-31-engine-jobs.md` (header,
  sections 1, 2, 4).
- SP: `docs/plans/architecture-pass/2026-10-31-standalone-pass.md`
  section 3.4.
- AG: `docs/plans/architecture-pass/2026-11-01-after-game-report.md`.
- DJ: `docs/plans/architecture-pass/report/site/decisions.json`.
- PL: `.superpowers/sdd/2026-10-30-architecture-pass/progress.md`.
- PR: `docs/agents/process.md` (section 4 last paragraph; section 5
  last bullet; the skill-map row for the two design skills).
- CTX: `CONTEXT.md` section 4b (the four runtime-state words) and
  section 7 (architecture pass, promise, moment, part, quality, design
  flaw, truth sweep).
- RM: `docs/plans/ROADMAP.md` block headings (for the block names).
- Consistency files under `docs/plans/architecture-pass/consistency/`
  (only to learn what the part "Joins and proofs" held).
- INV: `docs/plans/architecture-pass/decision-record/inventory.md`.

## Global judgments

1. **Section order.** The goal and the frame; the words; what the engine
   must do; how the design is made and in what order; the owner's site;
   how the work runs. The inventory's six topics, ordered from the big
   picture down as the task asked. "The words" come second because every
   later entry uses them.
2. **Merging amendments.** Where a later decision amends an earlier one
   by name (31 amends 12, 14, 15; 34 renames 7's halves; 36 widens 27
   and settles 34's exception; 22 widens 12's list; 26 qualifies 8; 33
   settles the "Pending" note), the standing statement says what holds
   now and the history says what changed. Where the inventory marks a
   change "overtaken (inferred)" (7, 10, 11, 13 against 30 and 31; 10
   against 33), the standing statement says what the later decision
   implies, and the history and the "Read as overtaken, not yet
   confirmed" list say the record does not name the change and that it
   is to be confirmed with the owner. Nothing inferred is written as if
   the owner had said it.
3. **Decisions 5 and 11 folded into one entry.** Both only reword or add
   questions to the set decision 1 opened. The owner reads the question
   set as one list, so the record has one entry, "The nine questions
   the pass answers", whose history carries 5 and 11 (and 1's first six
   questions and 9's wording). The number-to-title table maps 5 and 11
   to that entry's history. This departs from the inventory's one title
   per number; the inventory's titles for 5 and 11 are kept in the
   table.
4. **Decision 9 kept as its own entry.** It settles the components'
   roles, which is substantive beyond the question's wording.
5. **Decision 15 retitled.** The inventory proposed "Corrections to
   order, hardening and readers". Part (a), the order, no longer stands,
   so the entry is "Corrections to the readers and the hardening
   pieces", and part (a) is in "Superseded and withdrawn". The table
   carries the new title.
6. **The six after-game questions** are folded into decision 28's entry,
   as the inventory proposed, and listed in the table by what each
   asked.
7. **Numbers in text.** Counts stay (nine questions, ten promises,
   sixteen design flaws, five documents). Ids do not: flaw ids are
   replaced by the flaw's title where one is needed ("Tablets and
   phones decide facts the engine owns" for C9); the finding id X-08
   becomes "a finding"; promise ids become titles; part ids become
   names; "the 17-part candidate shape" becomes "the candidate shape of
   the engine's parts", except inside the owner's own quoted sentence,
   which is kept as said. Blocks go by the roadmap's names (RM headings:
   unlock, hardening, truth sweep, capture, preview, depth-and-close).
   Rounds go by date; the definition session's rounds all fell on
   2026-10-30, so they are told apart as "first round" to "seventh
   round" of that session, which are ordinals in a dated session, not
   bare round numbers. "Round 8" is "the question round of 2026-10-30
   to 2026-11-01". "Step 2" is "the test rig"; "step 3" is "the design
   rounds"; "phase 1 / phase 2" are "the design half / the build half".
   The "rung-1 rig" is "the test rig" (it is the level "real programs
   with stand-in hardware" in decision 34's names). Document section
   numbers are also avoided ("the program document's appendix").
8. **Quotes.** Owner's words quoted where the sources record them: the
   goal (CS decision 31 text); "which phase 1?" (CS 31); "I've been
   using them because you've been using them..." (CS 36, `5dc79eaf`);
   "how is the truth sweep different from the architecture pass?" (PL
   2026-10-30 ~07:35); "ok, I think?" and "sure" (PL ~07:35, ~08:15);
   "the 17 part candidate shape is never diagrammed. this is still not
   showing me how everything comes together." (PL, page version 7
   entry). The kickoff brief's quotes in PD section 1 were not reused
   because decision 26 and 31's words state the frame more directly.

## Entries

### The goal and the frame

- **Design for the long term, beyond ALN** (26). Sources: CS 26 and the
  owner's-words paragraph under CS 31 (commit `e0fd0485`); CTX section 7
  "Architecture pass"; INV row 26. Judgment: the owner's words are
  quoted here (the inventory notes they are recorded with 31) and again
  in 31's history, since both entries rest on them.
- **The architecture pass is the next work** (1). Sources: PD Appendix A
  item 1; PD sections 1 and 2 (scope, blue runs until green, no date,
  the owner's condition and the nine evidence files); PL ~07:35 (the
  owner's question); CS history `26fc2f20`. Judgment: the questions are
  moved out to "The nine questions the pass answers" so this entry says
  what the pass is and where it stands; the scope sentence is PD
  section 2's, which PD attributes to decision 1.
- **Blue's fixes are evidence of design causes** (8). Sources: PD
  Appendix A item 8; PD section 6 (the two worked examples); CS 26; CS
  31 ("today's sixteen design flaws as test cases"); CS history
  `a3db4ddf` ("the owner's meaning of the brief's question 6"). Judgment:
  "the brief's question 6" is written as "the kickoff brief's question
  on blue's fixes" to avoid the number.

### The words

- **Four words for the game's live facts** (3). Sources: PD Appendix A
  item 3; CTX section 4b for the one-line meanings; PL ~07:35 (flagged
  for owner) and ~08:15 (Q6a yes). Judgment: the glossary's short
  meanings are added so the entry reads alone.
- **Promises, qualities, moments, venue technician** (27). Sources: CS
  27; CTX section 7 entries; EJ header note; PL 2026-11-01 "decision
  27" entry; CS history `8e0b21e8` (the jobs restructure, 2026-10-31).
  Judgment: the 2026-10-31 history line is added so the reader sees
  where "job" came from before it was retired.
- **Name each step by what it does** (34). Sources: CS 34; CS 31 ("which
  phase 1?"); RM block headings for the block names. Judgment: the block
  names are listed in the statement, since the decision says blocks go
  by name and the reader needs the names.

### What the engine must do

- **The nine questions the pass answers** (1, 5, 9, 11; the nine Qs).
  Sources: PD section 3 (the table) and Appendix A items 1, 5, 9, 11;
  CS history `26fc2f20`, `a3db4ddf`, `4610b2d8`; INV section 2.1 (titles
  and the "serve as checks (inferred)" note). Judgment: see global
  judgment 3. The inventory's nine titles are used as lead-ins. The
  inventory's inference that the nine serve as checks under 31 is stated
  as a reading to confirm, not as a decision.
- **The role question starts from settled roles** (9). Sources: PD
  Appendix A items 5 and 9; PD section 2; PL ~08:15 ("sure"; the role
  question ignored the settled roles).
- **Standalone games: declared, never mixed** (22). Sources: CS 22; PL
  2026-10-31 "Q22 answered"; SP section 3.4 (the standalone pass's
  questions); DJ question 22 and C; CS lines 181-182 (where the
  standalone fact is held, kept for the design rounds). Judgment: the
  question's own wording is not in any record (INV), so the history says
  what was answered; the 2026-10-31 standalone pass and the 2026-11-01
  site clause are added as history because the decision now lives on
  the owner site in the venue promise.
- **The night's record and the after-game article** (28; AG1 to AG6).
  Sources: CS 28; AG (questions and answers, "Folded into"); DJ decided
  item 28. Judgment: the opening sentence ("are the game's business,
  outside the engine, and the engine's record is designed so they can
  read it") is a summary of the six answers, each of which follows.
  "Card C9" is written by its title from AG ("Tablets and phones decide
  facts the engine owns"); "finding X-08" is "a finding".
- **One published protocol and an outside test bench** (33; the
  "Pending" note). Sources: CS 33; CS history `df46faf9` (Pending) and
  `5dc79eaf` (removed); consistency files for what "Joins and proofs"
  held (shared shapes written once; tests on an engine of their own).
  Judgment: a one-clause gloss of "Joins and proofs" is added so the
  owner knows what was replaced; its source is the consistency check's
  description of the part, not a decision text.

### How the design is made, and in what order

- **One program: design half, then build half** (7). Sources: PD
  Appendix A item 7; PD section 5; CS 30, 31, 34; CS history `a3db4ddf`
  (the owner asked why no code); PL ~08:15 (Q3 reframed into two
  phases); INV row 7. Judgment: "starts with a thin first version on a
  new test bench" is written into the standing statement because CS 30
  and 31 say so plainly; the loss of "each area starts with its proof
  test failing on today's engine" is the inferred change, flagged in
  the history and in the "not yet confirmed" list.
- **Run the pass like the re-charter** (2). Sources: PD Appendix A item 2;
  PD section 7 (roadmap revision r5, r4 in history, written here without
  the revision numbers); CS history `4610b2d8` (the glossary entry
  written in round 3); INV row 2. Judgment: "a draft with numbered
  questions" is restated as questions by title per 36; "adversarial
  review" is written "hostile review" per 34's names.
- **The truth sweep's charter is retired** (6). Sources: PD Appendix A
  item 6; PD sections 1 and 7; CTX section 7 "Truth sweep".
- **Five documents the design half hands over** (10). Sources: PD
  Appendix A item 10; PD section 4.2; CS 31, 33; INV row 10. Judgment:
  the third document is written as the published protocol with "which
  took the place of contract proposals", and both inferred changes are
  flagged.
- **The design half's method and tools** (12, as amended by 15, 22, 30,
  31). Sources: PD Appendix A items 12 and 15; PD section 4.1 (the
  review's shape, pages published for the owner); CS 22, 30, 31, 34 (the
  step names); PR skill-map row. Judgment: the standing order is 34's
  step list with 31's content under each step; the tools from 12 that
  31 did not change (the two skills, side-by-side designs, prototypes,
  the review's shape) are kept.
- **When the design half is finished** (13). Sources: PD Appendix A item
  13; PD section 4.3; CS 30, 31; INV row 13. Judgment: the rig condition
  is written as no longer applying, flagged as inferred; "every question
  has a rule" is kept with a to-confirm note.
- **Corrections to the readers and the hardening pieces** (15). Sources:
  PD Appendix A item 15; PL ~09:40 ("Q15a/b/c asked; owner: all yes");
  CS 30, 31. Judgment: see global judgment 5.
- **Build the test rig when building starts** (30; question 21). Sources:
  CS 30; PD section 4.1 step 2 (the four reproductions, for the history);
  DJ question 21; INV row 21.
- **Design top-down, hardest-to-reverse choices first** (31). Sources: CS
  31 and its owner's-words paragraph (`e0fd0485`). Judgment: "proactive
  frame" is written as "the long-term frame" in the statement, since the
  entry it points at is titled "Design for the long term, beyond ALN";
  the owner's word "proactive" stays inside the quote.
- **Independent architects propose the top-level design** (32). Sources:
  CS 32.
- **What the architects' panel sees, and when** (35). Sources: CS 35.
  Judgment: "the 17-part candidate shape" becomes "the candidate shape
  of the engine's parts".

### The owner's site

- **The owner's site: five linked pages** (29). Sources: CS 29; CS 31
  (reframed); CS 36 (titles); PL 2026-11-01 page version 7 and "decisions
  28 and 29" entries; CS live-state lines. Judgment: site version
  numbers are avoided ("the single page it replaced"); the owner's
  remark about the undiagrammed shape is quoted as the history that led
  to the structure question.

### How the work runs

- **Green's follow-ups ship before the pass** (4). Sources: PD Appendix A
  item 4; PD section 7 (the three follow-ups named); CS first steps;
  PL ~07:35 ("ok, I think?") and ~08:15 (Q5 yes).
- **Decide in question rounds, never at sign-off** (14). Sources: PD
  Appendix A item 14; PD section 4.1; PR section 5 last bullet; CS 31.
  Judgment: the approved flow of the rounds is moved to "Superseded and
  withdrawn" and to the history; the rule stands as written in PR.
- **The owner ratified the program document** (16). Sources: PD status
  line and Appendix A item 16; CS history `12baf920`.
- **No rule for documents: fix as we go** (20). Sources: CS 20; PR section
  4 last paragraph; DJ decided item 20; PL 2026-10-31 round 8 answers;
  CS history `c40d70c0`.
- **Titles, not numbers, and a topic record** (36; the "Under
  discussion" note). Sources: CS 36 (`a548d0f2`); CS history `5dc79eaf`
  (the note's wording); INV header.

### Superseded and withdrawn

Sources: as the entries above. Judgment: the section lists only changes
the record itself names (reworded questions, the two earlier orders, the
approved flow, "job" and "installer", question 21, "Joins and proofs",
the phase names, the numbers). Inferred changes go in a separate list,
"Read as overtaken, not yet confirmed", so the owner can see which are
the record's words and which are this writer's reading. The note that
the Decisions page and the state page still list question 21 as open
comes from INV rows 21 and section 5.1 (CS lines 177 and 229-230).

### Still open

Sources: DJ (intro, groups, step3, decided); CS section 0's open list;
INV sections 2.2, 2.3, 3. Judgment: the three folds (17 into the
promises question, 18 into F, 23 into C) are stated next to the holding
question, from DJ's intro. The recommendation on refused scans is given
in one line because CS says the owner asked for the orchestrator's view.
The eleven design choices are counted, not listed, since they are
design questions, not decisions (INV section 3).

### Number to title

Sources: INV sections 1, 2.1, 2.2, 2.3. Every number 1 to 36, Q1 to Q9,
the promises question and A to G, and AG1 to AG6 has a row. Rows 5, 11
and 15 carry the judgments above.

## Coverage check

Every inventory row (1 to 36) appears: as a standing entry (1, 2, 3, 4,
6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 20, 22, 26, 27, 28, 29, 30, 31, 32,
33, 34, 35, 36), in the history of one (5, 11), in "Superseded and
withdrawn" (21, and 15's part a), or in "Still open" (17, 18, 19, 23, 24,
25, and 22's ESP32 reading). The nine questions, the promises question
and A to G, and AG1 to AG6 appear in their entries and in the table. The
two notes that became decisions ("Pending", "Under discussion") are in
the histories of 33 and 36. The definition session's open notes are in
the histories of the entries they became.

Checks run after writing: no em dash in either file; no "decision N",
"question N", "step N", "phase N", "block N" or "round N" pattern in a
title or statement of `DECISIONS.md`, with two deliberate exceptions:
the owner's quoted words "which phase 1?" (kept as said, twice), and
the "Superseded and withdrawn" line that names "Phase 1" and "phase 2"
as the labels that were replaced; no flaw, promise or part id (C1 to
C16, N1, J1 to J10, P1 to P17, X-08) outside the number-to-title table
and the quoted owner sentence. The record has 28 standing entries.
