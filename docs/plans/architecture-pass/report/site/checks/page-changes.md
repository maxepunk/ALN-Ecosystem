# Check: changes.html

Checked 2026-11-01 against the site plan (section 3.6, section 6), every
inventory row homed on this page, version 7 (`2026-10-31-cause-report.html`,
`build_report.py`), the overlay `site/changes.json`, the data files'
`title` and `shapeChange` fields (`2026-10-31-engine-jobs.json`,
`2026-10-31-cause-cards.json`), `CURRENT-STATE.md` section 0 (decisions 20
to 29) and the publishing commits of versions 1 to 7, the git log of
`report/` with the bodies of the commits each version item cites, the
after-game report, the cause analysis (X-08, section 5) and `CONTEXT.md`
sections 5 and 7. The page was read as text with the command in the task;
every link was listed with its words and target.

**18 conflicts. 143 items checked** (125 page elements: header, intro and
status line 3; versions 8 x date, title and prompt plus 32 items; promises
10 earlier titles plus 26 change lines; cards 17 lines; recommendations 9
fields; vocabulary 10 lines; footer 1; the link audit 1; plus 18 inventory
entries: table 1 rows 8, 9, 11, 12, 18, 41, 44, 56, 84, 86, 90, 91; table 3
rows 26 to 29 and 31; note 4). `CJ` is `site/changes.json`; line numbers are
as the files stand now.

## Conflicts

| # | Where on the page | What it says | What it should say | Place to change |
|---|---|---|---|---|
| 1 | The promises' earlier wording, "The designer's game is the game the whole kit plays", first line | "The two-pack proof also keeps A change is proven before it reaches anyone, and the owner alone sends it to the show." A full title dropped mid-sentence, unquoted and capitalised; it reads as a broken sentence | "The same two-pack proof also serves [[promise:J10\|the promise that a change is proven before it reaches anyone]]." | `CJ` `promises[0].changes[0]` (line 108) |
| 2 | Recommendations, Question F, After | "One promise, as the title A change is proven before it reaches anyone, and the owner alone sends it to the show has it, covering both moments, and give the proof and the release a question each in the pass." A title inside "as the title ... has it", and a noun phrase joined to an order | "Keep one promise covering both moments, as its title does, and give the proof and the release a question each in the pass." | `CJ` `recommendations[1].after` (line 298) |
| 3 | Recommendations, Question G, After | "C2's card stays under The room does what the designer cued and the GM asked, where its moment ..."; "under One game, the same on every screen they match how the game's running state is already defined". The second title has a comma of its own and runs into the clause with none | "C2's card stays under [[promise:J4\|the room promise]], where its moment at a show is felt"; "under [[promise:J2\|the one-game promise]], they match how the game's running state is already defined" | `CJ` `recommendations[2].after` (line 304) |
| 4 | Recommendations, Question G, Before and Why | "the record promise" (twice) names "One game, the same on every screen". On this site "the night's record" is the second half of "Every tap gets its answer, and the night can be told afterwards" (decision 28), so a reader can take "the record promise" for that one | "the one-game promise", linked once: [[promise:J2\|the one-game promise]]. "The record job" in the quoted v4 question stays, as history | `CJ` `recommendations[2].before` (line 303), `recommendations[2].why` (line 305) |
| 5 | Recommendations, Question G, Before, last sentence | "...and would have moved C2's card under it; the published version 5 withdrew that." The published version 5 never carried the draft; it was changed before publishing (`467227dd` "change neither sentence", then `20ec5c38` published v5) | "...and would have moved C2's card under it; it was withdrawn before version 5 was published." | `CJ` `recommendations[2].before` (line 303) |
| 6 | Versions, Version 5, What prompted it | "said the venue job and the truth job ( The game fits the venue it is in tonight and Anyone reading a screen can act on it without a second question today) read as mechanics". "today" lands after the second title and reads as part of it; two full titles in brackets are stiff | "said the venue job and the truth job read as mechanics, not what they do for people. They are now [[promise:J8]] and [[promise:J9]]." | `CJ` `versions[3].prompt` (line 57) |
| 7 | Versions, Version 8, items 3 and 4, against the entries below | Item 3 retells decision 28's change to "Every tap gets its answer..." clause by clause, and its built-today clause is word for word the same as that promise's own entry ("its built-today line notes that ALN's article writer reads the GM tablet's report by hand, outside the engine"). Item 4's "The two clocks, finding X-08, joined [C9] under decision 28" repeats the C9 card entry's first sentence | Item 3: "Decision 28 changed the people, need, goal and built-today line of [[promise:J3\|the promise that every tap gets its answer]]; its entry below says how." Item 4: "Finding X-08 joined [[flaw:C9\|C9]] under decision 28; the total is 358 findings, 337 of them under the sixteen flaws and 21 set aside." | `CJ` `versions[0].items[2]` (line 13), `versions[0].items[3]` (line 14) |
| 8 | Versions, Version 8, item 3, and "Every tap gets its answer...", decision 28 line | "ALN's article writer reads the GM tablet's report by hand". A program does not read by hand: the director downloads the report and pastes it into the console, where an AI call parses it (after-game report, "What it takes"). The page-promises check found the same slip in the built-today line itself | "...notes that, outside the engine, the director pastes the GM tablet's report into ALN's article writer by hand." Keep it equal to the built-today line once that line is fixed | `CJ` `versions[0].items[2]` (line 13) and `promises[2].changes[2]` (line 127); source line `build_site.py` `BUILT['J3']` (line 59) |
| 9 | The promises' earlier wording, every entry | "Restated from the side of the people it serves in version 5 and retitled under decision 27 in version 6." appears ten times, eight of them word for word | Say it once, as a lead-in under the heading: "Every promise was restated from the side of the people it serves in version 5 and retitled under decision 27 in version 6." Drop the line from each entry; keep only what differs (venue technicians in "Each person sees their part..."; release day named in the title of "A change is proven..."; the map's reasons for the venue and screen promises) | `build_site.py` `page_changes`, the earlier-wording section (lines 1684 to 1687); `CJ` `promises[0..9]` restated lines (lines 110, 118, 126, 135, 143, 151, 160, 169, 177, 185) |
| 10 | The promises' earlier wording and The cards, every "Now ..." sentence | "Now only the Game record decides claims"; "Now Equipment owns one dated picture..."; "Now the Game record is the one decider...". On this page nothing says that "now" is the candidate shape; read alone, each reads as a decided design. In version 7 these notes sat beside the card's "Candidate, not decided" diagram | One lead-in sentence under each heading: "Each note says what the relationship map changed. 'Now' means the candidate shape, which is not decided." | `build_site.py` `page_changes`, after the h2 of `earlier-wording` (line 1685) and of `card-changes` (line 1690) |
| 11 | Header intro; The words | "...and the words decision 27 replaced." Two of the ten word entries are not decision 27's: "Design flaw, not cause" is version 3 and "green run" version 5 (the writer's log says so), and Moment, Quality and Part are definitions, not replacements | "...and the words the page has changed, most of them by decision 27." | `CJ` `intro[0]` (line 3) |
| 12 | "The game fits the venue it is in tonight", third line; The words, eighth line | "Decision 27 made that seventh title a promise"; "The seventh title becomes a promise". The page never says what "seventh" counts: on Promises this is the eighth entry, and in the map's table it was the first. With numbers gone, an unexplained ordinal reads as a hidden number. The two lines also say the same thing | One place only, in The words: "Decision 27 made the map's restated title a promise: 'Fit the game to the venue it is in tonight' became [[promise:J8]]." The promise entry drops its sentence, keeping "The person in it is the venue technician." | `CJ` `promises[7].changes[2]` (line 169), `vocabulary[7]` (line 316) |
| 13 | Version 6, items 2 to 4, against The words | Version 6 and The words say the same changes twice: shared work folded into the parts (item 2 and words line 9); "part" narrowed to the 17 parts, module, interface and seam defined without it (item 3 and words line 7); the venue technician throughout (item 4 and words line 2); the summary's "mostly a quality" (item 5 and words line 5). Version 3 item 2 and version 5 item 5 repeat words line 10 | Version 6 keeps what happened to the page (retitled, organized by promise, "Mainly keeps" and "Also needed by", the questions in promise words, the checks) and replaces the word changes with one line: "The words changed as listed under The words below." The other versions keep their one-clause mention | `CJ` `versions[2].items[1]`, `[2]`, `[3]` (lines 39 to 41) |
| 14 | Version 6, item 1 | "(version 3 to 5 were "What the Engine Must Do")" | "(versions 3 to 5 were ...)" | `CJ` `versions[2].items[0]` (line 38) |
| 15 | Version 8, item 6 | "so no page depends on the viewer's diagram drawing." Stiff; "diagram drawing" is not a thing the reader knows | "so no page needs a diagram program in the reader's browser." | `CJ` `versions[0].items[5]` (line 16) |
| 16 | "The game fits the venue it is in tonight", first line | "You are asked to confirm this in question E." A request to the reader on a page whose intro says "Nothing here is open for decision". The other entries point to open questions without asking ("stays question D", "question F stays open") | "Question E asks for the owner's confirmation." | `CJ` `promises[7].changes[0]` (line 167) |
| 17 | "The room does what the designer cued and the GM asked", first line | "Now Equipment keeps that dated picture here, beside the Show runner." On the change log "here" reads as "on this page" | "Now Equipment keeps that dated picture under this promise, beside the Show runner." | `CJ` `promises[3].changes[0]` (line 134) |
| 18 | Footer | Names the version history, decisions 20 to 29, the promises document, the notes and the vocabulary. It leaves out three sources the page uses: the cause analysis (X-08 and the 358 count), version 7's questions E, F and G (each After and Why) and the after-game report (the decision 28 lines) | Add: "the cause analysis of 2026-10-30 (finding X-08 and the totals), the questions of version 7 (E, F and G, after the map), and the after-game report of 2026-11-01". The page cites no file, so the documents go by name | `build_site.py` `FOOTERS['changes']` (lines 1004 to 1008) |

Not a separate conflict: the page runs to about 5,500 words of text
against the plan's 3,000 to 4,000 (section 3.6). Conflicts 7, 9, 12 and 13
remove most of the excess without losing a fact.

## What I checked and found right

**Rules.** No promise id anywhere a reader sees; no em or en dash. "Job"
appears only as history (earlier titles, version items, E, F and G before,
the words); "installer" only in the words line that records what decision
27 replaced, which the task allows on this page. The person is the venue
technician everywhere else. The status line says the shape is a candidate.

**Links (68, one audit).** Every link's words match its target: promise
titles to their `promises.html` anchors, flaw titles and the short C2, C8
forms to `flaws.html#cN`, part names to their `parts.html` anchors, question
markers to `decisions.html#q-x`, page names to their pages. No link leaves
the site.

**Versions (8).** Dates match the publishing commits (`8104893b` and
`3b445778` 2026-10-31; `4e777811`, `ab78f1a7`, `20ec5c38`, `bf1f0163`,
`182a9386` 2026-11-01; version 8 this site). Titles match each version's
page ("ALN Cause Analysis", "What the Engine Must Do", "What the Engine
Promises"). Items match their commits: v7's picture and walkthroughs
(`857a6894`), 19 conflicts (`4ac709c6`), 16, 3 and 10 with 41 diagrams
(`9739aafa`); v6's 28 and five leftovers (`6f3b384e`, `7db3f4bd`); v5's 54
links, 182 and 96, 57, then 54, 3 and 10 (CURRENT-STATE "Live state"); v4's
39 as 29 plus 10 and the ten page fixes (`20ac363b`, `1c2e99a9`); v3's
regrouped questions and A, B, C (`17fcce9d`, `jobChanges`); v2's 24 parity
rows and section 7 (`0b24bd9b`); v1's 42 corrections and 357 findings
(`95daa8ed`, `be01564c`). Prompts match CURRENT-STATE: decision 22's
parity reasoning, decision 26's frame quoted, decision 27's reason, the
first consistency run lost (`3fafcd02`), the method-skill question
(`8104893b`), and decision 29 with the owner's words. The 358 total is
337 under the flaws (the cards' `findings` sum) plus 21 set aside.

**Promises (10).** Every earlier wording equals the promise's `title`
field; every heading is the promise's exact `proposedTitle`. Every first
change line equals its `shapeChange`, with the quoted titles and question
letters turned into links. The later lines hold: J1's widening in version
3 and its two clauses in the shape (the Generic quality; the pack
channel's stamp, shape section 5 A to C); the roles widening (question B);
decision 22's words in the venue promise (question C) and the map's
reason (engine as subject, people missing); the screen promise's reason
(the four states are the mechanism); decision 28's people, need and goal
against `engine-jobs.json` J3 before (`9739aafa`) and after.

**Cards (16).** Each first line equals the card's `shapeChange` word for
word, and each heading is the card's `title`. C9's X-08 line matches
cause analysis row X-08 and section 5.5, and the card's 19 findings.

**Recommendations (E, F, G).** Before matches the version 3 questions
(`4e777811`) with version 4's added options (`ab78f1a7`); the venue
technician stands in for v3's "installer", as the rules require. After and
Why match version 7's E, F and G, with the parts named as in shape
section 5 (Venue fit, Verdict, Engine instance; Joins and proofs, Engine
instance, Release; Delivery, Equipment). G's first draft (`0d20835a`) is
real; conflict 5 is only about when it was withdrawn.

**The words (10).** Promise, venue technician, titles not numbers, kept
by and break (version 6) and broken by (version 8), quality, moment, part,
shared work and design flaw match decision 27, `CONTEXT.md` sections 5 and
7, and commits `b0109a9d`, `6f3b384e`, `06f5d73b`.

**Decision 28.** Nothing on the page contradicts it: the director and the
players after the show; how the story reaches them is the game's own
business; the record carries the game it ran and the texts the players
saw; the Director Console stays a separate program that reads it, with
room in the Review stage later; X-08 under C9. Players' emails are not on
this page; the front page and Decisions carry them.

**Inventory.** Table 1 rows 18, 41, 44, 56 and 86 (disposition change
log): version 5's prompt carries the "you asked" framing with both levels;
every promise's "Earlier wording, as a job" and change note; every card's
change note; E, F and G with before, after and why (F's "the earlier
split ... does not match the map" in its Why; E's and G's replaced answers
in their Before). The historical clauses of rows 8, 11 and 12 (the changed
notes) sit in the promises and cards sections; row 9's "job is gone" is
the first words line; row 84's before and after are the recommendations;
row 91's reconcile (182, 96) is in version 5 and "the words are decision
27" in The words. Row 90's 171 and 53 and row 91's four relationship maps
are not on this page; inventory note 4 allows either home, and the footers
of `promises.html` and `parts.html` carry both. Table 3 rows 26 to 29 (the
page, versions newest first, the promises and cards in one place, E, F, G,
the words) are present; row 31's build check lets "job" and "installer"
through only on this page (`build_site.py` lines 1758 to 1761), and the
page passes it.
