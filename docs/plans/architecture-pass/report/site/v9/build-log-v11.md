# Build log, version 11: integration, build and smoke test (2026-11-10)

> Superseded on the counts by `checks/v11-apply-log.md`: 22 settled, 19 partly settled, 6 proposed; 21 notes under “Today”; 1,775 links; 2,610 words.

Written for the agent running the pass. This step applied the items the five writers left for other files, made
Design's later choices identical to the Decisions page's, built the site, ran the smoke test, checked the counts
and wrote the pages as text for the checkers. Nothing was committed. No git command that changes anything was run.

## Result

- Build: passed. "checks passed: 1773 links resolve; markers, ids, entries, titles, diagrams and words as the plan
  asks". 41 diagrams drawn.
- Smoke test: passed. "smoke passed: 24 loads, 24 screenshots", 124 section anchors followed, 0 console errors on
  every load, no sideways scroll, no tag alone on its line.
- Front page: 2,609 words in sentences, under the hard limit of 2,625. The build prints its standing warning above
  2,500.
- The build passed on its first run in this step, because the one failure the builder's writer forecast (Design's
  later choices naming a removed question) was fixed before the first build. The build and the smoke test were
  each run twice: once after the items below, and once more after the last text change (the vendor's name, below).
  Both runs passed with the same numbers.

## What was applied for other files

Each row is an item from a writer's log, under "For other files", and what this step did with it.

### Applied in this step

| File | Field | Change | Asked by |
|---|---|---|---|
| `report/site/v9/design.json` | `later` | Made identical to `decisions.json` `later` (R8), text for text, all fifteen. Each item keeps its `alt` key by position: 1 `alt-delivery`, 2 `alt-lifecycle`, 3 `alt-rules`, 4 `alt-equipment`, 5 `alt-standalone-tablet`, 7 `alt-scoreboard`, and `""` for the rest. The removed hardware question and "the fallback you choose" are gone from Design. | Decisions, Design and builder logs |
| `report/site/v9/changes.json` | `intro[1]` | "where version 10's ten questions went," became a link to the new table: `[[page:changes#letters-v10\|Where version 10's ten questions went]],`. | Design and builder logs |
| `report/site/v9/changes.json` | `versions`, version 1, `prompt` | R9. The sentence named a vendor's product. It now reads "whether the written method for designing architecture, which the agent follows when asked, was used for that review". This text is older than this run; no writer listed it. It was the only model or vendor name on any page. | R9, found in this step |
| `requirements/2026-11-01-quality-targets.json` | QT37 `today` | "reaches the GM once, as a summary on the result screen" became "reaches only the GM, on the tablet's result screen and activity list". Checked in the code: `ALNScanner/src/ui/uiManager.js:497-502`, `ALNScanner/src/ui/renderers/GameOpsRenderer.js:640-644`. | Decisions log |
| same | `numberToSet` of QT5, QT9, QT19, QT33, QT44, QT46 | Each gains the order of size the review's numbers list on Decisions already gives, marked as the proposal of the agent running the pass: a few minutes (QT9); a few hours, inside one working day (QT19); well under a second for a scan's answer and about a second for a live message to reach every tablet (QT33); about ten seconds (QT44, QT46); a few seconds for a GM tablet or a scoreboard screen and ten seconds for a player scanner (QT5). No target gained or lost a number, so the split 23, 24 and 17 holds. | Decisions and requirements logs |
| `report/site/v9/decisions.json` | question F, `recommendation` | "This changes the target ..., which until this version had a trial copy start on the show machine while a show runs." became "The target “[[qt:QT11]]” waits on this answer: its trial copy runs wherever your answer lets it." | Requirements log, item 3 |
| same | `groups[1].intro[2]` | Two corrections from the row checks. The video token: "today the phone shows a blank screen with the token's id, and the hardware scanner shows the token's picture and says to rescan later, which cannot help in a game with no show machine". The clock: "with no game clock and no phases". See "Judgement calls", 1. | Requirements log, item 4 |
| same | the call “The panel's three lenses”, `call` | "Each architect is also asked for six more things." became "Each architect is also asked for more, and the brief on Design lists all of it. Six of the asks are these." | Design log, item 3 |
| `DECISIONS.md` | “Design top-down, hardest-to-reverse choices first”, the 2026-11-10 line | Three sentences added: the extension decision is designed in two parts, and the last decision also settles what the hardware scanners run while the old machine is still the fallback. | Design log, item 4 |
| same | “What the architects' panel sees, and when”, History | One new line dated 2026-11-10: the brief was revised and is not yet approved; the setting gains the secure connection and the roles of ALN's devices as facts; the failures include the kit's whole network; the blind folder leaves out the notes on today's engine and the second round gets them back. | Design log, item 4 |
| `panel/2026-11-01-panel-brief.md` | "What is withheld, and how", the paragraph on the script | One sentence added: "Where a requirement's text points to another requirement, the script writes that requirement's title in its place." | Requirements log, item 12 |

Every JSON file still round-trips (`json.dumps(indent=2, ensure_ascii=False)` plus a newline equals the file).
`front.json` was not edited in this step and parses. Every line added to `DECISIONS.md` is 72 characters or
shorter.

### Found already applied by the file's own writer

Checked against the files as they stand, and left as they are.

- `build_site.py`: `neededBy`, `waitsFor`, `answerSheet`, a group with no question, `today`, `lettersV10` under the
  exact heading "Where version 10's ten questions went", the three leads, the status date, the texts on
  standalone games, the comparison table's head and cell, and the count checks.
- `site_smoke.js`: the new anchors `waits-for`, `answers` and `letters-v10`.
- `changes.json`: `lettersV10` (ten rows, A to J), the version 11 entry with its items and prompt, the older
  table's rows for the merged and deleted calls, and the corrected sentence on the kit's backup.
- `design.json`: the date of the brief's revision, passes in the protocol decision, install and release in the
  copies decision, the bound on the one-kit rule, homes for QT45 to QT48, "Three readings of your words follow",
  and the sentence that a seventh decision is proposed (R7, in `front.json` `intros.design[1]`).
- `front.json`: nine questions, five readings, thirteen calls in `now`; "no show machine" in the three places; the
  entry "The engine" in `words`; the sentence on the tag “Today” in `intros.requirements`.
- `decisions.json`: the reading path and its counts, the seventeen number lines and the line on size, the anchors
  `q-a` to `q-i`, the group title "Standalone games", the four readings the requirements name, the sentence on
  the night's record under release day, and "Three readings follow" under “No technical failure stops a game”.
- `DECISIONS.md`: every item the Decisions log listed, and the record writer's own checks.
- `panel/2026-11-01-panel-brief.md`: the removed hardware question and the removed reading are gone; the six asks
  and the lens sentences are in; the step before the agenda; the roles in the setting; the field “today” left out
  of the blind folder.
- `report/2026-10-31-standalone-lines.json`: no marker to the deleted call.

## Judgement calls

1. **The hardware scanner's video-token line.** The Decisions writer wrote "says to rescan later, which can never
   work". The requirements writer's correction dropped that clause. The scanner has no standalone mode today, and
   in a networked game a rescan can work, so "never" was too wide. I kept the reason and bounded it: "which
   cannot help in a game with no show machine". Checked: `arduino-cyd-player-scanner/ALNScanner_v5/Application.h`
   (the "VIDEO UNAVAILABLE", "Rescan later" branch), `aln-memory-scanner/js/tokenDisplay.js` (the status line
   with the token's id when a token has no picture and no sound), and `ALN-TokenData/tokens.json` (both video
   tokens have no picture and no sound of their own).
2. **Question B's sentence on the clock was left as the Decisions writer wrote it.** The requirements writer
   proposed another wording for the same fact. Both say the display keeps counting and that nothing on a tablet
   moves the phases. The Decisions writer's text also says a cut-off tablet cannot pause or end the game. I
   checked it: the tablet's clock counts by itself each second (`ALNScanner/src/ui/renderers/SessionRenderer.js`,
   `renderGameClock`), a disconnect pauses only the session and video modules
   (`ALNScanner/src/app/adminController.js`, `pause`), and a standalone tablet shows "Started" and "Duration"
   with no clock and no phases (`ALNScanner/src/ui/renderers/GameAdminRenderer.js`).
3. **The orders of size in the requirements say "the agent running the pass".** The requirements are shared texts
   the panel reads, and that is how the file already names the agent where it proposes a value.
4. **R9 was applied to one older text** (the change log's entry for version 1). See the table above.

## The three checks the merged report asks for before publishing

1. What a cut-off tablet can do with the game's clock: checked again in the code. See judgement call 2.
2. Each row of the standalone table: the two writers' row checks agree with the code. The two rows that differed
   between them are now the same on Decisions and in QT37. See judgement call 1 and the table above.
3. Every place that names the two removed questions: a search of every source and every built page for both
   removed question titles, the deleted call, its marker, and the removed reading's words finds them only in the
   change log (as history), in the record (in dated history lines and the table of older numbers) and in the
   builder's own list of removed titles. The builder's check 14 covers the pages on every build.

## Counts (R4)

All from the data and the built pages.

| What | Count | Where it was checked |
|---|---|---|
| Questions | 9, lettered A to I, anchors `q-a` to `q-i` | `decisions.json`; the navigation on every page; "On this page"; the front page; the record |
| Readings to confirm | 5 | `decisions.json`; "On this page"; the answer sheet; the front page; the record |
| The agent's calls | 13, the titles of R3 exactly, each with its `call-` anchor on the page | `decisions.json`; `decisions.html`; the front page; the record |
| Quality targets | 47 (23 settled, 18 partly settled, 6 proposed; 17 with a number); QT45 to QT48 proposed | the targets file; Decisions; Requirements; the record |
| Extension cases | 28 | the cases file; Requirements |
| Later choices | 15, identical on Decisions and Design | both overlays |
| Notes under “Today” | 20 (13 targets, 7 cases) | both requirements files; Requirements |
| Answer sheet | 15 lines: nine questions, the readings, the requirements, the brief, three facts | `decisions.json` |
| Version 10's letters | 10 rows | `changes.json` |

A search of the five live pages and the record for every written count of questions, readings, calls, targets and
cases found none that disagrees. The old counts (ten, three, fourteen, forty-three, eighteen) appear only as
history: in the change log, in the record's dated lines, and in the sentence on Decisions that names version 10.

## The Decisions page at 400 pixels, light and dark

From the smoke test's full-page screenshots and element screenshots of the box on what the panel waits for,
question B, the answer sheet, the readings and the calls:

- Nothing overflows. The page is 400 wide in a 400 viewport, and no element in the main column passes either
  edge outside a scrolling wrapper.
- "When to answer", "What it means", "What it costs", "Why" and "Where the reading comes from" each sit on their
  text's line. "What it decides", "What it means in practice", "The options" and the recommendation's tag are
  block labels above their text by design, as in version 10.
- The box, the answer sheet, the reading cards and the call cards read cleanly in both themes.

The element screenshots are in
`/tmp/claude-0/-home-user/5a982c73-3a26-5297-92bd-9dd1027a1b1a/scratchpad/v11el`. The smoke test's 24 are in
`/tmp/claude-0/-home-user/5a982c73-3a26-5297-92bd-9dd1027a1b1a/scratchpad/site-shots-v11`.

## The pages as text

Written by `html2text.py` to `/tmp/claude-0/-home-user/5a982c73-3a26-5297-92bd-9dd1027a1b1a/scratchpad/v11text`:
`index.md`, `decisions.md`, `requirements.md`, `design.md`, `today.md`, `changes.md`. They match the final build.

## Left for the agent running the pass

Items the writers addressed to the lead, or that no ruling covers. None stops the build.

1. **The change promise still names replugging.** In `report/2026-10-31-engine-jobs.json`, the promise “A change
   is proven before it reaches anyone, and the owner alone sends it to the show” ends its `need` with "the owner
   can swap back by replugging a machine", and its `goal` ends "and can replug the old one". The merged report
   ((c), item 4) says no requirement names a way to do later releases, and names only QT42 and EX17. Two writers
   left the promise to you. If it should match: "and the owner can take a version back" in both places. The
   markdown twin words this promise differently and does not name replugging.
2. **The earlier candidate's data still says "no engine"** (`report/2026-11-01-engine-shape.json`, eight lines,
   among them 54, 129, 149, 151 and 485), shown folded on Design. One is a part's name, "Who decides when there
   is no engine". The panel does not get this file. The requirements writer left it for you.
3. **The readings' lead says one reading is inside a requirement.** Three more are named in a requirement's
   status as "to confirm" (QT37 and EX12, and QT38). The lead's sentence is the merged report's text. If the two
   should say the same, the builder's writer offers: "Three more are named in a requirement's status, each as a
   reading for you to confirm."
4. **The script that builds the panel's folder is not written.** It must leave out every `today` key in the blind
   round and give them back in the second, write each open question as its “What it decides” paragraph only, put
   the settled roles under the setting, place a confirmed reading with the owner's decisions and take a refused
   one out, and turn each marker in a requirement's text into its title. The brief now says all of this.
5. **If the owner says yes to the seventh decision**, the full draft entry and the list of what changes with it
   are in `apply-log-v11-design.md`, under "R7".
6. **The requirements writer left three wordings alone and listed them**: QT39's "a parity gap to close", EX25's
   `case` and `throughWhat` (the shorter way that comes later), and the "Today ..." sentences inside the promise
   data's needs and tests, which R6 does not name.
7. **Names that are not model names stay**: the site's own address in `DECISIONS.md`, the branch name and the
   guide file names in the markdown twin and the standalone lines, and the page shell's viewport setting, which
   the build requires.
8. **Not done here**: publishing; the state page `docs/plans/CURRENT-STATE.md`; a commit. The record says the page
   was reworked as version 11 and does not say it is published.
9. **For the message to the owner**: the merged report's part 3 stands, with one correction from the code. The kit
   is not without any backup today: the guide asks for a copy by hand after every event, and nothing checks it or
   brings it back. The change log's entry for version 11 says it that way.

## Commands

From `docs/plans/architecture-pass/report`:

- `MERMAID_JS=<scratchpad>/mermaid-pkg/node_modules/mermaid/dist/mermaid.min.js python3 -I build_site.py`
- `node site_smoke.js site <scratchpad>/site-shots-v11`
- From `report/site`: `python3 -I <scratchpad>/html2text.py <scratchpad>/v11text index.html decisions.html
  requirements.html design.html today.html changes.html`
