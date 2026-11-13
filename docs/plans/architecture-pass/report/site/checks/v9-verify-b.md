# Version 9 verify (B): Requirements, Design and Today's engine after the edits

Verified 2026-11-01, refute by default. I read the three rebuilt pages whole as text, with diagram labels kept, against
the three page checks (`v9-page-requirements.md`, `v9-page-design.md`, `v9-page-today.md`), the editor's log
(`v9-apply-log.md`), `git diff ea210eb3 -- docs/plans/architecture-pass/`, and the sources each row names
(`DECISIONS.md`, the requirements files, `2026-10-31-engine-jobs.json`, `2026-10-31-standalone-lines.json`,
`2026-10-31-cause-cards.json`, `2026-11-01-engine-shape.json`, the panel's brief, `ROADMAP.md`, the jargon table).
I also compared each page with its text at `ea210eb3`. I edited nothing except this file.

**68 rows: 60 resolved, 8 partly, 0 unresolved. The editor rejected none, so no rejection reason needed checking.
9 new conflicts: 2 come from the edits, and 7 were missed by the checks and still break the rules.**

## Verdicts

### Requirements (`requirements.html`): 15 resolved, 5 partly

| Row | Verdict | What the rebuilt page shows |
|---|---|---|
| 1 | Resolved | No question letter. Lead-in: "Decisions lists them in one place, under the question Do the quality targets say how well the engine must work?"; under each of the 14 numbers: "Listed with the other numbers to set on Decisions". |
| 2 | Resolved | All ten "In a standalone game" lines describe today only. The earlier candidate's sentences moved to `standaloneCandidate` and now sit in Design's fold under "In a standalone game, promise by promise", each starting "In the earlier candidate". |
| 3 | Resolved | The eight goals no longer use the candidate's parts: "the game's record carries it", "each decided in one place", "One set of steps moves a game", "The design tool talks to the engine only by sending it requests", "Every action is checked once against what its pass allows", "A check at start compares what each machine carries with its written list", "One answer (healthy, down or not installed tonight)". The "door" metaphor is gone. |
| 4 | Resolved | The four needs drop the candidate's answers. "Where the setting lives is left to the design rounds" appears once, under the room promise. |
| 5 | Partly | Both meanings are back: the promises are open, and the test summary names the pass's nine questions, not the questions on Decisions. The new sentence is broken, though: "The promises themselves are open too: Are these the right ten promises? , and the wording questions Two clauses added to the pack promise ; ... ; Which promise carries equipment state on screens? , wait for you on Decisions ." The list has no working verb, and question marks run into semicolons. "the test summary names which of the nine questions the architecture pass asks of the whole engine the promise answers" is a garden-path clause. Suggested wording: "The promises are open too. On Decisions you are asked whether these are the right ten, and seven questions on their wording: (titles). The test summary names which of the architecture pass's nine questions the promise answers. The pass asks those of the whole engine; they are not the questions on Decisions." Change in `v9/front.json` `intros.requirements[1]`. |
| 6 | Resolved | "Mainly None yet: its planned capabilities are not built." |
| 7 | Resolved | QT39's situation ends "if you confirm that reading (your open question The hardware scanner's standalone mode)". The status lists that reading as open and still waiting for the owner's word, which matches DECISIONS "Standalone games: declared, never mixed". |
| 8 | Resolved | "A refused scan never reads as complete" is now Partly settled (your word for the standalone case, the rest proposed). "A test run cannot touch the live show" is now Proposed, and its status says the growth rule covers kits and packs, not test runs. |
| 9 | Resolved | "the two clocks join the flaw "Tablets and phones decide facts the engine owns" as a finding". |
| 10 | Resolved | EX12 uses the record's words: "recorded as a parity gap, on the owner's rule that the two player scanners keep feature parity". Where the declaration lives is "a question for the design rounds", and the tablet count is the open question by title. Goes through: "(the design rounds choose where)". The Designers line names the design round on where authority lives. |
| 11 | Partly | The lowercase "number to set" sentences are gone, and EX10 names the target. The new sentence reads broken, because the title sits bare in the middle: "How many phones one kit carries at once is the number Phone capacity is measured before the first phone leaves for you to set." Suggested wording: "How many phones one kit carries at once is a number you set, under the quality target 'Phone capacity is measured before the first phone'." Change in `extension-cases.json` EX10 `case`. |
| 12 | Resolved | All three wordings are in place. The same target's status still says "its witness lights entry" (see row 14). |
| 13 | Partly | One intro sentence now explains hardening, capture, preview, depth-and-close, operations era and release, previewable and adoptable, and "deferral registry" and "readiness ladder" are gone. The page still uses "show-ready" without saying what it means: "until the show-ready decision" in "Replugging the old machine undoes a release". Add "show-ready (the state where swapping the new machine in for a show becomes your live choice)" to the intro's list in `front.json` `intros.requirements[2]`, or say it in QT42 `status`. |
| 14 | Partly | The ten names the check listed are replaced. Other internal entry names are still in the statuses: "(its Capability entry)" in QT21, "(the Capability entry)" in EX4, "(the strings sidecar entry)" in EX7, "its Supervisor entry" in EX15 (jargon row 46), "(the environment ladder) and its witness lights entry" in QT25 (jargon row I40), "(the Deploy entry)" in EX13, "glossary, 'surface', its word for a kind of screen" in EX9, "'mode', the pack mode entry" in EX3, "the device's own type word is retired" in QT22, and "owner-fixed" in QT31. Suggested wordings: drop the parenthesized internal names; "its entry on stand-in lights"; "the device's own word for what kind of device it is no longer counts"; "fixed by the owner". Change in the `status` field of each of those requirement entries. |
| 15 | Resolved | The five "test case for this target, not its reason" clauses now state the example plainly. "A question asks; it does not settle" is gone from the statuses and is said once in the intro. |
| 16 | Partly | The tag no longer repeats in the sentence, but `status_grounds` brought in three new faults. "Settled On: ..." reads like "settled on (a date)". QT34 reads "Your word in direction (...)", which is not English. And many statuses mix "you" with "the owner": "Your word in part (the owner's decision ...)", "(the owner's open question ...)". Suggested fixes: "Rests on:" in place of "On:"; "Your word on the direction"; "your decision" and "your open question" throughout the status sentences. Change in `build_site.py` `status_grounds()`, QT34 `status`, and the status texts. |
| 17 | Resolved | QT22: "a general way to add new kinds of display is room left beyond the constellation screen, with no slot yet". |
| 18 | Resolved | Footer: "the list of planned capabilities drawn from the roadmap you approved". The Design page still says "you approved" (new conflict C). |
| 19 | Resolved | The rules intro says it once. |
| 20 | Resolved | The intro names "what it goes through, what it must not need" and lists all three kinds, "settled, partly settled or proposed". |

### Design (`design.html`): 25 resolved, 1 partly

| Row | Verdict | What the rebuilt page shows |
|---|---|---|
| 1 | Resolved | "Three of your open questions feed this round: The hardware scanner's standalone mode; One GM tablet per standalone game?; Exposed evidence and video with no engine." |
| 2 | Partly | The questions are now named by title. The check's own wording, applied as given, now restates them right after their titles: "Two of your questions, Two clauses added to the pack promise and Keep the venue promise whole? , touch the clauses added to the pack promise and whether the venue promise stays whole". Suggested wording: "Two of your questions bear on it: Two clauses added to the pack promise, and Keep the venue promise whole?; the panel designs against the promises as you confirm them." Change in `design.json` `ahead[3].settled`. |
| 3 | Resolved | The brief's intro and the three notes say "your question (title)". |
| 4 | Resolved | "Where settings that belong to no game live, ...: in the venue profile or in a file of their own." |
| 5 | Resolved | It names all three ways and says "Either way the build half starts with a thin first version of the new design." |
| 6 | Resolved | The example of numbered facts is gone from the state decision. It remains in the protocol's explanation under Decided directions, which the check accepted. |
| 7 | Resolved | "Each scan counts exactly once" is now among the drivers of the state and protocol decisions. |
| 8 | Resolved | "Every request is checked against its pass" is now among the drivers of the protocol and authority decisions. |
| 9 | Resolved | The pieces are in plain words at first use, and the second use says "already built". The wording differs from Today's engine and Decisions, although the log says all three match (new conflict B). |
| 10 | Resolved | The sentence about coming early is gone from what the panel brings. |
| 11 | Resolved | The Director Console sentence is gone from the copies decision. |
| 12 | Resolved | Header: "The earlier candidate, seventeen parts drawn bottom-up from today's engine, is at the end." |
| 13 | Resolved | "Then come the later choices that still stand." |
| 14 | Resolved | "Before the panel runs, its brief is here for you to approve, with three questions on the Decisions page." |
| 15 | Resolved | The nine questions' titles are quoted, and "The quality target A tablet reconnects ..." now has its noun. One more bare title remains, in the after-game boundary (new conflict E). |
| 16 | Resolved | "applying a change while the engine runs, between games". |
| 17 | Resolved | "the proposed seventeenth design flaw, Nothing declares a game standalone". |
| 18 | Resolved | "both need copies of the engine that stay separate." The same idiom survives on Requirements (new conflict G). |
| 19 | Resolved | "The goal. In your words: "design a long-term optimal architecture ..."", word for word from the brief. |
| 20 | Resolved | The setting now carries the brief's facts: HDMI, the engine driving the programs, Android tablets in Chrome, the scanner hardware, Notion exported into the pack, and agent safety. Two small parts are still left out: "running Raspberry Pi OS", and that the owner designs the games and runs the shows. |
| 21 | Resolved | "several million tokens of AI use, about as much as one of the larger runs that built this site". |
| 22 | Resolved | "The earlier candidate compares both." |
| 23 | Resolved | "the roadmap allows it only before a game starts or after it ends". |
| 24 | Resolved | The Parts introduction is back above "The seventeen parts", in the past tense of the candidate, with the key to each card's rows. "Step 3" is gone. |
| 25 | Resolved | "...and nothing in the tablet's code keeps the standalone choice in one place." |
| 26 | Resolved | "with the real video, music, audio and lighting programs and stand-ins for the room's equipment". |

### Today's engine (`today.html`): 20 resolved, 2 partly

| Row | Verdict | What the rebuilt page shows |
|---|---|---|
| 1 | Resolved | "The panel meets these situations only in its second round, as facts with no fix attached." This matches the brief. |
| 2 | Resolved | It is said once, where blue is first named, with the link. The blue item is gone from "The pieces already well built". |
| 3 | Resolved | The repeating lead-in is gone. |
| 4 | Resolved | A card guide comes before the table. It says the head names the pass's nine questions, not those on Decisions, and links "In design terms" to the words on The engine page. |
| 5 | Resolved | "In design terms" sits inside the fold, after the parts row, on all sixteen cards. |
| 6 | Partly | Each mention of Joins and proofs is now marked as replaced. The new note is ungrammatical, though: "Joins and proofs is since replaced by the published protocol and the test bench outside the engine." It should read "has since been replaced" (`build_site.py` line 815, the `replaced muted` note). The mark also repeats. On "Names joining two places are kept by hand" it appears four times: in the standalone line, the folded note, the parts-row note and "In design terms". It appears twice on each of the other two cards. Keep the parts-row note and drop the parenthetical from `cause-cards.json` C14 and C16 `after.note` and `designTerms`. The diagram labels still say "Joins and proofs" with no mark; the note under each drawing covers that. |
| 7 | Resolved | "(your open question One GM tablet per standalone game?)", linked. |
| 8 | Resolved | The tag is "Waiting for your answer", and the sentence uses the question's title. |
| 9 | Resolved | "It is your open question Record every refused GM scan attempt? on Decisions." |
| 10 | Resolved | It says what the hardening block is and names the three pieces in plain words. The wording does not match Design or Decisions (new conflict B). |
| 11 | Resolved | "Four kinds of automated test, from small tests of single pieces of code to full run-through tests ...". |
| 12 | Partly | The five "candidate shape" lines now say "In the earlier candidate". Eight standalone lines still say "In the candidate": C3, C5, C6, C7, C8, C12, C13 and C16 in `2026-10-31-standalone-lines.json`. Examples: "In the candidate each device shows its pack version ..." on "Pack edits reach each copy of the pack differently", and "In the candidate one set of tests covers both ..." on "A green test run proves nothing about the show". The check's reason covers them all: plan v2 names it "the earlier candidate" outside the change log. |
| 13 | Resolved | "The other way the earlier candidate weighed:" comes before each alternative. |
| 14 | Resolved | "Five pieces of tablet code reshape before drawing"; "the clock's piece loses the values it does not name". |
| 15 | Resolved | "the tablet's store of game data", "Its part for networked games", "Real tablet store of game data". |
| 16 | Resolved | The Row column is gone. |
| 17 | Resolved | All five cell and header wordings are in place, with "Wi-Fi" spelled one way throughout. |
| 18 | Resolved | "(fixed on 2026-10-30, with three small fixes for green, the new show machine)"; "red "Disconnected" label". The jargon table's row F158 still has the old wording, as the log notes. |
| 19 | Resolved | Footer: "the sale and adjustment times printed hours apart". |
| 20 | Resolved | "In today's code" appears twice. |
| 21 | Resolved | "Nothing here is the reason for a design."; "problems"; the new closing sentence; "the earlier candidate" links to `design.html#earlier`. |
| 22 | Resolved | The glance table now follows the cards' order, grouped by the promise each mainly touches, with the proposed seventeenth last. |

## New conflicts

| # | Origin | Where | What it says | What it should say | Place to change it |
|---|---|---|---|---|---|
| A | From the edits (the row 12 edit rewrote one of these sentences and kept the word) | Today's engine, the standalone lines on "Service health and service state travel on separate paths" and "Engine trusts its stale picture of outside programs" | "the tablet's Equipment stand-in reports every duty as not installed tonight" (twice) | "every service the engine runs (video, music, lights) as not installed tonight" (jargon wording 45, already used on Requirements) | `2026-10-31-standalone-lines.json` `lines.C2`, `lines.C3` |
| B | From the edits | Today's engine, The pieces already well built; Design, the extend and move decisions; Requirements, the intro's list of block names | Three wordings of the same three pieces: "the list of kinds of equipment a pack says it needs ... the smallest test set-up" (Today), "the kinds of equipment a pack can ask for and a venue profile can name ... the smallest set-up the tests need" (Design), and the Decisions entry's mix of the two. The hardening block also gets three meanings: "the roadmap's work to make the show machine safer" (Today), "the work that makes the show machine run without a technician" (Requirements), "the engine checks itself and restarts what crashes" (The engine's words). The editor's log says the pages now share "one wording"; they do not. | One wording on every page, for example the Decisions entry's "the kinds of equipment a pack can ask for and a venue profile can name, the code that marks equipment not installed tonight, the smallest test set-up". One meaning for the block, the words box's (ROADMAP Block 2: the engine checks itself and restarts what crashes). | `build_site.py` `WELL_BUILT[0]`; `design.json` `ahead[3].settled`; `front.json` `intros.requirements[2]` |
| C | Missed by the check; now contradicts the corrected Requirements footer | Design, Later choices, the start-or-use setting | "or in a file of its own, as the list of planned capabilities you approved has it" | "as the list of planned capabilities drawn from the roadmap has it". Requirements row 18 found that no source records you approving that list. | `design.json` `later[9].text` |
| D | Missed by the check; now contradicts Requirements and The engine after their edits | Design, the earlier candidate: the quality "Who decides when there is no engine", and the Venue fit card | "with the declaration held wherever the owner places it"; "and, if the owner places it here, the declared fact that a game runs with no engine" | The record says where the declaration is held "is a question for the design rounds". Write "wherever the design rounds place it" and "if the design rounds place it here". | `2026-11-01-engine-shape.json`, the quality "Who decides when there is no engine" `plain`, and `parts[id=P12].plain` |
| E | Missed by the check | Design, Decided directions, The after-game boundary, sentence 2 | "The second half of Every tap gets its answer, and the night can be told afterwards names the director and the players after the show." | A bare title in the middle of a sentence, the pattern Design row 15 fixed elsewhere. Write "The second half of the promise 'Every tap gets its answer, and the night can be told afterwards' names the director and the players after the show." | `design.json` `decided[3].paragraphs` |
| F | Missed by the check | Design, the earlier candidate, the Joins and proofs card | "Replaced by the published protocol and the test bench: the published protocol , the test bench outside the engine ." | The sentence repeats itself through its link list. Write "Replaced by the published protocol and the test bench outside the engine.", with each name linked. | `build_site.py` line 1957 (the `replaced` paragraph in the part card) |
| G | Missed by the check (Design row 18 fixed the same idiom) | Requirements, "Running copies of the engine stay separate", Why it matters | "all need the same thing, one copy that keeps to itself" | "all need the same thing: a copy of the engine that stays separate from the others" | `quality-targets.json` QT43 `why` |
| H | Missed by the check | Requirements, extension case "A different content tool feeds the same pack" | "A designer writes their game's corpus in a different tool" | "A designer writes their game's content in a different tool" | `extension-cases.json` EX18 `case` |
| I | Missed by the check | Requirements, "One game, the same on every screen", In a standalone game | "two tablets are two games, one per game undecided" | A fragment the owner cannot parse. Write "two tablets are two separate games; whether a game may have only one tablet is your open question One GM tablet per standalone game?" | `2026-10-31-engine-jobs.json` `jobs[J2].standalone` |

Note for a page that is not mine: on Decisions, question "One GM tablet per standalone game?" still says that EX12 "carries the number of GM tablets one standalone game may run as a number to set". Since Requirements row 10, EX12 calls the count an open question, not a number to set (`v9/decisions.json` question M `evidence[0]`).

## What I found right

- **Frame.** All three pages carry plan v2's status line and the six-page navigation. The rebuilt text has no visible promise, flaw, finding, target, case, decision or question id, no question letter, no bare phase, step, block, round, decision or question number, no em dash, and no "orchestrator". "The agent running the pass", "the blind round" and "the second round" are used throughout. No list of decisions, steps or choices is numbered.
- **The proactive frame.** Requirements no longer carries any of the earlier candidate's answers: goals, needs and standalone lines are all clean, and the candidate's sentences now sit in Design's fold, labelled "In the earlier candidate". Every "In design terms" on Today's engine is inside the fold marked "Candidate, not decided". The Design header and fold call the candidate one input among the panel's.
- **Facts against sources.** QT7, QT27 and QT39 now have the right status kinds. The standalone decision, the night's record decision, the panel brief's goal, setting and three options, and the roadmap's deferred-work rows match their sources word for word where quoted. DECISIONS confirms "Standalone games: declared, never mixed", including that where the declaration is held is a question for the design rounds, and the requirements pages now agree.
- **Nothing lost.** Version 8's Parts introduction is back on Design. The card guide restores version 8's explanation of a card on Today's engine. "Mainly: None yet" is back on Requirements. Comparing each page with its text at `ea210eb3` shows only the changes the checks asked for, the new sentences above, and the moved candidate lines.
- **Data unchanged where it should be.** The glance counts, problem counts (337 under the sixteen, 21 set aside, 35 from the standalone review), the 24-row comparison table and the code grid are as the checks found them. The glance table now follows the cards' order.
