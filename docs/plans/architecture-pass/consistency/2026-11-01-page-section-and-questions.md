# Page check: the top, "How the jobs fit together", and the questions

- **Date:** 2026-11-01. **Tree:** `/home/user/ALN-Ecosystem`, branch `claude/nice-curie-hescfv`, at `51657542`.
- **What I read:** the built page `docs/plans/architecture-pass/report/2026-10-31-cause-report.html` (as text, and its HTML where a field's source mattered); its builder `report/build_report.py` (BUILT, SET_ASIDE, FIT_SUMMARY, OVERVIEW, FIT_DEVICES, `fit_html`, `job_html`, TEMPLATE); `report/2026-11-01-engine-shape.json`; `report/2026-10-31-engine-jobs.json` (to check what the questions say about the jobs); `report/2026-10-31-cause-cards.json` (the change notes); `2026-11-01-engine-shape.md` in full, including section 8; `2026-10-31-engine-jobs.md` sections 2 and 4 (EJ); `docs/plans/CURRENT-STATE.md` section 0 (CS); the set-aside table in `2026-10-30-cause-analysis.md` section 3; and the earlier questions in `git show 1c2e99a9:.../build_report.py`, to see which recommendations changed. Nothing was run except text extraction. `backend/.env` and the top-level clones were not opened.
- **Scope:** the header, "What you are deciding", "How to read a job", the design words, the section "How the jobs fit together" (id `fit`), and the questions at the end. Where a job's own text decides whether a question is true, I read that job's text too.
- **Rule:** refute by default. A claim I could not confirm against its source is a conflict.
- **Result:** 27 conflicts, 227 claims checked.

## Conflicts

"Shape" means `2026-11-01-engine-shape.md`; "builder" means `report/build_report.py`; "shape JSON" means `report/2026-11-01-engine-shape.json`; "jobs JSON" means `report/2026-10-31-engine-jobs.json`.

| # | Where on the page | What it says | What it should say, and why | File and field to change |
|---|---|---|---|---|
| 1 | Questions, "Are these the right ten jobs…" | "Eight have a proposed new title written that way, J8 and J9 among them." | "All ten have a proposed new title written that way; the old title shows under each." Every job on the page shows "Proposed title. It was…", and the shape's section 1 proposes a title for all ten. The count of eight dates from before check rows 1.8 and 1.9 gave J6 and J7 new titles (shape section 8). | builder, TEMPLATE, first `.q` under "About the jobs" |
| 2 | "What you are deciding", third paragraph | "Everything is at the end, each with a recommendation." | "Everything is at the end. Most questions carry a recommendation; the jobs question and question 22 ask for your word." The jobs question and question 22 have no recommendation, and question 25 has a "suggestion". | builder, TEMPLATE, `.decide` third `<p>` (or add recommendations to those two questions; see row 10) |
| 3 | Question A, heading and body | "J1 now says nothing in the engine assumes ALN, and every part of the kit runs the same version of the pack and says which." | J1 on the page no longer says the first clause. Its need says "A second designer's game runs on the same engine", and its change note says the toy-pack proof moved to J10. The heading should describe J1 as it now reads, for example: "J1 now says a second designer's game runs on the same engine, and every device plays the same version and shows which. 'Nothing in the engine assumes ALN' is now a quality every job has (Generic, in 'How the jobs fit together')." The shape's question note A places that clause on the Generic quality (shape section 5, A). Keep the recommendation; it still follows. | builder, TEMPLATE, question A `<h3>` and first `<p>` |
| 4 | Question C, first paragraph | "the venue profile (the map's favourite, since it already says what the kit brings tonight)" | The shape gives a different reason: "the dormancy idea (a profile with no engine equipment, so every engine duty reads dormant) already carries the right words" (shape section 5, C; shape JSON `questionNotes` C). Say: "the venue profile, which the map favours: a profile that lists no engine equipment already makes every engine job read 'not installed tonight', which is what a standalone game needs." | builder, TEMPLATE, question C first `<p>` |
| 5 | Question C, second paragraph | "On the map it lands on the same two parts either way." | The shape's flaw list says N1 lands on "P2, P12, or P3 if the owner puts the declaration in the game record" (shape section 4.1, the list after P17). Say: "On the map it lands on the pack channel and venue fit, or on the game record if the declaration is kept there. The answer to 23 does not move it." | builder, TEMPLATE, question C second `<p>` |
| 6 | Question D, recommendation | "Recommendation: split. Question 19 belongs with the night's record." | Question 19 on the same page says it decides "whether the game's record keeps refused attempts, or only the answer goes back to the tablet", and the shape's choice 10 says it decides whether P3 (the game record) records refused actions or only P4 (answering) answers them. Neither is the night's record. The recommendation also gives no reason drawn from what D says. Say: "Recommendation: split. The two halves serve two people at two moments and share no part, so two sentences let each find their need. Question 19 is about the game's record and answering, not the night's record." | builder, TEMPLATE, question D `.rec` |
| 7 | Question E, first and second paragraphs | "the installer's profile, which says what the kit brings, binds each of the pack's names to a real instrument, and gives one go or no-go"; the "tonight" title "leaves … other kits to a quality of every job" | The profile does not give the go or no-go. Venue fit (P12) offers the profile, the bindings and whether the engine starts or adopts each program; the verdict (P10) turns the profile into go, no-go or dormant (shape section 4.1, P10 and P12). Say: "…binds each of the pack's names to a real instrument and says whether the engine starts each program; the verdict turns it into one go or no-go." Also, J8's need on the page names a second kit in its third sentence ("A second kit or a new machine needs no change to engine code"). So say the "tonight" title "leaves standalone games and other kits to the job's sentences", which matches the cost line that follows. | builder, TEMPLATE, question E first and second `<p>` |
| 8 | Question F, first paragraph, options and recommendation | "The map splits J10 by moment"; options (b) and (c) carry no cost; "Recommendation: widen…" | A reader sees "the map splits" and then a recommendation not to split. The shape separates the two moments into a quality (the proof) and one small part (release), and says widening, splitting and filing release under J8 all fit the parts (shape section 5, F). Say "The map separates J10's two moments: the proof is a quality every part passes, and release day is one small part." Give each option its cost from shape section 4.4, last row: split gives the owner's release day a job with one small part; filing under J8 puts the installed-pieces check where the installer works but moves the owner's cutover away from the developer's proof. Then give the reason for widening from what the page says, for example: "both moments guard the same promise, that nothing reaches the live show unproven or before you say so, and the proposed title already names both." | builder, TEMPLATE, question F first `<p>`, `<ol>` items b and c, `.rec` |
| 9 | Question G, first paragraph and recommendation | "The map's answer: neither job needs to carry the route. One part, delivery, carries every fact…"; "Recommendation: change neither sentence. Both promises hold through the one delivery part…" | One delivery part is an open choice: the page's own alternatives table, row 1, offers "each job delivers its own facts" for step 3. The recommendation must say it rests on that choice. Also, the page already proposes new titles for both J2 and J4 (J4's change note moves "know its true state" to J9), so "change neither sentence" reads as untrue. Say: "Recommendation: add the equipment's route to neither job, as long as step 3 keeps one delivery part. If you choose the other way, each job delivering its own facts, the equipment's route belongs in J4, beside C2's card." | builder, TEMPLATE, question G first `<p>` and `.rec` |
| 10 | Question 22 | "On the map, a yes means the standalone declaration must reach a device that has no idea of it today. Is that right?" | Only the cost of yes is given. Add the cost of no from the page's own standalone section: the ESP32 then stays behind the phone with no engine, which J8's standalone line counts as "seven of 24 abilities", and shows a missing engine as a red outage. Then add a recommendation, or say why there is none. CS section 0 records 22 "on that reasoning; the owner's explicit word is asked for". | builder, TEMPLATE, question 22 `<p>` |
| 11 | Question 19 | Facts and "Recommendation: yes. Record every attempt and its answer, and show it nowhere until a feature needs it." | No cost is given for either side. From the page and shape choice 10: yes means the game record gains a kind of fact (refused attempts) that no screen shows yet. No means a refused attempt lives only on the tablet that scanned, as today (the set-aside row "A question for you"), and the night's record cannot tell it. | builder, TEMPLATE, question 19 `<p>` |
| 12 | Questions, "Coming in step 3" list | Nine items; "They are listed here so nothing arrives as a surprise." | Two alternatives that the alternatives table says "Step 3 puts each in front of you" are missing: one delivery part or each job delivering its own facts (alternatives row 1), and the lifecycle as one module or as a table each part reads (row 6). Add both. Rows 5 (J3) and 8 (release day) are covered by questions D and F, and the other eight items match shape section 6. | builder, TEMPLATE, step-3 `<ol>` |
| 13 | Step-3 preview item 8 against J4's long-term goal | Item 8 says where the start-or-adopt setting lives is open. J4's goal says "The profile says whether the engine starts or adopts each program." | J4's goal states the departure as settled. CS section 0 says this departure from the ratified capability map is put to the owner. The goal should say: "A setting says whether the engine starts or adopts each program; whether it lives in the profile or in a file of its own is open." | jobs JSON, `jobs[J4].goal` |
| 14 | "How the jobs fit together", summary, "Not all ten are the same kind." | J9 and J10 "become a label every fact carries … and a proof every part must pass, not parts of their own." | The page itself gives J9 a part of its own (the verdict; J9's change note says "with one part of its own, the Verdict") and J10 three (joins and proofs, engine instance, release). The shape says J9 "has one mechanism of its own, the verdict" and J10 "has two (checking the joins, keeping engines apart)" (shape section 1, last paragraph). Say: "J9 and J10 are mostly qualities every other job must have: a label every fact carries and a proof every part passes. Each also has a piece of its own: J9 the verdict; J10 the checks between parts, each engine's own names, and release day." | builder, FIT_SUMMARY item 4 |
| 15 | Summary items 1 and 2, and the at-a-glance diagram | "A spine." "A ring."; subgraphs "The spine: every tap" and "The ring: the machinery" | These are metaphors, against the house rules (process.md sections 4 and 5), and "ring" sits beside "loop" for a different set of jobs. Use plain headings: "What happens at every tap." and "The engine's own machinery." In the diagram: "At every tap" and "The engine's own machinery". | builder, FIT_SUMMARY items 1 and 2; OVERVIEW subgraph labels |
| 16 | `fit` intro paragraph | "This section answers at two levels: the jobs against each other, and the jobs against the pieces of the engine." | The owner asked for the two levels as the big components and the modules inside them (CS section 0, live state; shape title and section 3). Say: "This section answers at two levels: the big pieces (the engine, the tablets, the scanners, the scoreboards, the config tool) and the smaller parts inside them. It shows how the jobs depend on each other, where they sit in today's code, and one candidate shape for the whole engine." | builder, `fit_html`, `<p class="intro">` |
| 17 | Under the at-a-glance diagram, the collapsed full diagram | "Every dependency between the jobs (25)"; "The ones whose absence would break the job that uses them at a show tonight." | The 25 links are chosen by weight from 45 pairs, 32 of which carry a dependency. Two of the 25 are not dependencies: J9 to J2 is a quality and J10 to J6 is a shared piece (shape section 2.2). Say: "The 25 main links between the jobs". Then say: "23 are dependencies: without them the job that uses them breaks at a show. One is a quality and one is a shared piece; they are drawn dashed." | builder, `fit_html`, the `<summary>` and the `<p class="muted">` under it |
| 18 | The full diagram (collapsed) | The two links labelled "quality:" and "shared:" are drawn as solid arrows. | A solid arrow must be a dependency. The shape names these two as a quality and a shared piece (shape section 2.2). Draw them dashed (`-.->`), as the at-a-glance diagram already draws its quality line. | shape JSON, `relationsMermaid` (edges `J9 -->|"quality: …"| J2` and `J10 -->|"shared: …"| J6`) |
| 19 | The full diagram's labels | "adopted pack: rules, modes, groups", "cues, clock rules, surfaces", "profile: installed, bindings, host mode", "who is the authority with no engine", "dormant verdict: silence cues, no restart", "phase gate, the end writes the night's record", "apply window: setup or ended", "shared: per-engine naming layer" and others | These are compressed jargon chains, against the house rules. The owner reads this diagram. Rewrite each label in a few plain words, for example: "the rules of the pack in use", "which programs the engine starts", "who decides with no engine", "not installed tonight: no cues, no restarts", "which moments allow a scan; the end writes the night's record", "a change applies only before or after a game", "shared: each engine's own names". | shape JSON, `relationsMermaid` labels |
| 20 | "Which parts run where", the seven device lines | Present tense, as facts: "A GM tablet in a networked game … keeps no list of its own and decides nothing before the engine answers"; "The scoreboards are one page in two places … deciding nothing"; "The config tool … talks to the running engine only by message"; "The tests run on an engine of their own … and never touch the live one." | These describe the candidate shape, not today. The tangles in the same section say the opposite about today: the tablet decides before the engine answers (tangle 2), the scoreboard decides the evidence rule (tangle 13), the config tool works by file and import (tangle 10), and tests use the live display (tangle 8). Two of the lines are also open choices (shape section 6, choices 8 and 9). Title the block "In the candidate shape, which parts would run where", write each line with "would", and end the scoreboard and config-tool lines with "(an open choice; see step 3)". | builder, FIT_DEVICES (all lines) and the `<h3>` in `fit_html` |
| 21 | The part cards for Connections and roles, Equipment, Show runner, Verdict and Engine instance, "Runs on" | "the engine" only (Verdict: the engine and the config tool; Engine instance: the engine, the config tool and the tests) | Shape section 4.3 (check row 4.3d) says a standalone tablet needs its own small version of each of these five parts. The page's own device line and J7's standalone line ("a Connections and roles stand-in knows one connection, itself") say so. Add "GM tablets (a small stand-in in a standalone game)" to each. | shape JSON, `parts[P7,P8,P9,P10,P13].runsOn` (or a note in `part_html`) |
| 22 | "What several jobs share", row "Knowing who is connected", Jobs column | J7 J2 J3 J4 J5 J6 J8 J9 | The shape lists J1 as well, thinly: the pack's version passed when a device connects (shape section 2.3, M-C). Add J1, or say in the row why the thin link is left out. | shape JSON, `mechanisms[2].jobs` |
| 23 | "What several jobs share" (row "The verdict"); the Verdict part card; the design words | "each line paper or live"; the words "pass", "dormant" and "verdict" used throughout | "Paper or live" is defined nowhere on the page. "Pass" (the key a device shows when it connects) is not defined either. The design words box lists the step-3 words but not these, which the fit section uses most. Add to the design words: "Paper or live: checked from the files only, or checked against the equipment in the room"; "Pass: what a device shows when it connects, which says who it is and what it may do"; "Not installed tonight (dormant): grey, absent on purpose, never a fault". | builder, TEMPLATE `dl.terms`; shape JSON `mechanisms[5].plain` and `parts[P10].plain` may then keep the words |
| 24 | "Where a real alternative exists", the table | Columns "Candidate" and "The other way", but every cost cell says "A needs…", "B keeps…"; costs use "the truth sweep", "a generic store", "the rig", "the doors", "C5's shape in a new coat"; intro: "the map found two sound ways to build the part" | The reader is never told that A is the candidate and B the other way. Name the columns "A, the candidate" and "B, the other way", or write "The candidate…" and "The other way…" in each cost cell. Replace the jargon and the metaphor: "the truth sweep" with "the check that every screen shows each fact's label"; "a generic store" with "one store on every screen that holds any fact"; "C5's shape in a new coat" with "the same fault as C5: a list kept by hand that a test must check". Rows 5 and 8 are about the jobs' wording, not how to build a part, so the intro should say "two sound ways to build a part or to word a job". | builder, `fit_html` alternatives `<thead>` and intro `<p>`; shape JSON `alternatives[0..7].cost` |
| 25 | "How to read a job", first paragraph | "Then come what is built today, the long-term goal, and the parts of the candidate shape that would carry it." The second paragraph says only cards carry a change note. | The page shows, in order: the change note, the parts that carry the job, then "Built today" and the goal (`job_html`). Every job also carries a "Changed after the relationship map" note. Say: "Then come a note on what the relationship map changed, the parts of the candidate shape that would carry it, what is built today, and the long-term goal." | builder, TEMPLATE, "How to read a job" first `<p>` |
| 26 | J9, "Built today" (BUILT, hand-written) | "Health words healthy, down and dormant (grey); held items; a first, minimal preflight." | Held items belong to the show runner, under J4 (shape section 3.2, J4 row, `heldItemsStore`; part P9), and J4's "Built today" already lists them. Drop "held items" from J9, or say what J9 adds ("held items shown with the service that blocks them"). | builder, `BUILT['J9']` |
| 27 | Question 25 | "This decides what the screens draw in those two cases." Suggestion: evidence on the tablet's own scoreboard; a video token shows its picture with a plain note. | No other way is named and the suggestion has no cost. Name the other way and both costs, for example: the suggestion needs the tablet's scoreboard screen to show exposed evidence; the other way, showing nothing for exposure and hiding video tokens, is smaller but drops a mode's effect in a standalone game. Shape choice 3 says this decides what the screens draw on a standalone device. | builder, TEMPLATE, question 25 `<p>` |

## Checked and found consistent

**Counts.**
- Ten jobs; seven questions A to G.
- Eleven shared pieces (shape JSON `mechanisms`, shape section 2.3).
- Five qualities (shape section 2.4).
- Thirteen tangles (shape section 3.3; the `<summary>` count).
- 17 parts (shape section 4.1; the heading and the design words).
- 25 links in the full jobs diagram (shape section 2.2; the count is right, the label is not, row 17).
- 52 part edges with no cycle: the builder's `part_layers` recomputes it and would stop on a cycle.
- Eight alternatives (shape section 4.4).
- The set-aside counts 7, 5, 2, 2, 1 and 4 make 21, and each group matches the cause analysis section 3: A-44, B-96, C-52, D-77, D-86, A-58, B-99; B-80, X-02, D-19, D-57, A-35; B-91, C-45; D-23, D-42; B-08; B-84, B-92, B-97, C-17.
- "Three questions about games with no engine" (22, 24, 25), "one about recording refused scans" (19) and "one about the test rig" (21) are right.

**Header and "What you are deciding".**
- The eyebrow names phase 1, step 1, and the date.
- The jobs question replaces 17 (CS section 0).
- A to G ask about wording and whether three jobs should split (J3, J8, J10; EJ section 4).
- The box names E, F and G as changed, and only those. Against the questions as they stood at `1c2e99a9`: A "keep both", B "agree", C "agree, and yes on 23" and D "split" are unchanged; E went from split to rename, F from split to widen, and G from "J4" to neither. Each of the three carries the "Recommendation changed by the map" label.
- "Nothing in the shape is decided" matches the shape's status line.
- "Decided so far: 20, 22 and 26" matches CS section 0. 18 folded into F and 23 into C, as CS says.

**How to read a job, and the design words.**
- The card captions "Today" and "Candidate, not decided" exist on every card.
- All 16 cards and all 10 jobs have a change note.
- The legend's two colours match the card diagrams.
- Module, interface, seam, deep and shallow, adapter, leverage and locality are plain restatements of the skill's words that the shape's header lists. Part and quality match the shape's usage.

**FIT_SUMMARY (apart from rows 14 and 15).**
- The tap paragraph matches shape section 2.1.
- The machinery paragraph (equipment reports, verdict, profile, the life of a game feeding back) matches shape section 2.1.
- "The profile feeds this loop from outside" and the seven-module circle with the record inside match shape section 2.2 and the shape's list of modules.
- J6 and J10 reach the show only through the pack and each engine's own names (shape section 2.1).
- The count of seven ordinary jobs (ten less J9, J10 and J5) matches shape section 1.

**At-a-glance diagram.** All 13 solid arrows are dependencies the shape draws:
- J1 to J2 and J1 to J4; J2 to J3 and J3 to J2;
- J7 to J3 and J7 to J2; J4 to J9; J8 to J9;
- J9 to J5; J5 to J4 and J5 to J2;
- J6 to J1; J10 to J8.

The one dashed line, J9 to J2, is the shape's quality link. The caption's reading rule matches.

**Shared pieces and qualities.**
- Ten of the eleven job lists match shape section 2.3; the eleventh is row 22.
- Each "plain" line agrees with the shape's "Today" column: two builders per fact, six modules, the hardware scanner filed as a phone, sixteen fixed names, nine holders, three contract tests, a tap, a web address and nothing.
- The five qualities, their job lists and how each is carried match shape section 2.4. The standalone row now names the owner's choice of where the declaration lives (check row 2.4b).

**Tangles.** All thirteen titles and their flaw lists match shape section 3.3, including the corrected counts: nineteen resets with fourteen called, and twenty branches in six modules.

**Parts.**
- The intro's layer rule ("each part uses only the parts in the rows below it") holds by the way the builder computes the rows.
- For all 17 parts, "Serves" matches shape section 4.1 and "Removes" matches the shape's list after P17.
- The parts that carry each job, as listed for the glance table, match the shape's "Every job lands" list.
- "Runs on" matches shape section 4.3 for P1 to P6, P11, P12, P14 to P17. P2 no longer lists the scoreboards (check row "JSON parts[1]"). The five exceptions are row 21.
- The Venue fit card hedges the standalone declaration to the owner's choice (check row P12). The Engine instance card names the single starting point above the parts (check row P13).

**Device lines and the component diagram.**
- The engine's line matches shape section 4.3.
- The standalone tablet's line names the stand-ins and the other way (check row 4.3d).
- The phone and ESP32 line matches "sharing data".
- The component diagram's eight boxes and seven arrows match shape section 4.3 in plain names. Only their tense is wrong, which is row 20.

**Alternatives.**
- All eight rows give both sides' costs, as shape section 4.4 and check rows 4.4-5, 4.4-6 and 4.4-7 require.
- The standalone row's "five rules that nothing keeps equal" matches tangle 2.
- The release row's "a wording choice" matches the shape.

**Questions, apart from the rows above.**
- A: the pack's version stamp checked when a device connects matches the shape's question note A.
- B: the GM keeps start, pause, end and score changes, and the stored passwords rotate. J7's capability needs on the page still name that rotation. The connections-and-roles part holds both the pass and the grants (shape section 5, B).
- C:
  - decision 22's words;
  - the four homes for the declaration, matching shape choice 1;
  - question 23 folded in, with "its eight problems" matching the evidence section's 8 under N1.
- D:
  - the two halves share no part;
  - answering serves five jobs (P4 serves J3, J2, J4, J5, J7);
  - the night's record has one reader;
  - the cost of each side matches EJ section 4 D and shape section 5 D.
- E: "run in any setup" has no part, and the naming layer is J10's. Both titles and the cost of not splitting match shape section 5 E. The recommended title is the one J8 shows.
- F:
  - four options, matching shape section 5 F;
  - the proposed title widens J10, as option a says;
  - question 4 covers C8, and none of the nine covers C15 and C16 (EJ section 4 F; the cards' chips);
  - "replaces question 18" matches CS.
- G:
  - the equipment decides state and health as one dated fact;
  - both readings and their costs match shape section 5 G;
  - C2's card sits under J4 in the jobs JSON.
- 24: two standalone tablets are two games; several would need to talk directly; the link to player scans in the night's record matches shape choice 2.
- 21: "every area starts with its test failing" is confirmed in `docs/plans/2026-10-30-architecture-pass.md` lines 177-178 and 364. The rig sentence matches BUILT J10's note that step 2 rebuilds it.
- The step-3 items present each choice as open, with the map's leaning named only as a leaning:
  - items 1 to 7 and 9 match shape choices 1, 5, 6, 7, 8, 9, 11 and 14;
  - item 7's hot-apply limit matches check row 6.11 and J5's and J6's goals;
  - item 8's departure from the capability map is the one CS section 0 names.

**BUILT.** The lines for J1 to J8 and J10 match the root CLAUDE.md's capabilities and the shape's "Today" notes. J10 notes the lost test rig. The one exception is J9, row 26.
