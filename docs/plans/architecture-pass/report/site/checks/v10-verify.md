# Verify: the apply round of version 10's four checks (2026-11-02)

Written 2026-11-02 for the agent running the pass. This is a working file, so it calls the owner "the owner". Scope: every row of `v10-check-decisions.md` (36), `v10-check-requirements.md` (38), `v10-check-design-front-changes.md` (25) and `v10-check-today-data.md` (25), as `v10-apply-log.md` records them, read where each lands on the rebuilt pages; then every line the apply round changed, read as it now stands on its page. Refute by default. Nothing was edited; `DECISIONS.md` was not touched.

How the changed lines were found: the checkers' text dumps of the pre-apply pages (the session scratchpad, `c/*.txt` and `req.txt`, taken 03:10 to 03:22, before the apply round at 03:45 to 03:56) were diffed against the current pages rendered with the same converters. That isolates the apply round's changes from the earlier version 10 build: 240 diff lines on Decisions, 360 on Requirements, 72 on Design, 60 on The engine, 80 on the change log, 98 on Today's engine. Changes that render nowhere (J4 and J8 `roles`, the cases' `intro`, the markdown twin, the panel brief) were read in the files. Code facts the changed lines state were checked against `backend/src/websocket/gmAuth.js`, `backend/src/utils/processMonitor.js`, `backend/src/services/vlcMprisService.js` and `ALNScanner/src/app/domains/gameOps.js` and `index.html`. A rebuild from the current sources in a scratch copy (with the mermaid build the workflow uses) passes the builder's checks and reproduces all six pages byte for byte.

Counts: 124 rows. 122 resolved, 2 partly (both waiting on `DECISIONS.md`, reason holds), 0 unresolved. 7 slips.

---

## Verdicts

### v10-check-decisions.md

| Row | Verdict | Where it lands now |
|---|---|---|
| Facts 1 | Resolved (slip 5) | H, first item: the default is the agent's call by title, linked, "and the record lists it there". Its last sentence lost its antecedent (slip 5). |
| Facts 2 | Resolved | G, first item: the reading, the history question “One GM tablet per standalone game?”, and the open list naming it in full. |
| Facts 3 | Resolved | B, "At a show": red Disconnected, "rescan later, which cannot work", phones say offline. |
| Facts 4 | Resolved | Call retitled "The tap promise is to be split in two", saying when; the letters row follows. Requirements still shows one promise; counts of ten stand. |
| Facts 5 | Resolved | I, third option's cost separates typed codes from camera reading. |
| Facts 6 | Resolved | E recommendation: "without rebuilding; the places cost their versions and their tests from the first release". |
| Facts 7 | Resolved | D, designer item and recommendation say EX22 is due with players' phones and "fits in tables once the pack says". |
| Facts 8 | Resolved | C: "uses it only to label the station in its list" (matches `gmAuth.js` line 69). |
| Facts 9 | Partly, for the lead; reason holds | Page keeps "after you review"; the record still says "confirms". This run may not edit `DECISIONS.md`. |
| Meaning 1 | Resolved | The promise named by title (linked), "the promise that the night can be told afterwards", and parity named as the standing rule, in the intro, the closing line, D's decides and the second group's intro. |
| Meaning 2 | Resolved | "already answer, some resting on your decisions and some on targets still marked proposed"; "the panel designs to them as they stand". |
| Meaning 3 | Resolved | G, "At a show" ends with both reasons. |
| Meaning 4 | Resolved (slip 1) | I has "For the GM at a failure". Its claim about today is wrong and its decision title is bare (slip 1). |
| Meaning 5 | Resolved | E's third option: means and cost now separate; the cost names the split. |
| Meaning 6 | Resolved | J: two readings withheld, named; the third accounted for. |
| Meaning 7 | Resolved | Decided "Two kinds of game extension" keeps "should probably" and "probably". |
| Voice 1 | Resolved | F: "The record's own sources say different things". |
| Voice 2 | Resolved | Calls lead-in: "By your ruling these choices are the agent's to make". |
| Jargon 1 | Resolved | F names the decision ahead “How one engine runs as many separate copies” (a real title on Design); Sources item likewise. |
| Jargon 2 | Resolved | Hardware intro and the refused-scan call say "how long records are kept"; QT30 status too. |
| Jargon 3 | Resolved | "the standalone phone page's own copy of the pack (which changes only when the page is republished)". |
| Jargon 4 | Resolved | "a way to keep a script from harming the show or the kit". |
| Jargon 5 | Resolved | "call the point of the engine work". |
| Jargon 6 | Resolved | "facing inward" gone; "splits the platform's users". |
| Jargon 7 | Resolved | "the heat it can shed". |
| Jargon 8 | Resolved | "readiness state" gone from this page. |
| Jargon 9 | Resolved | "the panel's architect for growth and extension". |
| Rendering 1 | Resolved | No status tag on Decisions (`class="stag"` count 0). |
| Rendering 2 | Resolved | "What it means in practice" on all ten. |
| Rule breaks 1 | Resolved | All seven code names gone from the lines; the two record titles stay, as the row itself left them to the lead. |
| Rule breaks 2 | Resolved (slip 7) | B's ask is now three short answers; the first and third overlap (slip 7). |
| Rule breaks 3 | Resolved (slip 2) | The seven sentences are one; the new sentence drops the questions answered by decisions (slip 2). |
| Rule breaks 4 | Resolved | C's "Which decision ahead" no longer restates the protocol item. |
| Rule breaks 5 | Resolved | The hardware intro's second sentence is cut. |
| Rule breaks 6 | Resolved | “Coming in the design rounds” quoted. |

### v10-check-requirements.md

| Row | Verdict | Where it lands now |
|---|---|---|
| F1 | Resolved | J3 goal: "is a call of the agent running the pass, which the owner can overrule". |
| F2 | Resolved | J3 flaw line: "a separate call of the agent running the pass". |
| F3 | Resolved | QT5 tag "A technical default", matching the review. |
| F4 | Resolved | QT9 review line carries the small-pack reason. |
| F5 | Resolved | QT2, its review line and the call name the shared watcher, the video player's fixed three seconds and the TV's browser; the call lists "10, 20, 40, then 80" (matches `processMonitor.js` and `vlcMprisService.js` lines 120 to 121). |
| F6 | Resolved | EX26 case, goes-through and status split the owner's question from the design rounds'; the cases' intro (not rendered) says the same. |
| F7 | Resolved | "sorted in one list under the review". |
| F8 | Resolved | EX24: "a keeping period the engine imposes on every game that the production cannot change". |
| F9 | Resolved | Footer dates the 2026-11-02 revisions. |
| M1 | Resolved | Lead-in names the agent running the pass as the sorter, "for you to overrule"; the intro too. |
| M2 | Resolved | Growth lead-in defines both kinds and neither, links the decision, keeps the tentative words. |
| M3 | Resolved | EX2, EX5, EX7: "Neither kind: a designer's content or values inside the game, no new mechanic". |
| M4 | Resolved | EX14, EX17, EX19 each give their own reason. |
| M5 | Resolved | Designers' line: "A designer extends the platform through the pack". |
| M6 | Resolved | EX22 status marks the reading as the agent's. |
| M7 | Resolved | J8 parity line: abilities a developer adds have firmware; a mechanic made inside the game needs none. Markdown twin likewise. |
| M8 | Resolved | QT1 status cites "No technical failure stops a game". |
| M9 | Resolved | QT5 situation drops "offline"; status Partly settled with the decision named. |
| M10 | Resolved | QT38 names the re-declaration that would amend the decision, with the question linked. |
| M11 | Resolved | EX27 sorts the machine's limits as technical defaults. |
| M12 | Resolved | EX28 status names the owner's hardware question, linked. |
| M13 | Resolved | QT13 and QT34: "what the agent running the pass proposes as fixed for every production". |
| V1 | Resolved | "your secrets, pack or venue". |
| V2 | Resolved | EX21, EX16, EX23 say "the owner's"; EX15 "than ALN's". |
| P1 | Resolved | "grouped by who does the growing". |
| P2 | Resolved | Snapcast glossed. |
| P3 | Resolved | All five "fork"s are "a separate copy of the engine's code". |
| P4 | Resolved | EX28 and question I's decides say "hardware scanner". |
| P5 | Resolved | QT12: "no device needs new firmware". |
| R1 | Resolved | The sentence once in the lead-in; "All the sorts, on Decisions" fifteen times. |
| R2 | Resolved | "Forty-three quality targets under twelve qualities. Fifteen need a number."; "Twenty-eight extension cases". |
| R3 | Resolved | Nine question titles linked to `#q-a` to `#q-i`, title only, quotes outside the link; QT44 names its question. |
| R4 | Resolved | J6 standalone line in “ ”. |
| R5 | Resolved | No straight-single-quoted phrase left anywhere in the promise data (scripted: 0). |
| B1 | Resolved | J5 swap line. |
| B2 | Resolved | J10 swap line. |
| B3 | Resolved | J10 flaw line. |
| B4 | Resolved | QT42 status. |

### v10-check-design-front-changes.md

| Row | Verdict | Where it lands now |
|---|---|---|
| F1 | Resolved | Change log: "Most were not: four were yours, plus the business half". |
| F2 | Resolved | "What prompted it" rewritten, in "you", with the owner's words exact. |
| F3 | Resolved | Worded to match the Decisions intro ("already answer, some resting on ..."). |
| F4 | Resolved | All fifteen later choices identical on Decisions and Design (scripted). |
| F5 | Resolved | "the requirements allow it only before a game starts or after it ends", both pages. |
| F6 | Resolved (slip 3) | Design's "Two kinds of game extension" now puts the second question with the design round. The same page's "How games and venues extend the engine" still calls both the owner's (slip 3). |
| F7 | Resolved | "and how the second kind reaches a production". |
| F8 | Resolved | The engine, "What the engine is for": the record's bound and "where it draws that line is open". |
| M1 | Resolved | All four Design places say the agent confirms the reading as its call, on Decisions. |
| M2 | Resolved | Privacy line untangled. |
| M3 | Resolved | "says which requirements are fixed and what each production may set; ALN is one production". |
| M4 | Resolved | "where it draws that line is open, for the design rounds and the build plan". |
| M5 | Resolved | Design's panel section and the brief: two withheld, two reach the panel marked as the agent's; "What is withheld" points to them. |
| M6 | Resolved | The setting item ends with the rewording sentence. |
| M7 | Resolved | Letters row E names the second clause. |
| M8 | Resolved | The review's promise item names both additions. |
| M9 | Resolved | The three recommendations end with their call titles. |
| V1 | Resolved | In F2's text. |
| V2 | Resolved | "Its purpose, which you stated on 2026-11-02 ... other logistics make it better". |
| P1 | Resolved | "the test of your decision ..."; "shown with the target". |
| R1 | Resolved | Rows for old questions 17, 18 and 23 use “ ”. |
| R2 | Resolved | Every named marker quoted, outside the marker. |
| B1 | Resolved | Timeline item no longer names version 9's eighteen. |
| B2 | Resolved | No version 10 letter on the change log. |
| B3 | Resolved | Words box, the architecture pass, the readiness states and Design's last round have no code names; the gloss for the two record titles is added. |

### v10-check-today-data.md

| Row | Verdict | Where it lands now |
|---|---|---|
| F1 | Resolved (slip 4) | Purpose, the open question linked to `#q-g`, today's shape, no channel, nothing recorded. The purpose keeps the paraphrase V2 replaced elsewhere (slip 4). |
| F2 | Resolved | C3 standalone line names the call, "the owner can overrule it". |
| F3 | Resolved | Video-token cell names the call's default. |
| F4 | Resolved | "21 were set aside, each with its reason below". |
| F5 | Resolved | By decisions Facts 4. |
| M1 | Resolved | Heading, chip, the notes on Today and Requirements, and the evidence intro drop "proposed"; Design's panel line too. |
| M2 | Resolved | J3 need: "never stops the game". |
| M3 | Resolved | C4: "if the game has a tablet and they are joined to it". |
| M4 | Resolved | J8 `roles[1]` and the twin make the GM-less shape conditional on the owner. |
| M5 | Resolved | J1 parity item keeps the tentative words; twin likewise. |
| M6 | Resolved | J10 goal "relates to"; twin likewise. |
| M7 | Resolved | Parity note says the owner's words settle the hardware scanner's standalone mode. |
| M8 | Resolved | "the build half changes them only where a rule requires", on Today, Decisions and Design. |
| P1 | Resolved | Intro: "The show machine in use now runs every show". |
| P2 | Partly, for the lead; reason holds | The intro still links “Blue's fixes are evidence of design causes”; the page must show record titles until the record retitles. The words box now glosses it. |
| P3 to P7 | Resolved (five rows) | C2, C3, C8, C15, C16 have no code name in the changed fields; the C16 title stays, noted for the lead. |
| P8 | Resolved | J8 `roles[0]` and J4 `roles[2]`: "the venue technician". |
| R1 | Resolved | Seen-mark cell in “ ”. |
| R2 | Resolved | By requirements R4. |
| R3 | Resolved | Card guide and footer in “ ”. |
| B1 | Resolved | In F1's text. |

(P3 to P7 are five rows; the table counts 25.)

---

## Slips the apply round made

| # | Page, where | What it says | Why it is wrong | What it should say | Exact place to change |
|---|---|---|---|---|---|
| 1 | Decisions, question “Which hardware the first new engine requires, and what it must allow replacing”, "For the GM at a failure" (new item from Meaning 4) | "Today the spare must be another Android tablet with NFC, set up in advance. If the station may be any browser, the GM carries on from a laptop or a phone at hand, typing codes; that is one more fallback under No technical failure stops a game." | Wrong fact: today the GM app already runs without NFC. `ALNScanner/src/app/domains/gameOps.js` line 178 shows "NFC unavailable. Use Manual Entry." and `index.html` line 190 has the Manual Entry button; the same question's third option says "the GM app already has manual entry". Rule break: the decision title is dropped bare into the sentence. | "For the GM at a failure. A GM tablet dies mid-show. Today the kit's spare is another Android tablet set up in advance; the GM app also opens in another browser and takes typed codes through Manual Entry, but nothing promises or tests that. If the station may be any browser, carrying on from a laptop or a phone at hand, typing codes, becomes one more fallback under “[[dec:no-technical-failure-stops-a-game]]”." | `site/v9/decisions.json` `groups[2].questions[0].evidence[3]` |
| 2 | Decisions, page intro, first paragraph (Rule breaks 3) | "Two of version 9's eighteen questions are still yours, reworded below; the rest are now the readings of your words to confirm, the agent's calls to overrule and the requirements to review, under their own headings below" | Wrong fact. The change log's table sends two of the eighteen to “Standalone games: declared, never mixed” ("Answered by ..."), and none to a reading; the replaced text had "or answered by your decisions". | "Two of version 9's eighteen questions are still yours, reworded below; most of the rest are now the agent's calls to overrule or the requirements to review, under their own headings below, two were answered by your decisions, and the [[page:changes]] says where each of the eighteen went." | `site/v9/decisions.json` `intro[1]`, the last sentence |
| 3 | Design, "How games and venues extend the engine", "Already settled" | "Two of your questions stay open there: how an extension for all games relates to the engine's main release, and which piece each kind changes (the pack, the engine's code, an added outside service)." | The apply round moved "which piece each kind changes" to the design rounds everywhere else (F6 on Design's own "Two kinds of game extension", EX26's status, the cases' intro, The engine's "Decided lately") and edited this very field (M8, in passing), but left this sentence. The page now says both ways. | "Your question on how an extension for all games relates to the engine's main release stays open (“How an extension for all games reaches a production” on [[page:decisions]]); which piece each kind changes (the pack, the engine's code, an added outside service) is this round's to decide." | `site/v9/design.json` `ahead[3].settled`, the sentence starting "Two of your questions stay open there" |
| 4 | Today's engine, "Standalone today", first paragraph (F1) | "for a room where a network connection is not feasible or where only GM scanners, player scanners or both are wanted" | The design check's V2 replaced this paraphrase on The engine because it drops the owner's reason ("other logistics making it more preferable"); the apply round applied V2 there and wrote the dropped wording here, so the two pages give the purpose differently. The record (`DECISIONS.md` line 265) says "other logistics make it better to use only". | "for a room where a network connection is not feasible, or where other logistics make it better to use only GM scanners, player scanners or both" | `report/build_site.py` `STANDALONE_P1` (lines 1037 to 1040) |
| 5 | Decisions, question “What a standalone game gives up, and what it keeps”, first item (Facts 1) | "...is now the agent's call “Exposed evidence and video with no engine”, listed below, and the record lists it there; ... This question is the rule above that default." | "that default" has nothing to point to: the old text called it "a technical default the agent proposes"; the new one calls it a call. | "...is now the agent's call “[[call:exposed-evidence-and-video-with-no-engine]]”, a technical default listed below, and the record lists it there; [[qt:QT39]] marks open whether a standalone game's record holds what the players found at all. This question is the rule above that default." | `site/v9/decisions.json` `groups[1].questions[1].evidence[0]` |
| 6 | Design, "Where authority lives across devices, offline and standalone included", the panel paragraph (today M1, in passing) | "... The engine does not know who is connected and the seventeenth design flaw, from the review of standalone games, Nothing declares a game standalone." | The inserted clause leaves the flaw's title floating after a comma, and it now sits bare in the sentence (the rule asks for typographic quotes outside the marker). | "... [[flaw:C13]] and the seventeenth design flaw, “[[flaw:N1]]”, from the review of standalone games." | `site/v9/design.json` `ahead[2].panel` |
| 7 | Decisions, question “The show machine fails mid-game”, "What we need from you" (Rule breaks 2) | "which of the first four fallbacks the engine must offer (one or more); whether the TV may keep counting ... (yes or no); and whether a game may be re-declared standalone once (yes or no), which amends your decision ..." | The fourth fallback is "Declare the game standalone once, for the rest of the night", so the first ask already contains the third; picking it answers the yes or no twice. | "From you, in one line: which of the first three fallbacks the engine must offer (one or more); whether the fourth, re-declaring the game standalone once, may be offered as well (yes or no), which amends your decision on standalone games only if you say yes; and whether the TV may keep counting while the engine is silent (yes or no). What the players may lose follows from the fallback you pick; add to it only if you want more protected than their scans counted once." | `site/v9/decisions.json` `groups[0].questions[1].recommendation` |

---

## What I found right

- The apply log is accurate: every change it records is on its page, in the field it names, and nothing changed that it does not record (the diff of the pre-apply dumps against the pages has no unlogged line). Its nine variants keep the checks' meaning; the two "for the lead" rows are correctly held back, since this run may not edit `DECISIONS.md`.
- The rebuild reproduces all six pages exactly from the current sources and passes the builder's checks (2,623 words in sentences on The engine, under the 2,625 limit).
- The code facts the changed lines state hold: `gmAuth.js` names the station "GM Station v{version}" and stores the version; `processMonitor.js` defaults to 5 failures, 5,000 ms and a multiplier of 2 (waits of 10, 20, 40 and 80 seconds); `vlcMprisService.js` uses a fixed 3,000 ms; the GM app has Manual Entry and no camera code reader.
- The fifteen later choices are identical on Decisions and Design. The nine question links on Requirements land on `decisions.html#q-a` to `#q-i`. "All the sorts, on Decisions" appears fifteen times and the sorting sentence once. No status tag remains on Decisions, and "What it means in practice" heads all ten questions.
- No new code name: the only blue or green left on the pages are the two record titles, the flaw title "A green test run proves nothing about the show" (glossed in the words box), a health count's colour, and history on the change log. No em dash, no "orchestrator" for the lead agent, no visible id, no version 10 question letter outside Decisions.
- The voice holds: the overlays and builder texts say "you"; the shared texts the apply round touched (promise data, cases, situations, cards, the brief) say "the owner". No reading marked to be confirmed is shown as settled: J3's need, J8's roles and Design's four readings now say the agent confirms them as its call or keep them conditional on the owner.
- The owner's words are quoted exactly in the rewritten change-log prompt and the Decided lately line ("other logistics make it better" there is a marked paraphrase, not a quotation).
- The panel brief and Design's panel section now agree on what is withheld (two readings) and what reaches the panel marked as the agent's (the sorting, and the show-machine reading through QT44).
- For the lead, beyond the apply log's list: once `DECISIONS.md` retitles "Blue's fixes are evidence of design causes", the words box's added sentence on the two older titles should go with it.
