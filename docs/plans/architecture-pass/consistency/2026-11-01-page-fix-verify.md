# Fix check: the 57 rows of the two page checks, and what the fixes changed

- **Date:** 2026-11-01. **Tree:** `/home/user/ALN-Ecosystem`, branch `claude/nice-curie-hescfv`, HEAD `8c6b58ef`.
- **What I read.** The two check files, `consistency/2026-11-01-page-section-and-questions.md` (27 rows, "check 1" below) and `consistency/2026-11-01-page-jobs-and-cards.md` (30 rows, "check 2"). The fixes: `git diff 25a2d06c HEAD -- docs/plans/architecture-pass/` (commits `e1f5a89d` and `8c6b58ef`), every changed string in `build_report.py`, `2026-11-01-engine-shape.json`, `2026-10-31-engine-jobs.json`, `2026-10-31-cause-cards.json`, `2026-10-31-standalone-lines.json` and `2026-11-01-engine-shape.md`. The rebuilt page as text (`report/2026-10-31-cause-report.html`, tags stripped). The shape's sections 1, 2, 4.3, 5, 6 and 8. For three facts: `2026-10-31-standalone-pass.md` section 4 (the seven parity rows), `CONTEXT.md` (the environment ladder) and `docs/agents/process.md` sections 4 and 5.
- **Freshness.** I ran `build_report.py` once. The rebuilt page was byte-identical to the committed one, so the page checked here is the page the data makes.
- **Rule:** refute by default. A row is resolved only if the page now says what the row asked, or something the row allowed.

## The 57 rows

R = resolved, P = partly resolved, N = not resolved.

### Check 1: the top, the new section and the questions

| # | Verdict | Page text now |
|---|---|---|
| 1 | R | "All ten have a proposed new title written that way; the old title shows under each." |
| 2 | P | The box still says "Everything is at the end, each with a recommendation." The jobs question and question 22 now carry one ("Recommendation: keep these ten…", "Recommendation: yes, as your parity rule asks."). Question 25 still carries a "Suggestion", and the step-3 list carries none (it says "no answer needed now"). |
| 3 | R | "A. J1 now says a second designer's game runs on the same engine, and every device plays the same version of the pack and shows which." and "'Nothing in the engine assumes ALN' is now a quality every job has (Generic…)". |
| 4 | R | "The map favours the venue profile: a profile that lists no engine equipment already makes every engine job read 'not installed tonight', which is what a standalone game needs." |
| 5 | R | "On the map it lands on the pack channel and venue fit, or on the game's record if the declaration is kept there; the answer to 23 does not move it." |
| 6 | R | "Recommendation: split. The two halves serve two people at two moments and share no part, so two sentences let each find their need." The false claim about question 19 is gone. |
| 7 | R | "…binds each of the pack's names to a real instrument and says whether the engine starts each program; the verdict turns it into one go or no-go." and "…leaves standalone games and other kits to the job's sentences." |
| 8 | R | "The map separates J10's two moments." Options b and c now carry costs. The recommendation adds "Both moments guard one promise: nothing reaches the live show unproven, or before you say so." (wording: new conflict 10) |
| 9 | R | "The map's answer, if step 3 keeps one delivery part…" and "Recommendation: add the equipment's route to neither job, as long as step 3 keeps one delivery part… If step 3 chooses the other way… the route belongs in J4, beside C2's card." |
| 10 | R | "A no leaves the ESP32 behind the phone with no engine, in seven of the 24 abilities the parity table compares, and showing a missing engine as a red outage all night." plus a recommendation. The seven match standalone pass section 4 (rows 1 to 4, 17, 23, 24). |
| 11 | R | "Yes means the record gains a kind of fact that no screen shows yet. No means a refused attempt lives only on the tablet that scanned, as today, and the night's record cannot tell it." (the "No" wording: new conflict 9) |
| 12 | R | The step-3 list now holds "Getting facts onto screens: one delivery part for every fact, or each job delivering its own facts in a shared shape." and "The life of a game: one lifecycle part… or a table each part reads and applies itself." |
| 13 | R | J4's goal: "A setting, in the profile as the candidate shape has it, says whether the engine starts or adopts each program." This marks the choice as the candidate's, and step-3 item "Where the setting lives…" names both homes. |
| 14 | R | "J9 and J10 are mostly qualities… Each also has a piece of its own: J9 the verdict; J10 the checks between parts, each engine's own names, and release day." |
| 15 | R | Headings "What happens at every tap." and "The engine's own machinery."; the diagram's subgraphs are gone, replaced by a colour key "what happens at every tap / the engine's own machinery / from outside the show". No "spine" or "ring" on the page. |
| 16 | R | "This section answers at two levels: the big pieces (the engine, the tablets, the scanners, the scoreboards, the config tool) and the smaller parts inside them." |
| 17 | R | "The 25 main links between the jobs" and "23 are dependencies: without them, the job that uses them breaks at a show. One is a quality and one is a shared piece; they are drawn dashed." The diagram has 25 links, 2 drawn `-.->`. ("dashed" against "dotted": new conflict 4) |
| 18 | R | `J9 -.->|"a quality: a label on every fact, how old and how sure"| J2` and `J10 -.->|"shared: each engine's own names"| J6`. |
| 19 | R | Labels now read, for example, "the rules of the pack in use", "who decides when there is no engine", "not installed tonight: no cues, no restarts", "a change applies only before or after a game". |
| 20 | R | Heading "In the candidate shape, which parts would run where"; every line uses "would"; "Today it decides before the engine answers", "Today the page decides which modes count as evidence… an open choice for step 3", "Today it writes the engine's files… an open choice for step 3", "Today they use the live display and audio." |
| 21 | R | Connections and roles, Equipment, Show runner, Verdict and Engine instance: "Runs on … GM tablets, as a small stand-in in a standalone game". (List wording: new conflict 7; the component diagram: new conflict 5) |
| 22 | R | "Knowing who is connected … J7 J2 J3 J4 J5 J6 J8 J9 J1". |
| 23 | R | Design words now hold "Paper or live", "Pass" and "Not installed tonight … The code calls it dormant." |
| 24 | R | Columns "The candidate" and "The other way"; cost cells begin "The candidate…" and "The other way…"; "the check that every screen shows each fact's label", "one store on every screen that holds any fact", "the same fault as C5: a list kept by hand that a test must check"; intro "to build a part or to word a job". |
| 25 | R | "Then come a note on what the relationship map changed, the parts of the candidate shape that would carry it, what is built today, and the long-term goal." This matches the order on every job. |
| 26 | R | J9 Built today: "Health words healthy, down and dormant (grey), each shown with the service it names; a first, minimal preflight." Held items are gone. (wording: new conflict 8) |
| 27 | R | "The suggestion below needs the tablet's own scoreboard screen to show exposed evidence. The other way, showing nothing for exposure and hiding video tokens, is smaller but drops a mode's effect from a standalone game." |

### Check 2: the ten jobs and the sixteen cards

| # | Verdict | Page text now |
|---|---|---|
| 1 | R | The at-a-glance nodes read the full proposed titles, e.g. "J6 The designer changes a value and plays it within minutes, and the live show never notices", "J10 A change is proven before it reaches anyone, and the owner alone sends it to the show". |
| 2 | R | The full diagram's J6 and J10 nodes carry the full titles (same text as row 1). |
| 3 | R | Same as check 1 row 1. |
| 4 | R | Same as check 1 row 3. |
| 5 | R | Same as check 1 row 14. |
| 6 | R | J4: "Before, the title also asked the engine to know each program's true state. Now Equipment keeps that dated picture here, beside the Show runner, and showing it on a screen is J9's label…" |
| 7 | R | J5: "…Now it is the GM's trust in each button; the table stays, held by one Lifecycle part that alone moves and resets the game…" |
| 8 | R | J8: "…with a standalone game declared here (where it is kept is a step-3 choice)…" (the dropped question-E pointer: new conflict 2) |
| 9 | R | J8 standalone: "…the declaration, wherever it is kept, reaches every device with its pack, and the tablet says standalone." |
| 10 | R | C12: "…so a tablet on another pack is told, not just logged." |
| 11 | R | C9 note: "Now one Game record judges every GM tap, on the engine or on a standalone tablet, and player devices draw the engine's reply…"; candidate note: "…player devices get data tables and judge nothing while the engine is there." |
| 12 | P | J10 goal: "Tests climb in levels, from the real engine with stand-in equipment to the real programs." Levels are back, but the line now places the real programs only at the top level, against J10's own Built today (new conflict 3). |
| 13 | R | J10 standalone: "the phone's pack test passes on a file the deployed site lacks". |
| 14 | R | C16: "…because it looked for the Team Details cards under a name the page never used." Matches A-83 on the same card. |
| 15 | R | C14: "Joins and proofs would check each device against the pack, and a transaction would have one shape, the Game record's." |
| 16 | R | J9: "a small Verdict stand-in on the tablet"; C10: "a small Verdict stand-in"; C13: "a small Connections and roles stand-in on the tablet"; the five parts now list GM tablets. |
| 17 | R | C13: "…keeps the station name 001, known to nobody. In the candidate…" No "(C1)". |
| 18 | R | C10 "…or, with an engine of its own, keeps it equal by tests"; C11 "…or an engine of its own kept equal by tests…"; C12 "…whether the tablet runs the engine's parts or an engine of its own kept equal by tests"; C16 "…with an engine of its own, a test feeds both the same inputs." (wording: new conflict 6) |
| 19 | P | C7 restored: "Each player device's record step returns the same words, from the one list." C4 took row 30's wording instead: "Player devices need to learn each new game: from the tablet if they are joined to it (question 24), or by a reset of their own." The fact that the device checks a game id from the tablet is not restored. |
| 20 | R | C1 note "Now only the Game record decides claims, from the transactions"; diagram "Lifecycle announces a reset or new game with a version"; note "Lifecycle announces resets with a version every tablet compares". |
| 21 | R | C7: "The Game record saves, then gives Answering the outcome" in the note and the design terms. |
| 22 | R | C10 and C14: "Or: each job sends its own facts." |
| 23 | R | Parts diagram: `P16 --> P14` and `P16 --> P11`. Joins and proofs stays in the top row, above Screens and Lifecycle; the shape now says 54 edges with the same order. |
| 24 | R | Same as check 1 row 13. |
| 25 | R | J1: "…the two-pack proof is now also J10's." J1 keeps its two-pack test case. |
| 26 | R | J6: "Edit, apply, play, repeat; the rules editor and applying a change to a running engine are built together." J8: "The installer picks the pack and the profile by name…" |
| 27 | R | J5: "the tablet decides each moment (start, pause, end, a reload, a new day, a pack change) by its own steps". |
| 28 | R | C5: "…in one order with one set of the engine's services…". |
| 29 | R | Same as check 1 row 26. |
| 30 | R | C4: "Player devices need to learn each new game: from the tablet if they are joined to it (question 24), or by a reset of their own." |

## New conflicts the fixes introduced

| # | Where on the page | What it says | What it should say, and why | File and field |
|---|---|---|---|---|
| 1 | Questions, the jobs question, its new recommendation | "Recommendation: keep these ten, with the new titles. The map found no job missing…" | Question D recommends splitting J3 into two jobs, which makes eleven. "The map found no job missing" appears nowhere in the shape or the job-relationships map; the map placed all ten, it did not search for an eleventh. Say: "Recommendation: keep these jobs with the new titles, and split J3 if you agree with D. Every job lands on a part of its own, and the one candidate for an eleventh, 'run in any setup', owns no part (question E)." | `build_report.py`, TEMPLATE, first `.q` `.rec` |
| 2 | J8, "Changed after the relationship map" | "…Release checking each machine; running anywhere became a quality." | The old note ended "question E stays open"; the fix dropped it. J3's note keeps "whether that makes two jobs stays question D" and J10's keeps "question F stays open". Without the pointer, J8's rename reads as decided. End with "…running anywhere became a quality; question E stays open." | `2026-10-31-engine-jobs.json`, `jobs[J8].shapeChange` |
| 3 | J10, "The long-term goal" | "Tests climb in levels, from the real engine with stand-in equipment to the real programs." | J10's Built today says "a rung-1 run with the real programs in CI", and Joins and proofs says "every level of testing runs the real programs it can". `CONTEXT.md`'s ladder: rung 1 runs the real software with stand-in hardware; higher rungs add real hardware, then the venue. Say: "Tests run in levels: the first runs the real engine and programs with stand-in equipment; later levels add real equipment, up to the venue." | `2026-10-31-engine-jobs.json`, `jobs[J10].goal` |
| 4 | "How the jobs fit together", the two diagram captions | At a glance: "The dotted line is a label every fact carries". Full diagram: "they are drawn dashed". The key's "from outside the show" swatch is a dashed border. | Both diagrams draw the line the same way (`-.->`), so one word should name it, and it should differ from the key's dashed border. Use "dotted" in both captions: "…they are drawn dotted." | `build_report.py`, `fit_html`, the `<p class="muted">` under the full diagram's `<summary>` |
| 5 | "In the candidate shape, which parts would run where", "As a diagram", the standalone tablet's box | "GM tablet, standalone: screens, rules, pack client, game record, lifecycle, local answering, local delivery, a local night's record, the standalone declaration" | Five part cards now list "GM tablets, as a small stand-in in a standalone game" (Connections and roles, Equipment, Show runner, Verdict, Engine instance), and the device line names the stand-ins. The box names none. Add "and small stand-ins for connections, equipment, the show runner, the verdict and the engine's names". The shape's own diagram in section 4.3 has the same gap. | `2026-11-01-engine-shape.json`, `componentsMermaid`, node `GS` (and shape section 4.3's diagram) |
| 6 | C10, C11 and C12, "In a standalone game" | C10: "The candidate declares that fact to every device and gives the tablet a small Verdict stand-in; or, with an engine of its own, keeps it equal by tests." C11: "The candidate puts the engine's Game record on the tablet, or an engine of its own kept equal by tests…" C12: "In the candidate … whether the tablet runs the engine's parts or an engine of its own…" | Each sentence makes the tablet's own engine part of "the candidate". The alternatives table and the device line call it "the other way". In C10, "it" has no clear referent. Say, for C10: "In the candidate the tablet gets a small Verdict stand-in. The other way, an engine of its own, kept equal by tests. Either way every device is told the game is standalone." Do the same for C11 and C12. | `2026-10-31-standalone-lines.json`, `lines.C10`, `lines.C11`, `lines.C12` |
| 7 | Five part cards, "Runs on" | "the engine, the config tool, the tests, GM tablets, as a small stand-in in a standalone game" | In a comma list, "as a small stand-in…" reads as another place the part runs, or as applying to the whole list. Write "GM tablets (a small stand-in, in a standalone game)". | `build_report.py`, `RUNS_ON['gm-tablet-standin']` |
| 8 | J9, "Built today" | "Health words healthy, down and dormant (grey), each shown with the service it names" | A health word names no service. Say what is built: "Health words healthy, down and dormant (grey), one for each service; a first, minimal preflight." | `build_report.py`, `BUILT['J9']` |
| 9 | Question 19 | "No means a refused attempt lives only on the tablet that scanned, as today…" | The set-aside group on the same page says "A rejected or duplicate GM scan is recorded nowhere." The tablet shows the refusal; it keeps nothing. Say: "No means a refused attempt is shown only on the tablet that scanned and recorded nowhere, as today…" | `build_report.py`, TEMPLATE, question 19 `<p>` |
| 10 | Question F's recommendation; J10's goal | "Both moments guard one promise…"; "Tests climb in levels…" | Two metaphors, against process.md section 4. Say "Both moments serve one promise…" and "Tests run in levels…" (the second is folded into row 3). | `build_report.py`, TEMPLATE, question F `.rec`; `2026-10-31-engine-jobs.json`, `jobs[J10].goal` |

## Checked and found consistent

- The two diagrams' counts: the full diagram has 25 links, 23 solid; the at-a-glance diagram has 14, one dotted. The builder counts these from the data.
- The parts diagram has 54 edges after the two additions. The layers still put Joins and proofs above Screens and Lifecycle. The shape's text, its completion check and its corrections list all say 54.
- The five parts that gained "GM tablets" are exactly the five that shape section 4.3 says a standalone tablet needs as adapters (P7, P8, P9, P10, P13).
- The step-3 list now has eleven items. Nothing on the page counts them.
- "Seven of the 24 abilities" matches standalone pass section 4 (rows 1 to 4, 17, 23, 24).
- Question C's new landing ("the pack channel and venue fit, or the game's record") matches shape section 4.1. Shape section 6, choice 13 still says "P2 and P12 either way"; that is a gap inside the shape, not on the page.
- The changed card strings for C1, C5, C7, C9, C12, C14 and C16, and the changed job strings for J1, J4 (both), J5 (both), J6, J8 (goal, standalone), J9 and J10 (standalone), keep their facts and agree with the parts the section lists for each flaw. The exceptions are listed above.
- No changed string adds an internal code beyond C1 to C16, N1 and J1 to J10. Question numbers were already used on the page.

## Summary

57 rows: 54 resolved, 3 partly resolved (check 1 row 2; check 2 rows 12 and 19), 0 not resolved; the fixes introduced 10 new conflicts.
