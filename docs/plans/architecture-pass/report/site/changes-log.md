# Change log page: writer's log

Written 2026-11-01 for `site/changes.json` (plan section 4.3). For
each block: where every item comes from. Paths without a folder are in
`docs/plans/architecture-pass/`; `report/` is
`docs/plans/architecture-pass/report/`; `CS` is
`docs/plans/CURRENT-STATE.md` section 0; `log` is
`git log --format='%h %ad %s' --date=short -- report/ CURRENT-STATE.md`
and `git show <hash>` for a commit's body. Nothing was read outside
`/home/user/ALN-Ecosystem`; `backend/.env` was not opened.

## Sources read

- CS: decisions 20 to 29, the "Live state", "In flight" and "The
  owner's page" entries; the same entry at the commits that published
  versions 1 to 6 (`8104893b`, `3b445778`, `4e777811`, `ab78f1a7`,
  `20ec5c38`, `bf1f0163`).
- `log`, and the bodies of `95daa8ed`, `be01564c`, `0b24bd9b`,
  `17fcce9d`, `1c2e99a9`, `20ac363b`, `37a51da1`, `0d20835a`,
  `467227dd`, `2cc743e9`, `f509848c`, `06f5d73b`, `7a8f7262`,
  `b0109a9d`, `1585e5cc`, `6f3b384e`, `7db3f4bd`, `857a6894`,
  `4ac709c6`, `9739aafa`, `1f7a9ab3`, `261ad97f`, `823b59b4`.
- `report/2026-10-31-engine-jobs.json`: `jobs[].title` (the first
  wording), `functional.proposedTitle`, `shapeChange`, `functional.people`,
  `functional.need`, `goal`, `jobChanges`; its history at `17fcce9d`,
  `2cc743e9` and `1585e5cc` for when the proposed titles took their form.
- `report/2026-10-31-cause-cards.json`: `cards[].shapeChange`,
  `findings` count for C9.
- `report/2026-11-01-engine-shape.json` `functional[].proposedTitle` at
  `94405282`, `2cc743e9` and `1585e5cc`; `parts[].name` for the markers.
- `report/build_report.py`: the TEMPLATE's questions E, F and G today
  (lines 1050 to 1075) and at `4e777811`, `ab78f1a7`, `0d20835a`,
  `467227dd`; the page titles and h1 at `95daa8ed`, `17fcce9d`,
  `1585e5cc` and today; `was` line 218 (v7's "Earlier wording, as a
  job"); the words box lines 962 to 976.
- `relationships/2026-11-01-job-relationships.md` header, section 2
  (J8 and J9 restated, with what the earlier wording got wrong) and
  section 6; `2026-11-01-engine-shape.md` section 5.
- `2026-10-31-engine-jobs.md` header ("What changed, and why").
- `2026-11-01-after-game-report.md` (the six questions and the owner's
  answers); `2026-10-30-cause-analysis.md` lines 35, 456 and 1064 to
  1068 (X-08).
- `consistency/2026-11-01-vocab-promises.md`, `-vocab-shape.md`,
  `-vocab-cards.md`, `-vocab-check-top-fit-questions.md` (the word
  changes decision 27's workflow applied); `CONTEXT.md` section 7 and
  section 5 entries added by `b0109a9d`.
- The owner's answers in this conversation to the page-structure
  questions ("five linked pages"; "move history to change log";
  "there's nothing I rely on in today's page yet. so no.").

## Rules applied

- "Job" appears, as the plan allows on this page only, where the
  history needs it: the earlier titles, the version items and the
  vocabulary.
- "Installer" appears once, in the vocabulary entry that records what
  decision 27 replaced (the task asks for "installer to venue
  technician"). The plan's build check (section 5.2) says no page may
  carry the word; the builder should allow this one entry on
  `changes.html`, as it allows "job", or the entry cannot say what was
  replaced. Everywhere else the venue technician.
- No promise id in visible text: every current title is a
  `[[promise:…]]` marker; the earlier titles are typed as text, since
  they are the record, not the title. Question references are `[[q:…]]`
  markers, parts `[[part:…]]`, flaws `[[flaw:…]]`, pages `[[page:…]]`.
  Checked by script: every marker resolves against the valid lists; no
  em dash; no bare J number.
- The shape is a candidate: every "now" in a change note describes the
  candidate design, as the source notes do.
- Word count: about 4,900 words of text, above the plan's 3,000 to
  4,000 target. The excess is the sixteen card notes and ten promise
  notes carried verbatim from the data (the plan says nothing from v7
  is lost) and the version items the task asks for. No source sentence
  was cut to meet the count.

## Intro

New, two sentences: what the page keeps and that nothing on it is open
(plan section 3.6; the open questions are on the Decisions page).

## Versions

Eight versions, newest first. Version numbers and dates from CS ("The
owner's page" entry) and the `docs(state)` commits that announced each
publish; version 8's date is the plan's and this site's. The quoted
owner words are from CS where CS quotes them, and from the owner's
chat answers for version 8.

- **8** (2026-11-01). Items: the six pages (plan section 1); the
  earlier wording and change notes moving here (plan section 3.3 item
  4 and 3.5 item 3); decision 28's fold (CS decision 28; `1f7a9ab3`;
  `823b59b4` for the roles and built-today line; `engine-jobs.json`
  J3 `goal`); X-08 under C9 and the 358 total (cause analysis lines
  35, 456, 1066; plan section 3.5 item 5); "Around the engine", the
  step-3 item and the Decided list (plan sections 3.1 item 6, 3.2
  items 3 and 4); diagrams drawn at build time (plan section 5.1;
  `261ad97f`). Prompt: the owner's chat answers; CS decision 29 ("The
  owner relies on nothing in version 7, so nothing has to stay as it
  is"); CS "In flight".
- **7** (2026-11-01). Items: `857a6894` body (the picture's content,
  the five walkthroughs, the dependency diagram renamed); `4ac709c6`
  (19 conflicts, the corrections named); `9739aafa` (16 resolved, 3
  partly, 10 new; the verdict's three answers; 41 diagrams). Prompt:
  CS "The owner's page" ("after the owner said the 17-part shape was
  never diagrammed and the page did not show how everything comes
  together"); `857a6894` body says the same.
- **6** (2026-11-01). Items: `b0109a9d` body (titles instead of ids
  everywhere; kept by and break; shared work folded into the parts;
  qualities table; questions rewritten with the same
  recommendations); the page title change from `build_report.py` at
  `17fcce9d` ("What the Engine Must Do") and `1585e5cc` ("What the
  Engine Promises"); `1585e5cc` body (no J number, "job" only in the
  earlier-wording line, no "installer"); `6f3b384e` body (28
  conflicts: Mainly keeps / Also needed by, the Today line, the words
  box order and the narrowed "part", two notes, decision 27 in decided
  so far, two metaphors); `7db3f4bd` body (five leftovers); CS "The
  owner's page" (version 6's description); `build_report.py:218` (the
  "Earlier wording, as a job" line). Prompt: CS decision 27 ("the owner
  found 'job' forced once the jobs were restated from people's side and
  the map split them into promises, qualities and parts").
- **5** (2026-11-01). Items: CS "Live state" (the map's contents:
  every job restated, eleven mechanisms, thirteen tangles, 17 parts, 54
  edges, no cycle; the reconcile's 182 verdicts and 96 corrected; the
  57 conflicts; 54 resolved, 3 partly, 10 new settled at `f509848c`;
  the three changed recommendations); `0d20835a` body (each job leads
  with its restatement; cards name parts and what the map changed; E,
  F, G; the step-3 preview); `7a8f7262` (alternatives in plain words);
  `06f5d73b` (question titles in colour; green run). The section's name
  "How the jobs fit together": CS "The owner's page". Prompt: CS "Live
  state" ("The owner asked how the ten jobs relate, at both levels (the
  big components and the modules inside them), and said J8 and J9 read
  as mechanics, not what they do for people"); the relationships
  sheet's header says the same.
- **4** (2026-11-01). Items: `20ac363b` subject (29 conflicts: 22
  changes, 5 duplicates, 2 already gone, 1 left for the orchestrator;
  plus the page's 10; section 8 of the analysis) and CS at `ab78f1a7`
  (39 in all); `1c2e99a9` subject (the ten page fixes, each named).
  Prompt: CS "The owner's page" ("The consistency check the owner asked
  for"); `37a51da1` (started 2026-10-31); `3fafcd02` (the first run
  stalled and was lost; the rerun covered the jobs document and the
  rebuilt page).
- **3** (2026-11-01). Items: `17fcce9d` subject (purpose first, the
  ten jobs with built-today and the long-term goal, cards nested under
  their main job, standalone, evidence at the back, questions
  regrouped); CS at `4e777811` (the title "What the Engine Must Do";
  the regrouped questions; 18 into F, 23 into C; "design flaws" because
  the owner said "cause analysis" does not land); `build_report.py`
  question text at `4e777811` (question 17 became the list question:
  "This replaces question 17" survives in v7's promises question);
  `engine-jobs.json` `jobChanges` (A, B, C applied). Prompt:
  `2026-10-31-engine-jobs.md` header ("The owner found that hard to
  follow and asked to restructure step 1 around the engine's jobs
  first"); CS decision 26 (the owner's words quoted); CS at `4e777811`
  ("cause analysis" does not land).
- **2** (2026-10-31). Items: `0b24bd9b` subject (standalone lines,
  summary, ESP32 parity table, questions 23 to 25; cause analysis
  section 7; two findings from the doc fixes); CS at `3b445778`
  (version 2's description; the three questions' texts); cause
  analysis line 1289 (24 rows; what the pass answers per cause).
  Prompt: CS decision 22.
- **1** (2026-10-31). Items: `95daa8ed` subject (sixteen checked cards,
  two checkers, 42 corrections; every diagram drawn in a real browser;
  published for round 8 questions 17 and 18); `be01564c` (page no
  wider than the screen, diagrams stacked top-down, 357 findings);
  `build_report.py` at `95daa8ed` (title "ALN Cause Analysis", h1
  "Sixteen causes behind the engine's faults"); card fields from
  `cause-cards.json` (`atAShow`, `whyItHappens`, `before`, `after`,
  `examples`, `blueFixes`, `questions`). Prompt: `95daa8ed` subject;
  CS at `8104893b` (the owner asked whether
  `improve-codebase-architecture` was used for step 1; decision 12 put
  it on step 3; the report presents the list by its method), said on
  the page as "the architecture method skill" so the page cites no
  file or tool name; CS "First steps" item 2 (written and checked,
  waiting for round 8, questions 17 to 21).

## The promises' earlier wording

`earlierTitle` is `jobs[].title` in `engine-jobs.json`, unchanged
since `17fcce9d` (checked at four commits), which v7 shows as "Earlier
wording, as a job". The first change line of each entry is the
promise's `shapeChange` note, with the one quoted title (J1's) turned
into a marker and J4's note taken as the file has it today (the vocab
pass rewrote it; `vocab-promises.md`). The "restated in version 5,
retitled in version 6" line: `engine-shape.json` `functional` at
`94405282` and `2cc743e9` (the restated titles; J6 and J7 filled at the
fold) and `engine-jobs.json` at `1585e5cc` (`proposedTitle` filled,
decision 27). Extra lines:

- J1, J7, J8: the applied changes A, B, C from `jobChanges[0..2]`
  (version 3, `f203118e`); J1's Generic quality and pack-channel stamp
  from `engine-shape.md` section 5 ("A to C") and v7's question A.
- J3: decision 28, CS and `2026-11-01-after-game-report.md` ("The
  owner's answers"); the new `functional.people`, `functional.need` and
  `goal` in `engine-jobs.json`; the built-today line from `823b59b4`.
- J8: the map's "what the current wording gets wrong"
  (`job-relationships.md` section 2, J8: "makes the engine the subject
  and names places... The people are missing"); the restated title
  "Fit the game to the venue it is in tonight" (`engine-shape.json` at
  `2cc743e9`); decision 27's "The seventh title becomes a promise"
  (CS); `vocab-promises.md` and `vocab-shape.md` rows for
  `proposedTitle`.
- J9: `job-relationships.md` section 2, J9 ("makes the engine the
  speaker and lists the four states a fact can be in. Those states are
  the mechanism").
- J10: release day named in the proposed title (`engine-shape.json` at
  `94405282`).

## The cards

Each card's one line is its `shapeChange` in `cause-cards.json`,
verbatim (plain text; no title is quoted in any of them). C9's second
line: the X-08 row of the cause analysis (line 456) and its section 1
sentence (line 35, "added by the after-game survey, decision 28");
`cards[8].findings` has 19 entries; the survey's "A flaw the console
already works around". The two games are written as "two games" rather
than by their dates, which are ALN's record, not the engine's.

## Recommendations the map changed

- **E.** Before: `build_report.py` at `4e777811` ("Split J8 into 'fit
  the game to the venue' and 'run in any setup'... Recommendation:
  split. The installer is one of the engine's five users and has no job
  of their own today") and at `ab78f1a7` (the rename alternative "Fit
  the game to the venue, whatever the setup"). The page says "venue
  technician" where the source said "installer" (plan section 6).
  After and why: today's TEMPLATE lines 1050 to 1053 ("This replaces
  the earlier recommendation to split"); `job-relationships.md` section
  6 E; `engine-shape.md` section 5 E. The parts are marked: Venue fit
  (P12), Verdict (P10), Engine instance (P13).
- **F.** Before: `4e777811` ("J10 holds four kinds of work. Split it?",
  the two halves, "Recommendation: split, and give each half a question
  of its own") and `ab78f1a7` (the widen option: "a new version reaches
  the show only when you say it is ready, with rollback as plugging the
  old machine back in"); the four kinds of work from `jobChanges[5]`.
  After and why: TEMPLATE lines 1057 to 1068; `job-relationships.md`
  section 6 F; `engine-shape.md` section 5 F (P16, P13, P17).
- **G.** Before: `4e777811` ("Which job carries the equipment's state to
  every screen?... Recommendation: J4. It keeps the game's record and
  the equipment's state apart, and matches the pass's question 2"). The
  first draft of version 5: `0d20835a` ("let J2's 'one game, the same
  on every screen' cover the equipment panels too... If you agree, C2's
  card moves under J2"), withdrawn at `467227dd` ("change neither
  sentence") before version 5 was published at `20ec5c38`. After and
  why: TEMPLATE lines 1070 to 1074 ("This replaces the earlier answer,
  which put the route under the room promise whatever the design");
  `job-relationships.md` section 6 G; `engine-shape.md` section 5 G
  (P6, P8).

## The words

- Promise, not job; the records' note: CS decision 27; `CONTEXT.md`
  section 7 "Promise" (added by `b0109a9d`); the vocabulary note added
  to the three records (`b0109a9d`).
- Venue technician: CS decision 27; `CONTEXT.md` section 5 "Venue
  technician" (its definition quoted).
- Titles, not numbers: CS decision 27; `b0109a9d` body (headings, the
  glance table, cross-links, the diagrams' labels).
- Kept by, break, Mainly keeps, Also needed by: `b0109a9d` body;
  `6f3b384e` body.
- Quality: CS decision 27; `CONTEXT.md` section 7 "Quality";
  `vocab-check-top-fit-questions.md` ("Two are kept mostly by a
  quality" replaces "J9 and J10 are mostly qualities") and `7db3f4bd`
  (the "mostly" removed).
- Moment: CS decision 27; `CONTEXT.md` section 7 "Moment".
- Part narrowed: `6f3b384e` body ("'Part' now names only the 17
  candidate parts: a pack's holders are places, today's code is
  modules or code, a kit's copies are copies"; module, interface and
  seam defined without "part"); `vocab-check-top-fit-questions.md`
  conflicts 7 and 8.
- The seventh title: CS decision 27; `vocab-promises.md` row
  `jobs[7].functional.proposedTitle`.
- Shared work folded into the parts: CS decision 27 ("needs no word of
  its own: each piece becomes one part"); `b0109a9d` body.
- Design flaw, not cause: CS at `4e777811`; "green run" as a passing
  test run: `06f5d73b`. Both predate decision 27; they are the page's
  other word changes and are dated to their versions.

## Not written

- The owner's exact words for versions 1 to 7 beyond what CS quotes:
  CS paraphrases them, so the page paraphrases too and quotes only
  CS's quoted phrases.
- A line per card for versions 3 and 4 (cards nested under their main
  job; N1 proposed with no card): those are version items, not changes
  to a card's content, so they stay in the versions block.

## Check applied, 2026-11-01

`site/checks/check-changes.md` found 10 conflicts in 119 items. Each
was verified against the source the check names before the file was
changed: `git show` of the v3, v6 and v7 pages (`17fcce9d`, `7db3f4bd`,
`9739aafa`), the bodies of `6f3b384e`, `7db3f4bd`, `20ac363b`,
`1c2e99a9` and `95daa8ed`, CS at `c40d70c0` and `8104893b`,
`cause-cards.json` (`findings` sum 337) with cause analysis section 5.6
(set aside 21, total 358), `consistency-page.md` rows P4 to P6,
`vocab-fix-verify.md` rows 1 to 5, `engine-jobs.json` J8 `shapeChange`,
`CONTEXT.md` section 5 and the plan's sections 4, 5.2 and 6. All 10
applied, 0 rejected. The file still parses (`python3 -I -m json.tool`);
no "installer", no em or en dash, no promise id outside the `id` fields,
every marker valid.

| # | Where | Change | Why |
|---|---|---|---|
| 1 | `versions[0].items[4]` | "the Decided list gains 27, 28 and 29" became "gains 28 and 29" | The v7 page's "Decided so far" already lists 27; `6f3b384e` put it there. This file's own v6 item says so. |
| 2 | `versions[0].items[3]` | "the flaw total is 358 findings" became "the total is 358 findings, 337 of them under the sixteen flaws and 21 set aside" | 358 is every finding (section 5.6 total); the sixteen cards' `findings` sum to 337; 21 are set aside. The plan's section 3.5 carries the same slip; not this writer's file to fix, noted for the orchestrator. |
| 3 | `versions[2].items[4]` | The 28 and the five leftovers are now listed on the right side of the colon | `6f3b384e` (the 28) names the label notes, the two metaphors and decision 27 joining the list; `7db3f4bd` and `vocab-fix-verify.md` rows 1 to 5 name the five: the summary's "mostly", the table of moments read by most promises, two notes split, the Connections and roles card. |
| 4 | `versions[4].items[0]` | 39 split as 29 (documents and page data, with the 22/5/2/1 breakdown) and 10 (the page itself) | `20ac363b`'s subject gives the breakdown for the 29 only, "plus the page's 10". |
| 5 | `versions[4].items[1]` | "the lost test rig and its 16 runs are recorded" became three fixes: the 35 standalone findings as 27 plus 8 under N1 (P4), the lost standing rig in the built-today line (P5), 16 rig runs instead of about 17 in question 21 (P6) | The rig and the 16 runs are two fixes (P5, P6) and the rig never had runs; P4 was missing, so the list had seven fixes, not ten. `consistency-page.md` P4 to P6; `1c2e99a9`. |
| 6 | `versions[5].items[3]` | "every device runs the same version" became "every part of the kit runs the same version of the pack and says which" | The v3 page's question A says so; the bare "same version" reads as the software version. The J1 entry already had it right. |
| 7 | `versions[7].prompt` | Opens with "The owner asked for a visual report of the cause list; round 8's questions 17 ... and 18 ... waited for it" | CS at `c40d70c0`: 17 and 18 "wait for the visual report the owner asked for". The skill question kept as "had also asked". |
| 8 | `vocabulary[1]` | The two barred words dropped; the entry now says "Earlier pages used another name for this person; decision 27 replaced it." | Plan section 6 bars the word on every page and section 5.2's build check fails on it, with no exception for the change log. The check left the orchestrator a second way, exempting `changes.html` for this one entry as the builder does for "job"; that needs the plan and the builder changed, which this task may not do, so the reword was applied. If the orchestrator exempts the page instead, the earlier entry's wording is in the first version of this file (git history once committed; before that, the check's "What it says" column quotes it). |
| 9 | `vocabulary[3]` | "'Kept by' and 'broken by' ... from version 6" became "'Kept by' and 'break' ... from version 6, and 'broken by' from version 8" | The v6 page has no "Broken by" (0 hits); its labels are "Kept by these parts of the candidate shape" and "Design flaws that break it today" (11 hits of "that break it"). "Broken by" is this site's label (plan 3.3 item 4). |
| 10 | `promises[7].changes[0]` | "[[q:E]] asks you to confirm." became "You are asked to confirm this in [[q:E]]." | The marker renders "question E" (plan section 4), so the sentence would start in lower case. The source's "Question E asks you to confirm" is otherwise kept. |

Row 2 corrects a claim in the "Versions" entry for 8 above ("X-08 under
C9 and the 358 total"): the 358 is the total of every finding, not the
flaws'. Row 8 supersedes the "Installer" paragraph under "Rules applied":
the word no longer appears in the file.
