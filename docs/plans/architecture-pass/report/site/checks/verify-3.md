# Verify 3: the partly and new rows of verify 2A and 2B, after the hand fixes

Checked 2026-11-01 against commit `905bde40`. I read the rebuilt
`index.html`, `decisions.html`, `changes.html`, `promises.html`,
`parts.html` and `flaws.html` as text, with the diagrams' labels kept,
and the HTML where a link mattered. Each partly row and each conflict
row of `verify-2a.md` and `verify-2b.md` was assumed unresolved until
the page showed otherwise. Then every line the commit changed in the
site data, the report inputs and `build_site.py` was read where it
renders. Sources checked: `2026-11-01-engine-shape.md` line 80 and its
check (the seven-module cycle), the cause analysis lines 277 and 592
with `causes-backend.md` B-53 and B-74, `backend/src/gameRules/dormancyWording.js`
and the GM scanner's copy, `inventory.md` row 87 and the plan's
sections 3.2 and 6.

**16 rows: 15 resolved, 1 partly, 0 unresolved. 6 new conflicts, all
small; two are on Decisions question C and the intro, where the round-8
numbers moved.**

## Verdicts

| Row | Verdict | What the rebuilt page says |
|---|---|---|
| 2A ruling 2 (one name for the nine questions) | resolved | Its four leftover places (2A conflicts 2 and 3) all read "architecture pass question" now. No "design question", "the pass's question" or "question ... in the pass" is left on any page. |
| 2A ruling 4 (door apart from the dormant reason) | resolved | Rested on 2A conflict 1, now resolved. The Door entry ends "It is not the reason a service is dormant, which the code also calls a door; see Not installed tonight." True to `dormancyWording.js` (`DOOR_WORDING`). |
| 2A conflict 1 (Not installed tonight) | resolved | "Grey, absent on purpose, never a fault: tonight's profile leaves the service out. The code calls this state dormant. A service the GM takes out of service during the show is dormant too, for its own reason, and reads "Out of service", also grey." The GM scanner's copy reads exactly "Not installed tonight" and "Out of service", and `HealthRenderer` gives every dormant row the one dormant class. |
| 2A conflict 2 (question F on Decisions) | resolved | Option a: "the recommendation gives each its own architecture pass question." Recommendation: "give the proof and the release an architecture pass question each." |
| 2A conflict 3 (change log, F and version 1) | resolved | Before: "give each half an architecture pass question of its own". After: "an architecture pass question each". Version 1: "18 (the three causes no architecture pass question covers)". |
| 2A conflict 4 (Pass) | resolved | The words box term reads "A device's pass". |
| 2A conflict 5 (questions A and B read as decided) | resolved | A: "In the candidate, "Nothing in the engine assumes ALN" is a quality every part must have". B: "In the candidate, one part, Connections and roles, holds ...". B's line has a new small fault (new conflict 4). |
| 2A conflict 6 (two figures of speech) | resolved | "...depend on each other in a circle, and the game's record is one of them." "...its publish goes out through Pack channel". Both as the row asked. The first is not quite exact against its source (new conflict 5). |
| 2A conflict 7 (round-8 numbers on Decisions) | partly | Both "replaces" sentences are gone; C's "What it decides" drops "folded in from question 23"; its recommendation reads "On the second point, yes". One orientation line in the intro carries the numbers. Left: C's evidence still ends "the answer to 23 does not move it" (new conflict 1); the orientation line is history on Decisions that neither the inventory nor the plan records, and it uses two figures (new conflict 2). |
| 2B ruling 3 (reproduced in a test) | resolved | Rested on 2B conflict 1, now resolved. Glance column "Seen live or in a test"; C5 and C11 read "Reproduced in a test", six cards "Seen live"; the line under the table: "Six flaws were seen live; two more were reproduced in a test." The counts are computed from the data. |
| 2B ruling 4 (door) | resolved | Rested on 2B conflicts 2 and 3, both resolved. |
| 2B conflict 1 ("at a show") | resolved | Intro: "whether it was seen live or reproduced in a test"; "Where it was seen live or reproduced in a test, a note says how"; the count line has no "at a show". |
| 2B conflict 2 (latch) | resolved | Dormancy need: "plus a decision about what a reset and a restart do to a service the GM has taken out of service." The engine-jobs document's line 163 says the same. |
| 2B conflict 3 (which door) | resolved | "a Connections and roles stand-in knows one connection, itself, so Answering runs the same rights check with no pass to verify." Fits Decisions B ("Answering checks the rule once"). |
| 2B conflict 4 (questions 19 and 24 as links) | resolved | C4's standalone line: "if they are joined to it (<a href="decisions.html#q-24">question 24</a>)". Set-aside table: "It is <a href="decisions.html#q-19">question 19</a> on Decisions." Both anchors exist; "became" is gone. Done by editing the dated input, not by an override (noted below the table). |
| 2B conflict 5 (C5 and C11 said twice) | resolved | C5: "Reproduced in a test The review ran the engine's reset code, and the Display row turned red." C11: "...ran the engine's code, and Check Now reported the display healthy when it had never launched." Both match B-53 ("`r.reset()` prints down/Reset") and B-74 ("reports healthy without reading `launched`"). |

## New conflicts

| # | Where | What it says | What it should say | Place to change |
|---|---|---|---|---|
| 1 | `decisions.html`, question C, What we know, last line | "On the map N1 lands on Pack channel and Venue fit, or on Game record if the declaration is kept there; the answer to 23 does not move it." The page no longer says what 23 is anywhere near; C now calls it "the second point". | "...; your answer on the second point does not move it." | `decisions.json` `groups[0].questions[3].evidence[4]` |
| 2 | `decisions.html`, intro, last paragraph (the orientation line) | "Three questions from round 8 live on here under new names: question 17 is the promises question, 18 is folded into question F, and 23 into question C." "Live on" and "folded into" are figures. The line is edit history on Decisions; `inventory.md` row 87 still homes it in the evidence lines of the promises question, F and C, which no longer hold it, and the plan's section 6 records no exception. | "Three questions from round 8 are asked here under other names: 17 is now the promises question, 18 is part of question F, and 23 is part of question C." Then inventory row 87's home: "`decisions.html` intro, last paragraph (`decisions.json` `intro[3]`), so the owner can answer by the old numbers; the change log's version 3 holds the history." Add one line under the plan's section 6 history rule naming this exception. | `decisions.json` `intro[3]`; `inventory.md` line 170 (row 87); `2026-11-01-site-plan.md` section 6, first bullet |
| 3 | `decisions.html`, question 21, What we know, line 3 | "Two more, C5 and C11, were reproduced in a test." One sentence earlier the same paragraph names C5 by its title ("Boot and Reset System wire the engine differently"), and the four seen-live flaws in this line go by title. The bare ids read as two new flaws. | "Two more were reproduced in a test: [[flaw:C5]] and [[flaw:C11]]." (the title links, as the sentence before uses) | `decisions.json` `groups[3].questions[0].evidence[2]` |
| 4 | `decisions.html`, question B, What we know, line 1 | "In the candidate, one part, Connections and roles, holds both the pass and what it allows". On this page "the pass" is the architecture pass everywhere else ("the base the pass designs for", "parity work the pass must serve", decisions 20 and 26). The words box now names this "A device's pass". | "...holds both each device's pass and what it allows". | `decisions.json` `groups[0].questions[2].evidence[0]` |
| 5 | `index.html`, How it fits together, passage 2, last sentence | "In today's code the loop is also a chain of seven backend modules that depend on each other in a circle, and the game's record is one of them." The seven are modules; the record is not one. The source names `sessionService`, the module that holds the record ("with the spine's record caught inside it", engine-shape line 80). | "...that depend on each other in a circle, and one of them holds the game's record." | `front.json` `fitSummary[1].text` |
| 6 | `index.html`, site guide, Change log line | "...and the words the owner page has changed, most of them by decision 27." Nowhere does the site call itself or its earlier version "the owner page"; the change log calls the earlier versions "the page". Low priority. | "...and the words the site and its earlier page have changed, most of them by decision 27." | `front.json` `siteGuide[5].line` |

Outside the pages, noted only: the hand fixes changed two dated inputs
that version 7's builder also reads. `2026-10-31-standalone-lines.json`
C4 now holds a `[[q:24|question 24]]` marker, and `2026-10-31-cause-cards.json`
C5 and C11 now hold the test notes with a `reproducedInTest` flag.
`build_report.py` (line 727) would print the marker raw and show both
notes under a "Seen live" chip. verify-2B advised overrides in
`build_site.py` instead. Nothing rebuilds version 7 today, so this harms
no page; if version 7 must stay reproducible, move the two changes into
`build_site.py` overrides.

## What I found right

- **Every changed line obeys the hard rules.** No em or en dash, no
  "job", "installer", "latch" or "stamped" (for the record) outside
  `changes.html`; no J1 to J10 a reader sees. Promises appear by their
  exact titles, or by short link forms that read in their sentence.
- **One name for the nine questions, site-wide.** Promise summaries
  ("answers architecture pass questions 8, 2"), flaw chips ("No
  architecture pass question covers it"), Decisions F and the change
  log all use it, and the words box defines it with examples true to
  the program document.
- **Decision 28 holds on every changed line.** The tap promise's goal,
  the record card on Parts, the change log's J3 entry and decided 28
  all say the record "carries the game it ran and the texts the players
  saw"; decided 28 links "the night's-record half of the tap promise".
- **The dormant reasons are plain and true.** "Not installed tonight"
  and "Out of service" are the GM screen's own words; the Door entry
  keeps the two senses apart; the dormancy need says "a service the GM
  has taken out of service".
- **The candidate stays a candidate.** Decisions A and B now open "In
  the candidate"; the standalone line on "Each person sees their part"
  opens "In the candidate shape".
- **Facts traced.** The six-and-two split (cards C2, C3, C8, C10, C15,
  C16 against C5 and C11; cause analysis lines 277 and 592). The CI-run
  wording on the change promise ("the test level above logic alone").
  The Proof quality ("through its interface, the one everything else
  uses"). The eyebrow is gone from page and stylesheet. Question 22's
  "the web scanner's on the phone". The ten Today lines on Parts.
