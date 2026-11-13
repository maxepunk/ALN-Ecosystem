# Check: the quality targets against their sources

Checked 2026-11-01. The file checked is
`2026-11-01-quality-targets.json` (43 targets under 12 qualities), with
its log `2026-11-01-quality-targets-log.md`. Each target was read
against the sources its log names and against the current state page
(`docs/plans/CURRENT-STATE.md` section 0, decisions 20 to 36), the
roadmap's standing constraints, the glossary (`CONTEXT.md`), the ten
promises (`report/2026-10-31-engine-jobs.json`), the list of planned
capabilities (`2026-10-30-map-direction.md`), the after-game survey and
the jargon table. The default was to refute.

Result: 25 conflicts. Four run across many targets (rows 1 to 4); one
is in the log (row 25); the rest sit in one target or a pair.

Short names: STATE = `docs/plans/CURRENT-STATE.md`; ROADMAP =
`docs/plans/ROADMAP.md`; GLOSSARY = `CONTEXT.md`; PROMISES =
`docs/plans/architecture-pass/report/2026-10-31-engine-jobs.json`
(line numbers of that file); SITE-DECISIONS =
`docs/plans/architecture-pass/report/site/decisions.json`; SHAPE =
`docs/plans/architecture-pass/report/2026-11-01-engine-shape.json`.

## Conflicts

| # | Where | What it says | What it should say | Source |
|---|---|---|---|---|
| 1 | `status` of QT7, QT8, QT14, QT16, QT18, QT19, QT22, QT23, QT28, QT29, QT30, QT31, QT37, QT38, QT39, QT43 | Cites "decision 22", "decision 28, answers 3 and 5", "decision 30", "decision 31", "decision 20", "question 13 of the roadmap's ratification", "question 12", "deferral row 8.8", "rules 1 and 2", "part a". | Name each decision and question by a short plain title ("the owner's decision on standalone games", "the owner's ruling that the preflight states its own limits", "the after-game decisions", "the thin first version comes first"). Keep the numbers only in the log, for cross-reference. | STATE decision 36 (lines 165 to 175): decisions, questions and design flaws go by short plain titles on the owner's pages; ids stay only inside records. Decision 34 (lines 141 to 149). |
| 2 | `status` of QT3, QT5 and QT17 | "settled by the owner", resting only on the promises' tests or goals, the pass's open questions, and (QT17) the glossary's runtime-state words. | "proposed" (or "settled in direction: ...; the situation is proposed"). A question in the pass's plan asks; it does not settle. The glossary's runtime-state section says its words "decide nothing about how the engine should hold them". | SITE-DECISIONS, group "About the promises": "Are these the right ten promises ..." has status `open`; the log's own note says the promise tests are not ruled one by one; GLOSSARY section 4b, lines 383 to 388; plan lines 96 to 106 are questions. |
| 3 | QT2 `situation` ("within about ten seconds"), QT3 ("within five seconds"), QT33 ("within half a second") | Gives each time as part of a settled target, with `numberToSet` empty (QT3) or silent on that time (QT2, QT33). "About ten seconds" is not testable as written. | Keep the times, but mark each as the owner's to confirm: add to `numberToSet` "confirm: ten seconds (from the promise's test)", "confirm: five seconds", "confirm: half a second". Drop "about". | PROMISES lines 306, 480, 305 (the promises' tests, not owner rulings); the log's note on numbers (log lines 28 to 33) says the owner has not ruled on them. |
| 4 | `why` of QT16, QT17, QT22, QT37, QT41; `status` of QT26 and QT27 | Argues from today's faults: "Today 'is a video playing' has eight answers", "Today a connection's own word decides", "today every device reads that choice as an outage", "Today a rollback quietly runs a mixture", "the two clocks already cost the director a correction every game", and a status settled by "a test run killed the live show's video player on blue". | Give each reason from the long-term goal (an engine others run, extend and maintain); today's fault may follow as a test case, never as the reason. QT16 also overstates the clocks: the console shifts them back; the source names two games, not every game. | STATE decision 26 (lines 46 to 54) and decision 31 (owner's words "proactive" vs "reactive", lines 118 to 123); the owner's request that the frame be fully proactive; after-game survey lines 78 to 90. |
| 5 | QT1 and QT37 `situation` | "the same ... exposed evidence and phase"; "the game's phase". | "whether the game is in setup, running, paused or ended". The owner asked "which phase 1?"; the word must not carry a second meaning on these pages. | STATE decision 31 (lines 113 to 117) and decision 34; the owner's relayed request on phase wording. |
| 6 | QT3 `situation` | "A scan the GM makes during the minute is either refused with a reason or kept and answered when the connection returns, and the GM can see which", under a settled status. | Keep the outcome the promises need (the GM always knows which happened), and mark what a disconnected tablet does with a scan as open: it belongs to the design round on where authority lives across devices, offline included. | STATE decision 31 (that design round); STATE "Live state": "the shape is silent on a short offline claim list on a disconnected tablet". No source in the log for this sentence. |
| 7 | QT12 `situation` | "A designer builds the toy game, or a new game of their own ... The whole game runs on the engine with no engine change." | "... or a new game of their own that uses only what the engine can already do ..."; a game that needs more is the case QT21 covers (the check refuses it and names the capability). | GLOSSARY line 27 ("The engine can run any game that fits its implemented model"); the gate entry (lines 206 to 227); QT21 in the same file. |
| 8 | QT13 `situation` | "They open no terminal for any of this", where "this" includes building the show machine from the guide. | "Filling in the profile, binding names and running the preflight happen in the tool's pages" (sourced); mark "no terminal for building the machine" as proposed, or drop it. | PROMISES line 553 (the clean-machine test includes "the install line works"); ROADMAP section 1 (profile, one page, one-button preflight); no source says the machine build needs no terminal. |
| 9 | QT14 `situation` | "the engine, the TV's resting picture, the players, the network name". | "the engine, the TV's resting picture, the video and music players, the kit network's name". "The players" reads as the people playing. | GLOSSARY "Kit network" (lines 481 to 489); jargon table row 49 (the music player). |
| 10 | QT17 `situation` | "One piece of code builds that fact both for the live message and for the catch-up"; "Starting the engine, Reset System and the test bench's reset run one and the same list of steps"; "equal keys and values". | Say what must be true, not how: "For every fact, the catch-up a reconnecting screen receives and the live message carry the same fields and values, and a test proves it"; "After engine start, Reset System and a test's reset, the engine is in the same state, and a test proves it". Replace "keys" with "fields". | STATE decision 35 (lines 150 to 164): the candidate shape is withheld from the panel, and this sentence is its Lifecycle and Delivery design (PROMISES goal lines 89 and 332); the task's "never how to build it". |
| 11 | QT18 `situation` and `status` | The shared formats listed omit the venue profile and the media list, and the list is not called versioned. The status cites decision 31's design round; the log calls the protocol decision "pending" (STATE "lines 129 to 132"). | "Everything that crosses the engine's edge (what a device may ask, what the engine answers, what it tells screens, and the files that carry a game or a night: the pack, the venue profile, the night's record, the media list) is written once in the published protocol, one versioned definition. Every program is generated from it or checked against it." Status: settled by the owner's decision on the published protocol and the test bench. | STATE decision 33 (lines 129 to 140), owner-confirmed 2026-11-01 after the explanation; the owner's request for a careful account of the published protocol and how it fits. |
| 12 | QT19 `situation` and `status` | "for each part of the engine one short page that says what it decides, which promises it keeps and how it is tested", under "settled by the owner for the documents (decision 20 ...)". | "for each piece of the engine, a short page ..." and mark the per-piece page as proposed. Decision 20 settles that documents are fixed as we go, not what pages exist. "Part" is the candidate shape's word. | STATE decision 20 (lines 34 to 35); GLOSSARY "Part" (one piece of the candidate design); STATE decision 35 (the candidate shape is withheld from the panel); ROADMAP section 9 is about per-block documents. |
| 13 | QT22 `situation` | "plugs its renderer into the engine's display seam"; "(a constellation, a map)"; "the preflight counts it against the profile" for every new kind of device. | "A game that declares a new kind of display in its pack, such as the second game's constellation, can add the way it is drawn without changing the existing displays or any other game." Keep the preflight count to what the sources rule: remote displays (and phones, once a number is set). | ROADMAP section 7.2 and row 8.8 (constellation only; the extensible surface set is "headroom"); GLOSSARY "Remote display"; jargon table (no "seam" or "renderer" wording; plain words rule). |
| 14 | QT23 `situation` and `why` | "through one interface per kind. Supporting the new program means one new adapter behind that interface and a profile entry"; why: "change only at one seam". | "Supporting a new program changes nothing outside the code that talks to that program and the venue profile: no cue, pack, screen or test changes." Why: "... the engine should change in one place only". | PROMISES goal line 261 is the candidate design; STATE decision 35 withholds it from the panel; jargon table row 20 (no "interface per capability"); the task's "never how to build it". |
| 15 | QT25 `situation` | "every rung of the environment ladder, from the bare automatic test run to the venue"; "the simulation is an ordinary profile ... generated from the pack's needs"; "are one and the same rehearsal". | Use the test levels' names: "logic only; real programs with stand-in hardware; the home test bed; the venue". "A simulation can be generated from the pack's needs so every need is met." "... are one kind of rehearsal at different depths." | STATE decision 34 (test levels by name); GLOSSARY "Simulation" ("One can be generated") and "Rehearse" ("One concept with many depths"). |
| 16 | QT26 `situation` | "if the real class gains or loses a member, or changes a return format, the comparison fails and names the member". | "if a stand-in offers something the real program does not, or answers in a different format, the comparison fails and names the difference". The source does not say a member the real class gains fails the check; "class" and "member" are engineering words. | PROMISES test line 680 ("fails on a member the real class lacks or a different return shape"); process.md section 4 (plain words). |
| 17 | QT27 `situation` | "Every test run is its own running copy of the engine, with its own files, network ports and settings". | "Every test run keeps its own files, network ports and settings, and cannot stop a program it did not start." Logic-only tests run no engine at all; "a test engine runs as an engine of its own" is the candidate shape's answer. | PROMISES needs line 645 ("in the candidate shape a test engine runs as an engine of its own"); STATE decision 35; decision 34 (the logic-only level). |
| 18 | QT28 (whole target) | A quality target that says a thin first version runs "before most of the new engine is built", made of "one player scan on a stand-in device, one GM claim, one cue firing a witness light, one screen updating, on both games". | Move it out of the quality targets: it is an order of building, which the build plan carries. If kept, quote decision 30 only and mark the listed contents as proposed. | STATE decision 30 (lines 94 to 100) and decision 31 ("then a build plan that starts with that thin first version"); neither names the contents. GLOSSARY "Quality": something every part must have. |
| 19 | QT30 `situation` | "Players' email addresses and consent never enter the engine." | "Players' email addresses stay outside the engine." The owner was asked about emails and consent and answered for emails only. | After-game survey question 4 (line 103) and the owner's answer 4 (lines 120 to 121); STATE decision 28 (4). |
| 20 | QT31 `situation` and `why` | "Every action passes one door, checked once, whichever way it arrives"; why: "every door must be a door, and the first outsider must not inherit the owner's keys". | "Every action is checked against what its pass allows, however it arrives, and is refused unless allowed." Why without metaphors: "... every request must be checked, and the first outsider must not hold the owner's passwords." | GLOSSARY "The floor" (deny by default, re-checked at execution, every transport); "one door" is the candidate shape's design (SHAPE quality "Only the GM moves the game"; STATE decision 35); process.md section 4 (no metaphors). |
| 21 | QT33 `situation`, `numberToSet` and `status` | "The preflight reads those limits and refuses a start that would break them"; the target kit size is "a number to set" with no scale given. | "The preflight checks the machine's disk, temperature, processes and ports and shows each as go or no-go" (sourced); mark refusing a start on load limits as proposed. Give the scale the owner already set: one two-hour show for a few dozen devices. | GLOSSARY "Preflight" (the host checks; refusal only for an unmet required need or a broken profile); STATE decision 35 (lines 152 to 157: "one two-hour show for a few dozen devices"). |
| 22 | QT34 `situation` and `status` | "The number is written down, the profile declares it, and the preflight counts connected phones against it", under "settled by the owner in direction". | Keep "measured before phones are admitted" as settled in direction; mark "the profile declares it and the preflight counts phones against it" as proposed (modeled on remote displays). | ROADMAP section 7.1 ("kit capacity work precedes phone load", nothing more); GLOSSARY "Remote display" is the model, not a ruling for phones. |
| 23 | QT39 `situation` and `status` | "What the players found reaches the record when their devices are brought to it (how is a design choice)"; "it shows the memory". Status lists only exposure and video tokens as open. | Mark open whether a standalone game's record holds player scans at all (the owner's question on one GM tablet per standalone game asks exactly this). "It shows the token's content" ("memory" is ALN's word, which QT20 bars from the engine). | SITE-DECISIONS question 24: "whether a standalone tablet's record of the night can hold player scans", status `open`; STATE open items (lines 176 to 183); QT20 and GLOSSARY section 8. |
| 24 | QT40 against QT4 | QT40: "A scan the engine refuses for good (no game exists) is shown as refused and never retried." QT4: a batch that arrives while no game exists is refused "and the scanner keeps the scans, or the engine stores them". For kept scans sent when no game exists, one says drop, the other keeps. | QT40: "A live scan refused because no game exists is shown as refused and never kept for later (the standing scanner decision). Scans already kept, sent when no game exists, follow QT4: kept by the device or stored by the engine, never answered 'processed' with nothing kept." | `arduino-cyd-player-scanner/CLAUDE.md` (a 409 no-session is final for a live scan, not queued); PROMISES test line 234 (the batch case). |
| 25 | The log | STATE line pointers past line 128 are stale: "STATE lines 129 to 132 (the pending decision on the published protocol)" is decision 33, now made; "133 to 141 (open: one GM tablet ...)" is decisions 33 and 34; "276 to 286" (how the venue runs) is lines 317 to 326; "246 to 256" (section 1) is lines 287 to 297. | Re-point: decision 33 lines 129 to 140 (made, not pending); open questions 24 and 25 at lines 176 to 183; section 3 at lines 317 to 326; section 1 at lines 287 to 297. Add decisions 33 to 36, which the log does not cite. | STATE as it stands now (decisions 33 to 36 at lines 129 to 175). |

## What was checked and found right

- **Promise titles.** Every one of the 94 promise references across
  the 43 targets matches a `functional.proposedTitle` in PROMISES
  exactly. No misquotes.
- **Every promise served.** Counted from the JSON: "A change is proven
  before it reaches anyone, and the owner alone sends it to the show"
  14; "The designer's game is the game the whole kit plays" 12; "Every
  tap gets its answer, and the night can be told afterwards" 12; "The
  game fits the venue it is in tonight" 11; "Anyone reading a screen
  can act on it without a second question" 10; "One game, the same on
  every screen" 9; "The room does what the designer cued and the GM
  asked" 9; "The designer changes a value and plays it within
  minutes, and the live show never notices" 7; "Each person sees their
  part and can do only their part" 6; "Each lifecycle button does
  exactly what its name says" 4.
- **Qualities.** Twelve headings: the ten the log names as the listed
  qualities, four targets each, plus "Safe release and rollback" (two)
  and "More than one copy, kit or pack without rework" (one). The
  candidate's five qualities (Honesty, Proof, Generic, Who decides
  when there is no engine, Only the GM moves the game; SHAPE) each
  have targets (QT5 to QT8; QT25 to QT27; QT20 and QT24; QT37 to QT39;
  QT31). The owner's three goal words are covered: easy to maintain
  (QT17 to QT20), continue development on (QT25 to QT28), extend (QT21
  to QT24). Every item on decision 22's list has a target: applying a
  change while the engine runs (QT9), the trial copy (QT11), capture
  (QT16), phones (QT22, QT34), standalone games (QT37 to QT39).
- **Standing constraints honoured.** Privacy defaults (QT29, QT30
  match ROADMAP 2.1 rules 1 to 4); growth without corners (QT24, QT43
  match 2.2); the media model (QT35 matches 2.3: names with
  fingerprints, a checked bundle that moves); the design-iteration
  loop (QT9 matches 2.4 and the ruling that applying a change refuses
  a running or paused game); platform parity (QT12, QT22 match 2.5);
  the engine holds no opinion (QT20 matches 2.6 and GLOSSARY section
  8); frozen production, blue and green, releases between events
  (QT42 matches ROADMAP sections 3, 6 and 7.4).
- **Decisions honoured.** Standalone declared and never mixed (QT37,
  QT38 match decision 22; QT37 and QT39 mark the open parts); the
  night's record carries the pack and the texts, the console stays a
  separate program, one clock (QT16, QT23 match decision 28); the
  trial copy touches nothing live (QT11 matches PROMISES lines 401,
  406, 429 and the preview-profile demand).
- **Numbers with a source.** Three router settings (GLOSSARY "Kit
  network"); tonight's kit, two tablets, three hardware scanners, two
  scoreboard screens, HDMI and one Bluetooth speaker (STATE section 3);
  the first sync of 5 to 15 minutes for 30 to 40 MB (the project
  guide); one polling interval (PROMISES line 617). Every `numberToSet`
  names what the owner sets, and the proposed parts of QT19, QT31 and
  QT33 say so.
- **Wording.** No em dashes, no promise numbers, no capability
  numbers, no finding ids, no bare phase, step, block or round number
  (the roadmap's blocks go by name). The jargon table's wordings are
  used where they apply: the program watcher, the trial copy, not
  installed tonight, the catch-up, live message, fingerprint, test
  stand-in, its own files, network ports and settings, the TV's
  browser, the check before a game starts.
- **Log pointers into PROMISES, ROADMAP, GLOSSARY and the list of
  planned capabilities.** Every line the log cites in those four files
  that was opened (PROMISES lines 23 to 692, DIRECTION lines 32 to
  286, ROADMAP sections 1 to 9 and appendix B, GLOSSARY sections 0 to
  8) says what the log says it says. Only the STATE pointers drifted
  (row 25).
- **Targets found right as written**, apart from the cross-cutting rows
  1 to 4: QT6, QT8, QT9, QT10, QT11, QT15, QT20, QT21, QT24, QT29,
  QT32, QT35, QT36, QT38, QT41, QT42, QT43 (17 of 43).
