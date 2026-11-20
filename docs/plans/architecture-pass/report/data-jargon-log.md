# Data files: jargon table applied

Written 2026-11-01 for the version 9 rewrite of "What the Engine Promises". Source of every change: `site/checks/jargon-table.md`, the four per-file sections for `report/2026-10-31-engine-jobs.json` (85 rows), `report/2026-11-01-engine-shape.json` (105 rows), `report/2026-10-31-cause-cards.json` (117 rows) and `report/2026-10-31-standalone-lines.json` (8 rows): 315 rows in all. Rows that target `site/front.json`, `site/decisions.json`, `site/changes.json`, `build_site.py` (F6, F7, P21 to P30, A9, `PARITY_WORDS`) and the parity table are not touched here; other writers and the builder take those.

## How the rows were applied

- Each row's "Now" sentence was looked up in the field the table names (by job, card, part or line id, then by field and index). The replacement runs only inside that field; the script stopped if the sentence was not found exactly once there, so no row was applied by guess.
- The field's JSON string was swapped in the raw file text, so the two-space layout of the cards, promises and standalone files and the compact layout of the shape file are untouched. Line counts before and after: cards 1007, promises 707, standalone 197, shape 498. Every file parses as JSON after the edits.
- Where a row rewrites one sentence of a longer field, only that sentence changed. Where a row lists several changes (a diagram's boxes and arrows, or two sentences), each change is one edit; the table below shows one line per row and names every field it touched.
- Diagram boxes and arrows were matched as whole labels (the text between a label's quotes), so a short arrow text such as "batch" or "names" could not match inside a longer one.
- In the promises' needs, every capability number is dropped and the capability's plain name kept (Held items, Remote displays, Players' phones, Hardware-scanner parity, the preflight, Self-heal, the GM scanner redesign, the second game); where the table replaces a code-word name with a short description (rows P14 to P102), the description is used as written.
- The finding ids on the Design flaws page (B-07 / D-04 and the rest) live in each example's separate `ids` field, which no row changes; dropping them from the page is F7, a renderer change in `build_site.py`.
- The table's "Now" column quotes four sentences slightly differently from the file (rows A8, A78, A81, F20: a colon, two final full stops and a capital). In each the sentence stands where the table says; the same wording was applied to the sentence as it reads in the file, and the row's line below says so.

## The rows, one line each

Format: row id, file and field(s), result.

### `report/2026-10-31-engine-jobs.json` (85 rows)

- I7 | `engine-jobs.json` `purpose[2]` | applied
- I8 | `engine-jobs.json` `purpose[7]` | applied
- P5 | `engine-jobs.json` `jobs[id=J6].functional.people` | not applied: the table says no change (the words-box entry The toy game (W5) explains it)
- P6 | `engine-jobs.json` `jobs[id=J9].functional.people` | applied
- P13 | `engine-jobs.json` `jobs[id=J1].goal` | applied
- P14 | `engine-jobs.json` `jobs[id=J1].needs[0]` | applied (2 edits in the field)
- P15 | `engine-jobs.json` `jobs[id=J1].needs[1]` | applied
- P16 | `engine-jobs.json` `jobs[id=J1].needs[2]` | applied
- P17 | `engine-jobs.json` `jobs[id=J1].needs[3]` | applied
- P18 | `engine-jobs.json` `jobs[id=J1].needs[4]` | applied
- P19 | `engine-jobs.json` `jobs[id=J1].needs[5]` | applied
- P20 | `engine-jobs.json` `jobs[id=J1].tests[2]` | applied
- P32 | `engine-jobs.json` `jobs[id=J2].flaws[id=C5].how` | applied
- P33 | `engine-jobs.json` `jobs[id=J2].needs[0]` | applied
- P34 | `engine-jobs.json` `jobs[id=J2].needs[1]` | applied
- P35 | `engine-jobs.json` `jobs[id=J2].needs[2]` | applied
- P36 | `engine-jobs.json` `jobs[id=J2].needs[3]` | applied
- P37 | `engine-jobs.json` `jobs[id=J2].needs[4]` | applied
- P38 | `engine-jobs.json` `jobs[id=J2].needs[5]` | applied
- P39 | `engine-jobs.json` `jobs[id=J2].tests[2]` | applied
- P41 | `engine-jobs.json` `jobs[id=J3].flaws[id=C13].how` | applied
- P42 | `engine-jobs.json` `jobs[id=J3].needs[0]` | applied
- P43 | `engine-jobs.json` `jobs[id=J3].needs[1]` | applied
- P44 | `engine-jobs.json` `jobs[id=J3].needs[2]` | applied
- P45 | `engine-jobs.json` `jobs[id=J3].needs[3]` | applied
- P46 | `engine-jobs.json` `jobs[id=J4].goal` | applied
- P47 | `engine-jobs.json` `jobs[id=J4].standalone` | applied
- P48 | `engine-jobs.json` `jobs[id=J4].needs[0]` | applied
- P49 | `engine-jobs.json` `jobs[id=J4].needs[1]` | applied
- P50 | `engine-jobs.json` `jobs[id=J4].needs[2]` | applied
- P51 | `engine-jobs.json` `jobs[id=J4].needs[3]` | applied
- P52 | `engine-jobs.json` `jobs[id=J4].needs[4]` | applied
- P53 | `engine-jobs.json` `jobs[id=J4].needs[5]` | applied
- P54 | `engine-jobs.json` `jobs[id=J4].tests[1]` | applied
- P56 | `engine-jobs.json` `jobs[id=J5].goal` | applied
- P57 | `engine-jobs.json` `jobs[id=J5].needs[0]` | applied
- P58 | `engine-jobs.json` `jobs[id=J5].needs[1]` | applied
- P59 | `engine-jobs.json` `jobs[id=J5].needs[2]` | applied
- P60 | `engine-jobs.json` `jobs[id=J5].needs[3]` | applied
- P61 | `engine-jobs.json` `jobs[id=J5].needs[4]` | applied
- P62 | `engine-jobs.json` `jobs[id=J5].needs[5]` | applied
- P63 | `engine-jobs.json` `jobs[id=J5].needs[6]` | applied
- P64 | `engine-jobs.json` `jobs[id=J5].needs[7]` | applied
- P65 | `engine-jobs.json` `jobs[id=J6].goal` | applied
- P66 | `engine-jobs.json` `jobs[id=J6].flaws[id=C8].how` | applied
- P67 | `engine-jobs.json` `jobs[id=J6].needs[0]` | applied
- P68 | `engine-jobs.json` `jobs[id=J6].needs[1]` | applied
- P69 | `engine-jobs.json` `jobs[id=J6].needs[2]` | applied
- P70 | `engine-jobs.json` `jobs[id=J6].needs[3]` | applied
- P71 | `engine-jobs.json` `jobs[id=J6].needs[4]` | applied
- P72 | `engine-jobs.json` `jobs[id=J7].flaws[id=C13].how` | applied
- P73 | `engine-jobs.json` `jobs[id=J7].needs[0]` | applied
- P74 | `engine-jobs.json` `jobs[id=J7].needs[1]` | applied
- P75 | `engine-jobs.json` `jobs[id=J7].needs[2]` | applied
- P76 | `engine-jobs.json` `jobs[id=J7].needs[3]` | applied
- P77 | `engine-jobs.json` `jobs[id=J7].needs[4]` | applied
- P78 | `engine-jobs.json` `jobs[id=J7].needs[5]` | applied
- P80 | `engine-jobs.json` `jobs[id=J8].needs[0]` | applied
- P81 | `engine-jobs.json` `jobs[id=J8].needs[1]` | applied
- P82 | `engine-jobs.json` `jobs[id=J8].needs[2]` | applied
- P83 | `engine-jobs.json` `jobs[id=J8].needs[4]` | applied
- P84 | `engine-jobs.json` `jobs[id=J8].tests[1]` | applied
- P85 | `engine-jobs.json` `jobs[id=J9].standalone` | applied
- P86 | `engine-jobs.json` `jobs[id=J9].needs[0]` | applied
- P87 | `engine-jobs.json` `jobs[id=J9].needs[1]` | applied
- P88 | `engine-jobs.json` `jobs[id=J9].needs[2]` | applied
- P89 | `engine-jobs.json` `jobs[id=J9].needs[3]` | applied
- P90 | `engine-jobs.json` `jobs[id=J9].tests[3]` | applied
- P91 | `engine-jobs.json` `jobs[id=J10].functional.need` | not applied: the table says no change (the words-box entry The toy game (W5) explains it; the front page's copy is front.json, another writer's)
- P93 | `engine-jobs.json` `jobs[id=J10].goal` | applied
- P94 | `engine-jobs.json` `jobs[id=J10].flaws[id=C8].how` | applied
- P95 | `engine-jobs.json` `jobs[id=J10].flaws[id=C15].how` | applied
- P96 | `engine-jobs.json` `jobs[id=J10].flaws[id=C16].how` | applied
- P97 | `engine-jobs.json` `jobs[id=J10].standalone` | applied
- P98 | `engine-jobs.json` `jobs[id=J10].needs[0]` | applied
- P99 | `engine-jobs.json` `jobs[id=J10].needs[1]` | applied
- P100 | `engine-jobs.json` `jobs[id=J10].needs[2]` | applied
- P101 | `engine-jobs.json` `jobs[id=J10].needs[3]` | applied
- P102 | `engine-jobs.json` `jobs[id=J10].needs[4]` | applied
- P103 | `engine-jobs.json` `jobs[id=J10].tests[0]` | applied
- P104 | `engine-jobs.json` `jobs[id=J10].tests[1]` | applied
- P105 | `engine-jobs.json` `jobs[id=J10].tests[2]` | applied (2 edits in the field)
- P106 | `engine-jobs.json` `jobs[id=J10].tests[3]` | applied
- F81 | `engine-jobs.json` `jobs[id=J1].flaws[id=N1].how` | applied
- X1 | `engine-jobs.json` `jobs[id=J8].needs[3]` | applied

### `report/2026-11-01-engine-shape.json` (105 rows)

- P9 | `engine-shape.json` `relationsMermaid` | not applied: the table says no change (the words-box entry The toy game (W5) explains it)
- P10 | `engine-shape.json` `relationsMermaid` | applied
- P11 | `engine-shape.json` `relationsMermaid` | applied
- A4 | `engine-shape.json` `qualities[0].plain` | applied
- A5 | `engine-shape.json` `qualities[1].plain` | applied
- A6 | `engine-shape.json` `qualities[2].plain` | applied
- A7 | `engine-shape.json` `qualities[3].plain` | applied
- A8 | `engine-shape.json` `mechanisms[10].plain` | applied; the file reads 'Today a tap', not 'Today: a tap' as the table quotes; same wording applied, 'Today ' kept at the start
- A15 | `engine-shape.json` `mechanisms[0].plain` | applied
- A16 | `engine-shape.json` `parts[id=P13].plain` | applied
- A17 | `engine-shape.json` `parts[id=P13].plain` | applied
- A18 | `engine-shape.json` `mechanisms[7].plain` | applied; 'Today ' kept at the start
- A19 | `engine-shape.json` `parts[id=P13].seams` | applied
- A20 | `engine-shape.json` `parts[id=P2].plain` | applied
- A21 | `engine-shape.json` `mechanisms[8].plain` | applied; 'Today ' kept at the start
- A22 | `engine-shape.json` `parts[id=P2].seams` | applied
- A23 | `engine-shape.json` `parts[id=P7].plain` | applied
- A24 | `engine-shape.json` `parts[id=P7].plain` | applied
- A25 | `engine-shape.json` `parts[id=P7].plain` | applied
- A26 | `engine-shape.json` `mechanisms[2].plain` | applied
- A27 | `engine-shape.json` `parts[id=P7].seams` | applied
- A28 | `engine-shape.json` `parts[id=P12].plain` | applied
- A29 | `engine-shape.json` `parts[id=P12].seams` | applied
- A30 | `engine-shape.json` `parts[id=P3].seams` | applied
- A31 | `engine-shape.json` `parts[id=P8].plain` | applied
- A32 | `engine-shape.json` `mechanisms[4].plain` | applied; 'Today ' kept at the start
- A33 | `engine-shape.json` `parts[id=P8].seams` | applied
- A34 | `engine-shape.json` `parts[id=P10].plain` | applied
- A35 | `engine-shape.json` `parts[id=P10].plain` | applied
- A36 | `engine-shape.json` `mechanisms[5].plain` | applied
- A37 | `engine-shape.json` `parts[id=P10].seams` | applied
- A38 | `engine-shape.json` `parts[id=P9].plain` | applied
- A39 | `engine-shape.json` `parts[id=P9].seams` | applied
- A40 | `engine-shape.json` `parts[id=P11].plain` | applied
- A41 | `engine-shape.json` `mechanisms[3].plain` | applied; 'Today ' kept at the start
- A42 | `engine-shape.json` `parts[id=P11].seams` | applied
- A43 | `engine-shape.json` `parts[id=P4].plain` | applied; the row changes only 'transport'; its Should read keeps 'one shape'
- A44 | `engine-shape.json` `parts[id=P5].seams` | applied
- A45 | `engine-shape.json` `parts[id=P6].seams` | applied
- A46 | `engine-shape.json` `mechanisms[1].plain` | applied; 'Today ' kept at the start
- A47 | `engine-shape.json` `parts[id=P14].plain` | applied
- A48 | `engine-shape.json` `parts[id=P14].seams` | not applied: the table says no change (the words-box entry Pi 4 (W9) explains it)
- A49 | `engine-shape.json` `parts[id=P15].plain` | applied
- A50 | `engine-shape.json` `parts[id=P15].plain` | applied
- A51 | `engine-shape.json` `parts[id=P15].seams` | applied
- A52 | `engine-shape.json` `parts[id=P16].plain` | applied
- A53 | `engine-shape.json` `mechanisms[9].plain` | applied; 'Today ' kept at the start
- A54 | `engine-shape.json` `parts[id=P16].seams` | applied (2 edits in the field)
- A55 | `engine-shape.json` `parts[id=P17].plain` | applied
- A56 | `engine-shape.json` `parts[id=P17].seams` | applied
- A62 | `engine-shape.json` `componentsMermaid` | applied (2 edits in the field)
- A63 | `engine-shape.json` `componentsMermaid` | applied
- A64 | `engine-shape.json` `componentsMermaid` | applied
- A65 | `engine-shape.json` `componentsMermaid` | applied
- A66 | `engine-shape.json` `componentsMermaid` | not applied: the table says no change (the words-box entry Pi 4 (W9) explains it)
- A67 | `engine-shape.json` `componentsMermaid` | applied
- A68 | `engine-shape.json` `componentsMermaid` | applied
- A69 | `engine-shape.json` `componentsMermaid` | applied
- A70 | `engine-shape.json` `componentsMermaid` | applied
- A71 | `engine-shape.json` `componentsMermaid` | applied
- A72 | `engine-shape.json` `componentsMermaid` | applied
- A73 | `engine-shape.json` `componentsMermaid` | applied
- A74 | `engine-shape.json` `componentsMermaid` | applied (2 edits in the field)
- A76 | `engine-shape.json` `today.tangles[0].plain` | applied
- A77 | `engine-shape.json` `today.tangles[1].plain` | applied
- A78 | `engine-shape.json` `today.tangles[2].title` | applied; the file's title has no final full stop; the table quotes one
- A79 | `engine-shape.json` `today.tangles[2].plain` | applied
- A80 | `engine-shape.json` `today.tangles[2].plain` | applied
- A81 | `engine-shape.json` `today.tangles[3].title` | applied; the file's title has no final full stop; the table quotes one
- A82 | `engine-shape.json` `today.tangles[3].plain` | applied
- A83 | `engine-shape.json` `today.tangles[4].plain` | applied (2 edits in the field)
- A84 | `engine-shape.json` `today.tangles[5].plain` | applied
- A85 | `engine-shape.json` `today.tangles[6].title` | applied
- A86 | `engine-shape.json` `today.tangles[6].plain` | applied
- A87 | `engine-shape.json` `today.tangles[6].plain` | applied
- A88 | `engine-shape.json` `today.tangles[7].plain` | applied
- A89 | `engine-shape.json` `today.tangles[7].plain` | applied
- A90 | `engine-shape.json` `today.tangles[8].plain` | applied
- A91 | `engine-shape.json` `today.tangles[9].title` | applied
- A92 | `engine-shape.json` `today.tangles[9].plain` | applied
- A93 | `engine-shape.json` `today.tangles[9].plain` | applied
- A94 | `engine-shape.json` `today.tangles[10].title` | applied
- A95 | `engine-shape.json` `today.tangles[10].plain` | applied
- A96 | `engine-shape.json` `today.tangles[10].plain` | applied
- A97 | `engine-shape.json` `today.tangles[10].plain` | applied
- A98 | `engine-shape.json` `today.tangles[11].title` | applied
- A99 | `engine-shape.json` `today.tangles[11].plain` | applied
- A100 | `engine-shape.json` `today.tangles[12].title` | applied
- A101 | `engine-shape.json` `today.tangles[12].plain` | applied (2 edits in the field)
- A103 | `engine-shape.json` `alternatives[0].a` | applied
- A104 | `engine-shape.json` `alternatives[0].b` | applied
- A105 | `engine-shape.json` `alternatives[0].cost` | applied
- A106 | `engine-shape.json` `alternatives[1].title` | applied; start 'The rules' kept for ALT_TITLE_START
- A107 | `engine-shape.json` `alternatives[1].cost` | applied (2 edits in the field)
- A108 | `engine-shape.json` `alternatives[2].title` | applied; start 'Equipment' kept for ALT_TITLE_START
- A109 | `engine-shape.json` `alternatives[2].a` | applied
- A110 | `engine-shape.json` `alternatives[2].b` | applied
- A111 | `engine-shape.json` `alternatives[2].cost` | applied (2 edits in the field)
- A112 | `engine-shape.json` `alternatives[3].b` | applied
- A113 | `engine-shape.json` `alternatives[3].cost` | applied
- A114 | `engine-shape.json` `alternatives[6].cost` | applied
- A115 | `engine-shape.json` `alternatives[6].a` | not applied: the table says no change (the words-box entry Pi 4 (W9) explains it)
- A116 | `engine-shape.json` `alternatives[7].title` | applied; start 'Release day' kept for ALT_TITLE_START
- A117 | `engine-shape.json` `alternatives[7].b` | applied
- A118 | `engine-shape.json` `alternatives[7].cost` | applied

### `report/2026-10-31-cause-cards.json` (117 rows)

- F9 | `cause-cards.json` `cards[id=C12].before.mermaid` | applied (6 edits in the field)
- F10 | `cause-cards.json` `cards[id=C12].after.mermaid` | applied (12 edits in the field)
- F11 | `cause-cards.json` `cards[id=C12].after.note` | applied
- F12 | `cause-cards.json` `cards[id=C12].designTerms` | applied
- F13 | `cause-cards.json` `cards[id=C12].examples[0].text` | applied; the finding ids live in the separate ids field; dropping them from the page is F7, a renderer change
- F14 | `cause-cards.json` `cards[id=C12].examples[5].text` | applied
- F15 | `cause-cards.json` `cards[id=C1].before.mermaid` | applied (2 edits in the field)
- F16 | `cause-cards.json` `cards[id=C1].after.mermaid` | not applied: the table says no change (the words-box entry Label (W7) explains it)
- F17 | `cause-cards.json` `cards[id=C1].examples[3].text` | applied
- F18 | `cause-cards.json` `cards[id=C1].examples[5].text` | applied
- F19 | `cause-cards.json` `cards[id=C6].whyItHappens` | applied (2 edits in the field)
- F21 | `cause-cards.json` `cards[id=C6].before.mermaid` | applied (7 edits in the field)
- F22 | `cause-cards.json` `cards[id=C6].after.mermaid` | applied (4 edits in the field)
- F23 | `cause-cards.json` `cards[id=C6].after.note` | applied
- F24 | `cause-cards.json` `cards[id=C6].designTerms` | applied (2 edits in the field)
- F25 | `cause-cards.json` `cards[id=C6].examples[1].text` | applied
- F26 | `cause-cards.json` `cards[id=C6].examples[3].text` | applied
- F27 | `cause-cards.json` `cards[id=C6].examples[4].text` | applied
- F28 | `cause-cards.json` `cards[id=C6].examples[5].text` | applied
- F30 | `cause-cards.json` `cards[id=C9].before.mermaid` | applied (4 edits in the field)
- F31 | `cause-cards.json` `cards[id=C9].after.mermaid` | applied (2 edits in the field)
- F32 | `cause-cards.json` `cards[id=C9].after.note` | applied
- F33 | `cause-cards.json` `cards[id=C9].examples[2].text` | applied
- F34 | `cause-cards.json` `cards[id=C11].before.mermaid` | applied (4 edits in the field)
- F35 | `cause-cards.json` `cards[id=C11].after.note` | applied
- F36 | `cause-cards.json` `cards[id=C11].designTerms` | applied
- F37 | `cause-cards.json` `cards[id=C11].examples[1].text` | applied
- F38 | `cause-cards.json` `cards[id=C11].examples[2].text` | applied
- F39 | `cause-cards.json` `cards[id=C11].examples[3].text` | applied
- F41 | `cause-cards.json` `cards[id=C7].before.mermaid` | applied (9 edits in the field)
- F42 | `cause-cards.json` `cards[id=C7].after.mermaid` | applied (4 edits in the field)
- F43 | `cause-cards.json` `cards[id=C7].designTerms` | applied
- F44 | `cause-cards.json` `cards[id=C7].examples[0].text` | applied
- F45 | `cause-cards.json` `cards[id=C7].examples[1].text` | applied
- F46 | `cause-cards.json` `cards[id=C7].examples[2].text` | applied
- F47 | `cause-cards.json` `cards[id=C7].examples[3].text` | applied
- F48 | `cause-cards.json` `cards[id=C7].examples[4].text` | applied
- F49 | `cause-cards.json` `cards[id=C7].examples[5].text` | applied
- F50 | `cause-cards.json` `cards[id=C2].seenLive` | applied
- F51 | `cause-cards.json` `cards[id=C2].before.mermaid` | applied (8 edits in the field)
- F52 | `cause-cards.json` `cards[id=C2].designTerms` | applied
- F53 | `cause-cards.json` `cards[id=C2].examples[1].text` | applied
- F54 | `cause-cards.json` `cards[id=C2].examples[2].text` | applied
- F55 | `cause-cards.json` `cards[id=C2].examples[3].text` | applied
- F56 | `cause-cards.json` `cards[id=C3].before.mermaid` | applied (6 edits in the field)
- F57 | `cause-cards.json` `cards[id=C3].after.mermaid` | applied
- F58 | `cause-cards.json` `cards[id=C3].examples[0].text` | applied
- F59 | `cause-cards.json` `cards[id=C3].examples[1].text` | applied
- F60 | `cause-cards.json` `cards[id=C3].examples[2].text` | applied
- F61 | `cause-cards.json` `cards[id=C3].examples[3].text` | applied
- F62 | `cause-cards.json` `cards[id=C3].examples[4].text` | applied
- F63 | `cause-cards.json` `cards[id=C3].examples[5].text` | applied
- F64 | `cause-cards.json` `cards[id=C4].whyItHappens` | applied
- F65 | `cause-cards.json` `cards[id=C4].before.mermaid` | applied (7 edits in the field)
- F66 | `cause-cards.json` `cards[id=C4].after.mermaid` | applied
- F67 | `cause-cards.json` `cards[id=C4].examples[5].text` | applied
- F68 | `cause-cards.json` `cards[id=C5].whyItHappens` | applied
- F69 | `cause-cards.json` `cards[id=C5].before.mermaid` | applied (5 edits in the field)
- F70 | `cause-cards.json` `cards[id=C5].after.mermaid` | applied (3 edits in the field)
- F71 | `cause-cards.json` `cards[id=C5].after.note` | applied
- F72 | `cause-cards.json` `cards[id=C5].designTerms` | applied
- F73 | `cause-cards.json` `cards[id=C5].examples[3].text` | applied
- F74 | `cause-cards.json` `cards[id=C13].before.mermaid` | applied (10 edits in the field)
- F75 | `cause-cards.json` `cards[id=C13].after.mermaid` | applied
- F76 | `cause-cards.json` `cards[id=C13].examples[0].text` | applied
- F77 | `cause-cards.json` `cards[id=C13].examples[1].text` | applied
- F78 | `cause-cards.json` `cards[id=C13].examples[3].text` | applied
- F79 | `cause-cards.json` `cards[id=C13].examples[4].text` | applied
- F80 | `cause-cards.json` `cards[id=C13].examples[5].text` | applied
- F83 | `cause-cards.json` `cards[id=C10].before.mermaid` | applied (5 edits in the field)
- F84 | `cause-cards.json` `cards[id=C10].after.mermaid` | applied; the Delivery label 'every fact labelled' stays (words box: Label, W7)
- F85 | `cause-cards.json` `cards[id=C10].designTerms` | applied
- F86 | `cause-cards.json` `cards[id=C10].examples[3].text` | applied
- F87 | `cause-cards.json` `cards[id=C10].examples[4].text` | applied
- F88 | `cause-cards.json` `cards[id=C8].seenLive` | applied
- F90 | `cause-cards.json` `cards[id=C8].before.mermaid` | applied (8 edits in the field)
- F91 | `cause-cards.json` `cards[id=C8].after.mermaid` | applied (11 edits in the field)
- F92 | `cause-cards.json` `cards[id=C8].after.note` | applied
- F93 | `cause-cards.json` `cards[id=C8].designTerms` | applied
- F94 | `cause-cards.json` `cards[id=C8].examples[0].text` | applied
- F95 | `cause-cards.json` `cards[id=C8].examples[1].text` | applied
- F96 | `cause-cards.json` `cards[id=C8].examples[2].text` | applied
- F97 | `cause-cards.json` `cards[id=C8].examples[3].text` | applied
- F98 | `cause-cards.json` `cards[id=C8].examples[4].text` | applied
- F99 | `cause-cards.json` `cards[id=C8].examples[5].text` | applied
- F100 | `cause-cards.json` `cards[id=C14].whyItHappens` | applied
- F102 | `cause-cards.json` `cards[id=C14].before.mermaid` | applied (7 edits in the field)
- F103 | `cause-cards.json` `cards[id=C14].after.mermaid` | applied (6 edits in the field)
- F104 | `cause-cards.json` `cards[id=C14].after.note` | applied (2 edits in the field)
- F105 | `cause-cards.json` `cards[id=C14].designTerms` | applied
- F106 | `cause-cards.json` `cards[id=C14].examples[0].text` | applied
- F107 | `cause-cards.json` `cards[id=C14].examples[1].text` | applied
- F108 | `cause-cards.json` `cards[id=C14].examples[2].text` | applied
- F109 | `cause-cards.json` `cards[id=C14].examples[3].text` | applied
- F110 | `cause-cards.json` `cards[id=C14].examples[4].text` | applied
- F111 | `cause-cards.json` `cards[id=C15].seenLive` | applied
- F113 | `cause-cards.json` `cards[id=C15].before.mermaid` | applied (7 edits in the field)
- F114 | `cause-cards.json` `cards[id=C15].after.mermaid` | applied (4 edits in the field)
- F115 | `cause-cards.json` `cards[id=C15].after.note` | applied
- F116 | `cause-cards.json` `cards[id=C15].examples[0].text` | applied
- F117 | `cause-cards.json` `cards[id=C15].examples[1].text` | applied
- F118 | `cause-cards.json` `cards[id=C15].examples[2].text` | applied
- F119 | `cause-cards.json` `cards[id=C15].examples[4].text` | applied
- F120 | `cause-cards.json` `cards[id=C15].examples[5].text` | applied
- F121 | `cause-cards.json` `cards[id=C16].atAShow` | applied
- F122 | `cause-cards.json` `cards[id=C16].whyItHappens` | applied
- F123 | `cause-cards.json` `cards[id=C16].seenLive` | applied
- F125 | `cause-cards.json` `cards[id=C16].before.mermaid` | applied (8 edits in the field)
- F126 | `cause-cards.json` `cards[id=C16].after.mermaid` | applied (8 edits in the field)
- F127 | `cause-cards.json` `cards[id=C16].after.note` | applied
- F128 | `cause-cards.json` `cards[id=C16].designTerms` | applied
- F129 | `cause-cards.json` `cards[id=C16].examples[0].text` | applied
- F130 | `cause-cards.json` `cards[id=C16].examples[1].text` | applied
- F131 | `cause-cards.json` `cards[id=C16].examples[2].text` | applied
- F132 | `cause-cards.json` `cards[id=C16].examples[3].text` | applied
- F133 | `cause-cards.json` `cards[id=C16].examples[4].text` | applied
- F134 | `cause-cards.json` `cards[id=C16].examples[5].text` | applied

### `report/2026-10-31-standalone-lines.json` (8 rows)

- F8 | `standalone-lines.json` `lines.C12` | applied
- F20 | `standalone-lines.json` `lines.C6` | applied; the file has lower-case 'there' after 'In a standalone game:'; the table quotes it capitalised
- F29 | `standalone-lines.json` `lines.C9` | applied
- F40 | `standalone-lines.json` `lines.C7` | applied
- F89 | `standalone-lines.json` `lines.C8` | applied
- F101 | `standalone-lines.json` `lines.C14` | applied
- F112 | `standalone-lines.json` `lines.C15` | applied (2 edits in the field)
- F124 | `standalone-lines.json` `lines.C16` | applied

## Counts

- Rows targeting these four files: 315. Applied: 308. No change by the table's own word: 7 (P5, P91, P9, A48, A66, A115, F16). Not applied for any other reason: 0.
- Separate edits made: 453 (a row that rewrites a diagram or two sentences counts once per box, arrow or sentence).
- The version 9 check (`site/checks/v9-check-data.md`, 27 conflicts): 26 applied in 41 edits, 1 rejected (row 6). See the next section.
- Files changed: 4. Files written: 4 data files and this log. Nothing committed.

## The version 9 check, applied

Applied 2026-11-01 from `site/checks/v9-check-data.md`. Each conflict was read against the source it names (the jargon table's wording, the decision record, site plan v2) before it was changed. Method as above: the "What it says" fragment swapped for the "What it should say" fragment inside the named field, in the raw file text, each fragment found exactly the expected number of times; every file parses, and the line counts are unchanged (promises 707, shape 498, cards 1007, standalone 197).

| Check row | File and field | Result | Source |
|---|---|---|---|
| 1 | `engine-jobs.json` `jobs[id=J6].goal` | applied: "only by sending it requests, never by writing its files" | Wording 42 |
| 2 | `engine-shape.json` `relationsMermaid`, arrows J5 to J2 and J5 to J4 | applied: "between games, what the record keeps or clears"; "between games, which cues, held items and services reset" | Wording 50 |
| 3 | `engine-shape.json` `parts[id=P2].seams`, first sentence | applied: "the toy game's pack" | Wording 58 |
| 4 | `engine-jobs.json` `jobs[id=J10].functional.need` | applied: "the machine carries everything on one written list of what it should carry (the engine's version, the tablet and phone apps, the pack, the media and the venue profile)". The "no change" of row P91 covered only "the toy game" in this field, which stays. | Wording 62 |
| 5 | `engine-jobs.json` `jobs[id=J8].goal` | applied: "The equipment's names live only in the venue technician's profile and in each running copy of the engine's own settings" | Row A6's wording of the same phrase; wordings 10 and 11 |
| 6 | `engine-shape.json` `qualities[1].name` ("Proof") | rejected. The decision record keeps the name: its entry "One published protocol and an outside test bench" says '"Proof" stays a quality every part must meet' (`DECISIONS.md` line 328); site plan v2 section 3.4 item 3 shows the Design page "with 'Proof' a quality", and `site/v9/design.json` `decided` quotes the same sentence. The name is a quality's title, like the part name Joins and proofs, which the table's "Not touched" list keeps; wording 9 covers "the proof" as a noun for the tests, not this name. | `DECISIONS.md`; site plan v2 section 3.4; jargon table "How to apply" |
| 7 | `engine-shape.json` `alternatives[0].cost`, `[1].cost`, `[5].cost`, `[7].cost` | applied: `[[flaw:C2]]`, `[[flaw:C6]]`, `[[flaw:C10]]` (twice for C2 and C6), `[[flaw:C9]]`, `[[flaw:C5]]` (twice), `[[flaw:C15]]`. For the builder: the version 8 `build_site.py` renders the alternatives table's cells with `e()` (line 1511), so the cost cell must go through `rich()` or the reader sees the markers as text. No other alternatives cell holds a bare flaw id. | Site plan v2 sections 2 and 5; the markers rule |
| 8 | `standalone-lines.json` `lines.C4`, last sentence | applied: `([[q:M]])` in place of `([[q:24\|question 24]])`. M is the letter `site/v9/decisions.json` gives "One GM tablet per standalone game?" (`groups[1].questions[1]`, still open). The marker carries no label, so the builder decides the words (the plan's marker table says "question M"); `site/v9/design.json` already uses bare `[[q:L]]`, `[[q:M]]` and `[[q:N]]` the same way. The version 8 builder's question list has no key M; the version 9 builder reads `v9/decisions.json`. | `DECISIONS.md` last table, row 24; `site/v9/decisions.json`; site plan v2 section 2 and its marker table |
| 9 | `engine-jobs.json` `jobs[id=J4].goal` | applied: "One program watcher restarts a crashed program a few times" | Wording 46; row A31 |
| 10 | `engine-jobs.json` `jobs[id=J9].goal`, `jobs[id=J9].tests[1]` | applied: "One Verdict (healthy, down or not installed tonight)"; "with lighting not installed tonight" | Wording 45 |
| 11 | `engine-jobs.json` `jobs[id=J1].flaws[id=C14].how`, `jobs[id=J10].flaws[id=C14].how` | applied: "The format of the files the pack hands each device"; "Names and formats that join two places" | Wording 38 |
| 12 | `engine-jobs.json` `jobs[id=J2].flaws[id=C4].how`, `jobs[id=J8].flaws[id=C4].how` | applied: "guesses that a new game began from whatever arrives"; "the tablet decides by its own code what happens between games". `jobs[id=J5].flaws[id=C4].how` opens with the flaw's own title and is kept, as the table keeps flaw titles. | Wording 50 |
| 13 | `engine-jobs.json` `jobs[id=J7].tests[0]`, `[1]` | applied: "with no password or pass" (twice) | Wording 56 |
| 14 | `engine-shape.json` `componentsMermaid`, box GS | applied: "its copy of the pack" | Wording 40; rows A63 and A65 |
| 15 | `engine-shape.json` `alternatives[0].cost` | applied: "offer it in one format" | Wording 38 |
| 16 | `engine-shape.json` `alternatives[5].cost` | applied: "is told each time a game starts or ends, the engine resets or restarts, or the pack changes". The check's wording stopped at a restart; wording 24's gloss and words-box revision 1 list five moments (a start, an end, a reset, a restart, a pack change), and the Lifecycle part takes up a new pack between games (`parts[id=P2].seams`), so the pack change is kept in the list. | Wording 50; wording 24; words box W-revise 1 |
| 17 | `engine-shape.json` `mechanisms[6].plain` (Today sentence), `parts[id=P4].plain`, `today.tangles[3].title` | applied: "Today three reply formats at three doors"; "gets one reply in one format"; "Three doors, three reply formats, replies matched to requests by name". The table's header says its wordings are site-wide and "Should read" is applied as written; rows A43 and A81 kept "shape" only because each row changed another word in its sentence, and wording 38 names "reply shape" itself. The three fields now agree with the wording and with the reworded flaw diagrams ("One reply format", row F42). | Wording 38; the jargon table's "How to apply" |
| 18 | `cause-cards.json` `cards[id=C4].whyItHappens`, first two sentences | applied: "tablet reload and reconnect: each moment between games has its own code on each device"; "whether that moment clears it, keeps it or fetches it again" | Wording 50 |
| 19 | `cause-cards.json` `cards[id=C6].before.mermaid`, box liveB | applied: "Live messages<br/>separate code per fact". The boxes "Catch-up builder" (C6) and "Catch-up builders" (C10) stand as rows F21 and F83 wrote them; the table decides those. | Wordings 35 and 36 |
| 20 | `cause-cards.json` `cards[id=C8].atAShow` | applied: "a small test stopped the live show's video player"; "The health check shown to staff who log in, such as the GM, says". The health dashboard is in the GM tablet's admin panel (project guide, "GM Scanner Admin Capabilities", Service Health), so the GM is the right example. | Wording 54; wording 52; rows F88 and F94 |
| 21 | `cause-cards.json` `cards[id=C8].after.note`, first sentence | applied: "One Engine instance holds each running copy's own files, network ports and settings, and a starting point builds the parts from one list, using them." | Wordings 10 and 47 |
| 22 | `cause-cards.json` `cards[id=C12].after.note`, last sentence | applied: "the engine compares pack versions when a device connects" | Wording 41 |
| 23 | `cause-cards.json` `cards[id=C14].after.mermaid`, box Answering | applied: "reply words, one fixed list" | Row F42's wording of the same phrase on C7 |
| 24 | `cause-cards.json` `cards[id=C15].after.mermaid`, box inst | applied: "Engine instance<br/>this engine's own files, ports and settings" | Wording 10, drawing form |
| 25 | `cause-cards.json` `cards[id=C16].after.mermaid`, box inst | applied: "Engine instance<br/>each run with its own files, ports and settings" | Wording 10, drawing form |
| 26 | `standalone-lines.json` `lines.C4`, first sentence | applied: "the tablet decides what happens between games" | Wording 50 |
| 27 | `engine-shape.json` `relationsMermaid` (two arrows from J10), `componentsMermaid` box GS; `standalone-lines.json` `lines.C8` | applied: "each engine copy's own files, ports and settings" (twice); "the engine's own files, ports and settings"; "to keep its own files, network ports and settings". Rows P10, P11, A64 and F89 dropped the ports that wording 10 says the promises' form was aligned to carry. | Wording 10 |

Noted for other writers and the builder, not changed here:

- `site/front.json` line 167 (version 8, another writer's file) still carries "the machine carries one matching set", the twin of row 4; `site/v9/front.json` does not carry the sentence.
- `alternatives[5].cost` still says "by construction"; no wording in the table covers it, and row A107 reworded it only in `alternatives[1].cost` ("because of how it is built").
- `2026-10-31-engine-jobs.md`, the Markdown twin of the promises file, now differs from the JSON by these edits too.

## Left in place: wording-table terms in these files that no row covers

These are not in any row of the table's four per-file sections, so they were left as they stand when the rows were applied. Each names the wording-table row that would apply. The version 9 check then changed 18 of them in fields the page renders (its rows 9 to 27; the table above records each); the items below that the table above does not name still stand, and the builder does not render them.

Promises file (`engine-jobs.json`):

- `jobs[J4].goal`: "One supervisor restarts a crashed program a few times" (wording 46, the program watcher). Row P46 changes only the adopt sentence of this goal.
- `jobs[J9].goal`: "One Verdict (healthy, down or dormant)" (wording 45, not installed tonight); `jobs[J9].tests[1]`: "with lighting dormant".
- `jobs[J1].flaws[C14].how`: "The shape of the files the pack hands each device" and `jobs[J10].flaws[C14].how`: "Names and shapes that join two places" (wording 38, format).
- `jobs[J2].flaws[C4].how` "infers a game boundary", `jobs[J5].flaws[C4].how` "what a game boundary clears or keeps", `jobs[J8].flaws[C4].how` "decides every boundary" (wording 50, between games).
- `jobs[J6].roles[2]`: "who receives the handoff" (wording 53); `jobs[J7].tests[0]` and `[1]`: "no credential" (wording 56, a password or pass).
- `jobs[J8].shapeChange`: "a step-3 choice" (wording 4, the design rounds); `jobs[J1].shapeChange`: "The two-pack proof" (wording 58); `jobs[J10].shapeChange`: "the developer's proof" (wording 9).
- `jobChanges[2]` names "decision 22" and "question 23"; `jobs[J3].meaning` and `jobs[J10].meaning` say "section 4". Numbers, not jargon-table terms; noted because the site rules want titles, not numbers.
- `2026-10-31-engine-jobs.md` holds the same sentences as this JSON (the table's "How to apply" note). The page reads only the JSON; the Markdown twin was not touched and now differs from it.

Shape file (`engine-shape.json`):

- `mechanisms[3].name`: "The boundary table" (wording 50).
- `mechanisms[4].plain`, first sentence: "one supervision rule" (wording 46). Row A32 changes the Today sentence only.
- `mechanisms[6].plain`: "Today three reply shapes at three doors" (wording 38). Rows A81 and A43 keep "reply shapes" and "one shape" in their own Should read, so this may be the table's intent.
- `mechanisms[7].plain`, first sentence: "Every name an engine owns, its process files, sockets, ports, data folder, passes and the display it drives, is per engine" (wordings 10 and 47). Row A18 changes the Today sentence only.
- `mechanisms[9].plain`, first sentence: "Every name and shape two parts share ... the same suite on two packs" (wordings 38 and 54). Row A53 changes the Today sentence only.
- `componentsMermaid`, box GS: "pack client" (wording 40, device); rows A63 and A65 reworded the same phrase in boxes GM and PH.
- `alternatives[0].cost`: "offer it in one shape" (wording 38); `alternatives[5].cost`: "every boundary change" (wording 50).
- `questionNotes[*].note` (A to G) and `ownerChoices[*]`: "The map" (wording 6), "the proofs" (9), "deploy chain" (53), "the pack channel's stamp" (41), "dormancy", "every engine duty reads dormant" (45), "the instance's names" (10), "under one contract" (39), "per capability" (20), "hot-apply window", "adopted" (16, 12), "capabilities" (19). No reader filed a row against these two blocks, which suggests the page does not render them; left for the editor to confirm.

Cards file (`cause-cards.json`):

- `cards[C4].whyItHappens`, first two sentences: "the game's boundaries", "whether a boundary clears it" (wording 50). Row F64 changes the last sentence only.
- `cards[C6].before.mermaid`, box "Live message builder<br/>separate code per fact" (wording 36). Row F21 lists the other boxes of this diagram but not this one.
- `cards[C8].atAShow`: "a unit test killed the live show's video player" (wording 54, small test). Rows F88 and F94 reword the same event in `seenLive` and `examples[0]`.
- `cards[C8].after.note`, first sentence: "every name an engine owns, and a starting point builds the parts from one list, under those names" (wordings 10 and 47, and the "one start-up step" wording rows F70 to F72 and F91 use). Row F92 changes sentences two and three only.
- `cards[C12].after.note`, last sentence: "the engine compares stamps when a device connects" (wording 41). Row F11 changes the first two sentences only.
- `cards[C14].after.mermaid`, box "Answering<br/>reply words, a closed list": "closed list" (row F42 made the same phrase "one fixed list" on C7).
- `cards[C15].after.mermaid`, box "Engine instance<br/>this engine's own names" and `cards[C16].after.mermaid`, box "Engine instance<br/>each run under its own names" (wording 10). Rows F114 and F126 list the other boxes of these diagrams but not these.
- `shapeChange` fields: C5 "a starting point builds every part once"; C8 "its own names", "the designer's preview engine", "under their own names"; C14 "each shared shape"; C16 "only the fakes" (wordings 10, 15, 38, 54). No row targets any card's `shapeChange`.
- Flaw titles C4 ("game boundary") and C6 ("Reconnect snapshot") keep their words: the table's "Not touched" list keeps the flaw titles, and open call 5 keeps C16's.
- Mermaid node ids (`mpd`, `parser`, `probe`, `toast`, `push`, `fake`, `kiosk`, `suites`, `reaper`) are code, never drawn; left as they are.

Standalone file (`standalone-lines.json`):

- `lines.C4`: "the tablet decides every boundary" (wording 50).
- `newFindings[*].text` (SG-01 to SP-23): "adopts", "ESP32", "field", "URL", "green test" and code paths. No row targets this block; it is the standalone review's own finding list, with code references the table's "Not touched" note treats as engineers' reference.
