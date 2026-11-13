# Version 9: the second fix round (verify A and verify B)

Applied 2026-11-01 on branch `claude/nice-curie-hescfv` (not committed). Every row marked partly resolved and every
new conflict in `v9-verify-a.md` and `v9-verify-b.md`, and verify B's note on question M, was checked against its
source first, then settled under the lead agent's six rulings. Edits were made in place, text only; every JSON file
stays valid with its layout (the git diff shows only the changed lines).

**Totals: 30 rows; 30 applied, 0 rejected.** Verify A: 1 partly, 11 new. Verify B: 8 partly, 9 new, 1 note.
Four rows were applied in a form that differs from the verifier's wording; each row says why.

## Verify A (`v9-verify-a.md`)

| Row | Result | The change, or the reason | Source verified |
|---|---|---|---|
| Decisions 21 (partly) | Applied | Question O `evidence[4]`: "a yes needs the same on a standalone tablet, carried by the design choice that removes the flaw A reply never says which request, final or stored." The title now ends the sentence. | The verifier's wording; plan v2 section 6 (a title last) |
| New 1 | Applied | `timeline.next[2]`: "Show-ready, the state where swapping green in for a show becomes your live choice, still needs one full venue rehearsal and your review of the visible changes; the game runs on blue until you say the new engine is ready." The pointer to The words moved to Done (new 5). | ROADMAP section 3, Show-ready, conditions 3 and 4 (condition 2 superseded 2026-10-30) |
| New 2 | Applied | Words box "The blocks": "the depth-and-close block (the rest of the design tool, then a final check that every temporary shortcut has someone to finish it, which closes this stretch of the roadmap)". | ROADMAP section 3, "Where done lives" (promise 3, the final sweep when Block 6 closes); section 4, Block 6 |
| New 3 | Applied | `changes.json` `sequence[19].now`: "the rest of the design pages, then a final check that every temporary shortcut has someone to finish it". | Same as new 2 |
| New 4 | Applied | `changes.json` `sequence[15].now`: "the hardening block: the engine checks itself and restarts what crashes (grey "not installed tonight", the program watcher, the preflight)". The block's one meaning (ruling 1) is added. | ROADMAP section 4, Block 2 (the third health word, the supervisor, the preflight) |
| New 5 | Applied | `timeline.done[0]`: "The unlock block (each block and state is explained in The words) also repaired the deployment guide, which the next state, hardware-proven, needs." Dropped from `next[2]`. | ROADMAP section 4, Block 1 |
| New 6 | Applied | `now`: "... the extension cases; the promises and their wording questions. Confirm four readings of earlier decisions there too, then answer the standalone questions, ...". | `v9/decisions.json` groups (the readings in their own group, "Confirming earlier decisions") |
| New 7 | Applied | `decided[4].entries[0].line`: "Your site was five linked pages built from one set of data (the engine, decisions, promises, parts and design flaws), with earlier wordings and changes kept in a change log; nothing in the single page it replaced had to stay. The same decision asks ...". | DECISIONS "The owner's site: five linked pages" |
| New 8 | Applied | Decided line: "...; proving each change before it reaches a show stays a quality every part must meet. Together they replace the earlier candidate's part "Joins and proofs"." Question J `evidence[1]`: "with proving each change before it reaches a show kept as a quality every part must meet". J `evidence[2]` keeps "(Proof, on Design)": there it names the earlier candidate's quality of that name, shown on Design. | DECISIONS "One published protocol and an outside test bench"; `2026-11-01-engine-shape.json` qualities ("Proof") |
| New 9 | Applied (ruling 1) | `timeline.done[1]`: "The hardening block's finished pieces: the kinds of equipment a pack can ask for and a venue profile can name, the code that marks equipment not installed tonight, and the smallest test set-up. Its other pieces wait for the build half." The five kinds in brackets are dropped so the wording is the same on every page. | DECISIONS "Corrections to the readers and the hardening pieces" |
| New 10 | Applied | `timeline.done[4]`: "Version 8 of your site was published, and the decision record was rewritten by topic." | DECISIONS preface ("written 2026-11-01 ... by topic") |
| New 11 | Applied (other form) | `qualities[10].line`: "The show machine keeps one written list of what it should carry ...". "Keeps" in place of the verifier's "carries ... carry", which repeats the verb. The same term was aligned where it said "hold": QT41 `situation` and question J `evidence[0]`. | QT41 title; the Release day moment; jargon table rows 196 and 515 |

## Verify B (`v9-verify-b.md`)

| Row | Result | The change, or the reason | Source verified |
|---|---|---|---|
| Requirements 5 (partly) | Applied (other form) | `intros.requirements[1]`: "The test summary names which of the architecture pass's nine questions the promise answers; the pass asks those of the whole engine, and they are not the questions on Decisions. The promises are open too. On Decisions you are asked "Are these the right ten promises?" and seven questions on their wording: "...", ... and "...". Each title is quoted, so no question mark runs into a semicolon. | `v9/decisions.json` questions D to K; DECISIONS "The nine questions the pass answers" |
| Requirements 11 (partly) | Applied | EX10 `case`: "How many phones one kit carries at once is a number you set, under the quality target "Phone capacity is measured before the first phone"." | QT34 (`numberToSet`, status) |
| Requirements 13 (partly) | Applied | `intros.requirements[2]` lists "the readiness states show-ready (swapping the new machine in for a show becomes your live choice), previewable ... and adoptable ...". | ROADMAP section 3, Show-ready; words box "The readiness states" |
| Requirements 14 (partly) | Applied (ruling 2) | All ten named entries replaced: QT21 ("the glossary's entry on the abilities a pack requires: an ability is only ever added, never removed"), EX4, EX7 ("the glossary's entries on the pack's strings file, its theme file and the word for a score-holder"), EX15 ("the glossary's entry on the program watcher"), QT25 ("the glossary's entries on the test levels and on the stand-in lights the tests use"; "its entries on rehearsing the show without the venue and on running it on software stand-ins"), EX13, EX9 ("the glossary's entry on kinds of screen"), EX3, QT22 ("the device's own word for what kind of device it is no longer counts"), QT31 ("fixed by you on 2026-07-09"). The other entry names in status lines were reworded the same way: QT6, QT8, QT10, QT16, QT23, QT33, QT35, QT36, EX1, EX5, EX6, EX11, EX14, EX18, EX19, EX22. | `CONTEXT.md` entries Capability, Strings sidecar, Supervisor, Environment ladder, Witness lights, Simulation, Rehearse, Deploy, "surface", "mode", Media bundle, Lighting role / binding / fallback, Review, Source adapter |
| Requirements 16 (partly) | Applied (ruling 2) | `build_site.py` `status_grounds()`: "Rests on:" in place of "On:". QT34 `status`: "settled by the owner on the direction", which renders "Your word on the direction". In every status line "the owner's decision", "open question", "ruling", "ratification", "explicit word", "parity rule", "account", "stated goal" and "decision per game" became "your ...", and "which the owner has not ruled on" became "which you have not ruled on". | Ruling 2; the page renders 60 "Rests on:" lines, six "Your word ..." lines, no "On:" and no "the owner" in a status line |
| Design 2 (partly) | Applied (other form) | `ahead[3].settled`: "Two of your questions bear on it, 'Two clauses added to the pack promise' and 'Keep the venue promise whole?'; the panel designs against the promises as you confirm them." Quoted, in the single quotes Design already uses for titles, so the second title's question mark does not run into the semicolon. | `v9/decisions.json` questions E and I |
| Today's engine 6 (partly) | Applied (ruling 3) | `build_site.py` `part_row()`: "Joins and proofs has since been replaced by the published protocol and the test bench outside the engine." The parenthetical mark is dropped from `cause-cards.json` C14 and C16 `after.note` and `designTerms`, and from the standalone line on C14. Each of the three cards now carries the mark once, in its parts row's note; the diagram labels keep the part's name. | DECISIONS "One published protocol and an outside test bench"; ruling 3 |
| Today's engine 12 (partly) | Applied (ruling 4) | `2026-10-31-standalone-lines.json`: C3, C5, C6, C7, C8, C12, C13 and C16 now say "In the earlier candidate". | Plan v2 section 6 |
| New A | Applied | C2 and C3 standalone lines: "the tablet's Equipment stand-in reports every service the engine runs (video, music, lights) as not installed tonight". C3's "the owner's choice" became "your choice". | Jargon table row 45 |
| New B | Applied (ruling 1) | One wording for the finished pieces on every page: `build_site.py` `WELL_BUILT[0]`, `design.json` `ahead[3].settled`, `decisions.json` (the "and" added), `front.json` `timeline.done[1]`. One meaning for the block: "the engine checks itself and restarts what crashes" in the words box, the Requirements intro, Today's engine's well-built piece and the change log's sequence row. | DECISIONS "Corrections to the readers and the hardening pieces"; ROADMAP section 4, Block 2 |
| New C | Applied | `design.json` `later[9].text`: "as the list of planned capabilities drawn from the roadmap has it". | Requirements footer as corrected (row 18); no source records you approving the list itself |
| New D | Applied | `2026-11-01-engine-shape.json`: the quality "Who decides when there is no engine" ("held wherever the design rounds place it") and P12 `plain` ("if the design rounds place it here"). The source document says it too, so `2026-11-01-engine-shape.md` lines 111, 203, 217 and 358 were changed to match; its change-history lines 417 and 451 were left as history. | DECISIONS "Standalone games: declared, never mixed" ("is a question for the design rounds") |
| New E | Applied | `design.json` `decided[3].paragraphs[0]`: "The second half of the promise 'Every tap gets its answer, and the night can be told afterwards' names the director and the players after the show." | Plan v2 section 6 |
| New F | Applied | `build_site.py` part card: "Replaced by the published protocol and the test bench outside the engine.", each name linked. The builder's check now looks for that sentence with its two links. | DECISIONS "One published protocol and an outside test bench" |
| New G | Applied | QT43 `why`: "all need the same thing: a copy of the engine that stays separate from the others; built once, it serves all three." | Design row 18's wording |
| New H | Applied | EX18 `case`: "A designer writes their game's content in a different tool". | Jargon table (plain words) |
| New I | Applied | `2026-10-31-engine-jobs.json` J2 `standalone`: "... but not every screen refreshes. Two tablets are two separate games; whether a game may have only one tablet is your open question One GM tablet per standalone game?". The builder now passes promise standalone lines through `rich()`, so the question marker resolves to its linked title. | DECISIONS "Standalone games: declared, never mixed"; question M |
| Note on question M | Applied | Question M `evidence[0]`: "The requirements leave the count to you, as this open question: the extension case "A small game with no show machine" and the quality target "A standalone game is normal, never a fault" both name it open. The quality target "A standalone game leaves its own record" names the second point open: ...". The decisions log's entry on M records the change. | EX12 `case`, QT37 and QT39 `status` |

Two small follow-ons, made for the same rule: EX12's case and the Requirements intro each ended with a question
title followed by a period ("?."); the period was dropped.

## The rulings

| Ruling | What changed |
|---|---|
| 1. The hardening block | Finished pieces in one wording ("the kinds of equipment a pack can ask for and a venue profile can name, the code that marks equipment not installed tonight, and the smallest test set-up") on The engine (Done), Decisions, Design and Today's engine. One meaning, from ROADMAP section 4's Block 2 (the health word, the supervisor that restarts crashed services, the preflight): "the engine checks itself and restarts what crashes", in the words box (unchanged), the Requirements intro (was "makes the show machine run without a technician"), Today's engine (was "make the show machine safer") and the change log's sequence row. |
| 2. Status lines address you | `status_grounds()` renders "Rests on:"; QT34 renders "Your word on the direction"; every status line says "your decision", "your open question", "your ruling" and so on; the internal entry names are gone (verify B rows 14 and 16). |
| 3. "Joins and proofs" marked once | The parts-row note reads "has since been replaced by the published protocol and the test bench outside the engine"; the repeats in C14 and C16 (`after.note`, `designTerms`, C14's standalone line) are gone. Diagram labels unchanged. |
| 4. "The earlier candidate" | The eight standalone lines; Design's device list (`FIT_DEVICES`, "In the earlier candidate it runs"); the alternatives table's column ("The earlier candidate") and its seven cost cells. Only the change log keeps "the candidate shape". |
| 5. The front page's word limit | Sentences on the front page: 2,619 (was 2,623); hard limit 2,625. The shorter finished-pieces line paid for the added verbs. |
| 6. P, Q and R | `v9/decisions-log.md` has a new entry, "P, Q and R: the panel", sourcing each to the panel's brief ("Questions for the owner", "Who is on the panel", "Size and cost") and the decision "What the architects' panel sees, and when". |

## Rejections

None.

## Notes for files I may not edit, and things left alone

- `2026-11-01-engine-shape.md` was edited (lines 111, 203, 217, 358) under the rule that a fact changed in a data
  file is changed in its source document too. Its history lines 417 and 451 still say "wherever the owner places it",
  as a record of the earlier edit.
- The requirements' "Why it matters" lines still say "the owner" in several places (QT14, QT19, QT41, EX17, EX24 and
  others). Ruling 2 covers the status lines only, so they were left; a later pass should apply "you" there too.
- The Requirements intro glosses the depth-and-close block as "the rest of the design tool's pages", shorter than
  the words box's new gloss. Not a conflict, but the two could match.
- `checks/jargon-table.md` and `DECISIONS.md` were not touched.

## Build and smoke test

- Build: `MERMAID_JS=... python3 -I build_site.py`: "checks passed: 1530 links resolve; markers, ids, entries,
  titles, diagrams and words as the plan asks" (1,532 before; the two links in C14's standalone line went with its
  repeated mark). One warning, as before: the front page's sentences are 2,619 words, a little over 2,500 and under
  the hard limit of 2,625.
- Smoke test: `node site_smoke.js .../site .../site-shots-v9`: "smoke passed: 24 loads, 24 screenshots", every load
  with 0 errors and no sideways scroll at 1100 or 400 pixels, light and dark.
