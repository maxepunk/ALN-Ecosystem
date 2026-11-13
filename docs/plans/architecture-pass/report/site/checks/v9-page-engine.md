# Check: the front page, `index.html` ("The engine"), version 9

Checked 2026-11-01 against the site plan v2 (sections 2, 3.1, 4, 5 and
6; plan v1 sections 2, 4, 5 and 6 where v2 is silent), the overlay
`v9/front.json` and its log, the builder `report/build_site.py`
(`page_engine`, `WORLD_CAPTION`, `WORLD_PEOPLE`, `WORLD_PROGRAMS`,
`world_svg`, `FOOTERS['engine']`, `STATUS_LINE`), the builder's log
`v9/build-log.md`, the requirements (`requirements/2026-11-01-quality-targets.json`,
`requirements/2026-11-01-extension-cases.json`), the promises data
(`report/2026-10-31-engine-jobs.json`: `purpose`, each promise's
`functional`), the decision record (`DECISIONS.md`, "DR"), the roadmap
(`docs/plans/ROADMAP.md`, "RM"), the state page
(`docs/plans/CURRENT-STATE.md`, "CS"), the hardening plan's piece table
(`docs/plans/2026-09-12-block2-hardening-plan.md`), the jargon table
(`checks/jargon-table.md`, "JT"), the live Decisions, Requirements,
Design, Today's engine and Change log pages (for the site guide and the
"now" line), and version 8's front page (`git show 72b4f813:.../index.html`).
The page was read as text with the diagram labels kept, and the world
picture was read in the screenshots at 1100 and 400 pixels
(`site-shots-v9/index-1100-light.png`, `index-400-dark.png`). Refute by
default.

Result: **25 conflicts** over **149 items** checked.

Items: navigation, status line and title 3; lead 3 sentences; timeline 17
(done 5, now 7, next 5); "What you can do now" 1; the pages 6; what the
engine is for 8 paragraphs; moments 32 (6 "when" lines, 6 people lists,
20 promise lines); the standalone line 1; qualities 12; growth 6 (24
case links inside them); the world picture 4 (wide layout, narrow
layout, caption, key); decided lately 5; the words 50 (49 entries and
the intro); footer 1.

## Conflicts

| # | Where on the page | What it says | What it should say | Place to change |
|---|---|---|---|---|
| 1 | Where the work stands, Done, first item | "Coherent on main: the merge train walked and every group of tests passing on main. The unlock block also repaired the deployment guide, which hardware-proven needs." "The merge train walked" is the jargon the owner flagged; "main" is a code-branch word; two readiness names appear with no meaning; the first sentence has no verb. | "Coherent on main, reached on 2026-09-12: everything built since the July release was merged, in order, into the main copy of the code, and every group of tests passes there. The unlock block also repaired the deployment guide, which the next state, hardware-proven, needs." (RM section 3, "Coherent on main"; RM Appendix C) | `v9/front.json` `timeline.done[0].text` |
| 2 | Done, second item | "the equipment families, the dormancy core and the test-harness minimum" (two of the three flagged by the owner; "equipment families" is the same kind of internal name) | "The hardening block's finished pieces: the list of equipment kinds a venue profile can name (screens, speakers, lights, stations, phones); grey "not installed tonight" for any service the profile leaves out; and two small fixes that stop test runs mixing up their logs and files. Its other pieces wait for the build half." (hardening plan, piece table and pin P1; DR "Corrections to the readers and the hardening pieces"; CS section 5) | `v9/front.json` `timeline.done[1].text` |
| 3 | Done, third item | "The architecture pass defined and its program ratified at the definition session; the truth sweep's charter retired." "Program" here is the program document (JT wording 30: "the plan for this review"); the question round has no date, though the rules name rounds by date; the truth sweep is never said to be anything; no verb. | "You approved the plan for the architecture pass at the definition session of 2026-10-30, and retired the truth sweep, the block that was to prove every screen tells the truth; its purpose moves into the build half." (DR "The owner ratified the program document", "The truth sweep's charter is retired") | `v9/front.json` `timeline.done[2].text` |
| 4 | Done, fourth item | "The review that named the design flaws: sixteen design flaws, now test situations for every design." ("design flaws" twice in one line) | "The review that named the design flaws found sixteen; they are now test situations for every design." | `v9/front.json` `timeline.done[3].text` |
| 5 | Next, first item | "It takes the hardening block's remaining pieces, the truth sweep's purpose and the show-ready gate's second condition." The owner cannot read "the show-ready gate's second condition" or "the truth sweep's purpose" without the roadmap. | "It also rebuilds the hardening block's remaining pieces and does the truth sweep's work, proving that every screen tells the truth; it takes the place those two blocks held among the conditions for show-ready." (DR "One program: design half, then build half"; RM section 3, "Show-ready", condition 2) | `v9/front.json` `timeline.next[0].text` |
| 6 | Next, second item | "Hardware-proven: green's home hardware pass, owner time, any time." The rung is not explained at its first use; "green" is first used here and defined only in the words box at the foot; "pass" is a third sense beside "a device's pass" and "the architecture pass" in the words box; "owner time, any time" is a note, not a sentence. | "Hardware-proven: green, the second show machine, built from the deployment guide and passing the home hardware test (real video, sound and Bluetooth speaker, a real bulb, NFC on a tablet, a hardware scanner's sync). You can run it whenever you choose." (RM section 3, "Hardware-proven"; RM section 6, Stage B; CS section 6) | `v9/front.json` `timeline.next[1].text` |
| 7 | Next, items three to five, and the words box's "The blocks" and "The readiness states" | Show-ready, previewable, adoptable, the capture block, the preview block, the depth-and-close block, content tooling and the operations era are named with no meaning anywhere on the page; the words box lists the names only ("Coherent on main (reached), hardware-proven, show-ready, previewable and adoptable"; "the truth sweep (its charter retired)"). The rules let a ratified name stay only if the page says what it means at its first use. | Give each a plain meaning, once, in the words box, and point to it at the first use in the timeline. Show-ready: swapping green in for a show becomes your live choice. Previewable: a designer friend can open the toy game in the design tool, change something and rehearse it. Adoptable: a stranger can stand the platform up and learn it from the guides. The capture block: capturing the roster, notes, photos and accusation during play. The preview block: the first design-tool pages, so a designer can try a change. The depth-and-close block: the rest of the design tool, and closing the program. Content tooling: the platform's own content tool in place of Notion. The operations era: running many games on a kit, with releases between events. The truth sweep: the block that was to prove every screen tells the truth, its plan retired. (RM sections 3, 4 and 7) | `v9/front.json` `words` entries "The blocks" and "The readiness states" (`def`); `timeline.next[2]`, `next[3]`, `next[4]` `.text` |
| 8 | What you can do now | Lists the quality targets, the extension cases, the promises, the standalone questions, the game's record "and the panel's brief", all on Decisions. It leaves out "Four readings of earlier decisions, to confirm", which Decisions asks in the requirements group; and the brief itself is a section of Design, not Decisions (Decisions holds three questions about it). | "You can confirm the requirements now on [[page:decisions]]: the quality targets, with every number left for you to set listed in one place; the extension cases; four readings of earlier decisions; the promises and their wording questions. Then answer the standalone questions, the game's record and three questions on the panel, whose brief is on [[page:design]]. Answer in the chat by a question's letter or its title; each question stands alone." | `v9/front.json` `now` |
| 9 | The pages, Design line | "The decisions ahead, top-down; the directions already decided; the earlier candidate, as one input among the panel's." Design also holds "The panel's brief" and "Later choices"; the guide names neither. | "The decisions ahead, top-down; the panel's brief; the directions already decided and the later choices; the earlier candidate, as one input among the panel's." | `v9/front.json` `siteGuide[3].line` |
| 10 | What the engine is for, seventh paragraph, against the words box | "The standing rules: players' data stays on the kit; media never lives inside the pack; phones and hardware scanners stay equal; the engine holds no opinion about game design; red always means act now; the preflight states its own limits; and nothing deploys to the live machine until the owner says the new engine is ready." The words box defines "The standing rules" as a different list, the roadmap's section 2 rules; three of these items are not among them. One name, two lists, on one page. | Rename the paragraph's list so it no longer claims the roadmap's name: "Some rules hold throughout: ..." (or give it the roadmap's list). The words box entry follows its source (RM section 2) and stays. | `report/2026-10-31-engine-jobs.json` `purpose[6]` |
| 11 | How it must grow, Designers | "a game declared standalone (A small game with no show machine; where the declaration lives, with the pack, the venue profile or the game's record, is your choice)". The decision record makes where it is held "a question for the design rounds" and names four places, each device among them; the Decisions page keeps it for the design round on where authority lives. "With the pack" also reads oddly. | "a game declared standalone (A small game with no show machine); where that declaration lives (the venue profile, the pack, the game's record or each device) is settled in the design round on where authority lives". (DR "Standalone games: declared, never mixed"; DR "Still open", "Kept for the design rounds") | `v9/front.json` `growth[0].line`; the same reading in `requirements/2026-11-01-extension-cases.json` EX12 `throughWhat` ("the owner chooses where") and `case` ("Where the declaration lives ... are the owner's open choices") |
| 12 | How it must grow, all six lines | Each case is written twice, as a description and then its title in brackets: "a scoring model (A new scoring model added once)", "a new kind of screen (Configuring screens, and a new kind of screen)", "a new program the engine drives (A different lighting system or video player)"; 24 brackets in six paragraphs. It repeats itself, the links do not read as part of the sentence, and the build log puts the extra titles behind the page's 2,614 sentence words, over the plan's "under about 2,500". | Let the titles be the items and drop the restated descriptions, for example: "A developer extends it once, as platform work, and other games run as before: [[ex:EX4]]; [[ex:EX9]]; [[ex:EX10]]; [[ex:EX15]]; [[ex:EX18]]; [[ex:EX20]]." The same for the other five lines. | `v9/front.json` `growth[0]` to `growth[5]` `.line` |
| 13 | How it must grow, Developers from outside the team | "A stranger extends it through the published protocol ..." The same page uses "a stranger on the venue wifi" four times for someone who must get nothing. | "A developer from outside the team extends it through the published protocol ..." (the case's own title, from EX21, can stay) | `v9/front.json` `growth[2].line` |
| 14 | How well it must work, Easy to extend | "a capability the engine lacks is added without touching the games already running" | "an ability the engine lacks is added without touching the games already running" (QT21 now says "ability"; "capability" collides with the words box's "Planned capability", JT wording 20) | `v9/front.json` `qualities[5].line` |
| 15 | Who counts on the engine, Release day | "the machine carries one set of matching versions (engine, apps, pack, media and profile)"; the quality line on the same page says "one written list of what it should hold". | "the machine carries everything on one written list of what it should carry (the engine's version, the tablet and phone apps, the pack, the media and the venue profile)" (EJ J10 `functional.need`, which has moved on from JT row I9) | `v9/front.json` `moments[5].promises[0].why` |
| 16 | Who counts on the engine, Author and Rehearse, Who is there | "The designer reading a badge on a draft" | "The designer reading a go or no-go badge in the editor" (EJ J9 `functional.people`; JT row P6) | `v9/front.json` `moments[0].people[3]` |
| 17 | The standalone line under the moments | "The decision Standalone games: declared, never mixed adds a requirement every design choice must serve: ..." The linked title's own colon breaks the sentence, and a second colon follows. | "One decision adds a requirement every design choice must serve ([[dec:standalone-games-declared-never-mixed]]). A whole game can run with no engine, ..." | `v9/front.json` `standaloneLine` |
| 18 | The engine in its world, Operator and Developer | Both arrows run to the engine below the published protocol, labelled "between events" and "code and tests" (wide), and straight up to the engine (narrow). The operator box says "installs packs", and a pack is a protocol file; the test bench's tests reach the engine by message. The key's first sentence says every message and every file crosses one line, so the picture contradicts its key. The key also says "At a show ... the operator ... between events". | Route the operator's pack through "The pack" (or say what the direct arrow is: "swaps machines; picks which installed pack runs"); route the tests through "Messages" and keep only "changes the code" as a direct arrow. In the key, move the operator and the developer out of "At a show". | `report/build_site.py` `world_svg` (wide: the arrows at y 459 and 527; narrow: the arrows at 648 and 628) and `WORLD_PEOPLE['Operator']`, `['Developer']`; `v9/front.json` `worldKey` |
| 19 | The engine in its world, outside programs | Video player, Music player, Audio and Bluetooth, Lighting. The TV's browser is missing, though the quality targets name it with the video and music players among the programs the engine starts, watches and restarts (QT2, QT11, QT24, QT27), and version 8's "Around the engine" had it. | Add "The TV's browser" to the outside programs, and to the key's list "(video, music, audio and Bluetooth, lighting, the TV's browser)". | `report/build_site.py` `WORLD_PROGRAMS`; `v9/front.json` `worldKey` |
| 20 | The engine in its world, people | Eight people; neither the stranger on the venue wifi (QT31, and three moments on this page) nor the developer from outside the team (EX21, its own group under How it must grow) appears. | Add "A stranger on the venue wifi: gets nothing", with its arrow stopping at the protocol, and write the developer as "Developer, on the team or from outside". | `report/build_site.py` `WORLD_PEOPLE` and the `rows` and `grid` lists in `world_svg` |
| 21 | The engine in its world, caption and key | The caption repeats the heading ("The engine in its world: the people and their devices, ...") in capitals, four lines at 400 pixels; the key's first sentence repeats the words box's definition of the published protocol nearly word for word. | Caption: "The people and their devices, the published protocol, the engine, and the outside programs it drives." Key, first sentence: "Every message and every file that reaches the engine from a device, a tool or a screen crosses one line, the published protocol (see The words)." | `report/build_site.py` `WORLD_CAPTION`; `v9/front.json` `worldKey` |
| 22 | Decided lately | Five entries, picked by old number (32 to 36), not by date. It leaves out "Design top-down, hardest-to-reverse choices first", made the same day, the decision that sets this site's frame and the design half's order, and "Build the test rig when building starts", which the timeline's Next column rests on. Version 8's three entries (the words, the after-game decision, the site's pages) are gone with no reason in the build log, and the after-game decision's "players' emails stay outside the engine" is now nowhere on the page. | Add the two missing decisions, each with one plain line from DR. Carry the emails into the privacy quality line: "... game data stays on the kit, players' email addresses stay outside the engine, and data is kept only as long as you set, per game" (QT30; DR "The night's record and the after-game article"). | `v9/front.json` `decidedLately` (add `design-top-down-hardest-to-reverse-choices-first` and `build-the-test-rig-when-building-starts`); `qualities[7].line` |
| 23 | Decided lately, "What the architects' panel sees, and when"; the words box, "The panel" | "the earlier candidate enters in a second round as one more proposal"; "They propose the top-level design blind ..., then critique each other and the earlier candidate. Its brief comes to you before it runs." The rules call the panel's two rounds "the blind round" and "the second round", as Decisions does; the entry also switches from "They" to "Its". | "... enters in the second round as one more proposal"; "Three independent architects ... In the blind round they propose the top-level design; in the second round they read today's engine and critique each other and the earlier candidate. The panel's brief comes to you before it runs." | `v9/front.json` `decidedLately[1].line`; `words` entry "The panel" (`def`) |
| 24 | Decided lately, "One published protocol and an outside test bench" | "Proof stays a quality every part must meet; together they replace the earlier candidate's part Joins and proofs." "Proof" reads as a name the page never gives (it is not among the twelve qualities above), and the part name runs into the sentence. | "Proving each change before it reaches a show stays a quality every part must meet; together they replace the earlier candidate's part "Joins and proofs"." (DR, that entry) | `v9/front.json` `decidedLately[3].line` |
| 25 | Lead, last sentence | "You are at the requirements, the design half's step now; ..." | "You are at the design half's current step, the requirements; the panel and the design rounds design against what you confirm here." | `v9/front.json` `lead` |

## What was checked and found right

- **Frame.** The status line is the plan's sentence exactly; the
  navigation has the six pages with Decisions carrying 18, the count of
  questions A to R on Decisions. The lead puts the requirements and the
  decisions ahead first, today's engine as evidence; nothing calls the
  earlier candidate current or decided (the words box says "Nothing in it
  is decided").
- **No ids, no numbers.** No promise, decision, question, flaw, finding,
  quality-target or extension-case id in the text; no bare phase, step,
  round, block, decision or question number; no em or en dash; "the
  orchestrator" does not appear (the panel lines say "the agent running
  the pass"). Every list on the page (timeline, moments, qualities,
  growth, decided lately, guide, words) is unnumbered. The counts that
  remain (ten promises, sixteen flaws, twelve qualities, 52 planned
  capabilities, versions 5 and 8) are counts, not ids.
- **Timeline against the record and the roadmap.** Now lists the design
  half's seven steps in DR's order ("The design half's method and
  tools", "Name each step by what it does"), the requirements marked
  current by a "Now" badge; the review that named the flaws is under
  Done. Done's facts hold: coherent on main reached 2026-09-12, the guide
  repair closed (RM Appendix C), the three merged hardening pieces and
  the others waiting (CS section 5), version 8 and the topic record. Next
  holds: the build half's thin first version and test bench (DR "One
  program", "Build the test rig when building starts"), hardware-proven
  open and at the owner's pace (CS section 6), show-ready's remaining
  conditions (RM section 3, conditions 3 and 4), blue until then, the
  capture, preview and depth-and-close blocks in the new roadmap's order
  (RM section 10.1), and the later blocks (RM section 7). No reading the
  record marks "to be confirmed" is written as settled; the words box
  marks the nine questions' new reading as "to be confirmed with you".
- **Moments.** Six columns carry all ten promises over twenty lines;
  every person in every promise's `functional.people` appears in a
  column (except the wording in conflict 16), and each "why" matches its
  promise's `functional.need` (except conflict 15). The promise titles
  link to their entries on Requirements.
- **Qualities.** Twelve lines, one per quality in the targets file, with
  the same names, each linking to its group. Each line was read against
  every target in its group; no line states a number the owner is to
  set ("a set time", "set limits", "as long as you set"), and none
  misstates a target, apart from conflicts 14 and 22.
- **Growth.** The 24 extension cases each appear once, under the group
  their `who` names; each line's claims match its cases' `case`,
  `throughWhat` and `mustNotNeed`, apart from conflicts 11 and 13.
- **World picture.** It draws no design inside the engine ("its inside
  is what the design decides"); the four protocol files and the
  messages sit in the protocol band; the outside programs sit on the
  engine's far side, reached by support inside the engine (EX15, QT23);
  the designer, venue technician, GM, players, audience, director,
  operator and developer, with the design tool, Notion, GM tablets,
  phones, scanners, TV and scoreboards, the Director's console and the
  test bench, are all present. At 400 pixels the narrow layout is
  readable with no sideways scroll. The gaps are conflicts 18 to 21.
- **The standalone line, the purpose paragraphs, the footer.** The
  purpose paragraphs equal `engine-jobs.json` `purpose`; the standalone
  line states DR "Standalone games: declared, never mixed" correctly and
  links Today's engine; the footer names the page's sources.
- **Decided lately, as written.** Each of the five lines matches its
  DR entry (apart from conflicts 23 and 24); each title links to its
  entry on Decisions.
- **Words box.** All 49 entries were read against their sources: the
  site's words against CONTEXT.md, DR and the requirements' intros; the
  sequencing names against DR "Name each step by what it does", "The
  design half's method and tools", "Decide in question rounds, never at
  sign-off" and "Run the pass like the re-charter"; the question rounds
  by date; the test levels by name; the design words as in version 8.
  The jargon table's words-box rows W2 and W4 to W9 are applied. Gaps are
  conflicts 7 and 23.
- **The site guide.** Five of the six lines match their pages' sections
  (Decisions: open now, design rounds, decided by topic; Requirements:
  promises, targets, cases, rules; Today's engine: works, sixteen
  situations, standalone, evidence; Change log: versions, wordings,
  numbers and names). The Design line is conflict 9.
- **Version 8 kept.** The lead's first clause, the purpose, the moments,
  the standalone line, the guide and the words carry over in the plain
  wordings. The whole-engine picture moved to Design, and "Around the
  engine" was dropped with a reason in the build log; its loss of the
  TV's browser and the players' emails is in conflicts 19 and 22.
