# Version 9, final verify: the third fix round

Verified 2026-11-02 on branch `claude/nice-curie-hescfv` (nothing committed; nothing edited but this file). I checked
the 20 conflicts of `v9-verify-2a.md` (13) and `v9-verify-2b.md` (7), the lead agent's three rulings and the editor's
record (`v9-apply-log-3.md`) against the six rebuilt pages, read as text with diagram labels and aria-labels kept. I
compared each page's text with its text at `644f72e6`. Then I read every changed line as it now reads on its page,
and checked the facts against the sources each row names (the engine shape, the engine jobs, the standalone lines,
the cause cards, `2026-10-31-jobs-capabilities.md`, the jargon table). A rebuild of a scratch copy of the
architecture-pass folder gave byte-identical pages, with "checks passed: 1529 links resolve" and the front page at
2,619 words in sentences, under the hard limit of 2,625. Refute by default.

**Result: 23 verdicts (20 rows, 3 rulings): 23 resolved, 0 partly, 0 unresolved.** One row (2B 1) was kept by ruling 1,
and its reason holds. Part of another (2A 12) was kept by ruling 1, and that reason holds too. **2 slips**, both
small: a bare title left in a line this round rewrote, and one new tangle title whose grammar does not hold.

## Verdicts

| Row or ruling | Verdict | What the rebuilt page says |
|---|---|---|
| 2A 1 | Resolved | Decisions, question A: "Two targets wait on questions on this page: “A standalone game is normal, never a fault” on question M, and “A standalone game leaves its own record” on question L, question M and question N. The other open point of “A standalone game is normal, never a fault”, where the standalone fact is kept, belongs to the design rounds. The quality target “A tablet reconnects to the same facts” leaves ...". Every title is quoted, and the second sentence now parses. |
| 2A 2 | Resolved | Question B: "The case “Players' own phones and two-tap actions” needs the number of phones one kit carries at once, which the quality target “Phone capacity is measured before the first phone” asks you to set; how many GM tablets the case “A small game with no show machine” may run is question M." The kinds are right: EX10 and EX12 are cases, and QT34 is a quality target. |
| 2A 3 | Resolved | Question C, all four lines: "Your decision “One program: design half, then build half” had ...", "Your decisions “The nine questions the pass answers”, “Five documents the design half hands over” and “When the design half is finished” had ...", and each "Read as overtaken by your decision “...”". The lines are still readings ("Read as"), so they are not shown as settled. |
| 2A 4 | Resolved | Question J: "Every option below gives the flaw “The deployed game is many parts nothing compares” a part to be fixed in; the flaw “A green test run proves nothing about the show” falls to the outside test bench whichever you choose." |
| 2A 5 | Resolved | Question K: "Under the promise “The room does what the designer cued and the GM asked”, the GM makes ... Under “One game, the same on every screen”, every screen agrees ...". It is clear where each title ends. |
| 2A 6 | Resolved | Question O: "The promise “Every tap gets its answer, and the night can be told afterwards” lists the flaw “Tablets and phones decide facts the engine owns” among its flaws, but leaves this to you: ...". This is true to the source: J3's flaws are C7, C4, C9, C11, C13 and N1. |
| 2A 7 | Resolved | Questions P, Q and R: "Your decision “What the architects' panel sees, and when” sets / lists / gives ...". |
| 2A 8 | Resolved | Decided, "The night's record and the after-game article": "the second half of the promise “Every tap gets its answer, and the night can be told afterwards” names the director and the players after the show;". The restatement is gone, as on Design. The same line still ends on a bare title: slip 1. |
| 2A 9 | Resolved | Later choices: "as the list of planned capabilities drawn from the roadmap has it." Decisions and Design now agree. |
| 2A 10 | Resolved | Words box, "Planned capability": "A list drawn from the roadmap you approved names 52; ...". The count is the capability table that `2026-10-31-jobs-capabilities.md` draws from the roadmap ("the engine's 52 capabilities"). |
| 2A 11 | Resolved | Words box, "Blue, green": "as in the flaw “A green test run proves nothing about the show”, is a passing one, unrelated." |
| 2A 12 | Resolved; the kept part's reason holds | Front page: Author and Rehearse people "You, designing the second game"; Review people "You and the designer"; Release day "on the day you send a new version to the venue", "You, sending a version to the venue", and under the promise "you decide when a new version goes to the venue ... and you can swap back by replugging a machine". Kept: "What the engine is for" still says "nothing deploys to the live machine until the owner says the new engine is ready". That sentence is `purpose[6]` of `2026-10-31-engine-jobs.json`, which ruling 1 names as promise data the panel also reads, so keeping it holds. The promise title "... and the owner alone sends it to the show" stays as a title. |
| 2A 13 | Resolved | Change log, version 9: "for you to confirm", "a number you set", "three ask you to confirm", "once you confirm the requirements". The venue note: "Earlier question E, now “Keep the venue promise whole?”, asks for your confirmation." The past-tense history ("Asked about a step, the owner said ...", "applied for the owner to confirm, then question A") is unchanged, as ruling 1 allows. |
| 2B 1 | Kept by ruling 1; the reason holds | I traced each place the row lists to its file. Each sits in a shared text that ruling 1 names: the requirements files, `v9/rules.json`, the engine jobs (J3, J10), cause card C2 (`seenLive`: "The owner reports the GM panel falling behind") and the earlier candidate (P5 `plain`: "the owner and the designer read it too"; `alternatives[7].a`: "the owner alone sends a change to the show"). A search of `v9/front.json`, `v9/decisions.json` and `v9/design.json` finds "owner" only in titles ("The owner's site: five linked pages", "The owner ratified the program document"), the roadmap stage name "The owner's sign-off", and "reaches only its owner", where "owner" means a player. In `build_site.py` it appears only in comments and in the code that rewrites "settled by the owner" to "Your word". No site prose in the overlays or the builder was missed. |
| 2B 2 | Resolved | Today's engine, C1, In a standalone game: "... In the earlier candidate the tablet runs the engine's Game record and Lifecycle; or an engine of its own, kept equal by tests. Two standalone tablets are two separate games; whether a game may have only one tablet is your open question “One GM tablet per standalone game?”". The title is quoted and linked, and it ends the line. "Your open question" adds no new form to the shared standalone lines: the same file already says "your open question" in another line, and C3 says "your choice". |
| 2B 3 | Resolved | C15, In a standalone game: "In the earlier candidate, Release's list would cover these, and every device would show its pack version and app version." Every standalone line that speaks for the earlier candidate now says so. |
| 2B 4 | Resolved | Design, where authority lives: "Three of your open questions feed this round: “The hardware scanner's standalone mode”, “One GM tablet per standalone game?” and “Exposed evidence and video with no engine”. The quality target “A tablet reconnects to the same facts” leaves to this round what a disconnected tablet does with a scan." The editor used typographic quotes in place of the verifier's straight ones. That follows the task's rule. |
| 2B 5 | Resolved | Requirements lead-in: "... under the question “Do the quality targets say how well the engine must work?”" No period follows the question mark. |
| 2B 6 | Resolved | Design, the earlier candidate, "Who decides when there is no engine": "...; the earlier candidate favours the venue technician's profile." This matches Later choices. |
| 2B 7 | Resolved | No page uses "door" or "doors" except for the venue's doors ("Before doors", "doors-open", "Doors open: the preflight"). The picture reads "Answering: every request comes in here, one reply per request" and "Delivery: every fact goes out here, with its label". The aria-label and caption say "Answering, where every request comes in, and Delivery, where every fact goes out", "Behind Answering and Delivery sit ...", "Answering, Delivery and their arrows are drawn in teal" and "runs the same Answering, Delivery, game record and lifecycle". The facts hold: P6 Delivery runs on the GM tablet, and P4 Answering checks the GM-only rule "here, once". The editor did not use the verifier's "entry points" in the tangle titles, because jargon row A98 marks "entry points" as jargon, so that reason holds. One of the new titles has a grammar fault: slip 2. |
| Ruling 1 ("you" and "the owner") | Resolved | The overlays and the builder's prose say "you". "The owner" is left only in titles, in the stage name, in past-tense history on the Change log, and in the shared texts the ruling names. |
| Ruling 2 ("door") | Resolved | "Door" is replaced in the builder's constants and the shape data, in cause card C7 and engine-job J7 `shapeChange`, and in the Change log's copies of both and its version 5 notes. The words-box entry "Door" is removed. No page now uses the word in that sense, so no entry points to a missing term. "Not installed tonight" never named "door". |
| Ruling 3 (as the verifier words it) | Resolved | Every row was applied as worded after its source was checked. There are two departures, and the reason for each holds: 2B 4 uses typographic quotes, and 2B 7's tangle titles avoid the jargon "entry points". |

## Slips

| # | Origin | Page, where | What it says | What it should say | Exact place to change |
|---|---|---|---|---|---|
| 1 | Left in a line this round rewrote (row 2A 8 changed the first half of the same line) | Decisions, Decided, "The night's record and the after-game article" | "... the two clocks (a sale stamped with the tablet's time, an adjustment with the engine computer's) join Tablets and phones decide facts the engine owns." The flaw's title sits bare after the verb, and the sentence reads as "join tablets", which breaks the rule on quoting titles. Requirements already words the same fact "join the flaw “...”". | "... join the flaw “Tablets and phones decide facts the engine owns”." | `v9/decisions.json` `decided[2].entries[3].line`: `join [[flaw:C9]].` becomes `join the flaw “[[flaw:C9]]”.` |
| 2 | Made by this round (row 2B 7, ruling 2) | Design, the earlier candidate, Today's tangles, the twelfth card's title | "Long chains of code, and the code that takes in requests does too much." The title begins with a noun phrase and then switches to a full clause after "and". It reads as a broken sentence. It also says "code" twice in a row. | "Long chains of code, and code that takes in requests and does too much" (two noun phrases, as in the old title, with no metaphor and no "entry points") | `2026-11-01-engine-shape.json`, `today.tangles[11].title` (line 217) |

## What I found right

- **The round did what its record says, and nothing more.** Each page's text differs from `644f72e6` only in the
  lines `v9-apply-log-3.md` lists, including the one extra fix (Today's "A question for you": "It is your open question
  “Record every refused GM scan attempt?” on Decisions."). A scratch rebuild gave byte-identical pages, and the
  build's checks passed.
- **The quotes are placed as the rule asks.** Every new title in a sentence uses “ ”, outside the link ("“<a
  ...>One GM tablet per standalone game?</a>”"). It is named by its kind where it would otherwise run into the verb
  ("the case", "the quality target", "the flaw", "the promise", "your decision"). No question mark runs into a comma,
  semicolon or period.
- **The facts hold.** J3 lists C9. EX10 and EX12 are cases, and QT3, QT34, QT37 and QT39 are quality targets. The 52
  capabilities come from a list drawn from the roadmap, not from the roadmap itself. In the earlier candidate,
  Delivery runs on the GM tablet, so a standalone tablet runs "the same Answering, Delivery, game record and
  lifecycle". Answering is where the GM-only rule is checked, so "Answering checks every action" (J7) and "the one
  place every request passes" match P4. "Three kinds of request, three reply formats" matches the tangle's own text:
  a player scan, a GM scan and a GM command each get a differently shaped reply.
- **"You" and "the owner" are now consistent with ruling 1.** The front page's moments and the promise text under
  Release day say "you". The Change log's version 9 items ask you, and its history stays in the past tense. The
  standalone lines' "your open question" matches wording the file already used.
- **The frame still holds on the changed lines.** No em dash, no visible id, no question letter off Decisions and the
  Change log, no numbered list, and no bare phase, step, block, round, decision or question number. No metaphor
  remains where "door" was. The earlier candidate is still "the earlier candidate", and the readings in question C
  still read "Read as", never as settled. The front page stays at 2,619 words in sentences.
