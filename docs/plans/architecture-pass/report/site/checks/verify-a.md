# Verify A: the engine, Decisions and the change log after the edits

Checked 2026-11-01. I read the rebuilt `index.html`, `decisions.html` and
`changes.html` as text, with the diagrams' labels kept, and listed every
link with its words and target. I checked each against its page check
(`page-engine.md`, `page-decisions.md`, `page-changes.md`), the apply log,
`git diff 3368565b -- docs/plans/architecture-pass/`, and the sources each
row names: the engine-shape JSON (`questionNotes` F, the seven adapters),
`build_report.py` (version 7's step-3 list and `BUILT['J3']`),
`CURRENT-STATE.md` section 0 (decisions 20, 22, 27, 28, 29),
`docs/agents/process.md` section 4 and `CONTEXT.md` (section 4's dormant
"doors"). I assumed each row was unresolved until the page showed
otherwise.

**65 rows: 63 resolved, 2 partly, 0 unresolved. 5 new conflicts.** The
apply log rejected no row. The rows it applied "in other form" or
"corrected" are judged below on whether their reasons hold.

## Verdicts

### page-engine.md (index.html)

| # | Verdict | What the page shows now |
|---|---|---|
| 1 | resolved | "The night's-record half of the tap promise names the director and the players; ... the two clocks join C9 as finding X-08." Both links are short and read as plain words. |
| 2 | resolved | "...and the owner and the designer read it too. This is the second half of the tap promise: the night can be told afterwards." |
| 3 | resolved | "then A to G, on their wording and whether three of them should split." Each letter links to its question. |
| 4 | resolved | "...for each choice that Decisions lists as coming in step 3." The link lands on `decisions.html#step-3`, which exists. |
| 5 | resolved | The "replaces version 7" line is gone. |
| 6 | resolved | The lead ends at "...what must happen for them." |
| 7 | resolved | The Decisions guide line no longer has the answer-in-the-chat clause. |
| 8 | resolved | "This page: the whole engine in one read, and the way to every other page." |
| 9 | resolved | The guide line opens "Every version, newest first;". Its last clause is new conflict N2. |
| 10 | resolved | "Decision 22 adds a requirement every rule must serve:". This matches section 0 ("join the list every rule must serve"). |
| 11 | resolved | Passage 2 opens "In the candidate, Equipment reports ...". |
| 12 | resolved | Passage 1 ends "Delivery sends every fact that changed to every screen that may see it."; passage 2 ends "it alone moves a game." The key above still has the label and "only between games". |
| 13 | resolved | The key reads "which the Parts page shows" and "The Parts page follows five moments step by step." |
| 14 | resolved | All four "How it connects" lines (video, music, audio and Bluetooth, lighting) open "In the candidate,". |
| 15 | resolved | "Today these are three of the engine's seven adapters". The shape JSON says "seven adapters", and the item names three: PipeWire, the sound player and BlueZ. |
| 16 | resolved | The "players' data stays on the kit" clause is gone. |
| 17 | resolved | "Today it is one of the nine holders ... ( C12 )."; "Today two design flaws touch it: pack edits reach each copy differently, and the engine and the tests both assume they own the machine." |
| 18 | resolved | The diagram's label reads "today: frozen at boot; candidate: adopted, stamped". |
| 19 | resolved | Passage 4 says "for ALN the Director Console reads it from outside (decision 28)". Only the decided line and the Director Console status carry the full point. |
| 20 | resolved | The footer adds "the cause analysis of 2026-10-30 (the design flaws named around the engine)". |
| 21 | partly | The check preferred to leave the page alone and name the status line as the kept copy, because an eyebrow repeats it. The editor added the eyebrow ("Architecture pass · phase 1, step 1 · updated 2026-11-01") and gave as the reason that the plan and inventory may not be edited. That reason only describes the editor's limits. The page now shows the same three facts on two lines in a row, and no other page has an eyebrow. Either the plan (3.1.1) and `inventory.md` row 3 name the status line as the kept copy and `build_site.py` `page_engine` (line 1241) drops the eyebrow, or the owner accepts the repetition. |

### page-decisions.md (decisions.html)

| # | Verdict | What the page shows now |
|---|---|---|
| 1 | resolved | "No flaw mainly breaks the designer's change-a-value promise today; C8 and C12 break it beside others." The editor's short link form is better than the check's own proposal, which still dropped the full title mid-sentence. The reason holds. |
| 2 | resolved | Line 2: "Each entry on the Promises page names the parts that keep it." Line 3: "Whether running in any setup needs an eleventh promise is question E." The recommendation keeps version 7's words. |
| 3 | resolved | "...and nothing tells the GM ( Pack edits reach each copy of the pack differently )." The title sits in brackets at the end of the sentence. The recommendation keeps the link between the second clause and C12. |
| 4 | resolved | 'whether "nothing declares a game standalone" is a design flaw of its own, with its own rule.' The title is said once, quoted and linked. |
| 5 | resolved | "...and it is declared where the game is fitted to tonight's setup, under the venue promise." |
| 6 | resolved | "they join C9, C11 and C14 ... On the map N1 lands on Pack channel and Venue fit, or on Game record ..." This edit leaves the line naming the flaw two ways (new conflict N4). |
| 7 | resolved | Line 1: "The night's record half names the director ... (decision 28, 2026-11-01)." Line 3 no longer says "now", and "This question stays open" is gone. |
| 8 | resolved | "The tap's answer is mainly broken by C7: a reply never says which request it answers, or whether the answer is final or stored. No design flaw mainly breaks the night's record half yet." The reason is left to option 2's cost. The other form (C7's title spelled out in a clause) reads well, so the reason holds. |
| 9 | resolved | Line 3 ends at "...a future operator with a second kit." |
| 10 | resolved | 'This promise is mainly broken by "Nothing declares a game standalone". C15 also breaks it: ...' |
| 11 | resolved | No "This replaces ..." sentence is left in E, F or G. Intro paragraph 2: "the Change log has the earlier recommendation." Each question keeps its one pointer line, as inventory row 86 asks. |
| 12 | resolved | "Four flaws mainly break this promise. The pass's fourth design question covers ... ( C8 ). For the other three none of its nine questions fits: the fifth is only the nearest ..." Each title now appears once, in its short form. |
| 13 | resolved | "Options a, b and c each give C15 a home in a part; C16 lands on Joins and proofs whichever you choose." This matches `questionNotes` F: widening, splitting or filing "all place C15", and leaving the promise as drafted "also fits the parts". |
| 14 | resolved | "...; the recommendation gives each its own question in the pass." |
| 15 | resolved | "This question places C2, where today health and state travel on separate routes, ..." The card clause is now only in the recommendation. The short form is the right choice, so the reason holds. |
| 16 | partly | "What it decides" now joins the two names: "Whether the hardware scanner, the ESP32, gets a standalone mode matching the phone's". Line 4 is now "On the map Pack channel carries the declaration to every device with its pack." The other half of the row is still open. The heading, kept from version 7, says "matching the web scanner's", and nothing on the page says that the web scanner is what runs on the phone. Write "matching the web scanner's on the phone" in `decisions.json` `groups[1].questions[0].decides`. |
| 17 | resolved | Line 2 is gone, and option 2's cost carries it. |
| 18 | resolved | Line 2 ends at "...through Answering."; option No: "Nothing is recorded, as today, and the night's record cannot tell a refused attempt." |
| 19 | resolved | "Where the tap promise lists C9 among its flaws, it leaves this to you: ... not that flaw's."; "...which the change for C7 carries." |
| 20 | resolved | "a black screen with the token's id". |
| 21 | resolved | Every link names its row or section, and each target id exists: `parts.html#alt-answer-and-record`, `#alt-release`, `#alt-delivery`, `#alt-standalone-tablet`, `flaws.html#standalone`, `changes.html#earlier-wording`, `#rec-e`, `#rec-f` and `#rec-g`. |
| 22 | resolved | All eleven items match version 7 word for word (`build_report.py` lines 1119 to 1129), plus the twelfth. The intro says once that the six with a row link to it, and each of the six opening phrases links to its own `alt-*` row. |
| 23 | resolved | "No rule in the pass for the project's written documents (guides, READMEs, contracts, code comments)." This is true to `process.md` section 4's last paragraph, which also lists `CLAUDE.md` files. The list here is examples, so the editor's narrower form holds. |
| 24 | resolved | "(the first one is the promises question). Answer any of them, in any order, and leave the rest for later." |
| 25 | resolved | "Only the Decided list at the end records what you have decided." |
| 26 | resolved | The footer names the program document of 2026-10-30 and the promises document of 2026-10-31. |

### page-changes.md (changes.html)

| # | Verdict | What the page shows now |
|---|---|---|
| 1 | resolved | "The same two-pack proof also serves the promise that a change is proven before it reaches anyone." |
| 2 | resolved | "Keep one promise covering both moments, as its title does, and give ...". |
| 3 | resolved | "C2's card stays under the room promise, where ..."; "under the one-game promise, they match ...". |
| 4 | resolved | Before and Why say "the one-game promise". The quoted "record job" stays, as history. |
| 5 | resolved | "...; it was withdrawn before version 5 was published." |
| 6 | resolved | "...read as mechanics, not what they do for people. They are now "The game fits the venue ..." and "Anyone reading a screen ..."." The titles are quoted and come after "now", so "today" no longer runs into them. |
| 7 | resolved | Item 3: "Decision 28 changed the people, need, goal and built-today line of the promise that every tap gets its answer; its entry below says how." Item 4: "Finding X-08 joined C9 under decision 28; the total is 358 findings, 337 of them under the sixteen flaws and 21 set aside." |
| 8 | resolved | The entry says "the director pastes the GM tablet's report into ALN's article writer by hand". It means the same as `BUILT['J3']`. |
| 9 | resolved | The restated line appears once, under the heading. Only what differs stays in the entries: venue technicians, the venue promise's restated title, the preflight's reader, and release day in the title. |
| 10 | resolved | Both sections open with: 'Each note says what the relationship map changed. "Now" means the candidate shape, which is not decided.' |
| 11 | resolved | "and the words the page has changed, most of them by decision 27." On this page "the page" refers back to "the owner page" earlier in the same sentence. |
| 12 | resolved | The venue entry drops its "seventh title" sentence. The words section says once: 'Decision 27 made the map's restated title a promise: "Fit the game to the venue it is in tonight" became The game fits the venue it is in tonight.' |
| 13 | resolved | Version 6's word changes are now one pointer, and the venue technician item is gone. The new pointer sentence reads badly (new conflict N5). |
| 14 | resolved | "(versions 3 to 5 were ...)". |
| 15 | resolved | "so no page needs a diagram program in the reader's browser." |
| 16 | resolved | "Question E asks for the owner's confirmation." |
| 17 | resolved | "under this promise, beside the Show runner." |
| 18 | resolved | The footer names the cause analysis, version 7's questions (E, F and G) and the after-game report. |

## New conflicts the edits introduced

| # | Where | What it says | What it should say | Place to change |
|---|---|---|---|---|
| N1 | `index.html`, The words, the new "Door" entry (added for page-flaws #11) | "Door: In the candidate, the one way in or out of the engine: every request comes in through Answering, and every fact goes out to the screens through Delivery." The site also uses the word for today's code: on Parts, tangles "Three doors, three reply shapes ..." and "Shallow chains and thick doors", and Answering's Today line "three reply shapes at three doors". The definition says a door exists only in the candidate. Also, `CONTEXT.md` section 4 and the code use "door" for dormant's two entrances (profile, operator), and the entry sits right above "Not installed tonight ... The code calls it dormant". | "Door: a way a request comes into the engine or a fact goes out of it. Today requests come in through three doors, each with its own reply shape; in the candidate there is one door in, Answering, and one door out, Delivery. Not the code's dormant door." | `front.json` `words`, the "Door" entry |
| N2 | `index.html`, How to use these pages, Change log line | "...the recommendations the map changed, and the words the page has changed." On the front page, "the page" reads as this page. The phrase came over from the change log's intro (changes #11), where "the owner page" comes earlier in the sentence. | "...and the words the owner page has changed, most of them by decision 27." | `front.json` `siteGuide[5].line` |
| N3 | `decisions.html`, Decided, decision 28 | 'the second half of "Every tap gets its answer, and the night can be told afterwards" names the director and the players after the show; ...'. Engine #1 fixed the same sentence on the front page ("The night's-record half of the tap promise names ..."). Apply log row 1 says "The same fix made in DJ's decision 28 line", but only "as finding X-08" was added. The two pages now word one decision two ways, and this one keeps the full title mid-sentence. | "The after-game article and emailer: the [[promise:J3\|night's-record half of the tap promise]] names the director and the players after the show; ..." | `decisions.json` `decided`, n 28 |
| N4 | `decisions.html`, question C, What we know, line 5 | "Nothing declares a game standalone holds eight findings from the standalone pass. ... On the map N1 lands on Pack channel ..." Line 4 ends on the same title in brackets. The edit for row 6 replaced "it" with "N1", so this line now opens with the full title as its subject and later names the same flaw by id, with nothing between them that says the two are one. | "[[flaw:N1\|N1]], the proposed flaw, holds eight findings from the standalone pass. If it is not a flaw of its own, they join C9, C11 and C14 ... On the map N1 lands on ..." | `decisions.json` `groups[0].questions[3].evidence[4]` |
| N5 | `changes.html`, Version 6 | "The words box puts the page's own words first; the words changed as listed under The words below." "Words" comes three times in one sentence, and "the words changed as listed" first reads as "the words that changed". | "The words box puts the page's own words first; the other word changes are listed under The words, below." | `changes.json` `versions[2].items`, the words-box item |

## What I found right

- **Rules hold on all three pages.** The visible text has no em or en dash and no J1 to J10. "Job" (52 times) and "installer" (2 times) appear only on `changes.html`, as history or as the words decision 27 replaced. The person is the venue technician everywhere else.
- **Decision 28 holds.** The front page's decided line and passage 4 name the director and the players. They say what players receive is the game's business, the record carries the game it ran and the texts the players saw, emails stay outside, the Director Console is a separate reader with room to move into Review later, and X-08 sits under C9. Decisions question D and the change log's J3 and C9 entries agree. Section 0 says "carries the pack the game ran". The pages say "the game it ran", which means the same.
- **The shape stays a candidate.** The front page's passages and the four "How it connects" lines now open "In the candidate". The change log says "Now means the candidate shape, which is not decided". Decisions keeps "on the map" and "if step 3 keeps one delivery part".
- **Edit history moved off the other pages.** The front page lost its "replaces version 7" line, and Decisions lost its three "This replaces" sentences and "now". Each question keeps one pointer that lands on its own entry (`#rec-e`, `#rec-f`, `#rec-g`, `#earlier-wording`).
- **Links.** Every link on the three pages lands on an id that exists on its target page. Each short form (C3, C8, C9, C12, N1, "the tap promise", "the room promise", "the one-game promise") reads as plain words. The build checks each `page#anchor` marker.
- **Facts traced.** The seven adapters (shape JSON); `questionNotes` F behind "options a, b and c"; version 7's eleven step-3 items word for word; decision 20 against `process.md` section 4; the token's id (standalone pass SP-06); version 5 withdrawn before publishing (`0d20835a`, `467227dd`, `20ec5c38`, per the apply log); 358 = 337 + 21.
- **Not counted, noted.** The change log's J3 entry says the goal records the night "stamped with the game it ran". Parts and the front page now say "carries". The entry describes the J3 goal correctly, since `engine-jobs.json` still says "stamped". The apply log's notes leave that goal for the promises verifier. The prose word counts are still over the plan's targets (front page 4,446; Decisions 4,458; change log 5,315), and the plan treats these as targets, not rules.
