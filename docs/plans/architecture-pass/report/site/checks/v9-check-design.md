# Check: version 9 Design page data

Checked 2026-11-01: `site/v9/design.json` (and its log, `site/v9/design-log.md`)
against the decision record (`DECISIONS.md`), the quality targets and
extension cases (`requirements/2026-11-01-*.json`), version 8's step-3 list
(`site/decisions.json` `step3`) and the candidate's alternatives
(`report/2026-11-01-engine-shape.json` `alternatives`, anchored by
`build_site.py` `ALT_ANCHORS`), the protocol explanation in the writer's
brief (`docs/agents/workflow-scripts/site-v9-content.js`, `PROTOCOL`), plan v2
sections 2 to 6, plan v1 section 6, the jargon table, and the sibling
`site/v9/decisions.json` for link targets and question letters. Refuted by
default.

22 conflicts. 52 items checked (6 decisions ahead x 4 fields, 15 paragraphs
in the 4 decided directions, 12 later choices, 1 earlier note), plus all 163
link markers.

## Conflicts

| # | Where | What it says | What it should say | Source |
|---|---|---|---|---|
| 1 | `ahead[1]` title and slug | "The published protocol's form", slug `the-published-protocol-s-form`. | One title and one slug on both pages. `v9/decisions.json` `designRounds[1]` links to `design.html#d-the-published-protocol-and-file-formats`, which does not exist, and the record names the round "the published protocol and file formats". Keep the plan's title and fix the Decisions page link, or use the record's wording on both. | `DECISIONS.md` "Design top-down, hardest-to-reverse choices first"; plan v2 section 3.4 item 2; `v9/decisions.json` `designRounds[1].link` |
| 2 | `ahead[0].panel` | "The panel proposes two or three ways of holding the state, blind, from the requirements alone". | "blind, from the goal, the requirements and the setting". The panel's first brief holds all three; only today's engine, the flaws, the candidate and the recommendations are withheld. | `DECISIONS.md` "What the architects' panel sees, and when" |
| 3 | `ahead[1].panel`, sentence 3 | "this round comes early, and its result is checked again as each later round settles." | "this round comes early" and stop. Neither the record nor the explanation says the protocol's form is re-checked after each later round; the log gives no source for that clause. | the explanation ("which is why it comes early in the design rounds"); `design-log.md` "The published protocol's form", `panel` |
| 4 | `ahead[2].settled`, sentence 5 | "Three of your open questions on [[page:decisions]] feed this round: the hardware scanner's standalone mode, one GM tablet per standalone game, and exposed evidence and video with no engine." | "[[q:L]], [[q:M]] and [[q:N]] feed this round." The titles are typed where a marker belongs; the letters now exist. | brief ("never type a title where a marker belongs"); `v9/decisions.json` questions L, M, N |
| 5 | `ahead[2].settled`, sentence 6 | "The quality target on a tablet's wifi dropping leaves to this round what a disconnected tablet does with a scan." | "[[qt:QT3]] leaves to this round what a disconnected tablet does with a scan." | brief (markers); `quality-targets.json` QT3 status |
| 6 | `ahead[3].settled`, last sentence | "Two of your open questions on [[page:decisions]] touch the clauses added to the pack promise and the venue promise's wording". | "[[q:E]] and [[q:I]] touch the clauses added to the pack promise and whether the venue promise stays whole". | brief (markers); `v9/decisions.json` questions E, I; `design-log.md` (names "Keep the venue promise whole?") |
| 7 | `ahead[3].settled`, sentence 4 | "(the equipment families, the dormancy core, the test-harness minimum)" | "(the equipment families, the core that marks equipment not installed tonight, the smallest test set-up)". | jargon table row 45 (dormancy); rows F158 to F159 ("minimum test harness" as "the smallest test set-up") |
| 8 | `ahead[4].settled`, sentence 3 | "A standalone tablet speaks the same protocol to its own built-in copy of the engine, as the protocol's explanation below has it." | Drop it from `settled`, or say it is open: "How a standalone tablet runs its game, with the same parts the engine runs or an engine of its own, is still open (see Later choices)." The explanation gives it only as an example of how a big decision would show up in the protocol. The record leaves the standalone tablet open, and the line favours one side of an open alternative. | the explanation ("for example ... standalone means ..."); `DECISIONS.md` "Standalone games: declared, never mixed" and "Still open" (the standalone tablet); `design.json` `later[5]` (`alt-standalone-tablet`) |
| 9 | `ahead[4].settled`, sentence 4 | "The Director Console stays a separate program on another computer that reads the record". | "stays a separate program, for now, that reads the record; the record is designed so the console can later become ALN's own part of the engine's Review stage". Dropping "for now" makes a provisional choice permanent. | `DECISIONS.md` "The night's record and the after-game article" |
| 10 | `ahead[4].decides` | Lists what each copy keeps apart, and what is set per copy and per kit; says nothing on where the trial copy runs. | Add: "Where the designer's trial copy runs, a laptop or the show machine between games, is open." The decision's own driver carries this open point, and the Decisions page points readers here for it. | `extension-cases.json` EX14 ("where it runs is an open question"); `checks/v9-check-decisions.md` row 8 |
| 11 | `ahead[5].decides` and `settled` | "on blue while the new engine is built for green"; "ready to swap in on green". The Design page has no words box. | Spell both out on first use: "blue, the show machine in use now", "green, the new machine this work builds". The log says row 17 was applied ("spelled out once"); it was not. | jargon table row 17 and words box W4; `design-log.md` (rows applied) |
| 12 | `ahead[5].drivers` | Lists [[qt:QT1]] (a power cut loses nothing) and [[ex:EX21]] (a stranger extends the platform from the guide). | Drop both. Neither turns on how today's engine moves to the new design: QT1 is about the new design's state across a restart (it already drives the first decision), and EX21 is about extending, which the fourth and fifth decisions carry. The rest (QT41, QT42, QT26, QT19, EX17) do push on the move, QT19 and QT26 through what the move does with today's tests. | `quality-targets.json` QT1; `extension-cases.json` EX21; `DECISIONS.md` "Build the test rig when building starts" |
| 13 | `ahead[5].settled`, last sentence; `decided[2].paragraphs[2]` | "its proof test failing on today's engine"; "each finding marked for live proof". | "its test failing on today's engine"; "each finding marked to be shown happening live". | jargon table row 9 (proof as "test"); `checks/v9-check-decisions.md` row 4 (same rendering) |
| 14 | `ahead[5].decides` and `panel` against `later[10]` | The decision ahead settles "in what order, starting from the thin first version" and hands the build plan "the order of the first areas"; the later choice says "The build plan ... settles it after the design rounds". | One owner for the order of the work. Either the later choice points to the decision ahead ("It is settled inside the decision ahead on how today's engine moves, and the build plan carries it out"), or the decision ahead drops the order. The record places the order with the build plan that follows the design rounds. | `DECISIONS.md` "Design top-down, hardest-to-reverse choices first" ("Then a build plan that starts with a thin first version"), "The design half's method and tools" |
| 15 | `decided[0].paragraphs[2]` | "The other big decisions show up in it: if facts are numbered in order, ...; standalone means a tablet speaks the same protocol to its own built-in copy of the engine." | "The other big decisions show up in it. For example, if facts are numbered in order, ...; and if a game is standalone, the tablet speaks the same protocol to whatever runs the game on it." Without "for example", the standalone line reads as a settled consequence (see row 8). | the explanation ("(for example, ...)"); `DECISIONS.md` "Still open" (the standalone tablet) |
| 16 | `decided[0].paragraphs[5]`; `earlierNote`, sentence 3 | "the earlier candidate's part Joins and proofs"; "Its part Joins and proofs is replaced". | "[[part:P16]]" in both places. The part is in the shape data and its anchor sits in the earlier candidate on this page. | brief (markers, `[[part:P5]]`); `engine-shape.json` `parts` P16; plan v2 section 2, anchors (`design.html` parts by slug) |
| 17 | `later[10]` | "(the earlier candidate put each running copy of the engine keeping its own files, network ports and settings, and delivery, first)" | "(the earlier candidate put [[part:P13]] and [[part:P6]] first)", as `v9/decisions.json` `later[10]` does. Two part names are written out as descriptions where markers belong. | brief (markers); `engine-shape.json` P13 Engine instance, P6 Delivery; jargon table "Not touched" (part names stay) |
| 18 | `decided[0].paragraphs[5]`; `decided[2].paragraphs[1]` | "Its form is the second decision ahead, above."; "It had been the design half's second step". | By name, not position: "Its form is the decision ahead on the protocol's form, above."; "It had come before the design rounds, right after the review that named the design flaws". | plan v2 section 2 (steps by what they do; no step or decision number); `DECISIONS.md` "Name each step by what it does" |
| 19 | `decided[0].paragraphs[5]` | "generating code for the web programs, and in part for the hardware scanner's program in its own language". | "generating code for the engine and the web programs, which share one language, and in part for the hardware scanner's program in its own". The explanation's "JavaScript" covers the engine too; "the web programs" reads as the tablet, phone and TV pages only. | the explanation ("code generation for JavaScript and partly for the hardware scanner's C++"); the explanation's list of sides generated (the engine first) |
| 20 | `decided[1].paragraphs[0]` | "a profile whose bindings point at software stand-ins for video, sound, lights and speakers". | "a profile that binds the pack's names to software stand-ins for video, sound, lights and speakers". | jargon table C60 ("the bindings" as "binding the pack's names to real equipment") and open call 7 |
| 21 | `later[7]` | "The design tool: a separate program ...". | The record and the Decisions page name this choice "the config tool"; the two pages must agree. Either "The config tool, the designer's and venue technician's tool: ..." on both, or "the design tool" on both with the record's word in the change log. | `DECISIONS.md` "Still open" ("the config tool"); v8 `step3[7]`; `v9/decisions.json` `later[7]`; `design-log.md` last reading |
| 22 | `later[0]`; `later[9]`; `later[11]` | `later[0]`: "It is settled inside the decision ahead on where authority lives." `later[9]` (where the start-or-use setting lives) and `later[11]` (paper documents) carry no pointer, though `ahead[3]` names both as its own. | `later[0]`: "It is decided in the round on where authority lives" ("settled" reads as already decided, the meaning the `settled` field gives the word on this page). Give `later[9]` and `later[11]` the same pointer: "It is decided in the round on how games and venues extend the engine." | `design.json` `ahead[2].decides`, `ahead[3].decides` and `settled`; `v9/decisions.json` `later[0]` ("It falls inside the round on where authority lives") |

## What I checked and found right

- **The six decisions ahead** are all present, titled from the record, in
  the record's order (state; the protocol; authority; extending; separate
  copies; the move). Each slug is its title in marker form. No entry
  proposes or favours an option apart from rows 8 and 15: the two-way
  framings in `ahead[2].decides` (refuse or keep a disconnected scan) and
  `ahead[5].decides` (change in place, or build beside) restate open
  questions, and "the engine in a networked game, the tablet in a
  standalone one" rests on QT7 and QT37, both settled.
- **Drivers.** Every promise listed in a `drivers` field is one that the
  listed quality targets or extension cases serve (checked by script
  against their `promises` fields). Every target and case pushes on its
  decision except the two in row 12. QT3's and EX15's open points are
  carried into the decisions they belong to (`ahead[2]`, `ahead[3]`), as
  the requirements say. Every QT and EX id exists (no QT28).
- **Settled lines** match the record apart from rows 8 and 9: the four
  words; the nine questions read as checks on each design, "to be
  confirmed"; the protocol as decided and designed early; the settled
  roles; the declared, never-mixed standalone rule and the four places the
  declaration might live; the hardening pieces changing only where a
  design choice requires; the thin first version on a new test bench;
  blue running until green is ready, no date; the rig at the start of
  building, with its in-place exception; the truth sweep's purpose moving
  into the build work; and every "read as overtaken, to be confirmed"
  reading (the drafted message lists, the build areas' failing tests, the
  rig end condition) flagged as unconfirmed.
- **The protocol paragraphs** follow the explanation in its order (what it
  is, how it is used, where it sits, today, what it is not, its cost), with
  every element present: the four kinds of content, the reply kinds, how
  old and how sure, the five generated sides and the hardware scanner,
  failing at build time, version rules, the inside-outside line, the
  open-source sentence, today's written lists checked by a few tests, not
  a program, the outside programs' own protocols, the three costs. The
  record's "replaces Joins and proofs" is carried. Exceptions are rows 15,
  16, 18 and 19. "The design tool" for "design studio" and "the video
  player, the music player and the lighting system" for the program names
  follow the requirements' own words.
- **The test bench, the rig and the after-game boundary** match their
  sources: QT25, QT26 and QT27 for the bench; the words box W2 and the rig
  decision's text and history for the rig (the four findings map to C1,
  C2, C4 and C5 as version 8's rig question had them; the question shown
  as withdrawn); the after-game decision sentence by sentence, with the
  two clocks in the jargon table's wording and joined to [[flaw:C9]].
- **Later choices.** All twelve of version 8's step-3 items are kept, in
  order, none lost; none has become a top-level decision in its own right
  (rows 14 and 22 concern pointers, not loss). Each `alt` names the right
  row of the shape's alternatives (delivery, lifecycle, rules, equipment,
  standalone tablet, scoreboard). The jargon replacements (one shared
  format, kind of job, loaded, uses one already running, the list of
  planned capabilities, only by sending it requests, pages the engine
  itself serves) are applied, and "Decision 28" and "step 3" are gone. The
  candidate's preferences are attributed to it, never stated as reasons.
- **The earlier note** labels the seventeen parts as an earlier candidate
  drawn bottom-up, one input among the panel's, compared in the panel's
  second round after it proposes blind, with only Joins and proofs
  replaced and nothing else decided. It does not present the candidate as
  current design.
- **Form.** The file parses; `ahead` 6, `decided` 4, `later` 12, one note.
  163 markers (23 promise, 39 quality target, 31 extension case, 32 flaw,
  34 decision, 4 page), all valid: every `[[dec:]]` slug resolves to one of
  thirteen record titles under the slug rule. No visible id, no bare phase,
  step, round, block or decision number (the only digit is "Pi 4", kept by
  jargon row 60), no em or en dash. "Snapshot" and "boundary" appear only
  inside exact titles. No metaphor found apart from the informal
  "try-my-change loop", which quotes QT25's own words.
