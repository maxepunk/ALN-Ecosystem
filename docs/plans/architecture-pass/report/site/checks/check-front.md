# Check: front.json

Checked 2026-11-01 against the site plan (`site/2026-11-01-site-plan.md`,
sections 2, 3.1, 4 and 6), version 7 (as text, and `build_report.py`'s
TEMPLATE, `FIT_SUMMARY`, `FIT_DEVICES` and `BUILT`), the data files
(`2026-10-31-engine-jobs.json`, `2026-11-01-engine-shape.json`,
`2026-10-31-cause-cards.json`), `docs/plans/CURRENT-STATE.md` section 0
(decisions 20 to 29), `2026-11-01-after-game-report.md` with the owner's
answers, `CONTEXT.md` section 5b, the relationship map
`relationships/2026-11-01-today-components.md`, `site/inventory.md` and
the writer's log `site/front-log.md`. Refute by default.

Result: **9 conflicts** over **88 items** checked.

## Conflicts

| # | Where | What it says | What it should say | Source that shows it |
|---|---|---|---|---|
| 1 | `whereYouAre.next[0]` | "...proves the design flaws on it for real instead of reading them off the code: one run per flaw, as [[q:21]] sets." | Question 21 is open. "One per design flaw" is only its recommendation, so the sentence states the answer as settled. Write: "...instead of reading them off the code. How many it proves first is [[q:21]]." | v7 question 21 ("Recommendation: one per design flaw, 16 runs"); `decisions.json` q21 `status: open`; CURRENT-STATE section 0, "Open in round 8 ... 21" |
| 2 | `whereYouAre.open[4]` | "How many design flaws the test rig proves live before design starts ([[q:21]])." | The question counts problems (findings), not design flaws. Write: "How many problems the test rig proves before design starts ([[q:21]])." | v7 question 21 heading, "How many problems should the test rig prove before design starts?"; `decisions.json` q21 heading; CURRENT-STATE "21 (how many findings the rig shows in step 2)" |
| 3 | `whereYouAre.next[2]` | "Version 7 of the page stays live until this site is checked and published to the same link." | The site is published to that same link and replaces version 7, so on the published page this sentence is false the moment it is read. Drop it, or write: "This site replaces version 7 at the same link; earlier versions are in the [[page:changes]]." | Plan header ("Published to the same artifact link as version 7"); plan 3.6.2 (versions, this site as version 8); CURRENT-STATE "In flight" (the "stays live" is a working note, not page text) |
| 4 | `moments[5]` (Release day): `people` "A future operator with a second kit"; `promises` J8 "A second kit or a new machine needs no change to engine code." | Places the promise "The game fits the venue it is in tonight" and the future operator at release day. That promise's moment is "In the days before an event, and on the night when the engine is absent by choice"; release day is the moment of "A change is proven before it reaches anyone, and the owner alone sends it to the show". | Move the future operator and that line to "Before doors", whose `when` already reads "In the days before an event". Release day keeps the developer and the owner. | EJ J8 `functional.moment`; EJ J10 `functional.moment` and `people`; the writer's log (Release day) names J8's people, not its moment, as the reason |
| 5 | `fitSummary[0]` to `[3]` | Present-tense statements of candidate parts as facts: "The request comes in through [[part:P4]], the one door in"; "Every fact that changed then goes out through [[part:P6]] ... with its label: what it is, how old, how sure"; "[[part:P5]] writes one record of the night ... The designer's Review stage reads it inside the engine". Nothing in the section's four passages says the parts are a candidate. | Today replies do not say which request they answer (C7), screens show a normal value when nothing is known (C10) and nothing writes the night's record. Mark the candidate in the passages: open the first with "In the candidate shape," and the fourth with "In the candidate," (keeping its "Today nothing writes this record" as the contrast), or use "would" as v7's `FIT_DEVICES` does. | Plan section 6 ("The shape is a candidate. Never write it as decided"); BR `FIT_DEVICES` ("would ..."); cards C7, C10; `2026-11-01-engine-shape.md`:345 ("nothing writes the night's record yet") |
| 6 | `around[8]` (Director Console) `status` | "Decided (28): the console stays a separate program that reads the engine's record, and the record is designed so the console can later become ALN's own part of the engine's Review stage. The engine's own story-of-the-night reading must stand alone; a per-game console is the advanced instance, never the baseline." | Decision 28 chose (a), with (b) left open; it did not choose (c), "a plain built-in telling for every game, with ALN's console as the advanced version". The second sentence is the glossary's earlier wording of (c), yet it sits under "Decided (28)", so it reads as part of the owner's answer. "Is designed" also reads as done. Write: "Decided (28): plan for the console staying a separate program that reads the engine's record, and design the record so the console can later become ALN's own part of the engine's Review stage." Drop the second sentence, or give it its own attribution outside "Decided (28)". | CURRENT-STATE decision 28 point 5; after-game report, question 5 (options a, b, c) and answer 5; the owner's relayed answer "plan for a, design so that b remains open"; the writer's log (the second sentence is from CX 5b, not decision 28) |
| 7 | `around[4]` (Video and the TV) `connects` | "The browser is also a client of the engine under a display pass" | No "display pass" exists. The pass kinds are operator, watch-only, device and session, and the TV's page connects under an observe credential. Write "under a watch-only pass", or "under a pass" as the source has it. | ES P7 `seams` (the kinds of pass); `relationships/2026-11-01-today-components.md`:633 ("a client of the engine's socket under an observe credential"); BR `BUILT` J7 ("a watch-only pass") |
| 8 | `aroundMermaid` | The edge `eng -->\|"written at the end"\| rec` is drawn solid and unlabelled, like a link that exists today, beside edges marked "today" and "candidate". `notion -.->\|"today: memory texts"\| con` | Nothing writes the night's record today, so label that edge as the candidate ("candidate: written at the end") or draw it dashed with the candidate edge. The console reads memory texts and paper documents from Notion: label it "today: memory texts and paper documents". | `2026-11-01-engine-shape.md`:345; `fitSummary[3]` ("Today nothing writes this record"); after-game report, "What it takes" (memory text and paper documents from Notion) |
| 9 | `intros.flaws[1]` | "The card's head counts those findings, names the question it answers, and says whether the problem was seen live or came as a clue from a fix on blue." | Heads show both marks on some cards (C2, C3, C8, C11), neither on others (C6, C7, C9, C12, C13), and C15 and C16 name no question. Write: "The card's head counts those findings, names the questions it answers where there are any, marks a problem that was seen live, and names any fix on blue it came from as a clue." | `2026-10-31-cause-cards.json` (`seenLive`, `blueFixes`, `questions` per card); v7 card heads (for example C3: "Questions 3, 5 Clue from blue: fix W9 ... Seen live") |

## What I checked and found right

- **Schema (plan 4.1).** All ten top-level keys are present with the right
  shapes: `whereYouAre` has `open`, `decided`, `next`; every moment has
  `name`, `when`, `people`, `promises` (`id`, `why`); every `around`
  entry has `name`, `what`, `connects`, `status`; `fitSummary` is
  `head`/`text`; `siteGuide` covers all six pages once; every word has
  `group` `page` or `design`; `intros` has `promises`, `parts`, `flaws`.
  Text fields hold no HTML; `aroundMermaid` is flowchart source with one
  colour, `#0f766e`, which the plan maps to `--accent`.
- **Markers.** 77 markers, all valid ids (promises J1 to J10, parts,
  flaws C9/C12/C14/C2/C3/C8, questions promises, A, C, G, 19, 21, 22,
  24, 25, pages). No promise id in visible text; no "installer"; no
  "job"; no em or en dashes. Promise and part titles are never typed
  where a marker belongs.
- **Every promise in moments.** All ten appear (21 entries across six
  moments).
- **Every person each promise names** appears in a moment's `people`:
  the designer who publishes, the GM at doors-open and a second designer
  (J1); the GM, the audience and a player with a hidden fact (J2); the
  GM, the player, the director, the players and the owner and designer
  (J3); the audience and the GM at Environment and Show Control (J4);
  the GM at the lifecycle buttons and the designer (J5); the designer,
  the owner designing the second game and a new designer (J6); the GM,
  the audience, a player, designers, venue technicians and a stranger
  (J7); the venue technician, a GM with no engine and a future operator
  (J8; see conflict 4 for where); the GM, the venue technician, the
  designer reading a badge and the audience watching the clock (J9); the
  developer, the owner and the GM (J10).
- **Every "why"** is a clause of its promise's `functional.need` or
  moment, and none misstates it, including "the same go and no-go
  words" (supported by P10, "go, no-go or dormant", and P15's verdict
  badges).
- **Decision 28 everywhere else.** The Review moment and J3's "why" name
  the director and the players; "how that story reaches the players is
  the game's own business"; the record carries the game it ran and the
  texts the players saw (decided list, `fitSummary[3]`, the console's
  `connects`); paper documents joining the pack is left to step 3
  (Notion `status`); players' emails stay outside the engine, with the
  ticketing API as the game's own later tool (booking list); the emailer
  is outside the engine and gets no promise; the two clocks join the
  flaw "Tablets and phones decide facts the engine owns" (decided list,
  console `connects`).
- **The words.** The fifteen v7 terms are verbatim and in v7's order;
  "Director" is added to the page group from `CONTEXT.md` section 5b,
  in plain words, with the "hat" image removed.
- **The open questions** in `whereYouAre.open`: thirteen in four groups,
  counts 8, 3, 1, 1; the summaries of the promises question, 22, 24, 25
  and 19 match v7; "the relationship map changed the recommendations for
  E, F and G" matches CURRENT-STATE.
- **Decided list.** Decisions 29, 28 and 27 match CURRENT-STATE section
  0, dated 2026-11-01.
- **Around the engine, facts.** Notion and the sync script (root
  `CLAUDE.md`); the pack held in nine places and three versions after a
  publish (ES tangle, today-components :623); the config tool writing
  the engine's files, importing its modules and running the pack check
  as a child process (today-components :42, :628); VLC's ageless,
  partly re-read picture (C3); MPD's private flag and calm playing look
  (C2, root `CLAUDE.md`); seven adapters and two supervision shapes (ES
  P8); tests adopting live audio and Bluetooth (C8); Home Assistant down
  at start (C2, A-11); witness lights on the rig (today-components
  :257); the console's eleven stops and two to eleven days, the
  emailer's contents (after-game report).
- **Other fields.** `lead`, `standaloneLine`, `siteGuide` and
  `intros.promises` and `intros.parts` match plan 3.1 to 3.5 and v7;
  "Built today is the orchestrator's summary" is v7's own footer
  wording. `fitSummary` passages 1 to 3 keep v7's `FIT_SUMMARY` meaning;
  v7's fourth passage ("How each promise is kept") is dropped as a
  duplicate, with its kept copies named in `inventory.md` row 20 (the
  qualities table, the glance table, the Lifecycle card).
- **No promise-by-promise mapping restated.** The intros describe the
  Promises page's table and entries without repeating which parts keep
  which promise; `fitSummary` links parts and promises as plan 3.1.5
  asks.
