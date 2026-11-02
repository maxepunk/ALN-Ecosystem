# Verify B: promises.html, parts.html, flaws.html

Checked 2026-11-01 after the apply pass (`checks/apply-log.md`; changes
since `3368565b`). Each of the 51 conflict rows in `page-promises.md`
(13), `page-parts.md` (23) and `page-flaws.md` (15) was read against the
rebuilt page, as text with the diagrams' labels kept, and against the
HTML for links, `title` attributes and captions. Then the three pages
were read whole against the rules in the task. The apply log rejected
nothing; where it applied a row "corrected" or "in another form", the
verdict says whether its reason holds.

**Verdicts: 47 resolved, 4 partly, 0 unresolved. New conflicts: 9.**

Abbreviations: BS `report/build_site.py`, FJ `site/front.json`, EJ
`report/2026-10-31-engine-jobs.json`, ES `report/2026-11-01-engine-shape.json`,
CC `report/2026-10-31-cause-cards.json`. Line numbers are as the files
stand now.

## Verdicts

### page-promises.md

| # | Verdict | What the rebuilt page says |
|---|---|---|
| 1 | resolved | Each entry: "Broken by these design flaws today", then a "Main" tag and list, then an "Also" tag and list, as text. The designer's loop reads "Main None yet." Intro: "the main ones first, each marked". |
| 2 | resolved | "The promises question asks whether these are the right ten; questions A to G ask about their wording and whether three of them should split." All three link (`#q-promises`, `#q-a`, `#q-g`). |
| 3 | resolved | "each a link to the Parts page"; "the cards are on the Design flaws page"; "are in the change log". |
| 4 | partly | The intro now separates the marked goal from the others, but its new clause, "other goals name what stays open in their last sentence", says every other goal names something open. Six of the nine unmarked goals leave nothing open. See new conflict 4. |
| 5 | resolved | Intro: "The test cases' summary names which of the architecture pass's nine design questions the promise answers; these are not the questions on Decisions." Summaries read "Answers the pass's design questions 6, 5, 8". (The wording differs from the Design flaws page's chips; new conflict 7.) |
| 6 | resolved | The lead-in links the short forms: "reading a screen without a second question", "proving a change before it reaches anyone", "The lifecycle buttons", each landing on its entry. Meaning unchanged. |
| 7 | resolved | Figure caption "The main dependencies in brief". |
| 8 | resolved | "Outside the engine, the director pastes that report by hand into ALN's article writer, the Director Console." |
| 9 | resolved | The tap promise's first need is now the interaction primitives alone; held items appear once, in the fourth item. |
| 10 | resolved | "Standalone games need something that says a game is standalone; today the pack has no field for it." |
| 11 | resolved | The rig is said once, in Built today ("its recipe survives, and step 2 rebuilds it"); the needs list drops to five. |
| 12 | partly | Both citations are gone, but the rewrite left a visible stray space: "thirteen list it as a secondary promise , dormancy (capability 8) ...". See new conflict 2. |
| 13 | partly | The block jargon is gone, and the apply log's correction holds (ROADMAP.md line 430 has a Block 7, so Block 6 is not the last). But the replacement for "a rung-1 run", "a run with the real programs in CI on the first test level", is wrong: rung 1 is the second rung (CONTEXT.md line 456: 0 = bare CI, logic only), and the same entry's goal lists "logic alone" as the first level. See new conflict 1. |

### page-parts.md

| # | Verdict | What the rebuilt page says |
|---|---|---|
| 1 | resolved | "Each causes some of the design flaws named under it." |
| 2 | resolved | "...becomes one part, and so does the work only one promise needs: seventeen parts in all." |
| 3 | resolved | "(the game rules, and the verdict with its health words)". |
| 4 | resolved | The sentence ends at "puts competing designs in front of you." |
| 5 | resolved | "The card's first paragraph says the part's work in plain words." |
| 6 | resolved | "and Also needed by names the promises that use it;" |
| 7 | partly | The sentence no longer implies every card has Today, and ten is the right count (Game rules, Engine instance, Pack channel, Connections and roles, Equipment, Verdict, Lifecycle, Answering, Delivery, Joins and proofs). But the new qualifier, "the ten parts that take over work done in several places now", is false for two of them: Verdict's Today says "Built and in good shape today" and Engine instance's says "Nothing". See new conflict 5. |
| 8 | resolved | The parenthesis is gone from the third paragraph. |
| 9 | resolved | Each walkthrough reads "Shows" and the promises. |
| 10 | resolved | "Today: a tap on the tablet, a URL path on the phone, ...". |
| 11 | resolved | The uses diagram's boxes read "Game rules" to "Release"; no P numbers. |
| 12 | resolved | Every short flaw link on the page has a `title` with the flaw's title (N1 included). |
| 13 | resolved | "re-decided in five places"; "nineteen modules each reset themselves"; "tests by area"; "Twelve test configurations split by area of the code". The apply log's narrower wording holds (the shape says only that they are split by area). |
| 14 | resolved | "Long call chains, and entry points that do too much." |
| 15 | resolved | "The engine on the show machine: ..."; "an equipment adapter on the engine". |
| 16 | resolved | The engine's box now lists "the release check at start", matching the Release card's "Runs on the engine, the config tool". |
| 17 | resolved | The record card: roster, the GM's notes, the accusation and photos captured during play; "It carries the game it ran and the texts the players saw. The director tells the players the story of their night from it". The correction (no "photos added later") holds: CONTEXT.md lines 534-536 list photos with the intake captured during Run. |
| 18 | resolved | "give the night's record one input, the end of the game, and readers of its own after the show". |
| 19 | resolved | The Verdict card's first paragraph no longer repeats its Today line. |
| 20 | resolved | "the host (the engine in a networked game, the tablet in a standalone one)." |
| 21 | resolved | "The lifecycle takes up a new pack once per boundary." |
| 22 | resolved | "the role filter from Connections and roles." |
| 23 | resolved | "that it does what its part needs of it". |

### page-flaws.md

| # | Verdict | What the rebuilt page says |
|---|---|---|
| 1 | resolved | X-08: "...a manual adjustment the engine's. The GM enters the first-burial bonus and the transfers as adjustments, so they printed nine hours away from the sales; ALN's Director Console shifts them back." Decision 28 point 6 holds: the two clocks are X-08 under C9. |
| 2 | resolved | "lists a few of its findings ... The card's head counts all its findings ... names any fix made on blue that points to it, as a clue." |
| 3 | resolved | The intro now follows the card order: moment and why, the seen-live note, In a standalone game, then the two diagrams (checked on C2, C3, C5, C8). |
| 4 | resolved | Chips read "Architecture pass questions 6, 5, 8" and "No architecture pass question covers it (nearest: 5)"; the intro says these are not the questions on Decisions. The reason for avoiding "Pass questions" holds ("pass" is a device's credential on this site). |
| 5 | resolved | "how many findings from the cause analysis sit under it (for N1, from the standalone pass)". |
| 6 | resolved | The evidence intro ends "...and 8 under the proposed N1." The N1 entry alone keeps question C with question 23 folded in, as inventory row 51 asks. |
| 7 | resolved | "358 problems came from blue's records, the maps of today's engine and, for one, the survey of ALN's after-game tools"; the intro adds "the after-game survey". |
| 8 | resolved | The footer lists the cause analysis, the standalone pass, the promises document, the engine-shape document with its four maps, and the after-game report; no reconciliation history. |
| 9 | resolved | "It also breaks". |
| 10 | resolved | C5: "The review reproduced the red Display row after a reset by running the engine's code in a test." C11 likewise. The correction holds: the cause analysis says "reproduced in-process" (B-53, B-74), not on a running engine. The plain wording now exposes that both sit under a "Seen live" label; see new conflict 6. |
| 11 | resolved | No "door" is left on this page: the C7 and C13 notes and the C7, C11 and C12 diagram labels are reworded. The site-wide uses are covered by a "Door" entry in the words list (FJ line 328), which the check allowed. That entry covers only the candidate; see new conflict 9 for the Parts page. |
| 12 | resolved | "Two pieces replace today's two lists: a starting point builds every part once, from one list, and Lifecycle runs start and reset as one path and alone calls every reset." |
| 13 | resolved | Row 12: "Optional. One design for C9 takes the seen mark away from player devices instead." Row 14: "Decide what a standalone record of player scans is before matching either side." Overriding in BS rather than editing the dated standalone pass is the right form. |
| 14 | resolved | "The ESP32 hardware scanner against the web scanner with no engine: 24 differences". |
| 15 | resolved | "Already fixed in today's code"; "four items the review raised about the minimum test harness"; "two system settings the deployment guide asks for, now in the environment template"; 'A name like "constructor" mistaken for a real service, station or token'. The corrections hold against D-77, B-99, B-80 and X-02 in the cause analysis (lines 853 to 858). |

## New conflicts

| # | Where | What it says | What it should say | Place to change |
|---|---|---|---|---|
| 1 | Promises, "A change is proven...", Built today | "a run with the real programs in CI on the first test level". Rung 1 is the second rung (CONTEXT.md line 456: rung 0 is bare CI, logic only), and the entry's own goal names "logic alone" as the first level. | "a CI run of the real engine and its programs, the test level above logic alone" | BS `BUILT['J10']`, line 66 |
| 2 | Promises, "Each lifecycle button...", needs item 1 | "thirteen list it as a secondary promise , dormancy (capability 8) ..." (space before the comma) | "thirteen list it as a secondary promise, dormancy (capability 8) ..." | EJ `jobs[J5].needs[0]`, line 335 |
| 3 | Promises, "Every tap gets its answer...", the long-term goal | "...captured during play, stamped with the game it ran and the texts the players saw." The rule, decision 28 point 3, CONTEXT.md (Review) and the Parts page's record card all say the record carries them; "stamped" makes the texts an identity mark. The apply log noted this and left it. | "...captured during play. It carries the game it ran and the texts the players saw." | EJ `jobs[J3].goal`, line 188; `2026-10-31-engine-jobs.md` line 125 to match |
| 4 | Promises, intro paragraph 2 | "a goal marked open is left to step 3 as a whole; other goals name what stays open in their last sentence." Six of the nine unmarked goals leave nothing open. | "a goal marked open is left to step 3; where another goal leaves something open, its last sentence says so." | FJ `intros.promises[1]`, line 376 |
| 5 | Parts, intro paragraph 2 | "Today, on the ten parts that take over work done in several places now, says how that work is done". Verdict's Today says it is built in good shape; Engine instance's says "Nothing". | "Today, on the ten cards that carry it, says how that work is done now;" | FJ `intros.parts[1]`, line 381 |
| 6 | Flaws, C5 and C11: the card chip, the note's tag and the glance table's "Seen live" column | "Seen live: The review reproduced ... by running the engine's code in a test." A test reproduction is not something seen live; the cause analysis keeps the two apart ("Reproduced in-process already: B-53", line 277; "B-74", line 592). The page counts eight seen live where six were. | Label these two "Reproduced in a test" (chip, note tag and glance cell), and say so in the intro: "marks a problem that was seen live or reproduced in a test". | CC `cards[C5]`, `cards[C11]` (a separate field from `seenLive`, lines 299, 687); BS `chips()` lines 100-101, `card_html` line 836, `page_flaws` lines 1599-1609; FJ `intros.flaws` |
| 7 | Promises test-case summaries against the Design flaws chips | Promises: "Answers the pass's design questions 6, 5, 8"; flaws: "Architecture pass questions 6, 5, 8". One list, two names on two linked pages; the apply log avoided "pass" on the flaws page for a reason that applies on the promises page too. | One name on both: "Answers architecture pass questions 6, 5, 8" / "No architecture pass question covers it yet" | BS `promise_html` `qtext`, line 1400 |
| 8 | Parts intro paragraph 2; Flaws intro paragraphs 1 and 2 | "each is a link to Promises"; "each a link to Design flaws"; "those entries on Promises point back to the card"; "each a link to Parts". Promises check 3 changed the same bare page names to "the Parts page" and "the Design flaws page"; parts check 7 rewrote the parts sentence and kept the bare form, so the pages now differ. | "each is a link to [[page:promises\|the Promises page]]"; "each a link to [[page:flaws\|the Design flaws page]]"; "those entries on [[page:promises\|the Promises page]]"; "each a link to [[page:parts\|the Parts page]]" | FJ `intros.parts[1]` (line 381), `intros.flaws[0]` and `[1]` (lines 385, 386) |
| 9 | Parts, Answering's Today line and tangle 4's title | "Three reply shapes at three doors"; "Three doors, three reply shapes, acknowledgements matched by name". The new words-list entry defines a door only "In the candidate", as Answering or Delivery; today's code has neither, so these uses fall outside it and stay a metaphor. | "Three reply shapes for three kinds of request"; "Three ways in, three reply shapes, acknowledgements matched by name" | ES `mechanisms[]` "Answering a request" `.plain` (line 109); ES `today.tangles[3].title` (line 177) |

## What I found right

- **Rules, all three pages.** No em or en dash in the visible text or the
  diagram labels. No "job", "installer" or J1 to J10 a reader sees.
  "Venue technician" throughout. Every promise link shows the exact
  title (or, in the promises lead-in, a short form that reads in its
  sentence) and lands on its entry. Every short flaw link on Promises
  and Parts now carries the flaw's title on hover. The shape stays a
  candidate: "Kept by these parts of the candidate shape", "Candidate,
  not decided" on all 16 candidate diagrams, "would" in the device
  list, the status line on each page.
- **Decision 28.** The tap promise names the director, the players the
  night is told to, and the owner and designer; its need leaves how the
  story reaches the players to the game; its goal keeps the Director
  Console a separate program with room to run inside Review; no
  player emails appear on any of the three pages. The record card on
  Parts now names the players and says "carries". C9 carries X-08 in
  the right words and names the Director Console.
- **No edit history.** The flaws footer and evidence intro lost their
  history; the promises intro points to the change log and says no
  more. The only "folded in" left is the N1 entry's, which inventory
  row 51 asks for.
- **Facts.** The corrected rows hold against their sources: ROADMAP.md
  Block 7 (promises 13), CONTEXT.md photos during Run (parts 17), the
  cause analysis's "in-process" (flaws 10) and its set-aside rows D-77,
  B-99, B-80, X-02 (flaws 15). The Release card and the run-where
  diagram now agree, and the shape document's section 4.3 was changed
  with them. The parts intro's count of ten Today lines is right.
- **Nothing lost.** The cut sentences (the held-items duplicate, the
  rig's second mention, the standalone duplicate, the Verdict's
  repeated line, the repeated "map found two ways") each survive in
  the place the check named. The J5 need lost only its document
  citations; its count and examples remain.
- **Builds.** The apply log's build reports 884 links resolving and the
  smoke test 24 loads with no errors; the three pages read here match
  that build.
