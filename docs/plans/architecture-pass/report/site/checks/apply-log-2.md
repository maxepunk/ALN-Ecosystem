# Apply log 2: the verifiers' partly and new rows

Written 2026-11-01. It settles every row that `verify-a.md` and
`verify-b.md` mark partly resolved and every new conflict they list,
under the orchestrator's four rulings. Each row was checked against its
source before the change. Files edited: `site/front.json`,
`site/decisions.json`, `site/changes.json`, the cause-cards, engine-jobs
and engine-shape JSON, `build_site.py`, and, for the one fact changed in
a data file that its source states, `2026-10-31-engine-jobs.md` line 125.

**20 rows settled: 20 applied (4 of them in another form), 0 rejected.
4 rulings applied. Build checks pass; smoke test passes (24 loads).**

Abbreviations: BS `report/build_site.py`, FJ `site/front.json`, DJ
`site/decisions.json`, CJ `site/changes.json`, EJ
`report/2026-10-31-engine-jobs.json`, ES
`report/2026-11-01-engine-shape.json`, CC
`report/2026-10-31-cause-cards.json`.

## Rows

| Verify file, row | Result | Change or reason | Source checked |
|---|---|---|---|
| verify-a, page-engine 21 (partly) | applied (ruling 1) | The eyebrow line is gone from BS `page_engine`; the dead `.eyebrow` selector is dropped from the CSS. The status line under the navigation is the one copy. | Plan 3.1.1 line 86 ("No eyebrow: the status line ... says"); inventory row 3 ("No eyebrow on `index.html`") |
| verify-a, page-decisions 16 (partly) | applied | DJ question 22 `decides`: "...gets a standalone mode matching the web scanner's on the phone, as parity work the pass must serve." The heading keeps version 7's "the web scanner's"; the line under it now says the web scanner is the phone's. | CLAUDE.md: the player scanner (web) is the PWA players run on phones; heading in DJ |
| verify-a, N1 | applied in another form (ruling 4) | FJ `words` "Door" now reads: "A way into or out of the engine that requests or facts pass through. Today's code has several. The candidate has two: Answering, the one door every request comes in by, and Delivery, the one door every fact goes out by. It is not the reason a service is dormant, which the code also calls a door; see Not installed tonight." The ruling's definition replaces the row's proposal; see ruling 4. | `CONTEXT.md` section 4, "Dormant vs fault" (two doors); ES tangle T4 and Answering's Today line |
| verify-a, N2 | applied | FJ `siteGuide[5].line` ends "...and the words the owner page has changed, most of them by decision 27." "The owner page" is named in decision 29's line on the same page. | CJ `intro` (same clause); FJ decision 29 line |
| verify-a, N3 | applied | DJ `decided` 28: "the [[promise:J3\|night's-record half of the tap promise]] names the director and the players after the show; ...". It now matches the front page's decision 28 line. | FJ `whereYouAre.decided[1]`; `CURRENT-STATE.md` section 0, decision 28 |
| verify-a, N4 | applied | DJ question C `evidence[4]` opens "[[flaw:N1\|N1]], the proposed flaw, holds eight findings from the standalone pass." Line 4 keeps the full title in brackets, so the two lines now name one flaw, title then id. | Same entry; the standalone pass's 8 N1 findings (flaws evidence intro) |
| verify-a, N5 | applied | CJ `versions[2].items[2]`: "The words box puts the page's own words first; the other word changes are listed under The words, below." | The row's own wording, with the comma it proposes |
| verify-b, page-promises 4 (partly) and N4 | applied | FJ `intros.promises[1]`: "a goal marked open is left to step 3; where another goal leaves something open, its last sentence says so." | EJ goals: only J5 has `goalOpen`; of the nine others, J3, J6 and J8 name what stays open in their last sentence, six name nothing |
| verify-b, page-promises 12 (partly) and N2 | applied | EJ `J5.needs[0]`: "secondary promise, dormancy" (stray space removed). The engine-jobs document's line 193 has no stray space, so it is unchanged. | EJ line 335; `2026-10-31-engine-jobs.md` line 193 |
| verify-b, page-promises 13 (partly) and N1 | applied | BS `BUILT['J10']`: "a CI run of the real engine and its programs, the test level above logic alone, started by hand or by a change to its own files ...". | `CONTEXT.md` lines 455 to 458 (rung 0 bare CI, logic only; rung 1 the real software stack with fake physics); EJ J10 goal ("from logic alone, through the real engine and its programs") |
| verify-b, page-parts 7 (partly) and N5 | applied in another form | FJ `intros.parts[1]`: "Today, on the ten cards that carry it, says how the part's work is done now;". "The part's work" replaces the row's "that work", which had nothing to refer back to in its sentence. The same line also takes N8's two page links. | BS `MECH_PART` (ten parts carry a Today line); Verdict's and Engine instance's Today lines |
| verify-b, N3 | applied | EJ `J3.goal`: "...captured during play. It carries the game it ran and the texts the players saw." The same fact changed in `2026-10-31-engine-jobs.md` line 125 ("...written when the game ends. It carries the game it ran ...") and in CJ's J3 entry ("Its goal now says the record of the night carries the game it ran ..."), so the change log still describes the goal as it stands. | Decision 28 point 3 (`CURRENT-STATE.md` section 0); `CONTEXT.md` (Review); the Parts record card |
| verify-b, N6 | applied (ruling 3) | See ruling 3. | Cause analysis line 277 ("Reproduced in-process already: B-53") and line 592 ("B-74") |
| verify-b, N7 | applied (ruling 2) | See ruling 2. | Program document section 3 (`docs/plans/2026-10-30-architecture-pass.md` line 87) |
| verify-b, N8 | applied | FJ `intros.parts[1]`: "each is a link to the Promises page"; "each a link to the Design flaws page". FJ `intros.flaws[0]`: "those entries on the Promises page point back to the card". FJ `intros.flaws[1]`: "each a link to the Parts page". All as `[[page:x\|the X page]]`. | The promises intro's forms after promises check 3 |
| verify-b, N9 | applied in another form (ruling 4) | No rewording of the two titles. The ruling defines a door so that it covers today's code ("Today's code has several"), so "Three reply shapes at three doors", "Three doors, three reply shapes ..." and "Shallow chains and thick doors" now sit inside the definition. The one use the definition did not fit, the Proof quality's "testing each part through the same door everything else uses" (a part's door, not the engine's), now reads "through its interface, the one everything else uses". | ES qualities "Proof"; `2026-11-01-engine-shape.md` line 107 ("Every part's interface is its test surface"), which already says interface, so it is unchanged |

The other verify rows were already resolved and are not repeated here.

## Rulings

| Ruling | What changed |
|---|---|
| 1. No eyebrow on the front page | BS `page_engine`: the `<p class="eyebrow">` line removed; the unused `.eyebrow` selector removed from the CSS. The front page now opens with the shared status line, then the title. |
| 2. One name for the architecture pass's nine questions | Chips on Design flaws keep "Architecture pass question(s) N" and "No architecture pass question covers it (nearest: N)". BS `promise_html` summary: "Test cases from the shows (4); answers architecture pass questions 6, 5, 8" or "no architecture pass question covers it yet". Prose: FJ `intros.promises[1]` and `intros.flaws[1]` say "the architecture pass's nine questions" (was "nine design questions"). DJ: "Architecture pass question 4 covers keeping tests away from the live show (C8). For the other three none of the architecture pass's nine questions fits: its question 5 is only the nearest ...". CJ: "architecture pass question 4 covers C8"; "the architecture pass questions it touches"; "matches architecture pass question 2". New FJ `words` entry, group page, after Quality: "Architecture pass questions: The nine questions the architecture pass asks of the whole engine, numbered 1 to 9, such as who decides each fact the GM sees (1) and whether one question gets one answer (5). Each is answered by a rule. They are not the questions on Decisions, which wait for your answer." |
| 3. Reproduced in a test is not seen live | CC: `"reproducedInTest": true` added after `seenLive` on C5 and C11 (the note text is kept, so version 7's builder is unaffected). BS: `SEEN_LIVE`, `SEEN_TEST` and `seen_label()`; the chip reads "Reproduced in a test" (plain chip, not the red live one); the card's note tag reads "Reproduced in a test"; the glance table's column is "Seen live or in a test", each cell says which, and a line under the table counts them apart from the data: "Six flaws were seen live at a show; two more were reproduced in a test." FJ `intros.flaws[0]` and `[1]`: "seen live at a show or reproduced in a test" (three places). DJ question 21 `evidence[2]`: "Six flaws already carry a "seen live" note ...; Two more, C5 and C11, were reproduced in a test." (it said eight). The six seen live: C2, C3, C8, C10, C15, C16. |
| 4. Door defined to fit every use, apart from the dormant door | FJ `words` "Door" as in verify-a N1 above. FJ `words` "Not installed tonight": "Grey, absent on purpose, never a fault. The code calls this state dormant. A service is dormant for one of two reasons: tonight's profile leaves it out, or the GM takes it out of service during the show." The site never uses "door" for the dormant reason, so the plain naming lives in that entry. ES Proof quality reworded to "interface" (N9 above). Every other "door" on the site (the front page's two doors, "one door checks every action once", "the same doors" on a standalone tablet, the Parts tangles and Answering's Today line) fits the definition. "Doors-open" (the show's doors) is a different, plain word and stays. |

## Build and smoke

- Build: `MERMAID_JS=... python3 -I build_site.py`: "drew 42 diagrams";
  "checks passed: 889 links resolve; markers, ids, entries, diagrams and
  words as the plan asks". Prose words: index 4,558; decisions 4,464;
  promises 7,273; parts 4,757; flaws 8,382; changes 5,317.
- Smoke: `node site_smoke.js site <shots>`: "smoke passed: 24 loads, 24
  screenshots", 0 errors on every load, light and dark, at 1100 and 400.
- Read back as text: no em or en dash on any page; "job" (52) and
  "installer" (2) only on `changes.html`; no J1 to J10 a reader sees.

## Noted, not changed (outside these rows)

- `2026-10-31-engine-jobs.md` line 125 still says "later photos"; EJ's
  J3 goal says photos are "captured during play", as `CONTEXT.md` does.
  No verify row names it.
- Decisions still carries two "This question replaces question 17/18 of
  round 8" sentences, in the promises question and in question F.
  Verify A judged them as pointers (page-decisions row 11); they still
  read as edit history outside the change log and may want rewording.
