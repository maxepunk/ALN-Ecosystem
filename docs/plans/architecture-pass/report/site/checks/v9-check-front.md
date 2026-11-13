# Check: `v9/front.json` (the front page overlay, version 9)

Checked 2026-11-01 against the plan (`site/2026-11-01-site-plan-v2.md`,
sections 2 to 6; plan v1 sections 2 and 5 where v2 is silent), the
decision record (`DECISIONS.md`, "DR"), the jargon table
(`checks/jargon-table.md`, "JT"), the quality targets ("QT") and
extension cases ("EX") in `requirements/`, the roadmap
(`/docs/plans/ROADMAP.md`, "RM"), the state page
(`/docs/plans/CURRENT-STATE.md`, "CS"), the engine-jobs data ("EJ"),
the engine-shape data and version 8's `front.json` and `changes.json`.
Refuted by default; every item below was read against its source.

**Result: 18 conflicts over 129 items.** Items: lead 1; timeline 17
(done 5, now 7, next 5); now 1; moments 20 promise lines in 6 columns;
standaloneLine 1; qualities 12; growth 6; worldMermaid 1; worldKey 1;
decidedLately 5; siteGuide 6; words 49; intros 9. All 39 markers were
validated inside those items.

## Conflicts

| # | Where | What it says | What it should say | Source |
|---|---|---|---|---|
| 1 | `lead`, last sentence | "You are at the design half's first step, the requirements" | "You are at the requirements, the design half's step now" (or "the first of the steps still ahead"). The record puts the review of today's engine first in the design half's order, already done, and the requirements after it. | DR "The design half's method and tools" ("in its current order: the cause analysis (done ...); the requirements ..."); CS section 0 ("the requirements (now)") |
| 2 | `timeline.done[0]` | "Coherent on main: the unlock block's merge train walked, the engine green on its full test suites, and the deployment guide repaired." | Keep the guide repair apart from coherent on main: coherent on main was reached 2026-09-12 by walking the train; the deployment guide's repair closed 2026-09-13 and gates hardware-proven, not coherent on main. For example: "Coherent on main: the merge train walked and every test passing on main. The unlock block also repaired the deployment guide, which hardware-proven needs." | RM section 3 ("Coherent on main ... Reached 2026-09-12"); RM Appendix C heading ("gates hardware-proven") and "Closed by R24 (2026-09-13)"; RM section 4, the unlock block |
| 3 | `timeline.done[0]` | "the engine green on its full test suites" | "every group of tests passing on main". "Suite" is jargon (JT: "group of tests"), and "green" for a passing run collides with green the machine, which the next column names twice ("green's home hardware pass", "the swap to green"). | JT wording 54 (suite to group of tests); JT words box W4 and open call 5 (green as passing is unrelated to the machine) |
| 4 | `timeline.done[3]` | "The review of today's engine: sixteen design flaws ..." | "The review that named the design flaws: sixteen design flaws, now test situations for every design." | JT wording 26 (the cause analysis takes "the review that named the design flaws", site-wide) |
| 5 | `timeline.next[2]` | "Show-ready, then the swap to green: ..." | "Show-ready, then the swap to green when you say the new engine is ready: ..." Show-ready makes the swap a live choice; the decision stays the owner's. | RM section 3, "Show-ready" ("the decision itself remains the owner's at this state"); QT42 ("Nothing reaches the show machine until the owner says the new engine is ready") |
| 6 | `qualities[0]` (Staying up through a live show) | "every device back by itself under its own name" | "every tablet back by itself under its own station name". The targets name tablets; no target says every device reconnects under its own name. | QT1 situation ("Every tablet reconnects by itself under its own station name"); QT3 ("back under its own station name") |
| 7 | `qualities[5]` (Easy to extend) | "... and a second production's kit each cost an addition in one place, never a change elsewhere in the engine." | Each case costs something different: a second game runs on the pack, and a missing capability is an additive change that leaves both games running; a new device joins by its pass; a swapped program changes only the code that talks to it and the venue profile; a second kit needs a new profile and no engine change at all. "An addition in one place" holds only for the swapped program. | QT21 ("an additive change: ALN's pack and the toy game's pack run as before"); QT22; QT23 ("changes nothing outside the code that talks to that program and the venue profile"); QT24 ("a new profile and the same engine code") |
| 8 | `qualities[7]` (Privacy and access) | "Players have no account and no recorded identity unless the game designs an identification moment" | "Players have no account, and the engine records a device or session id and nothing about the person, unless the game designs an identification moment". The engine does record an identity: the device's or session's. | QT29 ("The engine records a device or session id and nothing about the person"); RM section 2.1 rule 2 |
| 9 | `growth[0]` (Designers) | "A designer extends the platform through the pack alone ..." | "through the pack and its media bundle, written in the design tool ...". The media files go in the media bundle (whole game, new tokens); where a standalone game's declaration lives (pack, venue profile or the game's record) is open; a rehearsal runs on a trial copy with a profile generated from the pack. Drop "alone", or name these. | EX1 and EX5 `throughWhat` (the media bundle); EX12 `throughWhat` ("carried with the pack, the venue profile or the game's record (the owner chooses where)"); EX14 `throughWhat` |
| 10 | `worldMermaid` and `worldKey`, the outside programs | The video player, music player, audio and Bluetooth, and lighting sit inside "Outside the engine", their edges cross the subgraph "The published protocol: every message and file that crosses this line", and the key says "Everything outside the engine reaches it across one line, the published protocol". | Draw the outside programs on the engine's other side, not across the protocol line, and say so in the key: the published protocol covers what a device may ask, what the engine answers, what it tells screens, and the files; the engine reaches its outside programs through support written for each program, which a swap changes in one place. As drawn, the picture makes VLC, the music player and Home Assistant parties to the published protocol, which the record does not say. | DR "One published protocol and an outside test bench" (what the protocol defines); QT23; EX15 `throughWhat` ("Support for the program, added once inside the engine"); EX21 `throughWhat` (the protocol, and separately "the places a developer adds a device, a program ...") |
| 11 | `worldMermaid`, people | No operator: the people are designer, venue technician, GM, players, audience, director, developer. | Add the operator (you, or a future one), who picks the installed pack for the night, keeps the machine's written list and swaps machines; the growth section names operators as one of the six kinds who extend the engine. | EX16, EX17, EX23, EX24 (`who`: operator); QT41, QT43 |
| 12 | `worldMermaid`, programs | No content source: the design tool alone feeds the pack. | Add the content source that feeds the pack (Notion today; another content tool later through one source adapter), or name it in the key. Version 8's picture drew Notion and the sync script. | EX18 ("A developer writes one source adapter for that tool; it feeds the same pack through the same check"); QT23 ("the designer replaces Notion with another authoring tool"); v8 `aroundMermaid` |
| 13 | `worldKey`, second sentence | "No person touches the engine directly: ... the developer through the test bench" | Say the picture is the running engine at a show: "At a show, no person touches the running engine directly ...; the developer changes the engine's code and proves it from the test bench outside." Developers add code inside the engine (a scoring model, a device kind, a program's support), which the growth section on the same page says. | EX4, EX10, EX15 ("added once inside the engine"); DR "One published protocol and an outside test bench" ("The tests become a test bench outside the engine"); `growth[1]` |
| 14 | `decidedLately[2]` (Name each step by what it does) | "no page uses a bare step, block or round number." | "no page uses a bare phase, step, block or round number." The decision names phase first; it is the word the owner asked about ("which phase 1?"). A bare "phase" is not banned, only a bare phase number. | DR "Name each step by what it does" ("No page uses a bare phase, step, block or round number"); plan v2 section 2 ("No bare phase, step, block, round, decision or question number") |
| 15 | `words[2]` (Quality) | "... like honest or proven. It keeps promises; it is never a promise or a part. The twelve qualities on this page group the quality targets." | Give examples from the twelve the page shows, for example "like every screen telling the truth, or testable without the live show". "Honest" and "proven" are the earlier candidate's qualities (Honesty, Proof), not among the twelve. | QT `quality` values (twelve); engine-shape `qualities` (Honesty, Proof, Generic, ...); CONTEXT.md "Quality" (its example: every fact on a screen says how old and how sure it is) |
| 16 | `words[5]` (The standing rules) | "The roadmap's rules that bind every block: players never have accounts; game data stays on the kit; media never lives inside the pack; phones and hardware scanners stay equal; the engine holds no opinion about game design; nothing assumes one kit, one pack or one production." | Add the rules the list leaves out: naming a person is game policy, never an engine default, and the engine's only built-in identity is the device or session id; how long game data is kept is your decision, per game; a game is playtested without code or settings files, a change applied between games (the design-iteration loop). And "phones and hardware scanners stay equal in what the engine lets them do, not in their screens". | RM section 2.1 rules 2 and 4; RM section 2.4; RM section 2.5 ("equal in engine capabilities ... Parity does NOT mean identical user interfaces") |
| 17 | `words[12]` (The earlier candidate) | "The 17-part shape of the engine drawn bottom-up from today's engine for version 8 of this site." | "... drawn bottom-up from today's engine, on this site since version 5." The candidate shape of 17 parts was added in version 5 and drawn whole in version 7; version 8 gave it its own page. | v8 `changes.json` versions 5 ("a candidate shape of 17 parts"), 7 and 8; CS section 0 ("Live state": workflow `wf_5f2445a0-bac`) |
| 18 | `words[31]` (The requirements) | "The design half's first step, now: the promises with your answers, the quality targets as testable situations, and the extension cases, with who does the extending." | "The design half's step now: the promises with your answers, the quality targets as testable situations, the extension cases with who does the extending, and the standing rules." Two faults: "first step" as in conflict 1, and the standing rules left out, though the lead, the timeline and the site guide list them as requirements and the panel gets them. | DR "The design half's method and tools"; DR "What the architects' panel sees, and when" ("the requirements (... the standing constraints)"); plan v2 "What the site must do now" (1) |

## What I checked and found right

- **Fields and plan.** Every field plan v2 section 4 names for
  `front.json` is present (`lead`, `timeline` with `done`, `now`, `next`
  and `{text, current?}` items, `now`, `moments`, `standaloneLine`,
  `qualities`, `growth`, `worldMermaid`, `worldKey`, `decidedLately` as
  `{slug, line}`, `siteGuide`, `words` with groups `page`, `sequence`,
  `design`, `intros` for requirements, design and today). The JSON parses.
- **Markers (39).** 24 `[[ex:]]`, one for each of EX1 to EX24, each id
  real; 6 `[[page:]]` (`decisions`, `today`), none retired; 6 `[[dec:]]`,
  every slug equal to a DR title under the slug rule
  (`standalone-games-declared-never-mixed`,
  `design-top-down-hardest-to-reverse-choices-first`,
  `one-published-protocol-and-an-outside-test-bench`,
  `build-the-test-rig-when-building-starts`,
  `the-night-s-record-and-the-after-game-article`,
  `blue-s-fixes-are-evidence-of-design-causes`); `[[part:P4]]` (Answering)
  and `[[part:P6]]` (Delivery) match the doors the words box describes;
  `[[flaw:C16]]` is the green-test-run flaw. No `[[q:]]`, as the plan
  keeps letters on Decisions.
- **decidedLately.** All five slugs are titles in DR (36, 35, 34, 33, 32
  in the number table, all made 2026-11-01). Lines 1, 2, 4 and 5 state
  their decisions faithfully; line 3 is conflict 14. Choosing these five
  as "latest" is a reading: DR dates nine decisions 2026-11-01 and gives
  no finer order, so the choice is defensible but not proven.
- **Timeline, now column.** The seven steps in the order and names of DR
  "Name each step by what it does" and "Design top-down,
  hardest-to-reverse choices first"; the requirements marked current;
  the panel's line matches "What the architects' panel sees, and when";
  the sign-off ends the design half with the new roadmap ("One program:
  design half, then build half"; "Run the pass like the re-charter").
- **Timeline, done and next.** The hardening block's merged pieces and
  its waiting pieces; the definition session's ratification and the
  truth sweep's retired charter; version 8 and the topic record; the
  build half taking the hardening block's remaining pieces, the truth
  sweep's purpose and the show-ready gate's second condition, with the
  test rig built at its start; hardware-proven as owner time; the
  capture, preview and depth-and-close blocks in the order the new
  roadmap sets; the later blocks by their RM section 7 names, the
  release block reaching adoptable. All five readiness states appear.
  No block, step or round number.
- **now.** Matches plan v2 section 3.2's groups in order and
  `decisions.intro`'s answering rule.
- **Moments.** Carried from version 8 with JT row I9 applied; each of the
  twenty promise lines matches its promise's need in EJ, every promise
  appears, every person in each promise's people list appears in a
  column. The roles line ("The GM alone can start, pause, end and change
  scores") is the promise's own need, so it stands; JT wording 52 targets
  other rows.
- **standaloneLine.** Matches DR "Standalone games: declared, never
  mixed", with JT row I10's "design choice" and the parity table's plain
  name, pointing to Today's engine.
- **Qualities.** Twelve lines, their names equal to QT's twelve
  `quality` values; no number stated where QT leaves one to the owner.
  Lines 2, 3, 4, 5, 7, 9, 10, 11 and 12 state their targets faithfully;
  1, 6 and 8 are conflicts 6 to 8.
- **Growth.** Six kinds cover every EX `who`; developers, outside
  developers, venue technicians, operators and directors state their
  cases faithfully; the designers' line is conflict 9.
- **World picture.** 22 nodes, no part or module drawn inside the engine,
  one colour literal (the teal the theme maps); the four protocol files
  (pack, venue profile, night's record, media list) drawn; the GM, the
  players, the audience, the director, the designer, the venue
  technician and the developer with their devices or files; the
  director's console outside, reading the record. Conflicts 10 to 13 are
  the exceptions.
- **Words.** Version 8's entries carried with JT's wordings and words-box
  rows (W2, W4 to W9, W-revise 1 to 3, with plan v2's design half and
  build half for W1); the sequencing names (the architecture pass, the
  two halves, the seven steps, question rounds by date, the blocks by
  name, the readiness states, test levels by name) match DR; the
  architecture pass questions entry states DR's "to be confirmed"
  reading as such; the published protocol, the pack, the venue profile,
  the night's record, the media list and bundle, the test bench and the
  test rig match their sources. Exceptions: conflicts 15 to 18.
- **Intros.** Requirements, design and today paragraphs follow plan v2
  sections 3.3 to 3.5 (the six decisions ahead in DR's order, the three
  decided directions by marker, the earlier candidate as one input,
  today's engine as evidence that never drives the design).
- **Rules scan of visible text** (markers and promise ids stripped): no
  promise, flaw, finding, quality-target or extension-case id; no em or
  en dash; no bare phase, step, block, round, decision or question
  number; no "installer", "job", "cutover", "backend", "snapshot",
  "manifest", "hash", "adopt" (a pack) or "preview engine"; "dormant"
  only where the words box says it is the code's word; no metaphors
  found. The only jargon hits are conflict 3.
