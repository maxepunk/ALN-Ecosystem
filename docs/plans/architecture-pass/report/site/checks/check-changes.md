# Check: `site/changes.json`

Checked 2026-11-01, refute by default, against: `docs/plans/CURRENT-STATE.md`
section 0 (decisions 20 to 29, the page's version history); the git log of
`docs/plans/architecture-pass/report/` and `CURRENT-STATE.md` (commit dates and
messages for each published version); each version's own page, read from git
(`95daa8ed` v1, `0b24bd9b` v2, `17fcce9d` v3, `20ac363b` v4, `f509848c` v5,
`7db3f4bd` v6, `9739aafa` v7); `build_report.py` question G's history
(`0d20835a`); `report/2026-10-31-engine-jobs.json` (`title`, `shapeChange`,
`functional`, `goal`); `report/2026-10-31-cause-cards.json` (`shapeChange`,
`findings`, C9 `examples`); `report/2026-11-01-engine-shape.json` (part names);
`2026-10-30-cause-analysis.md` (sections 5 and 8, X-08);
`2026-11-01-engine-shape.md` section 1 and section 5 E to G;
`relationships/2026-11-01-job-relationships.md` section 2;
`consistency/2026-10-31-consistency-page.md` (P1 to P10) and
`consistency/2026-11-01-vocab-fix-verify.md`; `2026-11-01-after-game-report.md`;
`CONTEXT.md` section 5; the site plan (sections 4.3 and 6).

**Result: 10 conflicts in 119 items checked.** Five misstate the record of a
version (v1's prompt, v3, v4 twice, v6); two misstate version 8 itself (the
decided list, the 358 count); one breaks a plan rule that the build also
enforces ("installer"); one quotes a label v6 never had; one renders a
lower-case "question" at the start of a sentence. Every earlierTitle, every
card change and every promise's first change line matches its source; the
decisions 27, 28 and 29 text holds.

## Conflicts

| # | Where | What it says | What it should say | Source |
|---|---|---|---|---|
| 1 | `versions[0]` (v8), `items[4]` | "...the Decided list gains 27, 28 and 29." | "...the Decided list gains 28 and 29." Decision 27 has been on the decided list since version 6 (this file's own v6 item says "decision 27 joins the decided list"). | v7 page (`9739aafa`): "Decided so far: 20 ..., 22 ..., 26 ... and 27 (the page's words ...)"; commit `6f3b384e`: "decision 27 joins 'decided so far'" |
| 2 | `versions[0]` (v8), `items[3]` | "...joined [[flaw:C9]] under decision 28; the flaw total is 358 findings." | "...the total is 358 findings, 337 of them under the sixteen flaws and 21 set aside." 358 is every finding; the flaws hold 337 (C9 now 19). The plan's section 3.5 has the same slip ("358 findings under the flaws"). | `2026-10-30-cause-analysis.md` section 5 count table: §3 set aside 21, total 358; `cause-cards.json` `findings` sum 337 |
| 3 | `versions[2]` (v6), `items[4]` | "The vocabulary check applied 28 conflicts and its verification settled five leftovers: two notes no longer call a promise a label; the summary no longer says two promises are kept mostly by a quality; two metaphors are plain; decision 27 joins the decided list." | The list after the colon is not the five leftovers. Only "the summary no longer says two promises are kept mostly by a quality" is one; the label notes, the two metaphors and decision 27 joining the list came from the check's 28. Say: "The vocabulary check applied 28 conflicts, among them: two notes no longer call a promise a label; two metaphors are plain; decision 27 joins the decided list. Its verification settled five leftovers: the summary no longer says two promises are kept mostly by a quality; the table of moments is read by most promises, not every one; two long notes are split; the Connections and roles card says 'This part also says'." | commit `6f3b384e` (the 28); commit `7db3f4bd` and `consistency/2026-11-01-vocab-fix-verify.md` "New conflicts from the fixes" rows 1 to 5 |
| 4 | `versions[4]` (v4), `items[0]` | "The consistency check found 39 conflicts ...; all were settled from code or records and applied (22 changes, 5 duplicates, 2 already gone, 1 left for the orchestrator and applied)." | The breakdown belongs to the 29 conflicts in the documents and page data, not to all 39; the page's own 10 are the next item. Say: "The consistency check found 39 conflicts: 29 across the list of design flaws, the standalone pass, the jobs document and the page data, all settled from code or records and applied (22 changes, 5 duplicates, 2 already gone, 1 left for the orchestrator and applied), and 10 in the page itself." | commit `20ac363b`: "29 conflicts across the list of design flaws, the standalone pass, the jobs document and the page data ... (22 changes, 5 duplicates, 2 already gone, 1 left for the orchestrator and applied), plus the page's 10"; CURRENT-STATE.md "39 conflicts, all applied" |
| 5 | `versions[4]` (v4), `items[1]` | "The page's own ten fixes: ...; the lost test rig and its 16 runs are recorded; ..." (seven fixes listed) | Two fixes are merged into one false statement, and one is missing. The lost rig (P5) is the promise's built-today line saying the standing rig was lost with the old container; the 16 runs (P6) are question 21's recommendation, one per design flaw, 16 runs instead of "about 17". The rig never had 16 runs. Missing: the evidence says the standalone pass's 35 findings are 27 under the sixteen flaws and 8 under the proposed N1 (P4). | `consistency/2026-10-31-consistency-page.md` rows P4, P5, P6; commit `1c2e99a9` ("27 plus 8 standalone findings; the lost test rig; 16 rig runs") |
| 6 | `versions[5]` (v3), `items[3]` | "...the pack job says nothing in the engine assumes ALN and every device runs the same version" | "...every part of the kit runs the same version of the pack and says which". "The same version" with no object reads as the software version. This file's own J1 entry has it right. | v3 page (`17fcce9d`), question A: "J1 now says nothing in the engine assumes ALN, and every part of the kit runs the same version of the pack and says which" |
| 7 | `versions[7]` (v1), `prompt` | "Published for the owner's round 8 questions 17 ... and 18 ..., after the cause analysis was written and checked. The owner had asked whether the architecture method skill was used ..." | Name what prompted it: the owner asked for a visual report of the cause list, and questions 17 and 18 waited for it. Say: "The owner asked for a visual report of the cause list; round 8's questions 17 ... and 18 ... waited for it. The owner had also asked ..." | CURRENT-STATE.md at `c40d70c0`: "17 and 18 ... wait for the visual report the owner asked for" |
| 8 | `vocabulary[1]` | "Venue technician, not installer or venue installer: ..." | "Installer" is barred on every page (plan section 6: "The venue technician, never 'installer'"), and the build check in plan 5.2 ("no 'installer'") would fail on this line; unlike "job", no exception is written for the change log. Either reword ("Venue technician: the person who fits a kit to a venue ... Earlier pages used another name for this person.") or have the plan and builder exempt `changes.html` for this one entry, as they do for "job". The orchestrator decides which. | plan sections 5.2 and 6; `CONTEXT.md` section 5 "Venue technician" |
| 9 | `vocabulary[3]` | "'Kept by' and 'broken by' are the page's words for that, from version 6" | Version 6's labels were "Kept by these parts of the candidate shape" and "Design flaws that break it today". "Broken by" is this site's label (version 8). Say: "'Kept by' and 'break' are the page's words for that from version 6, and 'broken by' from version 8." | v6 page (`7db3f4bd`): no "Broken by" anywhere, 12 uses of "that break it"; `consistency/2026-11-01-vocab-check-promises-cards.md` line 36; plan 3.3 item 4 |
| 10 | `promises[7]` (J8), `changes[0]` | "... and Release checking each machine. [[q:E]] asks you to confirm." | The marker renders "question E" (plan 4), so the sentence starts in lower case. Say: "... and Release checking each machine. You are asked to confirm this in [[q:E]]." The source's own wording ("Question E asks you to confirm.") is otherwise matched. | plan section 4 marker table; `engine-jobs.json` J8 `shapeChange` |

## What I checked and found right

**Schema (plan 4.3).** The file parses. Top level has exactly `intro`,
`versions`, `promises`, `cards`, `recommendations`, `vocabulary`. Every version
has exactly `version`, `date`, `title`, `items`, `prompt`; every promise `id`,
`earlierTitle`, `changes`; every card `id`, `changes`; every recommendation
`key`, `before`, `after`, `why`. Versions run newest first, 8 to 1. Ten promises
(J1 to J10), sixteen cards (C1 to C16; N1 has no card, rightly), three
recommendations (E, F, G).

**Markers.** All 29 distinct markers use valid ids: promises J2, J3, J4, J8,
J9, J10; parts P4, P6, P7, P8, P10, P12, P13, P16, P17; flaws C2, C8, C9;
questions A to F; pages engine, decisions, parts, promises, flaws. Each part
marker names the part its sentence describes (P4 Answering, the door in; P6
Delivery, the door out; P7 Connections and roles; P8 Equipment; P10 Verdict;
P12 Venue fit; P13 Engine instance; P16 Joins and proofs; P17 Release). No
promise id, no HTML, no em or en dash in visible text. "Job" appears only as
history, which the change log allows.

**Version dates and titles (8 versions).** Each date matches the publishing
commit: v1 `8104893b` 2026-10-31, v2 `3b445778` 2026-10-31, v3 `4e777811`
2026-11-01, v4 `ab78f1a7` 2026-11-01, v5 `20ec5c38` 2026-11-01, v6 `bf1f0163`
2026-11-01, v7 `182a9386` 2026-11-01, v8 this site 2026-11-01. Page titles:
"ALN Cause Analysis" (v1, v2; h1 "Sixteen causes behind the engine's faults"),
"What the Engine Must Do" (v3 to v5), "What the Engine Promises" (v6, v7), as
the items say.

**Version items found right (26 of 32).** v8: one page became six; earlier
wording and "what changed" moved here; decision 28 folded into the night's
record (people, goal, built-today line; checked against `engine-jobs.json` J3
and `build_report.py` BUILT J3); diagrams drawn at build time (plan 5.1). v7:
all five items (commits `857a6894`, `4ac709c6`, `9739aafa`; 19 then 16, 3 and
10; 41 diagrams at 1200 and 400 px). v6: items 1 to 4 (commits `b0109a9d`,
`1585e5cc`, `6f3b384e`). v5: all five (182 verdicts, 96 corrected; 57 applied;
54, 3 and 10; E, F, G as the state page has them; alternatives, colour, "green
run"). v4: none beyond the two conflicts. v3: items 1 to 3 (v3 page; question
17 replaced by the list question, 18 into F, 23 into C). v2: all three (v2
page; 24 parity rows; section 7 and two findings, commit `0b24bd9b`). v1: both
items (card contents on the v1 page; 42 corrections; 357 findings; diagrams
top-down, commits `95daa8ed`, `be01564c`).

**Prompts (7 of 8 right).** v8 quotes the owner's three answers verbatim and
ties the survey to decision 28. v7, v6 (decision 27's reason), v5 (both levels;
J8 and J9 read as mechanics), v4 (first run stalled and lost; rerun widened),
v3 (decision 26's frame; "cause analysis" does not land) and v2 (decision 22,
the parity reasoning) match CURRENT-STATE.md and the commits.

**Promises (34 items).** Every `earlierTitle` equals the promise's `title`
field. Every first change line equals the promise's `shapeChange` once its
markers are rendered (J1 and J4 put the quoted title in a marker; J3, J8 and
J10 the question). The later lines hold: J1's widening in v3 and its two
clauses in the shape (Generic quality; the pack channel's stamp checked at
connection, `2026-11-01-engine-shape.md` section 5); J7's widening (question
B); J8's decision 22 clause (question C), the map's reason (JR section 2 J8:
engine as subject, places named, people missing) and decision 27's seventh
title; J9's reason (engine as speaker, four states are the mechanism); J10's
title naming the owner's release; J3's decision 28 line matches the data's
people, need, goal and built-today text and decision 28 points 1, 2, 3 and 5.

**Cards (17 items).** All sixteen first lines equal the card's `shapeChange`
word for word. C9's X-08 line matches the cause analysis row X-08 and section
5.5; C9 now carries 19 findings (18 in v7).

**Recommendations (9 items).** E, F and G before match the v4 page (with v4's
added options); G's first-draft note is true (`0d20835a` recommended J2 and
moving C2's card; `ce424d9e` withdrew it before v5 published). After and why
match the v7 page's E, F and G, the part markers included.

**Vocabulary (8 of 10 right).** Promise, titles, quality (the v5 summary's
"mostly qualities" became "kept by a quality" in v6), moment, part, the
seventh title, shared work and "design flaw" plus "green run" match decision
27, `b0109a9d`, `6f3b384e` and CONTEXT.md.

**Decisions 27, 28 and 29.** Nothing departs from CURRENT-STATE.md: 27's
words, its reason and its seventh title; 28's six points (the paper documents
question left for step 3; emails outside the engine; the console separate with
room in the Review stage; X-08 under C9); 29's five pages plus a change log and
"nothing has to stay as it is".
