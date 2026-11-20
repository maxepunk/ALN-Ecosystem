# Apply log: the six page checks

Applied 2026-11-01 to the overlays (`site/front.json`, `site/decisions.json`,
`site/changes.json`), the data (`2026-10-31-cause-cards.json`,
`2026-10-31-engine-jobs.json`, `2026-11-01-engine-shape.json`) and
`build_site.py`. Where a data fact changed, the source document was changed
to match (`2026-11-01-engine-shape.md`, three places). No edit to
`build_report.py`, `render_diagrams.js`, `diagram_theme.py` or the plan.

**116 conflicts: 116 applied, 0 rejected.** Eleven were applied with a
correction or a different form than the check proposed; the row says why.
Abbreviations: FJ `site/front.json`, DJ `site/decisions.json`, CJ
`site/changes.json`, CC cause cards, EJ engine jobs, ES engine-shape JSON,
ESmd engine-shape document, BS `build_site.py`, CS `CURRENT-STATE.md` section 0.

## page-engine.md (index.html): 21 applied

| # | Outcome | Change | Source verified |
|---|---|---|---|
| 1 | applied | FJ decided[1]: "The [night's-record half of the tap promise] names ..."; "the two clocks join [C9] as finding X-08". The same fix made in DJ's decision 28 line for consistency. | CS decision 28 (1)-(6); cause analysis X-08 |
| 2 | applied | FJ fitSummary[3]: "...read it too. This is the second half of [the tap promise]: the night can be told afterwards." Settled with #19 and parts #17(b) in one rewrite. | CS decision 28 (1) |
| 3 | applied | FJ open[1]: "then [A] to [G], on their wording and whether three of them should split." | DJ keys A to G |
| 4 | applied | FJ next[1]: "for each choice that [Decisions] lists as coming in step 3", the link landing on `decisions.html#step-3` (page markers now take an anchor, see decisions #21). | decisions.html id `step-3` |
| 5 | applied | FJ next[2] ("This site replaces version 7 ...") dropped; edit history. | decided[0] carries decision 29; guide line #9 carries the versions |
| 6 | applied | FJ lead ends at "...what must happen for them." | inventory row 6: kept copy is the site guide |
| 7 | applied | FJ siteGuide decisions line drops the "answer in the chat" clause. | Open for you, first line, says it |
| 8 | applied | FJ siteGuide engine line: "This page: the whole engine in one read, and the way to every other page." | the page itself |
| 9 | applied | FJ siteGuide changes line: "Every version, newest first; ...". Its last clause then took changes #11's wording ("the words the page has changed"). | `page_changes` renders Versions first |
| 10 | applied | FJ standaloneLine: "Decision 22 adds a requirement every rule must serve:". | CS decision 22 ("join the list every rule must serve") |
| 11 | applied | FJ fitSummary[1] opens "In the candidate, [Equipment] reports ...". | around[4] status (C3: no age today) |
| 12 | applied | FJ fitSummary[0] last sentence: "[Delivery] sends every fact that changed to every screen that may see it."; fitSummary[1] ends "; it alone moves a game." | BS `WHOLE_KEY` carries the label and "only between games" |
| 13 | applied | BS `WHOLE_KEY`: "which the [Parts page] shows"; "The [Parts page] follows five moments step by step." | the key's text |
| 14 | applied | FJ around[4..7].connects each open "In the candidate, ...". | around[1], [2], [3] split today and candidate |
| 15 | applied | FJ around[6].status: "Today these are three of the engine's seven adapters, ... ([C3]); ... ([C8])." | ES mechanisms (Equipment: seven adapters); the item names audio, sound and Bluetooth |
| 16 | applied | FJ around[10].connects drops "and players' data stays on the kit". | after-game report, privacy defaults (data stays on the kit unless the owner moves it) |
| 17 | applied | FJ around[1].status "Today it is one of the nine holders ... ([C12])"; around[3].status "Today two design flaws touch it: [pack edits reach each copy differently], and [the engine and the tests both assume they own the machine]." | CC titles C8, C12 |
| 18 | applied | FJ aroundMermaid edge pack to engine: "today: frozen at boot; candidate: adopted, stamped". | around[2].connects ("freezes a snapshot of it at boot") |
| 19 | applied | FJ fitSummary[3]: "for ALN the Director Console reads it from outside (decision 28)." (one rewrite with #2). | decided line and Director Console status keep the full point |
| 20 | applied | BS `FOOTERS['engine']` adds "the cause analysis of 2026-10-30 (the design flaws named around the engine)". | around items cite C2, C3, C8, C12 |
| 21 | applied, other form | The plan (3.1.1) and inventory row 3 home the eyebrow in the header; neither may be edited here, so BS `page_engine` now writes `<p class="eyebrow">Architecture pass · phase 1, step 1 · updated 2026-11-01</p>` before the h1. The build log's claim is now true. See the notes. | plan 3.1.1; inventory row 3 |

## page-decisions.md (decisions.html): 26 applied

| # | Outcome | Change | Source verified |
|---|---|---|---|
| 1 | applied, other form | DJ promises evidence[3]: "No flaw mainly breaks [the designer's change-a-value promise] today; [C8] and [C12] break it beside others." The check's own wording still dropped the 17-word title mid-sentence, so a short link form is used. | EJ J6 flaws (C8, C12 secondary) |
| 2 | applied | evidence[1] "Each entry on the [Promises] page names the parts that keep it."; evidence[2] "Whether running in any setup needs an eleventh promise is [question E]." | ES questionNotes E |
| 3 | applied | A evidence[2]: "Today a tablet running a different pack ... nothing tells the GM ([C12 title])." | CC C12 atAShow |
| 4 | applied | C decides: 'whether "[nothing declares a game standalone]" is a design flaw of its own, with its own rule.' (quoted, so the title does not start a capital mid-sentence) | N1 title in BS |
| 5 | applied | C evidence[1]: "... and it is declared where the game is fitted to tonight's setup, under [the venue promise]." | version 7 wording; ES questionNotes C |
| 6 | applied | C evidence[4]: "they join [C9], [C11] and [C14] ... On the map [N1] lands on [Pack channel] and [Venue fit] ...". | ES ownerChoices; ES parts with N1 |
| 7 | applied | D evidence[0]: "The night's record half names the director ... (decision 28, 2026-11-01)."; evidence[2] drops "now". | CS decision 28 (1); CJ J3 changes[2] keeps the history |
| 8 | applied, other form | D evidence[3]: "The tap's answer is mainly broken by [C7]: a reply never says which request it answers, or whether the answer is final or stored. No design flaw mainly breaks the night's record half yet." | CC C7 title; EJ J3 flaws |
| 9 | applied | E evidence[2] ends at "...a future operator with a second kit." | option 3's cost keeps the rest |
| 10 | applied | E evidence[3]: 'This promise is mainly broken by "[N1 title]". [C15] also breaks it: ...' (title quoted). | EJ J8 flaws |
| 11 | applied | The three "This replaces ..." sentences deleted from E, F, G; intro[1]: "...and the Change log has the earlier recommendation." | CJ recommendations E, F, G hold all three; F's reason stays in evidence[0] |
| 12 | applied | F evidence[2]: "Four flaws mainly break this promise. The pass's fourth design question covers ... ([C8]). For the other three none of its nine questions fits: the fifth is only the nearest ... ([C14]), ... ([C15]) ... ([C16]) have none." | CC questions; BS `OUTSIDE_NINE` |
| 13 | applied | F evidence[3]: "Options a, b and c each give [C15] a home in a part; [C16] lands on [Joins and proofs] whichever you choose." | ES questionNotes F ("widening, splitting, or filing ... all place C15") |
| 14 | applied | F option a cost: "...; the recommendation gives each its own question in the pass." | F evidence[2] (no question covers C15, C16 today) |
| 15 | applied, other form | G evidence[3]: "This question places [C2], where today health and state travel on separate routes, so ..."; last sentence dropped. Short form, since the full title repeats the clause after it. | CC C2; the recommendation keeps the card clause |
| 16 | applied | 22 decides: "Whether the hardware scanner, the ESP32, gets a standalone mode matching the phone's as parity work the pass must serve. ..."; evidence[3]: "On the map [Pack channel] carries the declaration to every device with its pack." | CS decision 22 |
| 17 | applied | 24 evidence[1] dropped. | option 2's cost carries it |
| 18 | applied | 19 evidence[1] ends at "...through [Answering]."; option No cost: "Nothing is recorded, as today, and the night's record cannot tell a refused attempt." | evidence[0] keeps "told to the tablet ... recorded nowhere else" |
| 19 | applied | 19 evidence[2]: "Where [the tap promise] lists [C9] among its flaws, it leaves this to you: ... not that flaw's."; evidence[3]: "... which the change for [C7] carries." | EJ J3 C9 line; standalone pass 3.3 |
| 20 | applied | 25 evidence[1]: "a black screen with the token's id". | standalone pass SP-06 ("Token: kai001"); parity row 13 |
| 21 | applied | BS `page_a` takes `page#anchor`; DJ lines link to `parts#alt-answer-and-record`, `#alt-release`, `#alt-delivery`, `#alt-standalone-tablet`, `flaws#standalone`, `changes#earlier-wording`, `#rec-e`, `#rec-f`, `#rec-g`. The build checks that each id exists. | BS anchors `ALT_ANCHORS`, page_changes ids, flaws `standalone` |
| 22 | applied | DJ step3 items 2 to 7 restored to version 7's words; BS `STEP3_INTRO` adds "The six with a row in the alternatives table on [the Parts page] link to it, where both designs and their costs are compared."; `page_decisions` links each of the six items' opening words to its row (`PAGE_OVERRIDE` removed). | `build_report.py` lines 1119 to 1131 |
| 23 | applied, other form | decided[0]: "No rule in the pass for the project's written documents (guides, READMEs, contracts, code comments). They are fixed as we go, always." The check's "program's own documents" was narrowed to what the rule covers. | CS decision 20; `docs/agents/process.md` section 4, last paragraph |
| 24 | applied | intro[0]: "Answer in the chat, by the question's letter or number (the first one is the promises question). Answer any of them, in any order, and leave the rest for later." | promises recommendation ties it to D to G |
| 25 | applied | intro[2] last sentence: "Only the Decided list at the end records what you have decided." | status line |
| 26 | applied | BS `FOOTERS['decisions']` adds "the program document of 2026-10-30 (the test rig's step); the promises document of 2026-10-31". | question 21 evidence; EJ |

## page-promises.md (promises.html): 13 applied

| # | Outcome | Change | Source verified |
|---|---|---|---|
| 1 | applied | BS `promise_html`: label "Broken by these design flaws today", a "Main" list and an "Also" list; "None yet." when no flaw is main. FJ intros.promises[1]: "the main ones first, each marked". | EJ flaws primary flags (J6 none) |
| 2 | applied | FJ intros.promises[0]: "[The promises question] asks whether these are the right ten; [questions A] to [G] ask about their wording and whether three of them should split." | DJ |
| 3 | applied | "[the Parts page]", "[the Design flaws page]", "in [the change log]". | |
| 4 | applied | "a goal marked open is left to step 3 as a whole; other goals name what stays open in their last sentence." | EJ goals of J3, J6, J8 end with an open point; only J5 has goalOpen |
| 5 | applied | Intro explains the pass's nine design questions are not Decisions' questions; BS `qtext` says "the pass's design question(s)" / "No design question of the pass covers it yet". Settled with flaws #4. | CC questions; the program document's nine |
| 6 | applied | BS `FIT_SUMMARY[3]` uses short links ([reading a screen without a second question], [proving a change before it reaches anyone], [The lifecycle buttons]), rendered with `rich()`. | ESmd line 29 (meaning unchanged) |
| 7 | applied | Figure caption "The main dependencies in brief". | |
| 8 | applied | BS `BUILT['J3']`: "Outside the engine, the director pastes that report by hand into ALN's article writer, the Director Console." Settled with changes #8. | after-game report, "What it takes" |
| 9 | applied | EJ J3 needs[0]: "Interaction primitives (capability 36): multi-tap actions are requests with the same reply shape." The engine-jobs document does not state this line (its J3 needs differ), so it needed no change. | EJ J3 needs[3] keeps held items |
| 10 | applied | EJ J8 needs[3]: "Standalone games need something that says a game is standalone; today the pack has no field for it." | the standalone line above it |
| 11 | applied | BS `BUILT['J10']`: "(the standing test rig was lost with the old container; its recipe survives, and step 2 rebuilds it)"; EJ J10 needs[5] dropped. | engine-jobs.md line 355 |
| 12 | applied | EJ J5 needs[0]: "thirteen list it as a secondary promise, dormancy (capability 8) and the second game's modules (capability 38) among them"; J6 needs[4]: "set no demand on it." Wording only; the document keeps its citations. | engine-jobs.md lines 193, 232 |
| 13 | applied, corrected | BS `BUILT['J10']`: "a run with the real programs in CI on the first test level"; EJ J10 needs[4]: "Blue/green cutover (capability 44) and two roadmap milestones (capabilities 45 and 51): the live machine stays frozen, and nothing deploys until the owner says so." The check's "the program's first and last blocks" is wrong: Block 6 is not the last (ROADMAP Block 7). | ROADMAP.md lines 416, 430; jobs-capabilities rows 45, 51 |

## page-parts.md (parts.html): 23 applied

| # | Outcome | Change | Source verified |
|---|---|---|---|
| 1 | applied | BS `TANGLE_NOTE`: "Each causes some of the design flaws named under it." | each tangle's flaw links |
| 2 | applied | FJ intros.parts[0]: "...becomes one part, and so does the work only one promise needs: seventeen parts in all." | ESmd section 4 (one part per job or per shared mechanism) |
| 3 | applied | "(the game rules, and the verdict with its health words)". | ESmd M-F (three health words inside the verdict) |
| 4 | applied | Sentence ends at "puts competing designs in front of you." | paragraph 3 and the table intro |
| 5 | applied | "The card's first paragraph says the part's work in plain words." | `part_html` |
| 6 | applied | "and Also needed by names the promises that use it;" | |
| 7 | applied | "Today, on the ten parts that take over work done in several places now, says how that work is done; Removes names ...". | BS `MECH_PART` (10 parts) |
| 8 | applied | Parenthesis dropped from intros.parts[2]. | `LAYERS_CAPTION`, `USES_NOTE` |
| 9 | applied | Walkthrough line "Shows" instead of "Keeps". | plan 3.4 item 4; decision 27 |
| 10 | applied | BS `page_parts` lowers the first letter of the quality's Today text: "Today: a tap on the tablet, ...". | |
| 11 | applied | BS strips "P1 " to "P17 " from the uses diagram's node labels (`uses_src`); edges unaffected. | |
| 12 | applied | BS `flaw_a` gives every short-form flaw link a `title` attribute with the flaw's title (site-wide). | |
| 13 | applied, other form | ES tangles: "re-decided in five places"; "nineteen modules each reset themselves"; "tests by area"; "Twelve test configurations split by area of the code" (the check's "one per area of the engine" claims more than the source says). Wording only; ESmd already says "modules". | ESmd T2, T6, T11 |
| 14 | applied | ES tangle 12 title: "Long call chains, and entry points that do too much". | ESmd T12 |
| 15 | applied | ES componentsMermaid: "The engine on the show machine: ..."; "an equipment adapter on the engine". Labels only. | |
| 16 | applied | ES componentsMermaid engine box adds "the release check at start". Fact change, so ESmd 4.3 changed too: its diagram adds "P17 check at start" and its prose "runs every part except the studio and the proofs, and of the release only its check at start". | ES P17 plain (the engine compares at start); P17 runsOn |
| 17 | applied, corrected | ES P5 plain: "...with the roster, the GM's notes, the accusation and photos captured into it during play. It carries the game it ran and the texts the players saw. The director tells the players the story of their night from it; ...". (a) and (b) as proposed; (c) drops "later" instead of "photos added later", because CONTEXT.md 5b says photos are captured during Run. ESmd P5 changed to match. FJ fitSummary[3] took "carries" too. | CS decision 28 (1), (3); CONTEXT.md lines 532-546 |
| 18 | applied | ES alternatives[4].cost: "give the night's record one input, the end of the game, and readers of its own after the show"; ESmd 4.4 row: "one input (P11's end) and readers of its own after the show (P15's Review, and the game's own telling from outside, decision 28)". | CS decision 28 (5) |
| 19 | applied | ES P10 plain drops "Already built; what is missing is a route to the screen." | Verdict's Today line |
| 20 | applied | ES P3 seams drops the repeated clause. | |
| 21 | applied | ES P2 seams: "The lifecycle takes up a new pack once per boundary." | walkthrough wording |
| 22 | applied | ES P6 seams: "the role filter from Connections and roles." | part P7's name |
| 23 | applied | ES P16 seams: "that it does what its part needs of it". | decision 27 |

## page-flaws.md (flaws.html): 15 applied

| # | Outcome | Change | Source verified |
|---|---|---|---|
| 1 | applied | CC C9 X-08: "...a manual adjustment the engine's. The GM enters the first-burial bonus and the transfers as adjustments, so they printed nine hours away from the sales; ALN's Director Console shifts them back." The cause analysis already says this. | cause analysis line 456; after-game report |
| 2 | applied | FJ intros.flaws[1]: "lists a few of its findings ... The card's head counts all its findings ... names any fix made on blue that points to it, as a clue." | CC findings vs examples |
| 3 | applied | Same paragraph reordered: moment and why, the seen-live note, In a standalone game, then the two diagrams. | `card_html` order |
| 4 | applied | Intro names the architecture pass's nine design questions and says they are not Decisions' questions; BS `chips()`: "Architecture pass question(s) ...", "No architecture pass question covers it (nearest: 5)". "Pass questions" was avoided because "Pass" is a defined word on the site (a device's pass). Settled with promises #5. | CC questions |
| 5 | applied | FJ intros.flaws[0]: "how many findings from the cause analysis sit under it (for N1, from the standalone pass)". | CC findings sum 337; N1's 8 from standalone lines |
| 6 | applied | BS `EVIDENCE_INTRO` ends "...and {n} under the proposed [N1]." | N1 entry keeps question C and 23 |
| 7 | applied | `EVIDENCE_INTRO`: "...came from blue's records, the maps of today's engine and, for one, the survey of ALN's after-game tools; ..."; intro "from blue's shows, the maps of today's engine and the after-game survey". | cause analysis 5.5 (X-08) |
| 8 | applied | BS `FOOTERS['flaws']` replaced with the check's list (reconciliation history dropped; promises document, shape and its maps, after-game report added). | changes version 5 holds the reconciliation |
| 9 | applied | N1 entry label "It also breaks". | glance header "Also breaks" |
| 10 | applied, corrected | CC C5 seenLive: "The review reproduced the red Display row after a reset by running the engine's code in a test."; C11: "The review reproduced, by running the engine's code in a test, Check Now reporting the display healthy when it had never launched." The check's "on a running engine" overstates "in-process". | cause analysis B-53, B-74 ("reproduced in-process by the review") |
| 11 | applied | CC C7 note "Answering takes every request and replies with one list of outcome words for every device"; C13 note "two kinds of connection"; labels C7 and C12 "every request, one reply", C11 "scans and commands, one reply". The other uses of "door" (the whole-engine picture, the fit summary, tangles, goals) are covered by defining it once, as the check allows: FJ words gains "Door: In the candidate, the one way in or out of the engine: every request comes in through Answering, and every fact goes out to the screens through Delivery." | CC; ES |
| 12 | applied | CC C5 note: "Two pieces replace today's two lists: a starting point builds every part once, from one list, and Lifecycle runs start and reset as one path and alone calls every reset." | CC C5 whyItHappens ("two separate hand-written lists") |
| 13 | applied, other form | BS `PARITY_WORDS` overrides the two cells: row 12 "Optional. One design for C9 takes the seen mark away from player devices instead."; row 14 "Decide what a standalone record of player scans is before matching either side." The dated standalone pass is left as written. | cause analysis C9 candidate (d); standalone pass SP-05 |
| 14 | applied | Parity summary "The ESP32 hardware scanner against the web scanner with no engine: 24 differences". | |
| 15 | applied, corrected | BS `SET_ASIDE`: "Already fixed in today's code"; "four items the review raised about the minimum test harness"; "two system settings the deployment guide asks for, now in the environment template"; 'A name like "constructor" mistaken for a real service, station or token'. The check's "sound settings" and "before the test rig" were not supported by the source, so the wording follows it. | cause analysis D-77, B-99, B-80, X-02 |

## page-changes.md (changes.html): 18 applied

| # | Outcome | Change | Source verified |
|---|---|---|---|
| 1 | applied | CJ J1 changes[0]: "The same two-pack proof also serves [the promise that a change is proven before it reaches anyone]." | |
| 2 | applied | CJ F after: "Keep [one promise] covering both moments, as its title does, and give ...". | version 7 F |
| 3 | applied | CJ G after: "[the room promise]"; "under [the one-game promise], they match ...". | |
| 4 | applied | CJ G before: "[the one-game promise]"; G why: "under the one-game promise". The quoted "record job" stays. | |
| 5 | applied | G before: "...; it was withdrawn before version 5 was published." | git: `0d20835a` draft, `467227dd` changed, `20ec5c38` published |
| 6 | applied | Version 5 prompt: "...read as mechanics, not what they do for people. They are now "[J8 title]" and "[J9 title]"." (quoted) | CS live state |
| 7 | applied | Version 8 items 3 and 4 shortened as proposed. | J3 entry; C9 entry |
| 8 | applied | CJ J3 changes[2]: "Its built-today line notes that, outside the engine, the director pastes the GM tablet's report into ALN's article writer by hand." Equal to BS `BUILT['J3']` (promises #8). | after-game report |
| 9 | applied | The "Restated ... version 6" line said once in BS `EARLIER_NOTE` under the heading; dropped from J1 to J6; J7 keeps "Its people say venue technicians."; J9 keeps its reasons; J10 keeps "Release day is named in its title." | CJ promises |
| 10 | applied | `EARLIER_NOTE` and `NOW_NOTE`: "Each note says what the relationship map changed. "Now" means the candidate shape, which is not decided." | |
| 11 | applied | CJ intro: "and the words the page has changed, most of them by decision 27." FJ guide line matched. | CJ vocabulary 9 (version 3, version 5) |
| 12 | applied | CJ J8 changes[2] drops the seventh-title sentence; vocabulary[7]: 'Decision 27 made the map's restated title a promise: "Fit the game to the venue it is in tonight" became [J8].' | CS decision 27 |
| 13 | applied | Version 6 items: the word changes become "The words box puts the page's own words first; the words changed as listed under [The words] below."; the venue technician item dropped; the qualities table sentence kept. | CJ vocabulary 1, 6, 8 |
| 14 | applied | "(versions 3 to 5 were ...)". | |
| 15 | applied | Version 8 item 6: "so no page needs a diagram program in the reader's browser." | |
| 16 | applied | CJ J8 changes[0]: "[Question E] asks for the owner's confirmation." | |
| 17 | applied | CJ J4 changes[0]: "under this promise". | |
| 18 | applied | BS `FOOTERS['changes']` adds the cause analysis (X-08 and the totals), version 7's questions (E, F, G) and the after-game report. | |

## Build and smoke test

- Build: `MERMAID_JS=... python3 -I build_site.py`: "drew 42 diagrams in one call
  of render_diagrams.js"; "checks passed: 884 links resolve; markers, ids,
  entries, diagrams and words as the plan asks". Prose words: index 4,446;
  decisions 4,458; promises 7,283; parts 4,757; flaws 8,335; changes 5,315.
- Smoke test: `node site_smoke.js site .../site-shots`: "smoke passed: 24
  loads, 24 screenshots", every load 0 errors, page width equal to the
  viewport at 1100 and 400 in light and dark.
- Visible text of all six pages: no em or en dash.

## Notes

- Plan 3.1.1 and inventory row 3 home an eyebrow that repeats the status line
  (engine #21). The eyebrow is now on the page; if the repetition is unwanted,
  the plan and inventory should name the status line as the kept copy and the
  eyebrow line in `page_engine` can go.
- `BUILT`, `FIT_SUMMARY[3]` and the walkthrough line now differ from
  `build_report.py` on purpose (promises #6, #8, #11, #13; parts #9).
- EJ J3's goal still says the record is "stamped with the game it ran" and
  names "later photos"; no check flagged it, so it was left. P5's card now says
  "carries" and drops "later" (parts #17).
- Wording-only changes to ES and EJ (parts #13-15, #19-23; promises #9-13)
  were not copied into the source documents, which keep their own wording and
  citations; the three fact changes (parts #16, #17, #18) were.
