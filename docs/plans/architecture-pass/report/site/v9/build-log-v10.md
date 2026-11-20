# Build log, version 10 (2026-11-02)

Written by the build step of the version 10 workflow, for the agent running the pass. It covers the promise data (rows 49 to 62 of `rework/impact.md`), the builder `report/build_site.py`, the smoke test `report/site_smoke.js`, the front-page cuts in `site/v9/front.json`, and the build and smoke results. Nothing was committed. `DECISIONS.md` was not edited; what it may need is at the end.

## Result

- Build: `cd docs/plans/architecture-pass/report && MERMAID_JS=... python3 -I build_site.py` passes its checks: 1,603 links resolve, 41 diagrams drawn. The only output besides the page table is the existing warning that the front page is over 2,500 words (it is 2,619, under the 2,625 limit).
- Smoke: `node site_smoke.js site <scratchpad>/site-shots-v10` passes 24 loads (six pages, 1100 and 400 pixels, light and dark), and follows 116 section anchors (see "The smoke test" below).
- The front page, without the moments and the words, counted in sentences: 2,619 words (version 9: 2,619; before the cuts the reworked sources gave 3,460).

## The promise data: rows 49 to 62

Both JSON files round-trip with `json.dumps(indent=2, ensure_ascii=False)`, so they were loaded, changed field by field and written back in the same layout; `git diff` shows only the changed strings. Each row's "Says now" was checked against the file before the change.

| Row | File and field | Done |
|---|---|---|
| 49 | engine-jobs.json `purpose[5]` | Applied as written. |
| 50 | `purpose[6]` | Applied as written. |
| 51 | J8 `meaning` | Applied as written ("installer" becomes "venue technician"). |
| 52 | J8 `roles[1]`, `roles[3]` | Applied as written. "as the game's shape allows" keeps the reading (no GM tablet at all) conditional, as the row's note asks. |
| 53 | J8 `goal`, last two sentences | Applied as written. The file's middle sentences ("A check at start ...", "Phones and hardware scanners stay equal.") match the row and stay. |
| 54 | J8 `needs[2]` | Adapted: the row's straight quotes around the owner's words "player scanners (phone or hardware)" are typographic quotes (“ ”), as the site's other quotations of the owner are. |
| 55 | J8 `functional.people`, `functional.need` | Applied as written. |
| 56 | J2 `standalone` | Applied. The file's text had no closing period after the marker; the new text ends with one. No `[[q:]]` marker is left. |
| 57 | J4 `goal`, `functional.need` | Applied as written. |
| 58 | J1 `needs[5]` | Applied as written. |
| 59 | J10 `goal` | Applied as written, after "every change runs on two packs." |
| 60 | J3 `functional.need` | Applied as written ("held for later" becomes "kept for later"; the new clause added). |
| 61 | standalone-lines.json `lines.C1` | Applied as written; the marker and its quotes are gone. |
| 62 | `lines.C4` | Applied as written. |

All fourteen rows are applied; one (54) adapted in punctuation only. The shared texts say "the owner", never "you", and carry no question letter.

The markdown twin `../2026-10-31-engine-jobs.md` states only some of these facts, in its older wording ("job", "installer"; its own vocabulary note says the record keeps its words). The same facts were applied there in its words, and a dated note under the vocabulary note says so:

- Row 49: section 1, the business paragraph. Row 50: section 1, the standing rules. Row 51: J8 "What it means for any game" (its "installer" kept, by the record's own note). Rows 52 and 55: J8 "Who relies on it" (the md has one line for both). Row 53: J8's long-term goal. Row 54: J8's hardware-scanner parity need. Row 56: J2 "In a standalone game". Row 57: J4's long-term goal (the md has no need sentence). Row 58: J1's hardware-scanner parity need. Row 59: J10's long-term goal, after "Every slice passes the two-pack run."
- Not stated in the md, so not applied there: row 55's need sentence, row 57's need sentence, row 60 (the md has no "What they count on" sentences), rows 61 and 62 (other file).

## The builder (`build_site.py`)

**The Decisions page** renders decisions.json's new shape in this order: heading and intro; a short "On this page" list (new; links to "Open now" with each group, the three new sections, the design rounds and "Decided, by topic"); "Open now" with each group's title (`h3`, anchor `g-<slug>` as before), its intro paragraphs and its questions; then three new sections; then the design rounds and later choices; then "Decided, by topic", as before.

- A question (`question_html`): status tag, "A." and the title (now an `h4` under the group's `h3`), "What it decides", "What we know" (the evidence list), "The options" and the recommendation. Each option shows its label in bold, then "What it means" and "What it costs", each with its own tag inline at the start of its paragraph. The recommendation shows its `recKind` as its tag: "Recommendation" as before (accent tag above a rule), "What we need from you" in a tinted box with a warm border on all sides and a thicker one on the left, warm tag and medium-weight text, so it reads at a glance as a call only the owner can make.
- Readings of your words, to confirm (anchor `readings`): lead-in "Each of these is the agent's reading of your words, not something you said. Nothing is built on a reading until you confirm it." Each reading's text, then "Where the reading comes from" and its source, in a dashed box.
- The agent's calls, for you to overrule (anchor `calls`): lead-in "These choices are not yours to make, so the agent running the pass made them. Each stands unless you overrule it by its title in the chat." Each call's title is an `h3` with the anchor `call-<slug of the title>` (the `[[dec:]]` slug rule), then the call, then its reason under a "Why" tag.
- The requirements, for your review (anchor `review`): lead-in "The requirements the panel and the design rounds design against, each to read on Requirements. Flag in the chat anything wrong or missing." Each item's title, what to review, "Read them on" its link, and for the quality targets the fifteen numbers under "How each number is sorted". Each item has the anchor `review-<slug>`.
- The navigation count stays the number of questions (ten).

**The `[[call:slug]]` marker**: `CALLS` (filled in `load()` from decisions.json, failing on two calls with one slug) and `call_a()`; it renders the call's title (or the marker's label) as a link to `decisions.html#call-<slug>`, and an unknown slug stops the build.

**The builder's own texts that named version 9's letters**:

- The set-aside row "A question for you" is now "Settled by the agent's call": "A rejected or duplicate GM scan is recorded nowhere today. The agent's call “[[call:every-refused-gm-scan-attempt-is-recorded]]” settles it: the engine records every attempt and its answer. You can overrule the call."
- Each quality target's number: the tag "The number" with its sort beside it (`numberKind`: engine "An engine requirement or limit"; production "A production's setting"; default "A technical default"; mixed "Mixed: the text gives each part's sort"), then the `numberToSet` text, then the small line `NUMBER_WHERE`: "Every number is sorted as an engine requirement or limit, a production's setting or a technical default; Decisions lists them in one place, under the review." (linking `decisions.html#review`).
- The qualities lead-in: "43 quality targets under 12 qualities. Fifteen need a number." then the same `NUMBER_WHERE` sentence. `NUM_WORD` now runs to twenty so the count is a word.
- The today page's note on the proposed seventeenth flaw: tag "Settled by the agent's call", text `N1_CALL`: "It stays a design flaw of its own rather than joining three others, by the agent's call “[[call:the-missing-standalone-declaration-is-a-design-flaw-of-its-own]]”, which you can overrule. Its problems come from the review of standalone games."
- No builder text says a number is the owner's to set; a new check enforces it on every page but the change log.

**Extension cases**: each case shows "Kind" after "Who": "inside the game" as "A mechanic made inside the game", "for all games" as "An extension for all games", "neither: ..." as "Neither kind: " and the rest. A missing or unknown kind stops the build, as does a `numberToSet` with no `numberKind` (or a `numberKind` with no number).

**growth_groups**: a case linked more than once in one group's line counts once, at its last place (the designers' line named EX25 before its list and again at its end; it now sits last, in list order); a case in two different groups still stops the build.

**The change log**: a new section "Where version 9's eighteen questions went" (anchor `letters`), where the change log's intro places it: the first of the four tables at the end, before "The words replaced in version 9". One sentence in the builder's words says the letters are version 9's, not the letters of today's questions. Each row is version 9's letter and title as plain text, never a link; the build stops unless there are eighteen rows, each "X. title" for a letter A to R. The recommendations table takes a plain title in `recommendations[].question` (today's data) or a question marker (still accepted by the renderer; the source check below refuses that marker outside decisions.json, so in practice every entry is a plain title).

**Footers**: the Decisions footer names the owner's comments of 2026-11-02 and the agent's sorting of version 9's questions; the change log footer names the sorting as the source of the letters table.

**Code names**: the builder's own texts no longer say "blue" or "green": the J8 "built today" line ("the method for a new show machine: it is built beside the one in use now and swapped in by replugging"), the cards' chips ("A fix to today's engine points here", "Three fixes to today's engine point here"), the set-aside row ("three small fixes for the new show machine") and the evidence intro ("the records of the show machine in use now"). The data still uses them; see "What the record and the data need" below.

**BARE_NUMBERS**: no longer matches a decision title ending in "decisions" followed by its date (the new decided entry "The Decisions page holds only your decisions", 2026-11-02, read as "decisions 2026"). The pattern now refuses a match followed by `-dd-dd`.

**Docstring and comments**: the docstring says version 10 and what it adds, names this log, and calls site/v9 the overlays' folder ("the folder keeps its name from version 9"). Comments on history (version 8, "The words replaced in version 9") are unchanged.

**CSS**: `.q h4` (was `.q h3`), the options' parts, `.rec-advice` and `.rec-need`, `.onpage`, `.qintro`, `.readings`, `.calls`, `.call`, `.reviews`, `.review-item`, `.numbers`; `.qgroup` gets a top rule and a 21px heading (it was a small muted label); `.req .numset` becomes a small grid with `.nkind` and `.small`. Every colour is a token (the build's stylesheet check passes).

### The checks added (`check_v10`, plus the anchor list)

- No question marker in any source but decisions.json (front, design, changes, rules, the promise data, the standalone lines, the cards, the earlier candidate, both requirements files), and none in the builder's source or in any of its module-level text constants.
- Every marker in every source and in the builder's constants resolves, whether or not a page renders that string: `call`, `dec`, `qt`, `ex`, `promise`, `part`, `flaw` by key, `q` by letter (in decisions.json), `page` by page and, with `#anchor`, by an id on the built page. An unknown marker kind fails.
- Each group has an intro; each question's `recKind` is "Recommendation" or "What we need from you"; each question has options and each option a label, a means and a cost; each reading a source; the call anchors are unique.
- The Decisions page shows every field: the build counts the questions, "What it decides", "What we know", option labels, "What it means", "What it costs", recommendations (and the "What we need from you" ones), group intros, readings, calls, call reasons, review items and review numbers drawn, against decisions.json.
- The Decisions sections come in the order open, readings, calls, review, design rounds, decided.
- `numberToSet` and `numberKind` agree on every target; every case has a known kind; Requirements draws a sort for every number and a kind for every case.
- No page but the change log says a number is "for you to set" or a "number to set".
- The change log's letters table links no letter to a question on Decisions, and shows every row.
- The plan's anchors now also require `open`, `readings`, `calls`, `review`, every `g-<group>` and every `call-<slug>` on Decisions, and `letters`, `jargon`, `numbers`, `sequence` on the change log.
- Every existing check is kept.

Each new check was tried against injected faults (a question marker in design.json and in the promise data, an unknown call rendered and unrendered, a missing `numberKind`, an unknown kind, a wrong `recKind`, an option with no cost, a reading with no source, a doubled call, a page anchor that does not exist); each stopped the build with its message.

## The smoke test (`site_smoke.js`)

- Header comment says version 10 and lists the two new failures.
- `SECTIONS`: Decisions `open`, `readings`, `calls`, `review`, `design-rounds`, `decided` and every `call-*`; Requirements `promises`, `qualities`, `growth`, `rules`; the change log `versions`, `letters`, `jargon`, `numbers`, `sequence`. On every load of those pages each anchor must exist, carry (or be) a visible heading, and come into the top half of the window when its anchor is followed (in-page `location.hash`, no extra page load). The page is scrolled back to the top before its screenshot.
- A new failure: an inline tag that opens a paragraph (`p > span.tag:first-child`) left alone on its line, with the text after it starting below. Tested on a constructed page (a tag followed by a line break is caught; a tag with its text on the same line is not).
- Still 24 loads and 24 screenshots; the summary line also reports the anchors followed (116).

## Looking at the Decisions page

At 400 pixels in light and dark (the smoke test's full-page screenshots, and element shots of the header, question A, question B's options and recommendation, the readings, the calls and the review): no overflow, every section heading visible, each inline tag on the line of its text, the "What we need from you" box distinct from a "Recommendation" in both themes. One change made with the new layout, before this look: version 9 styled the group title as a small muted label (17px, grey), close to a tag, which would leave each group with no clear heading above its long intro; it is now a 21px heading over a rule, and the question titles are one level below it. Nothing needed fixing after the look.

## The front page cuts (`site/v9/front.json`)

The reworked sources gave 3,460 words against the limit of 2,625, so front.json was cut by about 840 words, repetition first. front.json does not round-trip, so each change replaced one JSON string in place (the file's layout is kept). The promise data's purpose paragraphs (371 words, with rows 49 and 50 adding about 80) were not cut: they are shared texts.

Repetition removed (the fact stays on the front page, in the place named):

- `lead`: the list of what the site holds (it is "The pages"), and "on the hardware a production brings, within the bounds the roadmap sets" and "says which requirements are fixed and what each production ... sets" (the purpose paragraph from row 49, and "Decided lately").
- `timeline.done[5]`: the five decisions and the reworked page, listed again in "Decided lately"; the item now points there.
- `timeline.done[3]`: "they are now test situations for every design" (the Today line of "The pages" and the timeline's design rounds).
- `timeline.done[4]`: "the decision record was rewritten by topic" (the decided entry "Titles, not numbers, and a topic record"); "Versions 8 and 9 of your site were published" (version 9 was missing).
- `timeline.now[1]` and `now[3]`: "three independent architects propose the top-level design blind" and "starts with a thin first version" (the decided entries on the panel and on designing top-down).
- `timeline.next[0]`: "where the test rig is built again" (decided "Build the test rig when building starts") and "proving that every screen tells the truth" (`done[2]`).
- `timeline.done[0]`: the pointer to "The words" (the section sits on the same page).
- `now`: the six conflicts' titles (on Decisions, and named by group here) and where the panel's brief is (the Design line of "The pages", and the timeline). "each number sorted as the engine's or a production's" became "each number now sorted" (the three sorts are on Requirements and Decisions; two were named, three exist).
- `worldKey`: "a swapped program changes only the engine's support for it and the venue profile" (the "Easy to extend" line), "you or a future one" and "on the team or from outside" (the growth groups' headings and lines), "within the bounds the roadmap sets" and "the first production's" (purpose and "Decided lately").
- `qualities` "Easy to extend": the two examples (the growth groups, with the owner's two cases), "flexible about hardware within the bounds the roadmap sets" (purpose, "Decided lately"), "its operator finds what is fixed and what they may set" (the operators' growth line), "in your tentative words" (the decided entry "Two kinds of game extension" says the wording is tentative; the line keeps "should probably").
- `qualities` "Standalone and offline": the purpose of standalone games (the decided entry).
- `growth` "Designers": the first link to the owner's example (it is "the last below"), "in your tentative words" (as above), and the parenthesis on where the standalone declaration lives (in the case itself and in the later choices on Decisions and Design).
- `growth` "Developers": the glosses after the two linked cases (their titles say them).
- `growth` "Venue technicians": "equipment left at home reads as not installed tonight" (the "Every screen telling the truth" line: grey means not installed tonight).
- `decidedLately` on the panel and on the independent panel: "its brief comes to you first" and "It runs after you review the requirements" (the timeline's panel item); "Build the test rig when building starts" and "The engine says what is fixed ..." keep only what their titles do not already say.
- `siteGuide` "Decisions": now names the readings to confirm (new), "everything decided, by topic" kept.

Wording tightened, the facts kept: every other quality line, the timeline's done, next and now items, the decided entries on standalone games, the two kinds of extension, the hardware, the Decisions page, the order of the work, titles and names, and the protocol, and the other `siteGuide` and growth lines.

Detail that left the front page and lives only on Requirements (the target it summarises): in "Staying up", "every tablet back by itself" became "tablets return under their own names"; in "Every screen telling the truth", "red appears only when something that should work does not" became "red means act now"; in "Privacy and access", "only staff who log in can start, pause, end or reset a game" became "only staff who log in control a game"; in "Testable", "video, sound, lights and speakers" became "the room's equipment"; in "Running well", "the kit's capacity for phones is measured before the first phone is admitted" became "phone capacity is measured first"; in the designer's speed, "within a set number of minutes" became "within minutes" and "wherever it runs" left. In "Privacy and access" the data's keeping time now says "as long as the production sets" (it said "as long as you set"; the quality target's number is now a production's setting).

Code names: the timeline's "green, the second show machine", "swapping green in" and "runs on blue" became "the new show machine" and "the machine in use now". The front page's moments, its words section (which defines "Blue, green") and its standalone line were not touched (outside the word count, or not in this step's scope).

All before and after strings are in the scratchpad (`v10/front-cuts-1.json` to `front-cuts-8.json`, one per pass).

## What the record and the data need (for the agent running the pass)

- `DECISIONS.md`, the decided entry on the owner's site ("The owner's site: five linked pages") says version 9 was published 2026-11-02; when version 10 is published, the record may add that version 10 reworked the Decisions page. "Still open" already matches version 10's page (ten questions, three readings, fourteen calls, the review, fifteen later choices).
- Code names in the data, outside this step: "blue" or "green" appear in front.json (12, mostly the moments and the words section, which defines the pair), decisions.json (13, in decided entries and an evidence line), design.json (4), the cards (17), the promise data (8), the earlier candidate (4), the standalone lines (1) and the quality targets (4). The rule asks for "the show machine in use now" and "the new show machine"; a pass over the data is needed, with the words section's definition retired last.
- The change log's letters table names the agent's calls in plain quoted titles; it could link them with `[[call:]]` if the change log should lead to the calls.
- The front page sits at 2,619 of 2,625 words; any sentence added to front.json or to the promise data's purpose needs a cut beside it.
- `2026-10-31-engine-jobs.json` J8 `roles[0]` still says "the venue installer" (a retired word); the site does not show the roles, so the build does not catch it.
