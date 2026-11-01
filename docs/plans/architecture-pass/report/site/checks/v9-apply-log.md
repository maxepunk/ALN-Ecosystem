# Version 9: applying the six page checks

Applied 2026-11-01 on branch `claude/nice-curie-hescfv` (not committed). Every conflict in the six page checks
(`v9-page-engine.md`, `v9-page-decisions.md`, `v9-page-requirements.md`, `v9-page-design.md`, `v9-page-today.md`,
`v9-page-changes.md`) was verified against the source it names, then applied. None was rejected. Where two checks
touched the same text, one change settles both; the row says so. Edits were made in place, text only; every JSON
file stays valid with its layout (the git diff shows only the changed lines).

**Totals: 141 conflicts; 141 applied, 0 rejected.** (The engine 25, Decisions 28, Requirements 20, Design 26,
Today's engine 22, Change log 20.)

One builder change serves several checks: off the Decisions page and the change log, a `[[q:X]]` marker now renders
the question's title, not its letter (`build_site.py` `q_a()`, `Q_TITLES`). It settles Design rows 1 to 3, Today's
engine rows 7 to 9 and Requirements row 1, and any later slip of the same kind. The sentences around those markers
were rewritten as well, so each title reads naturally in its sentence.

| Page | Row | Result | The change, or the reason | Source verified |
|---|---|---|---|---|
| The engine | 1 | Applied | Done's first item now says what coherent on main means, its date, and names hardware-proven as the next state; "the merge train walked" and "main" gone. | ROADMAP section 3, "Coherent on main" (reached 2026-09-12); Appendix C |
| The engine | 2 | Applied | The hardening block's finished pieces in plain words (the equipment kinds a venue profile can name, with the five kinds; grey "not installed tonight"; two small fixes that keep test runs from mixing up logs and files). | Hardening plan, piece table and pin P1 (the five families); CURRENT-STATE section 5; DECISIONS "Corrections to the readers and the hardening pieces" |
| The engine | 3 | Applied | "You approved the plan for the architecture pass at the definition session of 2026-10-30, and retired the truth sweep, the block that was to prove every screen tells the truth; its purpose moves into the build half." | DECISIONS "The owner ratified the program document" (2026-10-30), "The truth sweep's charter is retired" |
| The engine | 4 | Applied | "The review that named the design flaws found sixteen; they are now test situations for every design." | The check's own wording; DECISIONS "Blue's fixes are evidence of design causes" |
| The engine | 5 | Applied | The build half "also rebuilds the hardening block's remaining pieces and does the truth sweep's work, proving that every screen tells the truth; it takes the place those two blocks held among the conditions for show-ready." | DECISIONS "One program: design half, then build half"; ROADMAP section 3, Show-ready condition 2 (superseded 2026-10-30) |
| The engine | 6 | Applied | Hardware-proven explained at first use: green, the second show machine, built from the deployment guide and passing the home hardware test, with what that test covers; "You can run it whenever you choose." The test's list follows the roadmap (sound through a real speaker, not "Bluetooth speaker"). | ROADMAP section 3, "Hardware-proven"; section 6, Stage B; CURRENT-STATE section 6 |
| The engine | 7 | Applied | The words box's "The blocks" and "The readiness states" now give each block and state a plain meaning; show-ready is explained at its first use in the timeline, which points to The words for the rest. Inline meanings for every block in the timeline pushed the page over the builder's hard word limit (2,625), so the timeline points to the words box, as the check proposes. | ROADMAP sections 3, 4 and 7 |
| The engine | 8 | Applied | "What you can do now" names the four readings and says the panel's brief is on Design, with three questions about it on Decisions. | `v9/decisions.json` (questions C, P to R); Design page's "The panel's brief" |
| The engine | 9 | Applied | The Design line names the panel's brief and the later choices (shortened with the other guide lines for the word limit). | `v9/design.json` sections; built `design.html` |
| The engine | 10 | Applied | The purpose paragraph's list is now "Some rules hold throughout: ..."; the words box's "The standing rules" keeps the roadmap's list. | ROADMAP section 2; `2026-10-31-engine-jobs.json` `purpose[6]` |
| The engine | 11 | Applied | The Designers line and the extension case "A small game with no show machine" now say where the declaration lives (venue profile, pack, game's record or each device) is settled in the design round on where authority lives. Settled together with Requirements row 10. | DECISIONS "Standalone games: declared, never mixed"; "Still open" |
| The engine | 12 | Applied | All six growth lines list the case titles as the items; the restated descriptions are gone. | `requirements/2026-11-01-extension-cases.json` titles; plan v2 3.1 word limit |
| The engine | 13 | Applied | "A developer from outside the team extends it ..." | EX21 `who` |
| The engine | 14 | Applied | "an ability the engine lacks". | QT21 wording; jargon table wording 20 |
| The engine | 15 | Applied | Release day's "why" now says the machine carries everything on one written list (the engine's version, the tablet and phone apps, the pack, the media and the venue profile); `engine-jobs.json` J10 `need` already says so. | `2026-10-31-engine-jobs.json` J10 `functional.need` |
| The engine | 16 | Applied | "The designer reading a go or no-go badge in the editor". | J9 `functional.people`; jargon table P6 |
| The engine | 17 | Applied | "One decision adds a requirement every design choice must serve (link). A whole game can run ..." | DECISIONS "Standalone games: declared, never mixed" |
| The engine | 18 | Applied | The world picture now routes the operator's packs into "The pack" ("installs, picks"), the developer's tests through "Messages", and keeps only "changes the code" as a direct arrow (wide: below the protocol band; narrow: round the left edge). The key moves the operator and the developer out of "At a show". | `build_site.py` `world_svg`, `WORLD_PEOPLE`; `v9/front.json` `worldKey` |
| The engine | 19 | Applied | "The TV's browser" added to the outside programs in both layouts. The key's list of programs was dropped instead of extended, to keep the page under the builder's hard word limit; the picture names all five. | QT2, QT11, QT24, QT27; version 8's "Around the engine" |
| The engine | 20 | Applied | A "Stranger, on the venue wifi" box whose dashed line stops at a bar at the protocol, labelled "gets nothing"; the developer box reads "on the team or from outside". The key says "A stranger on the venue wifi gets nothing". | QT31; EX21 |
| The engine | 21 | Applied | Caption "The people and their devices, the published protocol, the engine, and the outside programs it drives."; the key's first sentence points to The words instead of repeating it. | `build_site.py` `WORLD_CAPTION`; `v9/front.json` `worldKey` |
| The engine | 22 | Applied | "Design top-down, hardest-to-reverse choices first" and "Build the test rig when building starts" added to Decided lately, each with one plain line; the privacy line now says players' email addresses stay outside the engine. | DECISIONS, those two entries and "The night's record and the after-game article"; QT30 |
| The engine | 23 | Applied | "the blind round", "the second round" in the Decided lately line and in the words box's "The panel"; "They" throughout. | DECISIONS "What the architects' panel sees, and when"; the panel's brief |
| The engine | 24 | Applied | "proving each change before it reaches a show stays a quality every part must meet; ... the earlier candidate's part "Joins and proofs"." | DECISIONS "One published protocol and an outside test bench" |
| The engine | 25 | Applied | "You are at the design half's current step, the requirements; ..." | Check's wording |
| Decisions | 1 | Applied | "the smallest test set-up"; "the review's reading of today's code was split by source ...". Also, with Design row 9 and Today's engine row 10, the other two pieces now read "the kinds of equipment a pack can ask for and a venue profile can name" and "the code that marks equipment not installed tonight", and "merged" became "already built", so the three pages use one wording. | DECISIONS "Corrections to the readers and the hardening pieces"; hardening plan pin P1; jargon table F158 |
| Decisions | 2 | Applied | "its survey of every screen and its five recorded bugs where a screen fell out of step with the engine are evidence for the pass." | DECISIONS "The truth sweep's charter is retired" |
| Decisions | 3 | Applied | The check's wording, with "settings template". | DECISIONS "Green's follow-ups ship when the definition session ends" (merged 2026-10-30) |
| Decisions | 4 | Applied | "In the blind round ..."; "it enters the second round as one more proposal". | DECISIONS "What the architects' panel sees, and when"; panel brief |
| Decisions | 5 | Applied | "Your site is a set of linked pages built from one set of data, with earlier wordings and changes kept in a change log; nothing in the single page it replaced had to stay. The same decision asks for the site to take the long-term frame and to use titles in place of numbers." | DECISIONS "The owner's site: five linked pages" |
| Decisions | 6 | Applied | "parts keep promises and design flaws break them;" restored. | DECISIONS "Promises, qualities, moments, venue technician"; version 8's Decided line |
| Decisions | 7 | Applied | The three readings now say "the record reads them as ..., which question C asks you to confirm" and "may be overtaken, which question C asks you to confirm". | DECISIONS, the three entries' histories ("to be confirmed") |
| Decisions | 8 | Applied | "Each decision is written as it stands today, with its dated history in the decision record. The change log maps each old number to its title." | `changes.json` `numbers` (no versions named); plan v2 3.2 item 4 |
| Decisions | 9 | Applied | Both halves: the change log's row for the withdrawn question now keeps its substance (Change log row 3), and the intro says only what the change log holds: it maps the earlier letters and numbers to titles and keeps the withdrawn question. | Version 8 `decisions.html`, question 21; DECISIONS "Superseded and withdrawn", "Build the test rig when building starts" |
| Decisions | 10 | Applied, adjusted | Question C now has a group of its own, "Confirming earlier decisions". Putting it after D to K would print the letters out of order (A, B, D ... K, C), so the requirements group is split instead: "Confirming the requirements" (A, B), "Confirming earlier decisions" (C), "Confirming the promises" (D to K). A reader looking for the requirements no longer passes through C, and the letters stay in order. | `v9/decisions.json` groups; DECISIONS "Read as overtaken, not yet confirmed" |
| Decisions | 11 | Applied | Question B gains its two options with their costs, in the check's words. | Plan v2 3.2 item 2; panel brief ("a case added later reaches the design rounds but not the panel") |
| Decisions | 12 | Applied | "A small game with no show machine also waits on question L and question N." | EX12 `status`, `case` |
| Decisions | 13 | Applied | The gloss that repeated the title is gone. | EX15 |
| Decisions | 14 | Applied | "Today no flaw mainly breaks the promise ... Two flaws break it beside others: ..., and ...". | `engine-jobs.json` J6 `flaws` |
| Decisions | 15 | Applied | "and settle the four wording questions below, H to K." | `v9/decisions.json` H to K |
| Decisions | 16 | Applied | "they join three flaws (...; ...; ...) and the table comparing ...". | Question G's evidence; standalone review |
| Decisions | 17 | Applied | "... mainly broken by the flaw ...: the tablet cannot tell whether an answer is final or the scan was only saved to send later." | Card "A reply never says which request, final or stored" |
| Decisions | 18 | Applied | "In the earlier candidate, Joins and proofs (since replaced by the published protocol and the outside test bench) and Engine instance carried it."; "... falls to the outside test bench whichever you choose." | DECISIONS "One published protocol and an outside test bench"; "Superseded and withdrawn" |
| Decisions | 19 | Applied | The "a." to "d." prefixes are gone from question J's options. | Plan v2 section 6 (lists of choices unnumbered) |
| Decisions | 20 | Applied | "Your answer also decides which promise the flaw ... sits under: today the music card keeps its playing look while the health row turns red." | Card "Service health and service state travel on separate paths" |
| Decisions | 21 | Applied | "a yes needs the same on a standalone tablet; the design choice that removes the flaw ... would carry it." | Question O's evidence |
| Decisions | 22 | Applied | "Your decision ... sets / lists / gives ..." in P, Q and R. | DECISIONS "What the architects' panel sees, and when" |
| Decisions | 23 | Applied | "One more proposal in each round, so ten agents in place of eight, and a longer synthesis." | Panel brief, "Size and cost" (about eight agents: three, three, the synthesis and its checker) |
| Decisions | 24 | Applied | Question Q's facts gain the last decision ahead waiting for the second round, and that the panel runs only after you approve its brief and confirm the requirements. | Panel brief, "The blind round" and its header |
| Decisions | 25 | Applied | The footer names the panel's brief (2026-11-01). | Panel brief |
| Decisions | 26 | Applied | "(today, how often the scanners check on the engine)", in question A and in QT5's `numberToSet`; QT5's situation also loses "polling interval" ("one check-in period (how often a scanner checks on the engine)"). | QT5 |
| Decisions | 27 | Applied | "working out the earlier candidate (a set of the engine's parts drawn from today's engine, ...)". | Check's wording |
| Decisions | 28 | Applied | "or block by block, in the roadmap's order." | DECISIONS "Still open" |
| Requirements | 1 | Applied | Under each target with a number: "Listed with the other numbers to set on Decisions" (the link on "Decisions"). Lead-in: "Decisions lists them in one place, under the question Do the quality targets say how well the engine must work?". | `build_site.py` `qt_html`, `page_requirements` |
| Requirements | 2 | Applied | Each promise's "In a standalone game" line keeps only today; the earlier candidate's sentence moved to a new field `standaloneCandidate` and is shown on Design inside the earlier candidate's fold ("In a standalone game, promise by promise", under "Which part would run where"), reworded "In the earlier candidate". | DECISIONS "What the architects' panel sees, and when"; plan v2 section 2 |
| Requirements | 3 | Applied | The goals of the eight promises named now state the need without the candidate's parts: "the game's record carries it"; "each decided in one place ... Each fact reaches the screens that may see it by one route"; the room's setting without "in the profile as the candidate shape has it", held cues "kept in one place"; "One set of steps moves a game"; "The design tool talks to the engine only by sending it requests ... applies a change only between games ... A separate trial copy keeps its own files, network ports and settings"; "Every action is checked once against what its pass allows"; "A check at start compares what each machine carries with its written list"; "One answer (healthy, down or not installed tonight) serves the editor, ...". | `2026-10-31-engine-jobs.json` goals; J5 goal (pack changes only between games) |
| Requirements | 4 | Applied | The four needs lose the candidate's answers; "where the setting lives is left to the design rounds" is written once (the room promise). | `engine-jobs.json` J1, J4, J8, J10 needs |
| Requirements | 5 | Applied | The intro now says the promises themselves are open (the list question and the seven wording questions, by title) and that the test summary names which of the architecture pass's nine questions a promise answers, not the questions on Decisions. | Version 8's Promises intro; `v9/decisions.json` D to K |
| Requirements | 6 | Applied | A promise with no main flaw but other flaws now shows "Mainly: None yet: its planned capabilities are not built." | Version 8's "Main: None yet" |
| Requirements | 7 | Applied | QT39's situation marks the hardware scanner's reading as waiting on your open question; its status moves that reading into the open part. The status's other source, the pack promise's standalone sentence, moved to Design (row 2), so it now cites the pack promise's goal, which says the same. | DECISIONS "Standalone games: declared, never mixed"; "Still open" |
| Requirements | 8 | Applied | QT7 is now partly settled (the standalone case settled, the rest proposed); QT27 is proposed (the roadmap's rule on growth without corners covers kits and packs, not test runs). Decisions question A's counts follow: four proposed in full (adds QT27), six in part (adds QT7, all but the standalone case). | DECISIONS (no ruling covers test runs); ROADMAP 2.2 |
| Requirements | 9 | Applied | "... and the two clocks join the flaw "Tablets and phones decide facts the engine owns" as a finding". | DECISIONS "The night's record and the after-game article" |
| Requirements | 10 | Applied | EX12: the gap "recorded as a parity gap, on the owner's rule that the two player scanners keep feature parity"; where the declaration lives "is a question for the design rounds"; how many tablets is the open question "One GM tablet per standalone game?"; Goes through: "(the design rounds choose where)". Settled with the engine row 11 (the Designers line). | DECISIONS "Standalone games: declared, never mixed" |
| Requirements | 11 | Applied | EX10: "How many phones one kit carries at once is the number Phone capacity ... leaves for you to set." EX12's lowercase "number to set" sentence is gone (row 10). Decisions question B's line on the two numbers follows. | QT34; question M |
| Requirements | 12 | Applied | "every service the engine runs (video, music, lights)"; "checked against a stand-in light for each light the game names, generated from the pack's own needs"; "the pack is the one source every tool feeds". | Jargon table wording 45, row I40 |
| Requirements | 13 | Applied | One sentence in the page intro gives each block and readiness state used below its meaning (hardening, capture, preview, depth-and-close, operations era and release block; previewable, adoptable). "The deferral registry's row" became "the roadmap's row for deferred work" everywhere, and "readiness ladder" became "readiness states". | ROADMAP sections 3, 4, 7 and 8 |
| Requirements | 14 | Applied | Each internal entry name in the statuses replaced by what it says (red only for a real fault; every screen quotes one verdict, so mistakes are caught at the desk; every status row carries its actions, and the GM can take a service out of service for the night; power on leads straight to a running show; the words for the game's live facts; the access rules; the rules the engine and a standalone tablet share; the word for a score-holder; the resting video versus a video a game event plays; the channel the hardware scanner fetches its files on). The status of QT8 also loses "its honesty rule". | `requirements` files; CONTEXT.md entries named |
| Requirements | 15 | Applied | The five "test case for this target, not its reason" clauses now give the example plainly; the "A question asks; it does not settle" sentences left QT5 and QT17, and the rule is said once in the page intro. | Check's wording |
| Requirements | 16 | Applied | The status sentence no longer repeats its tag: "settled by the owner (X)" and "proposed (X)" read "On: X"; a qualified one reads "Your word in part (X); open: ...". | `build_site.py` `state_html`, new `status_grounds` |
| Requirements | 17 | Applied | QT22: "a general way to add new kinds of display is room left beyond the constellation screen, with no slot yet (...)". | ROADMAP row 8.8 |
| Requirements | 18 | Applied | Footer: "the list of planned capabilities drawn from the roadmap you approved". | `2026-10-31-jobs-capabilities.md` ("Nothing here is decided") |
| Requirements | 19 | Applied | The rules intro says it once: "They bind every block of work and every design, now and later: what each must do or must never do, whatever shape the design takes. They are not promises or quality targets." | `v9/rules.json` |
| Requirements | 20 | Applied | The intro names the labels the reader sees ("what it goes through, what it must not need") and the third kind, "partly settled". | Built page labels |
| Design | 1 | Applied | "Three of your open questions feed this round: (title); (title); (title)." | `q_a()` change; `v9/decisions.json` L to N |
| Design | 2 | Applied | "Two of your questions, (title) and (title), touch ...". | Same |
| Design | 3 | Applied | The brief's intro and the three "if you agree" notes name the questions by title ("your question ..."). | Same; P to R |
| Design | 4 | Applied | "Where settings that belong to no game live, ...: in the venue profile or in a file of their own." | EX15; Later choices |
| Design | 5 | Applied | "... changed in place, area by area, a new engine is built beside it and the pieces swapped over, or a mix of the two. Either way the build half starts with a thin first version of the new design." | Panel brief, "The second round"; DECISIONS "One program: design half, then build half" |
| Design | 6 | Applied | The numbered-facts example is gone; the sentence ends at the protocol link. | Check's reason (it leans toward an option) |
| Design | 7 | Applied | "Each scan counts exactly once" added to the drivers of the state and protocol decisions. | QT4 `situation` |
| Design | 8 | Applied | "Every request is checked against its pass" added to the drivers of the protocol and authority decisions. | QT31 `situation` |
| Design | 9 | Applied | First use: "The pieces of the hardening block already built into the engine (the kinds of equipment a pack can ask for and a venue profile can name, the code that marks equipment 'not installed tonight', and the smallest set-up the tests need)"; later: "already built". One wording with Decisions row 1 and Today's engine row 10. | DECISIONS "Corrections ..."; hardening plan pin P1 |
| Design | 10 | Applied | The sentence about the protocol round coming early is gone from what the panel brings. | The protocol section keeps it |
| Design | 11 | Applied | The Director Console sentence is gone from the copies decision. | The after-game boundary keeps it |
| Design | 12 | Applied | Header: "The earlier candidate, seventeen parts drawn bottom-up from today's engine, is at the end." | Check's wording |
| Design | 13 | Applied | "Then come the later choices that still stand." | Check's wording |
| Design | 14 | Applied | Header: "Before the panel runs, its brief is here for you to approve, with three questions on the Decisions page." | Panel brief |
| Design | 15 | Applied | The nine questions' titles are quoted in mid-sentence; "The quality target A tablet reconnects ..." gains its noun. | Check's wording |
| Design | 16 | Applied | "applying a change while the engine runs, between games". | Jargon table row 16 |
| Design | 17 | Applied | "the proposed seventeenth design flaw, ...". | Check's wording |
| Design | 18 | Applied | "both need copies of the engine that stay separate." | Check's wording |
| Design | 19 | Applied | The goal now carries your words. | Panel brief, "The blind round" |
| Design | 20 | Applied | The setting gains the brief's missing facts: the engine drives the outside programs; the TV over HDMI; GM tablets are Android tablets in Chrome, for staff only, sometimes offline; the hardware scanners' NFC reader, small screen, SD card and Wi-Fi, firmware by cable; Notion exported into the pack; every piece easy for an agent to read and change safely. | Panel brief, "The setting, as facts" |
| Design | 21 | Applied | "several million tokens of AI use, about as much as one of the larger runs that built this site". | Check's wording |
| Design | 22 | Applied | The six links read "The earlier candidate compares both." | `build_site.py` `page_design()` |
| Design | 23 | Applied | "the roadmap allows it only before a game starts or after it ends". | QT9 status; ROADMAP 2.4 |
| Design | 24 | Applied | Version 8's Parts introduction is back above "The seventeen parts", in the candidate's past tense, with the key to each card's rows; "Step 3 starts from this frame" left out. | Version 8 `parts.html` header; `build_site.py` `PARTS_KEY` |
| Design | 25 | Applied | "... and nothing in the tablet's code keeps the standalone choice in one place." | `2026-11-01-engine-shape.json` tangle 9 |
| Design | 26 | Applied | "runs the real engine with the real video, music, audio and lighting programs and stand-ins for the room's equipment", on Design and in the front page's words box ("The test rig"). The jargon table's row W2 carries the old wording; it is not mine to edit (note below). | Test level "real programs with stand-in hardware" |
| Today's engine | 1 | Applied | "The panel meets these situations only in its second round, as facts with no fix attached." | Panel brief, "The second round" |
| Today's engine | 2 | Applied | Said once, in the header, where blue is first named: "Blue, the show machine in use now, runs every show until the new engine is ready. Its fixes, and the problems found in it and left unfixed, are evidence ...". The blue item left "The pieces already well built". | DECISIONS "Blue's fixes are evidence of design causes" |
| Today's engine | 3 | Applied | The repeating lead-in is replaced by the card guide (row 4). | Header text |
| Today's engine | 4 | Applied | A card guide before the table says what each part of a card is: the moment and its cause, the drawing, the architecture pass's own questions (not those on Decisions), "In design terms" in the words on The engine page (linked), and that "The problems behind it" lists a few. | Version 8's Design flaws intro |
| Today's engine | 5 | Applied | "In design terms" moved inside the fold "How the earlier candidate would remove it", after the parts row. | `build_site.py` `card_html()` |
| Today's engine | 6 | Applied | Wherever Joins and proofs is named it now says "since replaced by the published protocol and the test bench outside the engine": a linked note under every parts row that names it (`part_row()`), the cards' design terms and folded notes, and the standalone line, with the two links. | DECISIONS "One published protocol and an outside test bench" |
| Today's engine | 7 | Applied | "(your open question One GM tablet per standalone game?)", linked. | `q_a()` change |
| Today's engine | 8 | Applied | Tag "Waiting for your answer"; "is part of your question The venue promise names declared standalone." | Same; question G |
| Today's engine | 9 | Applied | "It is your open question Record every refused GM scan attempt? on Decisions." | Same; question O |
| Today's engine | 10 | Applied | "Three pieces finished in the hardening block, the roadmap's work to make the show machine safer, stay in the engine ...: the list of kinds of equipment a pack says it needs, the code that marks equipment not installed tonight, and the smallest test set-up". | DECISIONS "Corrections ..."; ROADMAP section 4 |
| Today's engine | 11 | Applied | "Four kinds of automated test, from small tests of single pieces of code to full run-through tests of the whole system in a browser; ...". | Check's wording |
| Today's engine | 12 | Applied | "In the earlier candidate ..." on all five lines, and on the game-boundary card's line ("In the candidate"). | Plan v2 3.4 |
| Today's engine | 13 | Applied | The folded notes' "Or:" now reads "The other way the earlier candidate weighed:" (one prefix in `card_html()`; the fourteen notes keep their data). | `2026-10-31-cause-cards.json` notes |
| Today's engine | 14 | Applied | "five pieces of tablet code reshape ..."; "the clock's piece loses ..."; the drawing's box likewise. | Card "Reconnect snapshot and live update are built apart" |
| Today's engine | 15 | Applied | "the tablet's store of game data", "Its part for networked games", "a value the tablet's store of game data never passes on"; the green-test-run card's drawing likewise ("Real tablet store of game data"). | Cards "Names joining two places are kept by hand", "A green test run proves nothing about the show" |
| Today's engine | 16 | Applied | The Row column is gone from the comparison table. | `build_site.py` `parity_html()` |
| Today's engine | 17 | Applied | "Wi-Fi" throughout; "skips Wi-Fi and the check-in with the engine"; "Required by the settings check, which does not stop start-up; whatever value was read, or nothing, is written on each queued scan"; "Double-tap, after a 1-second opening screen"; "Read which pack it is from a file on the card ..."; header "(a proposal, not decided)". | `build_site.py` `PARITY_PREFIX`, `PARITY_WORDS` |
| Today's engine | 18 | Applied | "(fixed on 2026-10-30, with three small fixes for green, the new show machine)"; "red "Disconnected" label". The jargon table's row F158 keeps the old wording (note below). | DECISIONS "Green's follow-ups ...", merged 2026-10-30 |
| Today's engine | 19 | Applied | Footer: "(2026-11-01; the sale and adjustment times printed hours apart)". | After-game survey |
| Today's engine | 20 | Applied | "In today's code ..." twice. | Card "Engine and tests both assume they own the machine" |
| Today's engine | 21 | Applied | "Nothing here is the reason for a design."; "problems"; the closing sentence as the check gives it; "the earlier candidate" linked to Design. | Check's wording |
| Today's engine | 22 | Applied | The glance table follows the cards' order, grouped by the promise each mainly touches; the proposed seventeenth stays last. | `build_site.py` `page_today()` |
| Change log | 1 | Applied | "a letter, A to R, ... in six groups"; "Six new questions: three ask ...; three ask about the panel's brief: ...". The sequence row says "A to R". | `v9/decisions.json`; commit `ea210eb3` |
| Change log | 2 | Applied | Version 9's fifth item gains the panel's brief, with both decisions linked, and that lists are unnumbered; the prompt gains the owner's word that the panel's context is critical. | DECISIONS "Independent architects propose the top-level design" |
| Change log | 3 | Applied | The withdrawn question's row keeps its substance: asked 2026-10-30 as "How many problems should the test rig prove before design starts?", the rig, the four reproductions, the six seen live and two in a test, the recommendation (16 runs), and why it was withdrawn on 2026-11-01. | Version 8 `decisions.html`, question 21; DECISIONS "Build the test rig when building starts" |
| Change log | 4 | Applied | Heading "Recommendations the earlier candidate changed". | Intro; Decisions tag |
| Change log | 5 | Applied | "most of them when you settled the words in (link)". | Check's wording |
| Change log | 6 | Applied | The intro says the rule once and names the three tables by their headings, linked; version 9's sixth item says "the review that named the design flaws". | Built headings |
| Change log | 7 | Applied | Each promise note names its question by title, with the old letter where the sentence is history ("then question A; now Two clauses added to the pack promise"); the same for D/H, B/F, E/I, C/G and F/J. | Letter mapping in version 9's fourth item |
| Change log | 8 | Applied | The nine rows read "(link), under What the engine must do". | DECISIONS table |
| Change log | 9 | Applied | "the plan for the architecture pass (its name, the program document, stays in the decision title ...)"; the Decisions entry follows ("the plan for the architecture pass"). | DECISIONS "The owner ratified the program document" |
| Change log | 10 | Applied | Both rows: "the review that named the design flaws, done and now evidence and test situations; ...". | Jargon row for "the cause analysis" |
| Change log | 11 | Applied | The six rows say "defined in the words list on The engine" (linked to its words box). | Built `index.html#words` |
| Change log | 12 | Applied | "Test situations ..." as the check gives it; "Where today's engine falls short" has its own line; the "design choice" clause is dropped (the jargon table holds it). | Version 8 Promises page; DECISIONS "Blue's fixes ..." |
| Change log | 13 | Applied | Phase 3, Phase 4 and Phase 5 each mapped in one clause. | ROADMAP section 3, "Where done lives"; Appendix A |
| Change log | 14 | Applied | Rungs 0 to 3 and stages A to C each paired with their level. | CONTEXT.md environment ladder; ROADMAP Appendix A |
| Change log | 15 | Applied | The six block rows each gain one clause saying what the block is. | ROADMAP section 4 |
| Change log | 16 | Applied | New row: "Round one, round two (the panel's brief, until 2026-11-01)" now "the blind round; the second round". | Panel brief; commit `ea210eb3` |
| Change log | 17 | Applied | "... and where the engine's work ends after the game: it writes the night's record, and the after-game article comes from a separate program that reads it (link)". | DECISIONS "The night's record and the after-game article" |
| Change log | 18 | Applied | "the 35 findings of the review of standalone games are counted as ...". | Check's wording |
| Change log | 19 | Applied | The footer adds the roadmap, the plan for the architecture pass, the quality targets and extension cases, and the panel's brief. | Plan v1 section 2 |
| Change log | 20 | Applied | "\"version 7, the earlier one-page report\" on Decisions, unchanged on this page, which lists the versions; \"the owner page\" is now \"this report\"". | Jargon table row 32 |

## Rejections

None. Three conflicts were applied in a form that differs from the check's wording, each for the reason in its row:
the engine row 7 (meanings in the words box, with show-ready explained at first use and the timeline pointing to
The words, because inline meanings for every block took the front page past the builder's hard word limit),
the engine row 19 (the picture names the TV's browser; the key's program list was dropped rather than extended,
for the same limit), and Decisions row 10 (three groups, so the letters stay in order).

## Notes for files I may not edit

- `checks/jargon-table.md` row W2 still has "real video, music, audio and lighting stand-ins" (Design row 26), and
  row F158 still has "fixed in this work's first follow-ups on green" (Today's engine row 18). Both pages now use the
  corrected wording; the table should follow.
- `v9/decisions-log.md` stops at question O; questions P, Q and R come from the panel's brief and have no logged
  source (Decisions check, notes for other pages).
- `v9/build-log.md` still gives the front page's sentence count as 2,614; after this pass it is 2,623, the same as
  before the pass (under the builder's hard limit of 2,625, a little over the plan's "about 2,500").
- The decision record's "Corrections to the readers and the hardening pieces" and CURRENT-STATE section 5 still use
  "the dormancy core" and "the harness minimum"; the site now uses plain words for both.

## Build and smoke test

- Build: `MERMAID_JS=... python3 -I build_site.py`: "checks passed: 1532 links resolve; markers, ids, entries,
  titles, diagrams and words as the plan asks". One warning, as before this pass: the front page's sentences are
  2,623 words, a little over 2,500 (the hard limit is 2,625).
- Smoke test: `node site_smoke.js .../site .../site-shots-v9`: "smoke passed: 24 loads, 24 screenshots", every load
  with 0 errors and no sideways scroll at 1100 or 400 pixels, light and dark.
- The world picture was also looked at on its own at 1100 and 400 pixels after the change: the stranger's stopped
  line, the operator's arrow into the pack, the developer's tests into Messages and the code arrow round the
  protocol all read clearly, with no overlap.
