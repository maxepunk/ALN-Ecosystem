# Decision record: inventory of every number

Written 2026-11-01 for the decision "Titles, not numbers, and a topic
record" (number 36 on the state page). This is a working record, not an
owner page: it keeps the old numbers so the new topic record can be
checked against them. Nothing here decides anything. Titles and topics
are proposals for the owner.

Sources:

- PD: `docs/plans/2026-10-30-architecture-pass.md`, Appendix A (numbers
  1 to 16, word for word) and section 3 (the nine questions).
- CS: `docs/plans/CURRENT-STATE.md` section 0 (numbers 20, 22, 26 to
  36; the open questions), and its git history
  (`git log -p -- docs/plans/CURRENT-STATE.md`), which holds the
  "Pending" and "Under discussion" notes and the round dates.
- CA: `docs/plans/architecture-pass/2026-10-30-cause-analysis.md`.
- EJ: `docs/plans/architecture-pass/2026-10-31-engine-jobs.md`
  (questions A to G).
- SP: `docs/plans/architecture-pass/2026-10-31-standalone-pass.md`
  section 3.4 (the source of questions 23 to 25).
- AG: `docs/plans/architecture-pass/2026-11-01-after-game-report.md`
  (the six after-game questions).
- DJ: `docs/plans/architecture-pass/report/site/decisions.json` (the
  owner site's question list, version 8).
- PL: `.superpowers/sdd/2026-10-30-architecture-pass/progress.md`
  (git-ignored working log). It is the only record of the round-8
  questions' own short wording (its 12:20Z entry, 2026-10-30).

How the columns read:

- **When.** The date, then the question round as the record numbers it
  (kept for cross-reference only; on owner pages a round goes by its
  date). The definition session's rounds 1 to 7 all fell on
  2026-10-30. "Round 8" ran from 2026-10-30 to 2026-11-01. Numbers 26
  to 36 answered no numbered question, except 28 (the six after-game
  questions) and 30 (the question "withdraw question 21?").
- **Fate.** "Stands" means the source still reads as current. "Amended
  by" names a later number that the record itself says changes it.
  "Overtaken by (inferred)" marks a later decision that contradicts part
  of an earlier one without naming it; the record does not say so, and
  the topic record should ask or state it. Folded, withdrawn and still
  open are as the state page and the owner site record them.
- **Topic** codes: **G** the goal and the frame; **W** the words;
  **S** what the engine must do (its scope and its boundaries);
  **D** how the design is made and in what order; **O** the owner's
  site; **R** how the work runs (documents, records, tools).

## 1. Numbers 1 to 36

| # | When | What it decided or asked | Fate | Proposed title | Topic |
|---|---|---|---|---|---|
| 1 | 2026-10-30, definition session, round 1 | The architecture pass is the next piece of work, the paused hardening pieces and the truth sweep wait for it, and it must say who decides each fact the GM sees plus five more questions, on the owner's condition that the orchestrator understands the engine and the roadmap. | Stands as amended by 5 (two questions reworded) and 11 (two questions added); 9 words a seventh. | The architecture pass is the next work | G |
| 2 | 2026-10-30, round 1 | The pass is a roadmap revision run the way the September re-charter ran: evidence, a draft with numbered questions, a hostile review, question rounds, ratification; the glossary entry waits until the pass's difference from the truth sweep is settled. | Stands in outline. The glossary entry was written under 7. The order of the work is now 31's (which amends 12, 14 and 15, the decisions that spelled 2 out). "A draft with numbered questions" meets 36 (titles on the owner's pages). | Run the pass like the re-charter | D |
| 3 | 2026-10-30, round 1 (the outside-program clause confirmed in round 2) | Four terms go into the glossary: runtime state, authority, copy and delivery path; an outside program can be an authority (VLC decides what is playing); "verdicts" names what one truth checks. | Stands. | Four words for the game's live facts | W |
| 4 | 2026-10-30, round 2 | Green's three follow-ups ship as one small task as soon as the definition session ends. | Stands, done: merged 2026-10-30 at `089dd527`. | Green's follow-ups ship before the pass | R |
| 5 | 2026-10-30, round 2 | The question set is reworded: "can anything other than the live engine touch the live show?", "what does each fact and each copy do at a boundary?", and a new question on what each component receives, starting from the settled roles of the scanners and scoreboards. | Stands as amended by 9 (the new question's wording). | Two questions reworded, one role question added | S |
| 6 | 2026-10-30, round 2 | The truth sweep's charter is retired; its purpose (proving every screen tells the truth with rig tests and screen captures) moves into the build work the pass plans, and its census and five desync bugs become evidence. | Stands. | The truth sweep's charter is retired | D |
| 7 | 2026-10-30, round 3 (option c) | The pass is one program in two halves: the design half decides the shared rules for the whole engine and ends with the new roadmap; the build half changes the engine area by area, each area designed just before it is built and starting with its proof test failing on today's engine, before capture, preview and phones; the pass ends when every rule's test passes on the rig. | Stands; its halves renamed by 34. Overtaken in part by 30 and 31 (inferred): the build plan now starts with a thin first version on a new test bench, and pinning today's behaviour first returns only if the engine is changed in place. | One program: design half, then build half | D |
| 8 | 2026-10-30, round 3 | Blue's fixes and unfixed findings are evidence: for each, the problem area, the design cause, every other place with that cause, the design choice that removes it and the proving test; fixes sharing a cause become one design decision. | Stands as qualified by 26 (clues to where the design is off, never the driver) and 31 (the sixteen design flaws become test cases for the designs). | Blue's fixes are evidence of design causes | G |
| 9 | 2026-10-30, round 3 | The role question reads "does each component receive what its role needs, and no more?", starting from the settled roles, which stay as designed: player scanners show content and report scans, the GM scanner is the command center, the scoreboards show public results. | Stands. | The role question starts from settled roles | S |
| 10 | 2026-10-30, round 4 | The design half hands over five documents: the rules with a plain-words proof test each, the cause analysis, contract proposals written before code, a short decision record for each hard-to-reverse choice in a new `docs/adr/`, and the new roadmap with the build half's areas in order. | Stands as written. Overtaken in part (inferred): 31 orders the design by hard-to-reverse decisions rather than one rule per question, and 33 turns the contract proposals into one published protocol. | Five documents the design half hands over | D |
| 11 | 2026-10-30, round 4 | Two more questions: "how may a copy be updated, and can a screen tell how old it is?" and "is each fact's reconnect snapshot built the same way as its live update?"; four of the questions are designed together as one rule for live state. | Stands for the questions. "Designed together" is overtaken in part by 31 (inferred): the design rounds now go by decision, not by question. | Two questions on copies and reconnects | S |
| 12 | 2026-10-30, round 4 | The design half's method, in order: the cause analysis as one small workflow; the test rig rebuilt and used to reproduce the unrun findings; design rule by rule with `codebase-design` and `improve-codebase-architecture`, competing designs side by side, throwaway prototypes, every rule saying how it serves hot-apply, the preview engine, capture and phones; a hostile review; question rounds; ratification. | Amended by 15 (the order and the readers), 22 (standalone games join the list every rule serves), 30 (the rig no longer comes before design) and 31 (the top-down order). The two design skills stand (`process.md` cites this decision). | The design half's method and tools | D |
| 13 | 2026-10-30, round 4 | The design half ends at ratification once every question has a rule and proof test, every finding and blue fix is placed or set aside with a reason, every rule says how it serves the planned capabilities, the review's blocking findings are resolved, and the rig reproduces each finding marked for live proof. | Stands except its last condition, overtaken by 30 (inferred: the rig is built when building starts). 31's top-down order may change "every question has a rule" (to confirm). | When the design half is finished | D |
| 14 | 2026-10-30, round 5 | Every decision is made in a question round with the evidence in view and written into its document at once, so ratification is a skim; the approved flow was cause list, facts, one page per rule with the owner's pick, review findings as questions, the build order, ratification; the rule stands for every unit. | Amended by 15 and 31: the flow is now 31's order. The rule for every unit stands (`process.md` section 5, last bullet). | Decide in question rounds, never at sign-off | R |
| 15 | 2026-10-30, round 6 | Three corrections: (a) the design half's order is cause analysis, test rig, design, a proposed build order, its review, one question round, ratification; (b) the merged hardening pieces stay, changed only where a rule requires; (c) the cause analysis's readers are split by source, then merged by cause, then checked. | Amended by 31. Part (a) is overtaken by 30 and 31. Part (b) stands. Part (c) stands and is done. | Corrections to order, hardening and readers | D |
| 16 | 2026-10-30, round 7 | The owner ratified the program document; the definition session closed and the architecture pass became the current work, design half first. | Stands. | The owner ratified the program document | R |
| 17 | 2026-10-30, round 8 (question) | Asked: is the list of sixteen design causes right? | Folded into the promises question: from 2026-11-01 the engine's jobs, now its promises, replaced the cause list as the front of the work (EJ line 9; DJ intro). Still open there. | Is the list of design flaws right? | S |
| 18 | 2026-10-30, round 8 (question) | Asked: what to do with the three design causes none of the pass's nine questions covers (joins kept by hand on two sides, the deployed kit's unchecked pieces, tests that pass without proving the real path). | Folded into question F on the owner site (CS line 274; DJ intro). Still open there. | Flaws none of the pass's questions covers | S |
| 19 | 2026-10-30, round 8 (question) | Asked: should the game record every GM scan attempt and its answer, refused ones included? | Still open. The owner asked for the orchestrator's view; the recommendation is yes, record and show nowhere until a feature needs it; the owner's yes is awaited. | Record every refused GM scan attempt? | S |
| 20 | Asked 2026-10-30, answered 2026-10-31, round 8 | Asked whether the pass needs a rule for documents that disagree with the code; decided: no rule in the pass, documents are fixed as we go, always. | Stands (`process.md` section 4, last paragraph). | No rule for documents: fix as we go | R |
| 21 | 2026-10-30, round 8 (question; re-asked in plain words 2026-10-31) | Asked: how many of the findings marked for live proof should the test rig reproduce before design starts? | Withdrawn by 30 (2026-11-01). The state page still lists it as open (CS lines 177 and 229). | How much the rig proves before design | D |
| 22 | 2026-10-31, round 8 | Standalone games join the list every rule must serve: a whole game can run with no engine, as a choice the game declares; no game mixes networked and standalone devices; the ESP32's missing standalone mode is a parity gap, recorded on the owner's parity reasoning. | Stands. Its ESP32 reading waits for the owner's explicit word (open on the owner site). The question's own wording is not kept in any record; PL records the answers (a), (b) and the owner's "why new" on the ESP32. | Standalone games: declared, never mixed | S |
| 23 | 2026-10-31, round 8 (question, from SP section 3.4) | Asked: is "nothing declares that a game is standalone" a seventeenth design cause, or do its findings go under the existing causes? | Folded into question C on the owner site (CS line 274; DJ intro). Still open there. | Is the missing standalone declaration a flaw? | S |
| 24 | 2026-10-31, round 8 (question, from SP section 3.4) | Asked: does a standalone game run on one GM tablet? | Still open. Recommendation: one tablet, unless the owner plans standalone games with two GMs. | One GM tablet per standalone game? | S |
| 25 | 2026-10-31, round 8 (question, from SP section 3.4) | Asked: with no engine and no TV, what do exposed evidence and video tokens do? | Still open. Recommendation: exposed evidence shows on the tablet's own scoreboard screen; a video token shows its picture with a plain note. | Exposed evidence and video with no engine | S |
| 26 | 2026-10-31 (owner direction, no question) | The pass designs the best architecture for the engine's long-term use as it grows beyond ALN; blue's fixes and findings are clues to where today's design is off, never the driver. | Stands. The owner's own words for the goal are recorded with 31. | Design for the long term, beyond ALN | G |
| 27 | 2026-11-01 (no question) | The pass's words: a promise is what a person can count on at a given moment, and "job" is retired; parts keep promises, design flaws break them, a quality is something every part must have, a moment is when a promise matters; the venue technician fits a kit to a venue; promises carry titles only; the shared work becomes parts. | Stands. Widened by 36: decisions, questions and design flaws also go by titles. | Promises, qualities, moments, venue technician | W |
| 28 | 2026-11-01 (answers the six after-game questions) | The after-game article and emailer: the night's-record promise names the director and the players after the show; what players receive is the game's business; the night's record carries the pack and the texts the players saw; players' emails stay outside the engine; the Director Console stays separate and reads the record, shaped so it can later join the Review stage; the two clocks join the existing flaw on facts decided by tablets. | Stands. One part is still open for the design rounds: whether paper documents join the pack, with "unlocked" recorded during play. | The night's record and the after-game article | S |
| 29 | 2026-11-01 | The owner page becomes five linked pages built from one set of data (the engine, decisions, promises, parts, design flaws) plus a change log; nothing in version 7 has to stay. | Stands. 31 asks for the site to be reframed fully to the proactive frame. | The owner's site: five linked pages | O |
| 30 | 2026-11-01 (answers "withdraw question 21?") | The test rig no longer comes before design: it is built when building starts, as part of the new test bench where a thin first version runs end to end; if the plan for moving from today's engine chooses to change it in place, pinning down today's behaviour first comes back. | Stands. | Build the test rig when building starts | D |
| 31 | 2026-11-01 | The rest of the design half goes top-down: finish the requirements (the owner's answers, quality targets as testable situations, the ways the platform must be extended and by whom); then design rounds ordered by the hardest decisions to reverse, each with two or three designs checked against the promises, targets, extension cases and today's sixteen design flaws; then a build plan starting with a thin first version; the owner site is reframed and the sequencing words made unambiguous. | Stands. It amends 12, 14 and 15. | Design top-down, hardest-to-reverse choices first | D |
| 32 | 2026-11-01 | An independent panel of architects, who have not seen the orchestrator's reasoning, proposes and stress-tests the top-level design decisions before the first design round; its brief goes to the owner before it runs. | Stands; its context plan is 35. | Independent architects propose the top-level design | D |
| 33 | 2026-11-01 (after the explanation the owner asked for) | One published, versioned protocol defines everything that crosses the engine's edge (device requests, the engine's answers and screen messages, and the files that carry a game or a night); every program is generated from it or checked against it; it is designed early; the tests become a test bench outside the engine, and "Proof" stays a quality. Together they replace "Joins and proofs". | Stands. It settles the "Pending" note (section 4). | One published protocol and an outside test bench | S |
| 34 | 2026-11-01 (owner OK, decision numbers excepted) | One set of sequencing names: the pass has a design half and a build half; its steps are named by what they do; roadmap blocks go by name, question rounds by date, test levels by name; no page uses a bare phase, step, block or round number. | Stands as amended by 36, which settles the decision-number exception. | Name each step by what it does | W |
| 35 | 2026-11-01 (owner OK) | The panel first gets the goal, the requirements and the setting; only after its first proposals, today's engine as facts and the sixteen design flaws as test situations; the orchestrator's recommendations and earlier design lists are withheld, the candidate shape enters later as one more proposal; three architects propose blind, then critique each other; it runs after the owner confirms the requirements. | Stands. | What the architects' panel sees, and when | D |
| 36 | 2026-11-01 | Decisions, questions and design flaws go by short plain titles in conversation and on the owner's pages, ids stay only inside records; the decision record is reorganized by topic, each standing decision written as current truth with a dated history beneath, superseded ones moved into that history. | Stands; being applied (this inventory is part of it). It settles the "Under discussion" note (section 4). | Titles, not numbers, and a topic record | R |

Rows: 36.

## 2. Other numbered and lettered questions

The table above covers every number from 1 to 36. Three more sets of
questions carry numbers or letters of their own and collide with it.

### 2.1 The pass's nine questions (PD section 3)

Numbered 1 to 9 inside the program document, so "question 6" and
"decision 6" name different things today.

| Q | Came from | What it asks | Fate | Proposed title | Topic |
|---|---|---|---|---|---|
| Q1 | 1 | Who decides each fact the GM sees (the authority)? | Stands, the pass's central question. | Who decides each fact | S |
| Q2 | 1 | Does a service's state travel with its health? | Stands. | Service state travels with its health | S |
| Q3 | 1 | How does the engine read the programs it drives? | Stands. | How the engine reads its programs | S |
| Q4 | 1, reworded by 5 | Can anything other than the live engine touch the live show? | Stands. | Only the live engine touches the show | S |
| Q5 | 1 | Does one question get one answer? | Stands. | One question gets one answer | S |
| Q6 | 1, reworded by 5 | What does each fact and each copy do at a boundary (a game starting or ending, a system reset, a restart, a pack change while running)? | Stands. | Each fact at a game boundary | S |
| Q7 | 5, worded by 9 | Does each component receive what its role needs, and no more? | Stands. | Each component gets what its role needs | S |
| Q8 | 11 | How may a copy be updated, and can a screen tell how old it is? | Stands. | How copies update and show their age | S |
| Q9 | 11 | Is each fact's reconnect snapshot built the same way as its live update? | Stands. | Reconnect snapshot built like live update | S |

The nine stand in the program document. Under 31 the design rounds go by
hard-to-reverse decision, and the nine serve as checks (inferred; to
confirm when the topic record is written).

### 2.2 The promises question and questions A to G (EJ section 4; DJ)

First drafted 2026-10-31 as questions on the engine's jobs; reworded
2026-11-01 on the owner site (version 8). All wait for the owner.

| Q | What it asks | Fate | Proposed title | Topic |
|---|---|---|---|---|
| Promises | Are these the right ten promises, each read from the side of the people who count on it? (Holds question 17.) | Open. | Are these the right ten promises? | S |
| A | Keep the two clauses added to the pack promise: a second designer's game runs on the same engine, and every device plays the same pack version and shows which? | Applied, the owner's word asked. | Two clauses added to the pack promise | S |
| B | Keep the roles promise widened to cover who may do what, not only who sees what? | Applied, the owner's word asked. | The roles promise covers who may act | S |
| C | Keep the venue promise's clause that a standalone game is a declared choice, never mixed, and is the missing declaration a design flaw of its own? (Holds question 23.) | Applied, the owner's word asked. | The venue promise names declared standalone | S |
| D | Split the tap promise into "Every tap gets its answer" and "The night can be told afterwards"? | Open. | Split the tap promise in two? | S |
| E | Keep the venue promise as one, titled "The game fits the venue it is in tonight"? | Recommendation changed by the relationship map; open. 27 already made that title a promise. | Keep the venue promise whole? | S |
| F | Keep the developer's proof and the release day in one promise, split them, or move release day? (Holds question 18.) | Recommendation changed by the map; open. | Proof and release in one promise? | S |
| G | Which promise carries the equipment's state on every screen? | Recommendation changed by the map; open. | Which promise carries equipment state on screens? | S |

### 2.3 The six after-game questions (AG)

Asked and answered 2026-11-01. The answers are decision 28; propose
folding these into 28's entry rather than giving them titles of their
own.

| Q | What it asked | Fate |
|---|---|---|
| AG1 | Should the second half of the tap-and-record promise name the director and the players after the show? | Answered yes (28). |
| AG2 | Do the players after the show get a promise of their own? | Answered no: the game's business (28). |
| AG3 | Should the night's record carry the pack and the texts players held, and should paper documents join the pack? | First half answered yes (28); paper documents still open, for the design rounds. |
| AG4 | Does the engine ever hold players' emails and consent? | Answered no (28). |
| AG5 | What does "integrate" the Director Console mean? | Answered: it stays separate and reads the record, shaped for the Review stage later (28). |
| AG6 | Do the two clocks join an existing flaw or become a new one? | Answered: they join the flaw on facts decided by tablets, as finding X-08 (28). |

## 3. Open items with no number

- Where the fact "this game is standalone" is held: the game record,
  the pack, the venue profile or each device (CS lines 181-182; SP
  section 3.4, its fourth question). Kept for the design rounds.
- Whether paper documents join the pack (AG3, second half).
- The owner site's list of design choices for the design rounds (DJ
  `step3`): eleven entries, from where standalone is declared to the
  order of the work. These are design questions, not decisions, and
  carry no numbers.

## 4. Notes that became decisions

- **"Pending"** (added with 32, 2026-11-01; removed by commit
  `5dc79eaf`): replacing "Joins and proofs" with two design decisions,
  the published protocol and a test bench outside the engine; the
  owner leaned yes and asked first for an explanation of the protocol.
  Became 33.
- **"Under discussion"** (added with 33 to 35, 2026-11-01; removed by
  commit `a548d0f2`): the owner questioned numbering decisions at all.
  Became 36.
- The definition session's open notes ("Still open from round 1",
  "Open in round 3", "Open in round 4"; state page history,
  2026-10-30) became 4, 7, 8, 9, 10, 11, 12 and 13. They carried no
  numbers of their own.

## 5. Where the living documents use decision and question numbers

Line numbers are as of commit `4660b2b4` (2026-11-01); the four files last changed at `a548d0f2`.

### 5.1 The architecture pass's own numbers

**`docs/plans/CURRENT-STATE.md`**

| Line | Number | Text |
|---|---|---|
| 15 | decisions 1 to 16 | "its Appendix A holds the definition session's decisions 1 to 16" |
| 24-25 | round 8; questions 17 to 21 | "waiting for the owner's confirmation (round 8, questions 17 to 21)" |
| 33 | (rule) | "A decision carries the number of the question it answers." |
| 34 | 20; round 8 | list entry "20. No rule for documents in the pass (round 8)" |
| 36-38 | 22; round 8; decision 12 | list entry "22. Standalone games join the list ... (round 8; widens decision 12's list)" |
| 46 | 26 | list entry "26. The pass's frame" |
| 55 | 27 | list entry "27. The pass's vocabulary" |
| 71 | 28 | list entry "28. The after-game article and emailer" |
| 89 | 29 | list entry "29. The owner page becomes five linked pages" |
| 94-95 | 30; question 21 (twice) | list entry "30. ... answering \"withdraw question 21?\"): question 21 is withdrawn" |
| 101-103 | 31; decision 26; decisions 12, 14 and 15 | list entry "31. ... proactive frame of decision 26 (...; amends decisions 12, 14 and 15)" |
| 124 | 32 | list entry "32. An independent panel of architects" |
| 129 | 33 | list entry "33. The published protocol and the test bench" |
| 141-142 | 34; "decision numbers" | list entry "34. One set of sequencing names (owner OK, 2026-11-01, except decision numbers, which are under discussion)" |
| 150 | 35 | list entry "35. The panel's context plan" |
| 165 | 36 | list entry "36. Titles, not numbers" |
| 174-181 | round 8; 17, 18, 19, 21, 22, 23, 24, 25 | "Open in round 8 ...: 17 (...), 18 (...), 19 (...), 21 (...), 22's ESP32 reading (...), ... 23 (...), 24 (...) and 25 (...)". Lists 21 as open although 30 withdrew it. |
| 199 | decision 27 | "now in the owner's words (decision 27: workflows ..." |
| 219 | questions E, F, G | "recommendations: E (rename J8, not split), F (widen J10), G (route ..." |
| 228-230 | promises question; A to G; 22, 24, 25; 19; 21; decisions 28 and 29 | "thirteen questions on its Decisions page (the promises question; A to G; 22, 24, 25; 19; 21). Decisions 28 and 29 are folded in." Lists 21 after its withdrawal; line 230 still names the test rig as next, which 30 changed. |
| 235 | decision 29 | "change log (decision 29)" |
| 261 | decision 27 | "published 2026-11-01 in the words of decision 27" |
| 272-274 | A to G; 22, 24, 25, 19, 21; 18 into F; 23 into C | "Questions: the jobs (is the list right; A to G), the standalone questions (22's ESP32 reading, 24, 25), 19 and 21; 18 is folded into F and 23 into C." |
| 350 | decision 6 | "purpose now moves into the pass's phase 2 (decision 6)" |
| 353 | decision 15 | "them only where a rule requires (decision 15)" |
| 354 | decision 7 | "To be rebuilt inside the pass's phase 2 (decision 7)" |
| 363 | decision 6 | "2, covering every screen (decision 6)" |
| 366 | decisions 7 and 10 | "the new roadmap places Block 6 (decisions 7 and 10)" |

**`CONTEXT.md`**

| Line | Number | Text |
|---|---|---|
| 99 | decision 22 | "(owner, 2026-10-31, architecture pass decision 22)" |
| 386 | Appendix A (the record, no number) | "decision record: `docs/plans/2026-10-30-architecture-pass.md`, Appendix A" |
| 413 | decision 27 | "\"venue installer\" (owner, 2026-11-01, decision 27)" |
| 545 | decision 28 | "stay the game's business, outside the engine (decision 28," |
| 694 | decision 26 | "driver (owner, 2026-10-31, decision 26)" |
| 695 | Appendix A (no number) | "decision record: `docs/plans/2026-10-30-architecture-pass.md`, Appendix A" |
| 701 | decision 27 | "2026-10-31 (owner, 2026-11-01, decision 27)" |
| 722-723 | Appendix A (no number) | "(decision record: `docs/plans/2026-10-30-architecture-pass.md`, Appendix A)" |

**`docs/plans/ROADMAP.md`**

| Line | Number | Text |
|---|---|---|
| 201-202 | Appendix A (no number) | "decision record: `2026-10-30-architecture-pass.md`, Appendix A" |
| 337 | Appendix A (no number) | "decision record: `2026-10-30-architecture-pass.md`, Appendix A" |
| 376 | decision 28 | "(decision 28, 2026-11-01)" |
| 615 | decision 28 | row 8.10: "The plan (decision 28, 2026-11-01)" |

**`docs/agents/process.md`**

| Line | Number | Text |
|---|---|---|
| 31 | decision 12 | "(`docs/plans/2026-10-30-architecture-pass.md`, Appendix A, decision 12)" |
| 227-228 | round 8 | "(owner, 2026-10-31, the architecture pass's round 8)" |

The "Appendix A" rows carry no number but point at the numbered record,
so they need a new target when the topic record replaces it.

### 5.2 Numbers from other records (not the pass's)

These belong to earlier series: the September re-charter's and earlier
roadmap questions (Q1 to Q13, Q1r), the 2026-06-10 Tier-E decision
record (E1 to E11), Track E's numbers, and pack-work rulings. They are
outside this inventory's 1 to 36, but they are decision and question
numbers in the living documents, so they are listed.

**`CONTEXT.md`**

| Line | Number | Text |
|---|---|---|
| 123 | ruling D3s2 | "such scans are repeatable and register nothing (ruling D3s2)" |
| 140-148 | Tier-E decisions E1 to E11; decision E1, E2, E4, E5, E10; Track E's E1 to E5 | the "E-numbers" entry, which warns that the two series collide |
| 170 | owner ruling Q1 | "ALN's declared label is **Account** (owner ruling Q1, built 2026-08-29)" |
| 205 | A2 | "therefore never change mid-session (A2)" |
| 220 | slice-1 D1 | "(slice-1 D1)" |
| 292 | decision E5 | "**Timeline (three-segment model, decision E5).**" |
| 309 | owner ruling Q6-2 | "(slice 6, owner ruling Q6-2)" |
| 379 | E10 | "**Hot-apply (E10)**" |
| 574 | E4 | "the device sets the upper limit (E4)" |
| 595 | E4 | "finer non-floor taxonomy are Phase-4 E4" |
| 602 | Q11(a) | "refuse-on-base-mismatch (Q11(a):" |
| 734 | roadmap r4, Q4 | "restructured 2026-09-05 (roadmap r4, Q4)" |
| 761 | E4 | "until E4 makes functions pack-assignable per device class" |

**`docs/plans/ROADMAP.md`**

| Line | Number | Text |
|---|---|---|
| 126 | Q10 | "(2026-08-29, Q10)" |
| 133 | E10 | "historical: E10" |
| 171 | Q1r | "(ratified, Q1r: ..." |
| 194 | Q9 | "the first unit (Q9)" |
| 197 | Q5 | "Gate (ratified, Q5)" |
| 210 | Q5 | "this state (Q5, replacing r3's flat ..." (the source has a dash) |
| 218 | Q8 | "(Q8's ratified mitigation: ..." |
| 225 | Q7 | "candidate, Q7" |
| 227 | Q12 | "A safety rule rides it (Q12, ratified)" (the source has a dash) |
| 238 | Q4 | "**Where \"done\" lives (ratified, Q4).**" |
| 280 | Q9 | "(first unit, ratified Q9)" |
| 287 | Q13 | "(the boot pain's first half, Q13)" |
| 294 | Q8 | "Screen baselines (Q8)" |
| 313 | Q13 | "**The honesty rule (ratified, Q13):**" |
| 353 | Q8 | "tests join here (Q8)" |
| 356 | Q2 | "vocabulary (ratified, Q2)" |
| 381 | Q6 | "Sub-scope ratified (Q6)" |
| 383 | Q3 | "Position ratified (Q3)" |
| 391 | Q7 | "(ratified as candidate, Q7)" |
| 400 | Q7 | "This slice's final contents follow that grill; Q7" |
| 452 | Q8 | "which is what Q8's screen ..." |
| 520 | Q9 | "the Q9 owner task" |
| 592 | Q12 | "(before previewable, Q12)" |
| 611 | E10 | row 8.6, "Hot-apply (historical: E10)" |
| 637 | Q11 | "Created at ratification (Q11)" |
| 659 | Q3 | "once the capture block is priced (Q3)" |
| 697 | A1 / A2 / A3 | alias table row |
| 708 | Track E's E1 to E5 | alias table row |
| 709 | decision E1/E2/E4/E5 | alias table row, marked as colliding with Track E |
| 710 | E10 | alias table row |
| 740 | Q8 | "test (Q8) would catch" |
| 783 | Q13 | "the boot-to-running posture (Q13)" |

`docs/agents/process.md` has none.

Sequencing numbers (phase, step, block and round followed by a digit)
are outside this list. A count for the follow-up sweep: `CONTEXT.md`
13, `ROADMAP.md` 42, `process.md` 2, `CURRENT-STATE.md` 34.

## 6. Proposed topics

| Topic | Numbers | Questions |
|---|---|---|
| The goal and the frame | 1, 8, 26 | |
| The words | 3, 27, 34 | |
| What the engine must do (its scope and its boundaries) | 5, 9, 11, 22, 28, 33 | the nine (Q1 to Q9); 17, 18, 19, 23, 24, 25; the promises question and A to G; AG1 to AG6 |
| How the design is made and in what order | 2, 6, 7, 10, 12, 13, 15, 30, 31, 32, 35 | 21 |
| The owner's site | 29 | |
| How the work runs (documents, records, tools) | 4, 14, 16, 20, 36 | |
