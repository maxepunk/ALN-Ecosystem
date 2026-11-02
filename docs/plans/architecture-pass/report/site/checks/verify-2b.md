# Verify 2B: promises.html, parts.html, flaws.html

Checked 2026-11-01 after the second apply pass (`checks/apply-log-2.md`;
changes since `4e96e31f`). Each row of `verify-b.md` that was partly
resolved or new, and each of the orchestrator's four rulings as it
touches these pages, was read against the rebuilt pages as text (the
diagrams' labels kept) and against the HTML for links and chips. Then
the three pages were read whole against the rules. Where a row was
applied "in another form", the verdict says whether the reason holds.

**Verdicts: 11 resolved, 2 partly, 0 unresolved. New conflicts: 5.**

Abbreviations: BS `report/build_site.py`, FJ `site/front.json`, EJ
`report/2026-10-31-engine-jobs.json`, SL
`report/2026-10-31-standalone-lines.json`, CC
`report/2026-10-31-cause-cards.json`. Line numbers are as the files
stand now.

## Verdicts

| Row or ruling | Verdict | What the rebuilt page says |
|---|---|---|
| promises 4 and N4 | resolved | Promises intro: "a goal marked open is left to step 3; where another goal leaves something open, its last sentence says so." Checked every goal: only the lifecycle goal is marked open; the tap, designer's-loop and venue goals end on what stays open ("Whether refused scans are recorded stays open", "Where it runs is open", "where, and how many tablets, stays open"); the other six leave nothing open. |
| promises 12 and N2 | resolved | "thirteen list it as a secondary promise, dormancy (capability 8) ...": no stray space. |
| promises 13 and N1 | resolved | Built today: "a CI run of the real engine and its programs, the test level above logic alone". Matches CONTEXT.md lines 455 to 458 (rung 0 logic only, rung 1 the real software stack with fake physics) and the entry's own goal. |
| parts 7 and N5 (another form) | resolved | "Today, on the ten cards that carry it, says how the part's work is done now". Ten parts carry a Today line (seven do not: Venue fit, Game record, Show runner, The night's record, Screens, Design studio, Release). "The part's work" for "that work" is the better form: the reason holds. |
| N3 | resolved | Tap promise goal: "...captured during play. It carries the game it ran and the texts the players saw." It now matches the Parts record card and decision 28 point 3. |
| N6 | resolved | C5 and C11 show a plain "Reproduced in a test" chip and note tag; the glance cells say "Reproduced in a test"; six cards keep the red "Seen live" chip. The wording around it has a new fault; see ruling 3. |
| N7 | resolved | Promises summaries read "Test cases from the shows (4); answers architecture pass questions 6, 5, 8" (and "question 6" for the lifecycle promise); flaws chips read "Architecture pass questions 6, 5, 8", "No architecture pass question covers it (nearest: 5)". One name on both pages. |
| N8 | resolved | "each is a link to the Promises page"; "each a link to the Design flaws page"; "those entries on the Promises page point back to the card"; "each a link to the Parts page". All four are links to the right pages. |
| N9 (another form) | resolved | The titles stay: "Three reply shapes at three doors"; "Three doors, three reply shapes, acknowledgements matched by name". The reason holds: the words box's Door entry now says "Today's code has several", so these sit inside the definition. The Proof quality reads "testing each part through its interface, the one everything else uses". |
| Ruling 1 (no eyebrow) | resolved | Not on these pages. `index.html` has no eyebrow and BS's `.eyebrow` selector is gone; each of these pages opens with the shared status line. |
| Ruling 2 (one name for the nine) | resolved | Both intros say "the architecture pass's nine questions" and add "these are not the questions on Decisions"; chips and summaries as in N7. The words box on the front page carries "Architecture pass questions: The nine questions ... They are not the questions on Decisions, which wait for your answer." |
| Ruling 3 (reproduced in a test) | partly | The field (`reproducedInTest` on C5 and C11 in CC), the chip, the note tag, the glance column ("Seen live or in a test") and the count are right: "Six flaws were seen live at a show; two more were reproduced in a test." But "at a show" is false for two of the six: C16's note is test runs on blue ("Blue's last full run skipped 62 tests ...") and its own card says "This flaw shows nothing at a show"; C15's is blue's rollback and setup. See new conflict 1. |
| Ruling 4 (door) | partly | No "door" left on Design flaws. Every "door" on Promises and Parts now fits the words box's definition (Answering's "one door" and "Three doors" today). But the dormant reason itself appears once on these pages, not plainly: "the GM's out-of-service latch" (new conflict 2). And one use, "the same door runs with no pass to check", leaves the reader to guess which door (new conflict 3). |

## New conflicts

| # | Where | What it says | What it should say | Place to change |
|---|---|---|---|---|
| 1 | Design flaws: intro paragraph 1, intro paragraph 2, the line under the glance table | "whether it was seen live at a show or reproduced in a test"; "Where it was seen live at a show or reproduced in a test"; "Six flaws were seen live at a show". C16's note is test runs on blue and its card says "This flaw shows nothing at a show"; C15's note is blue's rollback and machine setup. The cause cards' notes are things seen live on blue's machine or at the venue, not all at a show. | Drop "at a show" in all three: "whether it was seen live or reproduced in a test"; "Where it was seen live or reproduced in a test"; "Six flaws were seen live; two more were reproduced in a test." | FJ `intros.flaws[0]` (line 390) and `[1]` (line 391); BS `page_flaws`, line 1623; BS comment line 86 to match |
| 2 | Promises, "The room does what the designer cued...", needs item on dormancy | "plus a decision about what a reset and a restart do to the GM's out-of-service latch". "Latch" is the code's word; ruling 4 asks the dormant reason to be named plainly where it appears, and the words box's "Not installed tonight" entry says "the GM takes it out of service during the show". | "plus a decision about what a reset and a restart do to a service the GM has taken out of service." | EJ `jobs[J4].needs`, line 267 (the engine-jobs document's line 163 has no "latch" and stays) |
| 3 | Promises, "Each person sees their part...", In a standalone game | "a Connections and roles stand-in knows one connection, itself, so the same door runs with no pass to check." Which door is left unsaid, and a door that "runs" reads as a figure. By the words box it is Answering. | "a Connections and roles stand-in knows one connection, itself, so Answering runs the same rights check with no pass to verify." | EJ `jobs[J7].standalone`, line 471 |
| 4 | Design flaws: C4's "In a standalone game"; the evidence's set-aside table, "A question for you" | "if they are joined to it (question 24)"; "This became question 19." Both questions are on Decisions (`#q-24`, `#q-19`), but neither is a link, while every other Decisions question on the page (question C) is. "Became" is edit history outside the change log. | "if they are joined to it ([[q:24\|question 24]])"; "It is [[q:19\|question 19]] on Decisions." | BS `card_html` line 849 and BS line 1639 (render through `rich()` instead of `e()`); C4's line overridden in BS as flaws row 13 did, since SL line 6 is the dated pass's data; BS `SET_ASIDE`, line 139 |
| 5 | Design flaws: C5 and C11 notes | "Reproduced in a test The review reproduced the red Display row after a reset by running the engine's code in a test." The tag and the sentence say the same thing twice. Low priority. | C5: "The review ran the engine's reset code, and the Display row turned red." C11: "The review ran the engine's code, and Check Now reported the display healthy when it had never launched." | BS `card_html` line 847: an override text for cards with `reproducedInTest`, so CC's notes stay as version 7's builder reads them |

## What I found right

- **Rules, all three pages.** No em or en dash in the visible text or the
  diagram labels. No "job", "installer", "stamped" (for the record) or
  J1 to J10 a reader sees. "Venue technician" throughout. Promise links
  show exact titles; the promises lead-in's short forms read in their
  sentences and land on their entries. Every short flaw link carries
  its title on hover.
- **The nine questions.** One name on every chip and summary line, and
  both intros say they are not the questions on Decisions; the front
  page's words box defines them.
- **Seen live against reproduced.** The data now carries the
  difference (`reproducedInTest`), and the builder reads it for the
  chip, the note tag and the glance cell. The counts (six and two) are
  computed from the data, not typed. C10 rightly keeps "Seen live":
  its note is A-74 at the venue, though B-72 under it was also
  reproduced in a test.
- **Decision 28.** The tap promise names the director, the players the
  night is told to, and the owner and designer; how the story reaches
  the players is the game's business; the record "carries" the game it
  ran and the texts the players saw, on Promises and on the Parts
  record card alike; the Director Console stays separate "with room to
  move inside the Review stage later"; no player emails appear. X-08
  sits under C9 and the flaws footer names the after-game report for
  it.
- **Candidate, never decided.** "Kept by these parts of the candidate
  shape", "Candidate, not decided" on every candidate diagram, "would"
  in the device list, "the candidate favoured here" for the standalone
  declaration, and the status line on each page.
- **Facts.** The CI-run wording, the ten Today lines, the six and two
  counts and the set of goals that leave something open all hold
  against their sources.
