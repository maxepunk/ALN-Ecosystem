# Check: version 9 Decisions page data

Checked 2026-11-01: `site/v9/decisions.json` against version 8's
`site/decisions.json`, the decision record (`DECISIONS.md`), the quality
targets and extension cases (`requirements/2026-11-01-*.json`), plan v2
sections 2 to 6, plan v1 section 6, the jargon table, and the sibling
`site/v9/design.json` and `site/v9/changes.json` for link targets.
Refuted by default. 18 conflicts, 71 items checked (4 intro paragraphs,
15 questions, 6 design-round items, 12 later choices, 6 topics, 28
decided entries), plus all 212 link markers.

## Conflicts

| # | Where | What it says | What it should say | Source |
|---|---|---|---|---|
| 1 | `intro[2]` | The facts under "What we know" come "in this order: the requirements first, then the decisions already made, then the earlier candidate, then today's engine". | Either reorder the evidence or drop the claim. The order does not hold in G, H and L (a decision comes before the requirements) or in G, H, J, K, L, M, N and O (an earlier-candidate line comes after a today's-engine line; for example M: requirements, today, candidate, today, candidate). The writer's log says the reordering was done; it was not. | v9 `groups[*].questions[*].evidence`; `v9/decisions-log.md` "The proactive frame" |
| 2 | Question A, `evidence[4]` | "[[qt:QT37]] and [[qt:QT39]] on [[q:M]] and [[q:N]], and [[qt:QT39]] also on [[q:L]]." | QT37 waits on [[q:M]] only (how many tablets); its other open point, where the standalone fact is kept, belongs to the design rounds. QT39 waits on [[q:L]], [[q:M]] and [[q:N]]. | `quality-targets.json` QT37 status ("open: how many tablets ... and where the standalone fact is kept"), QT39 status |
| 3 | Question M, `evidence[0]` | EX12 carries the tablet count as a number to set, "and [[qt:QT37]] and [[qt:QT39]] name it open". | QT37 names the count open. QT39 names M's second point open: whether a standalone game's record holds what the players found. Say so for each. | `quality-targets.json` QT37 and QT39 status |
| 4 | Question C, `options[1].cost` | Keeping an earlier decision means "one design choice per question, or the test rig comes before design; either adds work before the panel runs". | Name each consequence as the record has it: one design choice per question in the design rounds; each build area starting with its test failing on today's engine (build half); contract proposals beside the protocol; the rig reproducing each finding before the design half ends (before sign-off, not before design). None of these adds work before the panel runs. | `DECISIONS.md` "Read as overtaken, not yet confirmed"; "When the design half is finished"; "One program: design half, then build half" |
| 5 | Question J, `evidence[5]` | "Every option below gives [[flaw:C15]] a home in a part." | "Options a, b and c each give [[flaw:C15]] a part to be fixed in" (option d, tests alone, was not included in version 8). | v8 `questions[key=F].evidence[3]`; jargon table D19 (keeps the rest of the sentence) |
| 6 | Question J, `recommendation` | "...a question each among the pass's questions, which now serve as checks on every design ([[q:C]])." | "...which would serve as checks on every design if you confirm [[q:C]]". The record holds this reading unconfirmed; the page must not write it as settled. | `DECISIONS.md` "The nine questions the pass answers" ("is to be confirmed with the owner"); the record's preface ("Nothing inferred is written as if the owner had said it") |
| 7 | `designRounds[1].link` | `design.html#d-the-published-protocol-and-file-formats` | A link that exists. `v9/design.json` names this entry `the-published-protocol-s-form` ("The published protocol's form"), so the link is broken. Align the two; the record's wording is "the published protocol and file formats". | `v9/design.json` `ahead[1].slug`; `DECISIONS.md` "Design top-down, hardest-to-reverse choices first"; plan v2 section 3.4 item 2 |
| 8 | Question B, `evidence[4]`; `designRounds[4].text` | B says EX14's open choice (where the designer's trial copy runs) is "listed under Coming in the design rounds below". No item there names it; the round on separate copies says "the show's copy, a trial copy and a test run on one machine", which reads as settling it. | Name it as open, for example in the round on separate copies: "where the trial copy runs, a laptop or the show machine between games, is open". | `extension-cases.json` EX14 ("where it runs is an open question"); `2026-10-31-engine-jobs.json` J6 goal ("Where it runs is open") |
| 9 | Decided, "The night's record and the after-game article", `line` | "the night's record names the director and the players"; players' emails not mentioned. | "the second half of the promise [[promise:J3]], that the night can be told afterwards, names the director and the players after the show"; and keep "players' emails stay outside the engine", which version 8's line carried. | `DECISIONS.md` that entry; plan v1 section 6 (decision on the after-game article "holds everywhere"); jargon table D54; v8 `decided[n=28]` |
| 10 | Questions D and J; `intro` | Nothing says that D holds the earlier question "Is the list of design flaws right?" or that J holds "Flaws none of the pass's questions covers". Version 8's intro carried both folds (by number); version 9 dropped the paragraph. | Carry each fold by title in its question, for example D's decides: "This holds the earlier question "Is the list of design flaws right?"". (G already carries "Is the missing standalone declaration a flaw?" as its second point.) | `DECISIONS.md` "Still open"; v8 `intro[3]` |
| 11 | Question F, `decides` | "starting, pausing and ending a game and changing scores stay with staff who log in, such as the GM" | "starting, pausing and ending the game, show control and score changes stay with staff who log in, such as the GM". The jargon table's wording includes show control, and the promise says the GM "runs the show". | jargon table row 52 ("promises left out show control"); `engine-jobs.json` J7 goal; QT31 |
| 12 | Decided, "Five documents the design half hands over", `line` | "the design choices with proof tests in plain words, ... contract proposals, ...; two parts are read as overtaken ([[q:C]])" | Keep "one per question" in the list ("the design choices, one per question, ..."). Without it the reader finds only one of the two overtaken parts. | `DECISIONS.md` that entry |
| 13 | Decided, "When the design half is finished", `line` | Lists four conditions, then "that last condition and the rig condition are read as overtaken". | List the fifth condition: "and the rig reproduces each finding marked for live proof". | `DECISIONS.md` that entry |
| 14 | Decided, "Corrections to the readers and the hardening pieces", `line` | "the dormancy core behind "not installed tonight"" | "the core that marks equipment not installed tonight" (no "dormancy"). | jargon table row 45 |
| 15 | Question C, `evidence[2]`; decided "Five documents ...", `line` | "contract proposals, drafted for the two contract files before code"; "today's scattered contracts"; "contract proposals". | Row 39's wording: "proposals for the written lists of messages between the engine and the devices, drafted before code"; "today's scattered message lists and file formats". | jargon table row 39 |
| 16 | Question F, `evidence[0]` | "A connection with no credential gets nothing" | "A connection with no password or pass gets nothing". | jargon table row 56 |
| 17 | Decided, "The architecture pass is the work now" and "Green's follow-ups ...", `line` | "ready to swap in on green"; "a false boot warning on a correct green". The Decisions page has no words box. | Spell green out on first use: "green, the second show machine being built". | jargon table row 17 and words box W4 |
| 18 | Question F, `evidence[1]`; Question J, `evidence[5]` | "at the one door every request passes"; "gives [[flaw:C15]] a home in a part". | Plain words: "at the one place every request passes through"; "gives [[flaw:C15]] a part to be fixed in". | plan v1 section 6 ("no metaphors"); plan v2 section 6 |

## What I checked and found right

- **Every version 8 question is kept.** The promises question is D;
  version 8's A to G are E to K; 22, 24, 25 and 19 are L, M, N and O.
  Statuses carry over (E, F, G applied; I, J, K changed; the rest
  open), and N keeps "Suggestion". Every option, cost and
  recommendation matches version 8 in meaning, apart from rows 5 and 6;
  D's "settle D to G" correctly becomes [[q:H]] to [[q:K]]. Every
  version 8 evidence line is present, reworded per the jargon table
  (D6 to D37) and framed as "the earlier candidate".
- **The withdrawn test-rig question** is not shown as open. The intro
  sends the reader to the change log for it, and the rig decision's
  line says it is withdrawn.
- **Question A lists all fourteen numbers the owner must set**, one per
  line, each matching the target's `numberToSet` (QT1, 2, 3, 5, 9, 13,
  14, 19, 30, 33, 34, 35, 40, 43), with the three "confirm" values
  (ten seconds, five seconds, half a second). The counts are right:
  forty-two targets, twelve qualities, at least four targets per
  promise, three proposed in full (QT3, QT5, QT17), five in part (QT13,
  QT19, QT31, QT33, QT34).
- **Question B** is right on twenty-four cases, at least three per
  promise, EX15 the only case not settled, and EX10 and EX12 as the two
  cases with a number to set.
- **The "to be confirmed" readings** are all present: the four in the
  record's "Read as overtaken" list (question C), the nine questions
  read as checks on each design (C and the decided line), and the
  owner's word still asked on the hardware scanner (L) and on the three
  applied clauses (E, F, G). Each overtaken reading is flagged in its
  decided entry with [[q:C]].
- **Every requirement claim in the carried questions holds**: E (EX1,
  QT20, QT9, EX2), F (QT31, EX11), G (QT37, QT38, EX12), H (QT4, QT7,
  QT16, EX19), I (QT24, EX16, QT13, EX13), J (QT26, QT41, EX17), K (QT5,
  QT17), L (QT39, QT22, EX10), N (QT39, EX12), O (QT7, QT16).
- **Decided** holds all twenty-eight standing decisions, in the record's
  six topics and in its order, each with the record's exact title and
  date; no superseded decision appears. Every entry slug and topic slug
  follows the rule (lower case, non-letters as one hyphen).
- **Coming in the design rounds** lists the six top-level decisions in
  the record's order; five of the six links match `v9/design.json`
  (row 7 is the sixth). The twelve later choices carry all twelve of
  version 8's step-3 items, reworded per jargon rows D47 to D52.
- **Markers**: 212, all valid. Every `[[dec:]]` slug exists in Decided,
  every `[[q:]]` letter in A to O, every `[[qt:]]` and `[[ex:]]` id in
  the requirements (no QT28), every part, flaw and promise id in its
  source, and every page anchor (`changes#rec-e`, `rec-f`, `rec-g`;
  `design#alt-*`; `today#standalone`) exists.
- **No visible ids or numbers** outside markers: no J, C, N, Q, QT, EX
  or X-08 id, no "decision N", "question N", "step N", "phase",
  "round N" or "Block N". No em or en dashes.
- **Grouping** follows plan v2 section 3.2. One note, not counted: the
  readings question C sits under "Confirming the requirements",
  though it is about how the design half runs, not about the
  requirements.
