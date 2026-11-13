# Write log: the Decisions rework of 2026-11-02

Written 2026-11-02 by the agent running the pass. Each change below names its source: a row of `impact.md`, a table of `sorting.md`, a section of `owner-questions.md`, an entry of `../DECISIONS.md`, or the task's own rule. Rows not applied are listed at the end with their reasons. All JSON files parse, keep their layout (two-space indent; `front.json` keeps its compact one-line timeline items) and end with one newline. No `[[q:...]]` marker remains in any file this rework touched. No em dash, no "orchestrator" in anything written here.

Files changed:

- `report/site/v9/decisions.json` (rewritten whole, new shape)
- `requirements/2026-11-01-quality-targets.json`
- `requirements/2026-11-01-extension-cases.json`
- `report/site/v9/design.json`
- `report/site/v9/front.json`
- `report/site/v9/changes.json`
- `panel/2026-11-01-panel-brief.md`
- this log

Not committed, as instructed. Branch `claude/nice-curie-hescfv`.

---

## 1. `report/site/v9/decisions.json`

New shape. Kept as they were shaped: `designRounds` (text + link), `later` (text), `decided` (topic, slug, entries of slug/title/date/line). New keys: `groups[].intro` (array of paragraphs, optional), `groups[].questions[].options[].means` (what the option means in practice, beside `label` and `cost`), `readings`, `calls`, `review` (with an optional `numbers` array on the quality-targets entry). `recKind` takes a new value, "What we need from you".

| Part | What was written | Source |
|---|---|---|
| `intro` (4 paragraphs) | What the page asks and how to answer; that it asks only what is yours; the four tests; where the readings, the agent's calls and the reviews are; that the first group is the conflicts you asked to see; what follows the questions. | DECISIONS.md "The Decisions page holds only your decisions"; owner-questions.md opening; owner comment 1 |
| Group "Where the qualities pull against each other", intro (11 paragraphs) | The nine settled conflicts with their direction and markers; a closing line that six conflicts stay open, one question each. | owner-questions.md "Where the qualities pull against each other" (settled rows) |
| A. A GM tablet cut off from the engine | decides, 8 evidence items (conflict, at a show, GM, designer, adopter, conflict rule, decision ahead, sources), 3 options with means and cost, recommendation "Keep and label" with the conflict rule named as what we need from you. recKind Recommendation. | owner-questions.md "A GM tablet cut off from the engine"; the conflict "Staying up ... against every screen telling the truth" |
| B. The show machine fails mid-game | decides, 8 evidence items, 5 options (pause listed only to say it is out), recKind "What we need from you" with one line. | owner-questions.md "The show machine fails mid-game"; conflicts "Staying up ... against standalone and offline" and "... on the public screens" |
| C. Release day: what must update together, and how long older devices work | decides, 11 evidence items carrying the whole "Release day" explanation (the two phrases; today piece by piece; the long term for your kit and for adopters; at a show under each answer; how the answer changes the protocol and the build; the decision ahead; sources), 3 options, recommendation "Together for what the engine serves, a window for the rest", with the window and refuse-or-warn named as from you. | owner-questions.md "Release day: ..." and the section "Release day"; owner comment 3 |
| D. What a game's maker may build inside the pack | decides, 8 evidence items, 3 options, recommendation "Declared when-then rules ..., kept small", with the standalone subset named as from you. | owner-questions.md "What a game's maker may build inside the pack"; conflicts "Easy to extend against easy to understand" and "parity against standalone"; owner comment 6 |
| E. How an extension for all games reaches a production | decides, 8 evidence items, 3 options, recommendation "Design the places as inner interfaces now; ship main-release-only first; decide add-on policy at the release block", with the deferral named as from you. | owner-questions.md "How an extension for all games reaches a production"; owner comment 6 |
| F. Where the trial copy runs while a show runs | decides, 8 evidence items (including the record's disagreement with itself), 3 options, recKind "What we need from you". | owner-questions.md "Where the trial copy runs while a show runs"; conflict "iteration speed against running well and testable" |
| Group "Standalone games", intro (2 paragraphs) | The purpose in your words; settled points; the reading to confirm; the two conflicts that meet here. | DECISIONS.md "Standalone games: declared, never mixed"; owner comment 4 |
| G. Which standalone games the engine must run | decides, 8 evidence items, 5 shapes as options, recKind "What we need from you". Absorbs version 9's M. | owner-questions.md "Which standalone games the engine must run"; sorting.md Table 1 row M |
| H. What a standalone game gives up, and what it keeps | decides, 8 evidence items, 3 options, recommendation "Per-effect marks by the designer", with the record of player finds named as from you. | owner-questions.md "What a standalone game gives up, and what it keeps" |
| Group "Hardware", intro | Your decision; that the numbers are not questions but a sorting for review. | DECISIONS.md hardware entry and what-is-fixed entry |
| I. Which hardware the first new engine requires, and what it must allow replacing | decides, 8 evidence items, 3 options for the GM's station, recKind "What we need from you". | owner-questions.md "Which hardware the first new engine requires..."; owner comments 5 and 7 |
| Group "The panel", intro | Your decision on what the panel sees; the agent's calls on how it runs; the brief revised 2026-11-02. | DECISIONS.md panel entries; sorting.md Table 1 rows P, Q, R |
| J. What the panel gets in its blind round | decides, 6 evidence items (binding list now with the four of 2026-11-02; readings withheld; the setting's sentence on the GM station), 2 options, recommendation yes. Was version 9's Q. | sorting.md Table 1 row Q; impact.md rows 78, 110 |
| `readings` (3) | The three product readings: no GM tablet at all; a cut-off tablet keeps taking scans; the design says how a networked game carries on if the machine fails. Each one sentence, source a `[[dec:]]` marker. | sorting.md Table 3 (product rows) |
| `calls` (14) | Four readings confirmed (the 8 bookkeeping rows in one call); the numbers sorted, not asked; the watcher's retries; how long before a screen says the engine is silent; the show machine's limits; N1 a flaw of its own; the tap promise split; the venue promise one; proof and release one; the equipment-state route in neither; exposed evidence and video with no engine; refused scans recorded; the three lenses (changed); the second round reads the code. Each with title, call and why. | sorting.md Table 1 (agent's-call rows C, G second point, H, I, J, K, N, O, P, R), Table 2 (the two defaults and QT33's machine limits), Table 3 (bookkeeping rows) |
| `review` (4) | The promises, the quality targets (with the fourteen numbers plus QT44 sorted, one line each), the extension cases, the standing rules; links `[[page:requirements#promises]]`, `#qualities`, `#growth`, `#rules` (the anchors the builder's plan already requires). | sorting.md Table 1 rows A, B, D, E, F; Table 2; impact.md row 63 |
| `designRounds` (6) | Updated: the state round carries on through a failure; the protocol round carries the version rules; the authority round names the machine failing and a cut-off tablet; the extension round names the two kinds and a production's settings; the copies round names a copy on different hardware and points at question F in words. Links unchanged. | impact.md rows 64 to 72 in short; DECISIONS.md 2026-11-02 entries |
| `later` (15) | The twelve as before plus three new items in the same words as `design.json`: after the standalone tablet (the machine failing mid-game), after the start-or-use setting (where a production's settings live and which hardware the roadmap names), at the end (how an extension for all games relates to the main release). | impact.md rows 85, 86, 87, 117 |
| `decided` | Every entry of the record by topic. Added under "What the engine must do": No technical failure stops a game; The engine is hardware-flexible; the roadmap sets the bounds; Two kinds of game extension; The engine says what is fixed and what each production sets. Added under "The owner's site": The Decisions page holds only your decisions. Updated lines: the nine questions, one program, five documents, when the design half is finished (the `[[q:C]]` references became "a reading the agent confirms as its call, listed above"); standalone games (purpose, the hardware scanner answered, date "2026-10-31, purpose 2026-11-02"); what the panel sees (your question above); the owner's site (version 9 shipped both). Slugs by the slug rule, checked by script. | DECISIONS.md whole; sorting.md Table 1 rows C, L, Q |

Not in `decisions.json`: version 9's A, B, C, D, E, F, G (clause), H, I, J, K, L, N, O, P, R as questions; they are reviews, calls or answered, as `changes.json`'s letter table says.

## 2. The requirements

### `requirements/2026-11-01-quality-targets.json`

| Row | Applied | Note |
|---|---|---|
| 1 | yes | intro, last sentence replaced |
| 2 | yes | QT3 situation sentences 3 and 4 |
| 3 | yes | QT3 status and statusKind "partly settled" |
| 4 | yes | QT3 numberToSet |
| 5 | yes, with one change | QT44 added at the END of the list, not after QT3: the task's rule ("new targets or cases go at the end of their list with the next free id") overrides the row's placement. Fields as the row gives them, plus `numberKind: "engine"`. |
| 6 | yes | QT1 situation |
| 7 | yes | QT5 situation |
| 8 | yes | QT7 situation |
| 9 | yes | QT15 status |
| 10 | yes | QT40 status |
| 11 | yes | QT40 numberToSet |
| 12 | yes | QT37 situation |
| 13 | yes | QT37 status ("your decision" became "the owner's decision") |
| 14 | yes | QT38 status |
| 15 | yes | QT39 situation (the `[[q:L]]` marker and "you" are gone) |
| 16 | yes | QT39 status |
| 17 | yes | QT33 situation |
| 18 | yes | QT33 numberToSet |
| 19 to 30 | yes | numberToSet of QT1, QT2, QT5, QT9, QT13, QT14, QT19, QT30, QT34, QT35, QT43; QT13 situation sentence 2 (row 24) |
| 31 | yes | QT24 situation |
| 32 | yes | QT22 status |
| 33 | yes | QT21 situation and status |
| 34 | yes | QT12 situation |
| task rule | yes | `numberKind` inserted right after `numberToSet` in every target that has a number: QT1 production, QT2 default, QT3 engine, QT5 default, QT9 engine, QT13 production, QT14 production, QT19 engine, QT30 production, QT33 engine, QT34 production, QT35 production, QT40 engine, QT43 engine, QT44 engine. Where a target holds numbers of two sorts (QT2, QT33) the field carries the row's main sort from sorting.md Table 2 and the numberToSet text names each sort. Targets with no number carry no `numberKind`. |

Count: 43 targets, 15 with a number.

### `requirements/2026-11-01-extension-cases.json`

| Row | Applied | Note |
|---|---|---|
| 35 | yes | intro |
| 36 | yes | `kind` inserted right after `who` on every case, with the row's values; EX25 "inside the game", EX26 and EX28 "for all games", EX27 "neither: fitting the engine to a venue or a production". The builder change the row asks for (a tag beside "who") is not done here: `build_site.py` is not among this task's files. |
| 37 | yes | EX25 at the end, next free id |
| 38 | yes | EX26 |
| 39 | yes | EX27 |
| 40 | yes | EX28 |
| 41 | yes | EX12 title and case (the `[[q:M]]` marker is gone) |
| 42 | yes | EX12 who and status; statusKind stays "partly settled" |
| 43 | yes | EX16 case and status |
| 44 | yes | EX22 status |
| 45 | yes | EX4 status |
| 46 | yes | EX15 case and status |
| 47 | yes | EX21 case |
| 48 | yes | EX21 status |
| beyond the rows | yes | EX10 case: "How many phones one kit carries at once is a number you set" contradicted the numbers' sorting (sorting.md Table 2: a production's setting) and used "you" in a shared text; it now reads "is a production's setting, measured before the first phone is admitted, under the quality target ...". Impact.md's check of the other cases missed this sentence. |

Count: 28 cases.

New entries use only the promise titles the file already uses, checked by script against the ten titles.

## 3. `report/site/v9/design.json`

| Row | Applied | Note |
|---|---|---|
| 64 | yes | ahead[0] settled, sentence appended |
| 65 | yes | ahead[0] panel |
| 66 | yes | ahead[1] settled appended; panel replaced |
| 67 | yes | ahead[2] decides, sentence 2 replaced |
| 68 | yes | ahead[2] settled, first sentence and the last two sentences (letters L, M, N gone) |
| 69 | yes | ahead[3] decides, after the first sentence |
| 70 | yes | ahead[3] settled, last sentence (letters E, I gone) |
| 71 | yes | ahead[3] panel |
| 72 | yes | ahead[4] settled appended |
| 73 | yes | panel.intro[0] (letters P, Q, R gone) |
| 74 | yes | state lens lead and text |
| 75 | yes | growth lens text |
| 76 | yes | the requirements item |
| 77 | yes | the setting, as facts |
| 78 | yes | the binding decisions (letter Q gone) |
| row 116 | yes | panel.sections[1].items[4] (the six decisions ahead) also carried `[[q:Q]]`; it now reads "your question on what the blind round gets, on [[page:decisions]]" |
| 79 | yes | what each architect writes |
| 80 | yes | today's engine as facts (letter R gone) |
| 81 to 84 | yes | four new `decided[]` entries appended, slugs by the slug rule |
| 85 to 87 | yes | three `later[]` items inserted at the places the rows name, `alt: ""` |

## 4. `report/site/v9/front.json`

Edited as raw text so the compact one-line timeline items keep their layout.

| Row | Applied | Note |
|---|---|---|
| 88 | yes | intros.design[1] last sentence; intros.design[2] first sentence |
| 89 | yes | lead |
| 90 | yes | timeline.done new last item; timeline.now[0] "review"; the panel's now item also reads "after you review the requirements" |
| 91 | yes | the "What you can do now" box, with the final list of ten questions as the rework fixed them (the row said the titles would follow the rework) |
| 92 | yes | six new decidedLately entries at the top |
| 93 | yes | three new words (Fixed requirement, A production's setting, Fallback) and one more the row names (The two kinds of game extension); Quality target revised |
| 94 | yes | words "The requirements" and "The panel" |
| 95 | yes | moments[2] when and people; J4 why; moments[1] people[2]; J8 why |
| 96 | yes | standaloneLine |
| 97 | yes | qualities[0] line |
| 98 | yes | qualities[5] line |
| 99 | yes | qualities[8] line |
| 100 | yes | qualities[9] line |
| 101 | yes | growth[0] line, with EX25 added to its list |
| 102 | yes | growth[1] line |
| 103 | yes | growth[4] line; worldKey |
| 104 | yes | siteGuide decisions and requirements lines; intros.requirements[0], [1] (letters D to K gone), [2] |

## 5. `report/site/v9/changes.json`

| Row | Applied | Note |
|---|---|---|
| 119 | yes | version 10 (2026-11-02) inserted first, with title, six items (what changed and why, quoting your question and your comments 1, 4 and 6 where they help) and a prompt paragraph. |
| task rule | yes | A new top-level table `letters` ([{was, where}], the shape of the existing `numbers` table) mapping each of version 9's eighteen letters to a new letter, an agent's call, a review, or the decision that answered it. intro[1] now names four tables and links `[[page:changes#letters|...]]`; the builder must render the table under the anchor `letters`. |
| 118 | yes | the version 9 entry stays as history; the new counts (43 targets, 28 cases, numbers sorted) are in the version 10 entry |
| beyond the rows | yes | Version 9's `[[q:X]]` markers in this file pointed at letters that now mean other questions. Each is replaced by the version 9 title in words and where it went: six in `promises[].changes`, three in `recommendations[].question` (now the plain title; the builder's check at `build_site.py` 2376 demands a `[[q:X]]` marker and must change), eighteen in the `numbers` table's `where` column. |

## 6. `panel/2026-11-01-panel-brief.md`

| Row | Applied | Note |
|---|---|---|
| 105 | yes | header |
| 106 | yes | lens 1 |
| 107 | yes | lens 2 |
| 108 | yes | the requirements item |
| 109 | yes | the setting, each bullet introduced as ALN's, with the two new bullets |
| 110 | yes | the binding decisions |
| 111 | yes | what each architect writes |
| 112 | yes | what is withheld |
| 113 | yes | the lenses, as the agent's call |
| 114 | yes | what the blind round gets, as the owner's question (moved first; the section is retitled "The owner's question, and the agent's calls") |
| 115 | yes | the second round reads the code, as the agent's call |
| 73 to 80 | yes | the brief's sentences follow the Design page's panel section in the same words, with "the owner" in place of "you" |
| beyond the rows | yes | the opening paragraph now says which choice is the owner's and which are the agent's; the closing "Anything else" item notes that the setting's sentence on ALN's devices changes if the owner opens the GM's station (question I) |

---

## Not applied, with reasons

| Rows | What | Reason |
|---|---|---|
| 49 to 60 | `report/2026-10-31-engine-jobs.json` (purpose[5], purpose[6], J8 meaning, roles, goal, needs, functional; J2 standalone; J4 goal and need; J1 needs[5]; J10 goal; J3 need) and its markdown twin | The file is not among the files this task names. Note for the next step: J2 `standalone` still carries `[[q:M]]`, so the build's `[[q:...]]` check fails until row 56 is applied. |
| 61, 62 | `report/2026-10-31-standalone-lines.json` lines C1 and C4 | Same reason; both still carry `[[q:M]]`. |
| 63 | the standing rules | No change, as the row says. |
| 120 | `build_site.py` (the `kind` tag beside "who"; the `[[q:...]]` check; the front-page world-key check) | Not among this task's files. The builder change the task announces must also: render the new `decisions.json` shape (`groups[].intro`, `options[].means`, `readings`, `calls`, `review` with `numbers`, recKind "What we need from you"); render `numberKind`; render `changes.json`'s `letters` table under the anchor `letters`; accept a plain title in `recommendations[].question`; and replace its own `[[q:O]]` (line 189, the today page), `[[q:A]]` (lines 1832 and 1910, the requirements page) and `[[q:G]]` (line 2231, the N1 card) with words, since those letters now name other questions. The check that the later choices link to six alternatives rows still holds (the three new items start with no `LATER_ALT` key). |
| 116, 117 | DECISIONS.md "Still open" counts ("twelve design choices" to fifteen) and its list of open questions | DECISIONS.md is not among this task's files; its "Still open" section should be rewritten to the ten questions of this page and the fifteen later choices. |
| (none) | `[[q:...]]` markers in `report/site/v9/*-log.md` and `panel/2026-11-01-panel-site-content.json` | Working logs and an earlier panel content file, not this task's files and not read by the build. |

## Flagged for a later pass, not changed

- The requirements files still say "your decision", "your ruling", "your ratification", "fixed by you" in the `status` of QT7, QT8, QT9, QT11, QT14, QT16, QT18, QT19, QT23, QT25, QT30, QT31, QT33, QT43, EX1, EX2, EX10, EX13, EX14, EX17, EX19, EX24 (texts not touched by any impact row). The shared-text rule wants "the owner" there. Only the status fields the rows touched were changed (QT37, QT38, QT39, EX12).
- `design.json` ahead[0] still names the decision question "Reconnect snapshot built like live update", a title from the record, and `front.json` keeps "dormant" in the words-box entry that defines "Not installed tonight"; both are prior text.
- The owner's comment 7 and the hardware comment are the source of question I's "what you must say now"; the reading that "the first release's fixed list is ALN's kit as it stands" is written inside question I as something for you to say, not as a reading in `readings`, because the record does not hold it as a reading.

## Checks run

- Every JSON file parses; `decisions.json`, `design.json`, `changes.json` and both requirements files round-trip through `json.dumps(indent=2, ensure_ascii=False)` unchanged; `front.json` was edited as text and parses.
- Every `[[dec:]]` marker in the six JSON files names a slug in `decisions.json`'s `decided`; every `[[qt:]]` and `[[ex:]]` marker names an existing id; question, target and case titles are unique; question anchors are `q-<letter>`; decided slugs equal the slug of their titles.
- No `[[q:...]]` marker in the files this task names. No em dash. No "orchestrator". The jargon words checked (hot-apply, preview engine, dormant, backend, ESP32, snapshot, sandbox, kiosk, supervisor, instance, cutover, manifest, endpoint) appear in new text nowhere; "Snapcast" appears once as your own example, as the record has it.
