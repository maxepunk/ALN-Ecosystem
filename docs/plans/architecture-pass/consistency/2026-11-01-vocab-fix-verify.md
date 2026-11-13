# Verify check: the fixes for the 28 vocabulary conflicts

- **Date:** 2026-11-01. **Tree:** `/home/user/ALN-Ecosystem`, branch `claude/nice-curie-hescfv`, HEAD `6f3b384e`.
- **Read:** the rebuilt page as text (`docs/plans/architecture-pass/report/2026-10-31-cause-report.html`), and every string in `git diff 1585e5cc HEAD -- docs/plans/architecture-pass/report/`. The rendered text of the page at `1585e5cc` and at HEAD was also compared line by line, so every changed string a reader sees was read in place.
- **Rules:** decision 27 (`docs/plans/CURRENT-STATE.md` section 0), `CONTEXT.md` section 7 (promise, moment, part, quality, design flaw) and section 5 (venue technician), `docs/agents/process.md` sections 4 and 5.
- **Rows checked:** the 15 in `2026-11-01-vocab-check-top-fit-questions.md` (T1 to T15) and the 13 in `2026-11-01-vocab-check-promises-cards.md` (P1 to P13).
- **The published page is current.** Running `build_report.py` again changes nothing in the HTML, so the page is the builder's output.
- **Result:** 27 resolved, 1 partly resolved, 0 not resolved. The fixes add 5 new conflicts. Ten older wording problems, seen in passing, are listed at the end. They were not caused by the fixes and are not counted.

Abbreviations: `builder` is `docs/plans/architecture-pass/report/build_report.py`; `shape.json`, `jobs.json` and `cards.json` are `2026-11-01-engine-shape.json`, `2026-10-31-engine-jobs.json` and `2026-10-31-cause-cards.json` in the same folder.

## The 28 rows

| Row | The conflict | Verdict | The page now says |
|---|---|---|---|
| T1 | "Today Today" on 8 part cards | Resolved | "Today Nothing: sixteen fixed temporary names, two machine-wide kills, …"; "Today Nine holders, no message, …". No "Today Today" anywhere. A fresh rebuild gives the same HTML. All ten Today lines keep their full text; only the doubled word went. |
| T2 | Qualities row repeats "Today" and calls a quality "not a part but a setting" | Resolved | "Today: A tap on the tablet, a URL path on the phone, nothing on the hardware scanner, no field in the pack." The sentence "Not a part but a setting …" is gone. |
| T3 | Connections and roles: a sentence about the candidate under "Today" | Resolved | Description: "… A client's own word decides nothing. It also says who may move the game and command the room, and gives the design tool and a preview engine their own passes." Today: "Spread over six engine modules; … five clients each show their own word for whether the engine is there." |
| T4 | Shape intro claims every card has a Today line | Resolved | "In the candidate shape each such piece of work becomes one part, and that part's card says how the work is done today." Ten cards have a Today line; the seven without one take over no shared work. |
| T5 | "Keeps" reads as the full list but showed only 21 links | Partly resolved | Each card now reads "Mainly keeps" and "Also needed by". Game rules shows six promises again, as the map gives it, and the 17 cards show 78 links (the map's 77, plus "Anyone reading a screen can act on it without a second question" on Answering, from that promise's entry). The Lifecycle example the row cited still does not match: the summary says the table of moments is one "that every other promise reads", and the Lifecycle card names six other promises, not nine. See new conflict 2. The new label also adds new conflict 1. |
| T6 | Question D's "five" matched nothing on the page | Resolved | "Answering sits in the middle of the engine, and six promises depend on it." The Answering card shows two under "Mainly keeps" and four under "Also needed by": six. |
| T7 | Words box order against its intro | Resolved | "The page's own words come first. The rest are the words step 3 uses". The order is Promise, Moment, Design flaw, Part, Quality, Paper or live, Pass, Not installed tonight, then Module, Interface, Seam, Deep/shallow, Locality, Leverage, Adapter. |
| T8 | Module, Interface and Seam used "part" in the old sense | Resolved | "Module: Any piece of code with an inside and an outside, from one function to the whole backend." "Interface: Everything other code must know to use a module." "Seam: Where one module meets another, and where behaviour can be swapped." |
| T9 | Tangles heading said today's code keeps the promises | Resolved | "Where the promises' work sits in today's code: 13 tangles" |
| T10 | "the venue technician's venue fit editor" | Resolved | "the venue technician's profile editor (venue fit)" |
| T11 | Release alternative said the release-day half was proving | Resolved | "Release as its own small part, for release day: the owner alone sends a change to the show." |
| T12 | "whether some should split" lost the count | Resolved | "… ask about their wording and whether three of them should split." D, E and F each ask about a split. |
| T13 | First question lost its second half | Resolved | "Are these the right ten promises, and does each read from the side of the people who count on it?" |
| T14 | "Decided so far" left out decision 27 | Resolved | "… 26 (…) and 27 (the page's words: promises, parts, qualities, design flaws, the venue technician; promises named by title)." |
| T15 | A decided item sat in "What you are deciding" | Resolved | The box now holds three items. After it: "Already decided: your words. A promise is what a person can count on at a given moment, and "job" is gone. … (decision 27). The words box below defines each." |
| P1 | "Anyone reading a screen …" was said to be the label (a quality) | Resolved | "Before, this promise asked the engine to tell the truth. Now a label on every fact and reply keeps it, carried by Delivery and Answering, and so does one part of its own, the Verdict, because today the verdict reaches no screen." The meaning is right; the sentence's style is new conflict 4. |
| P2 | "The room does what …": showing it "is the label" | Resolved | "… showing it on a screen falls to the label every fact carries, which keeps "Anyone reading a screen can act on it without a second question", because running the room and labelling a screen differ." The meaning is right; the sentence's style is new conflict 3. |
| P3 | Capabilities said to keep a "second promise" | Resolved | "No capability exists mainly for this promise, but thirteen list it as a secondary promise (…)" |
| P4 | Pack holders called parts | Resolved | "one complete list of every place that holds a copy of the pack. No document has this list today." This matches the tangle ("nine places") and Pack channel ("every holder"). |
| P5 | C11: "inside one part of the engine" | Resolved | "One question has several answerers inside the engine or on one tablet, so …" |
| P6 | C7: "part ways" | Resolved | "… so a tablet's copy and the engine's record stop matching." |
| P7 | C12 title called the kit's devices parts | Resolved | Card and "Where each flaw lives" grid: "Pack edits reach each copy of the pack differently". This differs from the check's suggestion ("each device"), but it fits the card, which follows the engine's frozen copy, the disk, the TV's and the tablet's copies. |
| P8 | C5 note: "in two parts" | Resolved | "One routine for start and reset, split in two. A starting point builds every part once, from one list." |
| P9 | C5 Why it happens: today's wiring called parts | Resolved | "The start connects storage, broadcasts and cue forwarding in one order with one set of the engine's services; the reset connects them in the other order with a shorter set, and connects some a second time." These are the three boxes both routines wire in the Today diagram. |
| P10 | C14 Why it happens: "a part waits" | Resolved | "… a module waits for a message nothing sends; …" |
| P11 | C16: today's classes called parts | Resolved | "… their stand-in had a field the real code lacks." "… nothing compares them to the real code they stand for." |
| P12 | C14 design terms: "leaks" | Resolved | "Today nothing checks the tablet's inner seam: Team Details silently reads a field the outer layer never passes on." |
| P13 | C16: a riddle for an opening sentence | Resolved | "This flaw shows nothing at a show; it is why the other fifteen flaws reached one." |

## New conflicts from the fixes

| # | Where on the page | What it says | What it should say | File and field |
|---|---|---|---|---|
| 1 | Part cards, the new "Mainly keeps" line, against "How each promise is kept" | Seven cards say they mainly keep a promise that the summary says is kept mostly by a quality. Verdict, Answering, Delivery and Screens: "Mainly keeps … "Anyone reading a screen can act on it without a second question"". Joins and proofs, Engine instance and Release: "Mainly keeps … "A change is proven before it reaches anyone, and the owner alone sends it to the show"". The summary says: "Two are kept mostly by a quality every part must have". The qualities table also says "Mainly keeps" for both. "Mainly" on the part card reads as "this part does most of the keeping". Before the fix the card said "Keeps", which did not clash. | Name what the line is, the part's own promises, in the words the page already uses ("kept by parts of their own"): tag "Its own promises", with the second line "Also needed by". Or keep the tag and change the summary: "Two also rest on a quality every part must have: …". | builder, `part_html()`, the `Mainly keeps` tag; or builder line 351, the "How each promise is kept." text |
| 2 | "How each promise is kept", against the Lifecycle card | "… rests on a table of moments (setup, start, pause, end, reset, restart, the next game) that every other promise reads." The Lifecycle card, now complete, lists six other promises. It does not list "Each person sees their part and can do only their part", "The game fits the venue it is in tonight" or "A change is proven before it reaches anyone, and the owner alone sends it to the show". | "… that six of the other promises read." Or, if the map means all nine, add the three missing promises to the Lifecycle part's list in the map. | builder line 351; or `shape.json` `parts[P11].jobs` |
| 3 | Promise "The room does what the designer cued and the GM asked", Changed after the relationship map | One sentence of 47 words carrying four ideas: "Now Equipment keeps that dated picture here, beside the Show runner, and showing it on a screen falls to the label every fact carries, which keeps "…", because running the room and labelling a screen differ." "Falls to" is a figure of speech. `process.md` section 4 asks for short sentences, one idea each, no figures of speech. | "Now Equipment keeps that dated picture, beside the Show runner. Showing the picture on a screen is the work of the label every fact carries. That label keeps "Anyone reading a screen can act on it without a second question". Running the room and labelling a screen are different work." | `jobs.json` `jobs[3]` (the room promise) `.shapeChange` |
| 4 | Promise "Anyone reading a screen can act on it without a second question", Changed after the relationship map | "Now a label on every fact and reply keeps it, carried by Delivery and Answering, and so does one part of its own, the Verdict, because today the verdict reaches no screen." One sentence, four ideas, and "and so does" makes the reader carry "keeps it" across two clauses (section 4). | "Now a label on every fact and reply keeps it. Delivery and Answering carry that label. One part of its own keeps it too, the Verdict, because today the verdict reaches no screen." | `jobs.json` `jobs[8]` (the screen-reading promise) `.shapeChange` |
| 5 | Part card "Connections and roles", description | "… A client's own word decides nothing. It also says who may move the game and command the room, …" The moved sentence now follows a sentence about a client's word, so "It" can be read as that word. | "… A client's own word decides nothing. This part also says who may move the game and command the room, and gives the design tool and a preview engine their own passes." | `shape.json` `parts[P7].plain` |

Checked and found right among the changed strings:

- **No banned words.** No "installer". No J number in any heading, table, card, question or note; `J1` to `J10` survive only as mermaid node ids, which the rendered diagrams do not show (as at `1585e5cc`). "Job" appears only in the ten "Earlier wording, as a job" lines, the "Already decided" note ("job" is gone), the first question and the footer. No em or en dash.
- **"Part" in the changed strings.** Every new or kept use names one of the 17 parts, or the starting point's building of them. Today's code is now "module" or "code" in C5, C11, C14 and C16.
- **Counts in the changed strings.** Question D's six matches the Answering card. "Three of them should split" matches D, E and F. The tangle count (13), the part count (17) and the 25 links are unchanged. Decision numbers 20, 22, 26 and 27 match `CURRENT-STATE.md`.
- **Meaning of the `today_of()` rewrite.** For all 11 entries of the shared work, the new function returns the old text minus the leading "Today". No Today line lost a clause.
- **Qualities.** No quality is called a promise or a part. The "Already decided" note and the words box agree with `CONTEXT.md` section 7.

## Seen in passing, not caused by the fixes (not counted)

These use "part" for something that is not one of the 17 parts. Neither earlier check flagged them, though the first one's scope covered items 1 to 4 and 9.

1. Tangle title: "The game's facts are decided once and re-decided in five parts" (`shape.json` tangle at line 167). The five are devices and programs.
2. Tangle text: "nineteen parts each reset themselves and Reset System calls fourteen of them" (`shape.json` line 188). These are today's services.
3. Tangle title: "Joins kept by hand, fakes unchecked, tests per part" and "Twelve test configurations by part" (`shape.json` line 212).
4. Shape intro: "The parts that are already well built today (the game rules, the verdict, the health words)" (builder line 465). The health words are not a part.
5. C15 title and grid row: "The deployed game is many parts nothing compares", and its Today diagram edge "nothing compares the parts" (`cards.json` card C15 `.title` and `.before.mermaid`; also `2026-10-31-cards-g4.json`).
6. C5 design terms: "Today both do it by hand, each knowing every part and the order" (`cards.json` card C5 `.designTerms`). Today's code has services, not parts.
7. C6 note: "Before, the card had each engine part describe its facts" (`cards.json` card C6 `.shapeChange`).
8. Grid intro: "A dot means the flaw's problems sit in that part of the engine" (builder line 772). The columns are areas such as GM tablets, Tests and Contracts.
9. Idioms that read as the defined word: "four apply in part" (builder line 758), "re-reads only in part" (C3 in the room promise's flaw list), "is part of it" and "is part of the proof" (question F).
10. Promise entry "Anyone reading a screen …" says the Verdict is its "one part of its own", while the glance table and the Answering, Delivery and Screens cards also list that promise as theirs. The wording predates the fixes.

## Summary

28 rows: 27 resolved, 1 partly resolved (T5), 0 not resolved; 5 new conflicts from the fixes; 10 older items seen in passing, not counted.
