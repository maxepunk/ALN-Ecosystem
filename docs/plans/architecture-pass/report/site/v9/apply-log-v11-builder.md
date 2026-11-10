# Version 11, the builder and the smoke test: what was applied

Written 2026-11-10. Files changed: `report/build_site.py` and `report/site_smoke.js`. No other file was touched.
The real site was not built. `report/site/*.html` are still version 10's pages, and the integration step builds
them.

## What this run did

A first attempt was stopped by a container restart and `build_site.py` was restored to its committed version. Its
partial diff survived in the scratchpad (`v11restart/build_site.partial.diff`). I read it, applied it to the
restored file, and went on from there. Everything below is in the file as it stands now.

The builder renders every new field of the contract, derives the counts from the data, and carries the new checks.
On a scratch copy of the report folder with the real data, the build passes every check, and the smoke test passes
with 24 loads. One step of the integration is needed before the real build passes: see "For other files", item 1.

## Renderings

| Contract | Where in `build_site.py` | What the page shows |
|---|---|---|
| `neededBy` on each question | `question_html`, `needed_kind`, `NEEDED_TAG`, `NEEDED_MARKS` | A line under the question's title with the tag "When to answer". The line must start with one of the three marks the introduction names ("Needed before the panel", "Best answered now", "Can wait for the panel"). The first is drawn in bold with a warm tag. |
| `waitsFor` | `waits_html`, called in `page_decisions` before the section "Open now" | A box with the anchor `waits-for`, its title as the heading and its paragraphs through `rich()`. It is the first line of "On this page". |
| `answerSheet` | `answer_lines`, `answers_html`, `ANSWERS_TITLE` | The last block of "Open now", headed "Your answers, in one place", anchor `answers`, listed under "On this page" after "Open now". Each line is its label in bold, then its form. A question's line links to the question by its title, and the letter stays outside the link. |
| A group with no question | `page_decisions` (no change needed to draw it) | The group's title and introduction render, the anchor `g-hardware` exists, and "On this page" links to it. No check expects a question in each group. |
| `today` on a target or a case | `today_html`, `TODAY_TAG`, called last in `qt_html` and `ex_html` | A paragraph after "Why it matters" or "Why", under the tag "Today", set off by a dashed rule and muted. 20 items carry one today. |
| `lettersV10` | `page_changes`, `letters_v10_problems`, `LETTERS_V10_TITLE`, `LETTERS_V10_INTRO`, `V10_QUESTIONS` | A section "Where version 10's ten questions went", anchor `letters-v10`, before the version 9 table. Both columns are plain text through `html.escape`, with no link. |
| The version 11 entry in `versions` | No change | The existing loop draws it. |

New style rules, in `SITE_CSS`, all from existing tokens: `.q .needed`, `.waits`, `ul.answer-sheet`,
`.req .today-note`.

## The builder's own texts

- `READINGS_LEAD`, as the merged report's (b) gives it. The target is named by its marker, so its title follows
  the data: "Each of these is the agent's reading of your words or of how ALN runs today, not something you said.
  Answer each with yes or no. A yes makes it your decision, and it goes to the panel in your words. A no takes it
  out of the requirements and the panel's brief before the panel runs. One you leave unanswered goes to the panel
  as an open question. One reading is already inside a requirement: that a device going down includes the show
  machine is in the target “[[qt:QT44]]”, and it goes to the panel marked as the agent's reading until you
  answer."
- `CALLS_LEAD`, with the addition from (b): "... You do not need to answer these. If you say nothing, each stands."
- `REVIEW_LEAD`, with the addition from (e) item 5: "... When you have read them, say “reviewed” in the chat. The
  panel does not run before that. If you flag nothing, the requirements go to the panel as they stand, each with
  its status. Your OK of 2026-11-01 said the panel runs after you confirm the requirements. The agent reads that as
  after you review them."
- `STATUS_LINE` ends "Updated 2026-11-10." The date is `STATUS_DATE`, and the build checks it against the newest
  version in `changes.json`.
- `STANDALONE_P1`. "with no engine" reads "with no show machine". The sentence on the question now reads: "Whether
  one such game may use more than one GM tablet, whether its devices must play one shared game, and whether its
  record must hold what the players found are your question “[[page:decisions#q-h|Which standalone games the engine
  must run]]”. That player scanners alone may play one is among the [[page:decisions#readings|readings for you to
  confirm]]."
- `STANDALONE_P2`. "the missing engine" reads "the missing show machine".
- The comparison table on Today's engine. The head "Hardware scanner, no engine" reads "Hardware scanner, no show
  machine", and the fold's summary says "with no show machine". The video-token cell (`PARITY_WORDS['13'][3]`) no
  longer names the deleted call: "Neither is right. The agent proposes the same for both: the token's picture with
  a plain note, never an error. It is one of three proposals in the introduction to “Standalone games” on
  Decisions, for you to flag", with "Standalone games" linked to `decisions#g-standalone-games`. That cell is the
  one cell of the table drawn through `rich()`.
- `SET_ASIDE` and `N1_CALL` name two calls that stay ("Every refused GM scan attempt is recorded", "The missing
  standalone declaration is a design flaw of its own"). No change.
- `LETTERS_V10_INTRO`: "Version 10 put ten questions to you, by letter. Version 11 follows the independent review
  you asked for. It rewords the questions, and some carry new letters. This table says where each of the ten went.
  The letters in its first column are version 10's, not the letters of the questions on Decisions now."
- `FOOTERS`. Decisions, Requirements, Design and Change log each gain a clause that names the independent review
  the owner asked for and the date 2026-11-10. No model or vendor is named (R9).
- The module's description says version 11 and no longer says "ten questions in four groups".

## Counts, all from the data

- The navigation's count of open questions: from `decisions.json` (unchanged code, now also checked on every page).
- "On this page": "Open now, nine questions", "Readings ..., five", "The agent's calls ..., thirteen", each
  through `num_word()`.
- Requirements: "Ten promises", "Forty-seven quality targets under twelve qualities", "Seventeen need a number",
  "Twenty-eight extension cases", each counted.
- Decisions: the number of later choices with a row in the alternatives table comes from `LATER_ALT`, in the text
  and in its check.
- Today's engine: "Sixteen situations" in the heading and in the evidence line comes from the cards.
- Left as fixed words: "the seventeenth" (the flaw with no card) and "seventeen parts" (the earlier candidate).
  Neither is one of the counts R4 names.
- `LETTERS_V10_TITLE` says "ten" from `len(V10_QUESTIONS)`, which is version 10's history held in the builder.

## Checks added

Before any page is drawn, `check_sources(D)` runs and lists every problem at once. Until now the first bad marker
stopped the build inside a renderer, with one message.

1. Markers (`marker_fails`, used before and after drawing). Every marker's kind is known and its key resolves. A
   `[[call:]]` marker to one of the seven calls that left the list fails as "points to a call that left the list
   in version 11". A question marker, or a `[[page:decisions#q-x|...]]` link, to a letter no question carries
   fails as "points to a letter no question carries since version 11". A question marker outside `decisions.json`
   still fails.
2. Every `[[page:decisions#q-x|label]]` link's label equals the title of question x. A link with another label,
   or with none, fails and the message gives the title it needs.
3. Each question has `neededBy`, and it starts with one of the three marks.
4. `waitsFor` has a title and at least one paragraph.
5. The answer sheet has a line for every question, labelled "<letter>. <title>", and those lines come first in
   the page's order. Every line has a label and a form. A lettered line that answers no question fails.
6. `lettersV10`: ten rows, the letters A to J in order, each `was` equal to the letter and version 10's title,
   each with a `where`, and no marker in either field.
7. The status line's date equals the newest version's date in `changes.json`.
8. A group's introduction that says "N questions follow" must give the group's own count.
9. No call in `decisions.json` is one the builder holds as removed (`REMOVED_CALL_TITLES`).

After the pages are drawn, `check_v11(pages, D, ids)` runs with the older checks.

10. Decisions: one "When to answer" line for each question, placed between the title and "What it decides"; the
    box, "Open now", the answer sheet and the readings in that order; as many answer-sheet lines drawn as the
    data holds; "On this page" lists the box first and lists the answer sheet; every group shows its title, its
    introduction and exactly its own questions, a group with none included.
11. Requirements: as many "Today" notes drawn as targets and cases carry one.
12. Change log: the table of version 10's letters is there, before version 9's, under the exact heading, with the
    letters A to J and no link.
13. Every link to a question's anchor, on every page, shows that question's exact title.
14. No page but the change log shows, in typographic quotes, the title of a question or a call that left the
    list. This is the builder's part of the third check the merged report asks for before publishing.
15. Every page's navigation counts the open questions the data holds.
16. Counts written in words by the overlays (`COUNT_PHRASES`), on every page but the change log: "N questions only
    you can decide", "N readings of your words with yes or no", "N readings to confirm", "the agent's N calls",
    "N targets under", "N of the M rest on", "N are proposed or partly settled", "N carry a number", "N ways the
    platform must grow". A phrase that is reworded stops being checked. A phrase that stays must carry the count
    in the data.

The plan's anchors in `check()` gain `waits-for`, `answers` and `letters-v10`.

## The smoke test

`SECTIONS` in `site_smoke.js` gains `waits-for` and `answers` for Decisions and `letters-v10` for the change log.
Each must exist, show a heading, and come into view when its anchor is followed, as for the others. The header
comment says version 11. The loads stay at 24 (six pages, two widths, two themes).

## Tests on the scratch copy

The copy is `scratchpad/v11builder/ap`, refreshed from the real data by `scratchpad/v11builder/refresh.sh`. The
script also stands in for one integration step, item 1 under "For other files".

- Real build, with the diagrams drawn (41, Mermaid 11.4.1 from a local file): "checks passed: 1772 links resolve".
  The front page counts 2,609 words in sentences, which draws the warning above 2,500 and stays under the hard
  limit of 2,625.
- Smoke test on that build: "smoke passed: 24 loads, 24 screenshots", 124 section anchors followed, no console
  error, no sideways scroll, no tag alone on its line.
- I looked at the new parts as drawn, at 1,100 and 400 pixels wide, light and dark: "On this page", the box, a
  question's "When to answer" line, the empty hardware group, the answer sheet, a target and a case with a "Today"
  note, the table of version 10's letters, and the line above the design rounds.
- Negative tests (`scratchpad/v11builder/neg.py`): a baseline that must pass, then 28 cases, each changing one
  thing in a fresh copy of the data. All 28 fail the build with the message that names the change. They cover
  checks 1 to 9, 14 and 16, and an empty `today`, which stops in the renderer. One more case empties a second
  group and confirms the build then reports every link that pointed to its question. Checks 10, 12, 13 and 15
  guard the builder's own drawing; they pass on the build and have no negative case.
- The data exactly as it stands, with no stand-in: one failure, from check 14. `design.json` `later[11]` still
  names “Which hardware the first new engine requires, and what it must allow replacing”. Item 1 below removes it.

## Judgement calls

1. A link to a question shows its title everywhere (R1). `q_a()` no longer writes "question B" on Decisions. No
   source uses a question marker today, so nothing on the page changed. A `[[page:decisions#q-x|...]]` link now
   goes through `q_a()` too, so a wrong label cannot render.
2. The answer sheet links only the title, and the letter stands before the link. A link reading "A. A GM tablet
   ..." would not be the exact title.
3. The table of version 10's letters is drawn as plain text, as the contract says. The call titles in its "where"
   column are therefore not links.
4. A "Today" note that opens with the word "Today" is shown without it, because the tag says it. "Today both
   player scanners keep 100 scans ..." reads "Both player scanners keep 100 scans ..." under the tag. The data is
   unchanged. `status_grounds()` already does the same kind of thing for a status line. A note that opens another
   way ("At a show today, ...") is shown as written.
5. The line above the design rounds on Decisions gains: "A seventh, “How the engine drives the room”, is proposed.
   It joins this list only if you say yes under “What the panel gets in its blind round”." The Decisions writer's
   log raised it (its item 11), and R7 puts the same sentence in Design's introduction. The list itself still
   holds six. The sentence drops out by itself once `design.json` `ahead` lists a decision with that title.
6. The check for removed titles looks for the quoted title only. The merged call “Three choices about how the
   promises are worded” starts three sentences with the words of the calls it replaced ("The venue promise stays
   one, titled ..."), unquoted, and those are sentences, not titles.
7. The recommendations on the change log take a plain title only. The branch that accepted a question marker
   there was dead: the source check refuses that marker outside `decisions.json`.

## Not done, with the reason

- The real build and the publish. The task leaves them to the integration step.
- `INDEX_LIMIT` is unchanged. The front page is at 2,609 against the hard limit of 2,625.
- The earlier candidate's data (`2026-11-01-engine-shape.json`) still says "no engine" in six places, shown folded
  on Design. The requirements writer's log lists it for the lead (its item 14). The builder does not rewrite data.
- The page shell keeps its `claude:viewport-fit-sides` meta tag. It is a setting the publishing platform reads, not
  a name in any text the owner reads, and the build checks it is there.

## For other files

1. `report/site/v9/design.json`, `later`, at integration (R8). Make it identical to `decisions.json` `later`,
   keeping each item's `alt` key by position: 1 `alt-delivery`, 2 `alt-lifecycle`, 3 `alt-rules`, 4
   `alt-equipment`, 5 `alt-standalone-tablet`, 7 `alt-scoreboard` (counting from 0), and `""` for the rest. The
   Design writer's log gives the same list. Until this is done the build fails on one check: `design.html` names
   the removed question “Which hardware the first new engine requires, and what it must allow replacing”
   (`later[11]`). The scratch copy's `refresh.sh` holds the exact code for the step.
2. `report/site/v9/changes.json`, `intro[1]`. The new table's anchor exists now. Replace "where version 10's ten
   questions went," with "[[page:changes#letters-v10|Where version 10's ten questions went]],". The other four
   tables in that sentence are already links.
3. `DECISIONS.md`. The record names the change log's new table "Where version 10's ten questions went". The
   builder's heading is exactly that. Nothing to change.
4. `requirements/2026-11-01-quality-targets.json` and `2026-11-01-extension-cases.json`, `today`. Nothing must
   change. 19 of the 20 notes open with the word "Today", which the page drops under the tag (judgement call 4).
   If the lead prefers the notes shown as written, remove one line in `today_html`.
5. `report/site/v9/decisions.json`, the readings, against `READINGS_LEAD`. The lead says "One reading is already
   inside a requirement", the one in the target “The GMs know their fallbacks at a failure”. The requirements
   writer's log says three more readings are named in status lines as "to confirm" (in “A standalone game is
   normal, never a fault”, in the standalone case, and in the target on a game that loses its show machine). The
   lead's sentence is the merged report's text and I kept it. If the lead of the pass wants the two to say the same
   thing, the sentence to add after it is: "Three more are named in a requirement's status, each as a reading for
   you to confirm."
6. `report/site/v9/front.json`, `now`, and `decisions.json`, `review[1].what` and `review[2].what`. These hold the
   phrases check 16 reads ("the nine questions only you can decide", "five readings of your words with yes or
   no", "the agent's thirteen calls", "Forty-seven targets under", "Twenty-three of the forty-seven rest on",
   "Twenty-four are proposed or partly settled", "seventeen carry a number", "Twenty-eight ways the platform must
   grow"). All agree with the data now. If the integration step changes a status or adds a number, the build says
   which phrase to update.
7. The integration step's commands, from `docs/plans/architecture-pass/report`:
   `MERMAID_JS=/path/to/mermaid.min.js python3 -I build_site.py`, then
   `node site_smoke.js site <a folder for screenshots>`. Mermaid 11.4.1 is in the scratchpad at
   `mm/node_modules/mermaid/dist/mermaid.min.js`. The drawing step loads the page font from the network.
8. `report/site/v9/build-log-v10.md` is version 10's. This file is version 11's build log for the builder; the
   module's description points here.
