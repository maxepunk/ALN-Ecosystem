# Check: the extension cases against their sources

Checked 2026-11-01 on branch `claude/nice-curie-hescfv`:
`2026-11-01-extension-cases.json` (the intro and 21 cases, every field:
who, case, throughWhat, mustNotNeed, when, promises, status, why),
read against `docs/plans/CURRENT-STATE.md` section 0 (decisions 20 to
36), `docs/plans/ROADMAP.md` sections 1, 2, 3, 4, 6, 7 and 8,
`CONTEXT.md`, `report/2026-10-31-engine-jobs.json`,
`2026-10-30-map-direction.md`, `2026-11-01-after-game-report.md`, the
jargon table (`report/site/checks/jargon-table.md`) and, where a "when"
said "now", the code on this branch. The log beside the JSON was used
to find each case's sources, not trusted.

Result: 22 conflicts. Three cases the sources demand are missing; the
published-protocol wording predates decision 33 and no longer matches
it; one case (the new outside program) is built from the candidate
shape that decision 35 withholds from the panel's first round; six
"when" lines claim more than the roadmap schedules.

## Conflicts

| # | Where | What it says | What it should say | Source |
|---|---|---|---|---|
| 1 | intro, last sentence | A "published interface" is "the list of requests and replies between the engine and the devices, the pack's file formats, and the format of the night's record"; the log calls the protocol "the owner's pending question". | Use the owner's name, **the published protocol**, and his definition: one versioned definition of everything that crosses the engine's edge (what a device may ask, what the engine answers, what it tells screens, and the files that carry a game or a night: the pack, the venue profile, the night's record, the media list). Every program's code is generated from it or checked against it. It is settled, and it is designed in an early design round. | CURRENT-STATE decision 33 |
| 2 | EX10 throughWhat; status "settled" | "a published interface (... with the reply words and the rules a device needs delivered to it as data); one device adapter per device kind". | "The published protocol; everything the designer iterates on reaches the device as pack data, never firmware." The reply words as a closed list read as data, and the rules as data tables, are the candidate shape's design (the log says so), so either drop them or mark that half proposed. | decision 33; ROADMAP 2.5; log EX10 (SHAPE P1, P4) |
| 3 | EX21 throughWhat, case | "The published interfaces (... the night's record's format, the adapter seams)"; "send their change back with the proof that the show still runs". | "The published protocol (what devices may ask, what the engine answers and tells screens, the pack, the venue profile, the night's record, the media list)". The adapter points inside the engine are not part of the protocol and "seams" is jargon: say "the places a developer adds a device, a program, a scoring model or a content source". "the proof" becomes "the developer's tests". | decision 33; jargon table rows 9 and 39 |
| 4 | EX15 case, throughWhat, status, why | An adapter "beneath the engine's equipment interface: the few verbs the engine uses ..., a dated picture of what the program is doing, and a software stand-in"; status "the candidate shape's Equipment part"; why "seven programs ... with no interface above them". | Say what must be possible, not how: a developer adds support for a new lights system or video player once; the pack, the cues, the GM's screens and the support for other programs do not change; it has a software stand-in for tests and rehearsal; the program watcher covers it. Remove the candidate shape's words and its tangle: decision 35 withholds the 17-part shape from the panel until its second round. "verbs" and "dated picture" are jargon and metaphor. | decision 35; decision 31 ("never how to build"); CONTEXT Simulation and Supervisor |
| 5 | EX15 case, throughWhat, when, status | "The venue technician says in the profile whether the engine starts the program itself or uses one already running"; the "start-or-use setting" is "settled". | Where that setting lives is open for the design rounds: the ratified list of planned capabilities puts it in the host settings file (modes self and adopt), the glossary says how each program restarts is host configuration, not profile content, and only the candidate shape puts it in the profile. Write it with the jargon table's long form, "the setting that says whether the engine starts each program or uses one already running". | map-direction row "The host-config file" and section 3.3; CONTEXT Supervisor; CURRENT-STATE "Live state" (the shape departs from the map); jargon row 13 |
| 6 | EX6 case | "In a venue with no lights tonight, the cue's lighting shows as not installed tonight, grey, and the siren still plays." | Add the designer's choice: the designer marks whether the lights are needed. Marked "skip it", the lighting shows grey and the siren plays; marked "block the show", the preflight says no-go and the game does not start without the typed override. | CONTEXT "One truth, three loops", "Endpoints vs stack", Preflight |
| 7 | EX6 when, mustNotNeed | "now (cues are pack content; the last venue name left in pack content is retired in the preview block)"; must not need "a venue's scene ids ... inside the pack". | ALN's pack still carries venue scene ids as lighting fallbacks; they retire with the bindings page in the depth-and-close block. So: "now for cues that name roles; the last speaker name leaves the pack in the preview block, and the venue scene ids kept as lighting fallbacks leave it in the depth-and-close block." | ROADMAP Block 6 (the loud-fallback retirements); PHASE3-STATUS ledger L7; `ALN-TokenData/game.json` `lightingRoleFallbacks` |
| 8 | EX8 when | "a planned block: the preview block, where the GM scanner redesign's design opens (the phase-advance control and phase-relative cue timing)". | "The GM scanner redesign carries it: its design opens in the preview block, and its build is priced and slotted by its own planning session; no block delivers it yet." | ROADMAP deferral registry, GM-scanner redesign row |
| 9 | EX9 when, status, throughWhat, why | A new kind of public screen comes "later (roadmap section 7.2 and the deferral registry's row on pack-defined display surfaces)", "settled"; "a renderer module behind the display-surface seam"; "needs the seam opened". | The second game's modules bring one new screen, the constellation. Letting packs pick from new kinds of screen in general is room left beyond that, with no slot: "later for the constellation screen (the second game's modules); a general way to add new kinds of screen has no slot yet." Plain words for "renderer" and "seam": "the code that draws a new kind of screen", "the place a new kind of screen plugs in". | ROADMAP deferral row on pack-defined display surfaces ("stays headroom beyond it"); CONTEXT "surface" |
| 10 | EX12 when, case | "now, as a choice a game may declare; the declaration itself does not exist yet"; "the GM tablet and the player scanners each work alone". | "The design must allow it now; nothing builds it yet." Add what decision 22 records: the hardware scanner cannot work alone today, a parity gap the owner's explicit word is still asked for; and the open question of exposure and video tokens in a game with no engine. | decision 22; CURRENT-STATE section 0, open questions 24 and 25 |
| 11 | EX13 when | "now for the profile and the hand-run preflight"; the case describes a one-button preflight where "each line says what it checked and whether it checked paper or the live room". | "Now for the profile and the hand-run checklist; the one-button preflight with paper or live on every line is hardening work rebuilt inside the architecture pass (today only a minimal check exists); the bindings page and profile manager in the depth-and-close block." | ROADMAP section 3 (hardware-proven: "today's hand-run preflight checklist document"); map-direction row "The preflight" (partly built); CURRENT-STATE section 1 |
| 12 | EX14 case, mustNotNeed | "On a laptop ..."; must not need "the show machine". | Where the trial copy runs is open. The promise's own moment is "on a laptop or on the show machine between games". Say "On a laptop, or on the show machine between games (where it runs is an open question)", and drop "the show machine" from mustNotNeed; keep "the live engine's programs or records". | engine-jobs, "The designer changes a value and plays it within minutes, and the live show never notices" (moment; goal "Where it runs is open") |
| 13 | EX17 when, throughWhat | "now (the swap method is ratified ...)"; "The machine's described set, which the engine compares at start and reports". | The swap is ratified now; the check of one matching set does not exist. "now for the swap; the check that a machine carries one matching set is new work." The comparison at start is the candidate shape's design (the log says so); state the need: "the owner can see that a machine carries one matching set before it goes out". Replace "described set" with "one written list of what the machine should carry". | ROADMAP section 6; engine-jobs, "A change is proven before it reaches anyone, and the owner alone sends it to the show" (need); jargon row 62; log EX17 (SHAPE P17) |
| 14 | EX16 throughWhat, when | "the described set its machine carries"; "the seams that keep it cheap are built now". | "one written list of what the machine should carry"; "what keeps it cheap is built now: each pack and profile picked by name, no kit's own names inside the engine's code, a network name per kit, media that moves between machines." | jargon row 62; ROADMAP 2.2 (its checklist) |
| 15 | EX11 throughWhat, mustNotNeed, when, case | "the engine computes each pass's rights from the pack and its own floor"; "any loosening of the staff-only floor"; "now for the floor"; "a station on the floor". | "The floor" is jargon, and "a station on the floor" now reads two ways. Use the jargon table's wording: "starting, pausing and ending the game, show control and score changes stay with staff who log in, such as the GM". "Computes each pass's rights" says how; say "the pack says what each kind of device may do, within that limit". | jargon row 52; CONTEXT "The floor" |
| 16 | EX20 throughWhat | "the rules library, the interaction engine, the display-surface seam". | "the rules, multi-tap player actions, and the place a new kind of screen plugs in". | jargon row 57; ROADMAP 7.2 |
| 17 | EX2 throughWhat | "the apply step is a request the engine answers at a moment between games". | The need is settled (applied only between games, or refused with a reason); the means ("a request") is the candidate shape's answer to an open architecture pass question, whether anything but the live engine can touch the live show. Say "the engine applies the change only between games, or refuses and says why". | ROADMAP 2.4; jargon row 24, question 4; engine-jobs goal ("The Design studio talks to the engine only by message", candidate-shape wording) |
| 18 | EX1 when | "now", with throughWhat naming "a media bundle for the files the pack names". | The media bundle does not exist. "now for the pack; checking the media against the pack in the preview block; the bundle and its upload later (content tooling)". | ROADMAP 2.3 and deferral row on media reference checking; CONTEXT Media bundle |
| 19 | status of EX1, EX2, EX10, EX12, EX13, EX14, EX19 | "decision 26", "decision 22", "decision 27", "decision 28". | Decisions go by short plain titles on the owner's pages; numbers stay only inside records. For example "the owner's decision on standalone games", "the owner's frame for the pass", "the owner's decision on the after-game article". | decision 36; decision 34 |
| 20 | missing case | Nothing covers what a scan causes. | A designer declares what a scan triggers, for example that a GM scan plays a token's video. Today only a player scan can trigger a video, an ALN opinion built into the engine; a game played only on GM tablets reaches video through one standing cue per token. Who: designer. Through: the pack. When: later, with multi-tap player actions (players' phones). Settled by the deferral row on GM-scan video cueing and the engine-holds-no-opinion rule. | ROADMAP 2.6 and deferral row on GM-scan video cueing; CONTEXT "Idle loop vs game-event video" |
| 21 | missing case (EX16 folds it into a second operator) | A library of installed packs appears only for another operator, "later". | Our own kit runs a different installed game per event: Friday ALN, Saturday another game, without copying files or changing code. Who: operator. Through: an installed pack picked by name. When: now, by picking the pack at startup by path or id; a selection page later. The roadmap calls this "a real requirement", and the interim state is "a growing library of its own games". | ROADMAP section 1 (interim state) and 7.4 item 1 (multi-game kits) |
| 22 | missing case | No case covers where a game's records go and how long they stay. | The owner (or a future operator) decides per game how long old game records are kept, and no game data leaves the kit unless the owner moves it; a game that names players inherits the same rules. Who: owner or operator. Through: a per-game setting. When: the design must allow it now; these are the privacy defaults every operator inherits. | ROADMAP 2.1 rules 3 and 4 |

## What I checked and found right

- **Promise titles.** All 47 promise references across the 21 cases
  match a `functional.proposedTitle` in the engine-jobs file exactly,
  and each listed promise does name the need the case relies on.
- **No media inside packs, no player accounts, no engine default about
  naming people.** No case breaks these. EX5 keeps files in the media
  bundle and names them by fingerprint; EX10 and EX11 rule out accounts
  and logins and leave identification to the game; EX19 keeps players'
  emails outside the engine (decision 28).
- **Settled cases that are settled.** EX3 (modes as flags; the GM
  scanner already cycles any number of declared modes,
  `ALNScanner/src/app/domains/gameOps.js:33`), EX4, EX5, EX7, EX10's
  core, EX11's core, EX13's core, EX14's core, EX16, EX18, EX19, EX20
  and EX21 each rest on the decision or roadmap section their status
  names.
- **"When" lines that hold.** EX2 (the preview block, with the rules
  editor), EX3 now, EX4 and EX20 (the second game's modules), EX5's
  split, EX7 (built; editor in the depth-and-close block), EX10
  (players' phones, with the kit's network name and certificate), EX18
  (content tooling), EX19 (the capture block, then owner-paced), EX21
  (the release block and the adoptable state).
- **No em dashes, no promise, capability, finding, step, phase or block
  numbers** in the JSON. Blocks go by name, as decision 34 asks.
  Roadmap section numbers appear only beside a block's name, as a
  citation.
- **Plain wordings applied** where the jargon table has them:
  fingerprint, the check that refuses a broken pack, a separate trial
  copy of the engine with its own files, ports and settings, applying a
  change while the engine runs, the program watcher, not installed
  tonight, the toy game, the hardware scanner.
- **Numbers left to the owner.** The two "number to set" lines (phones
  per kit; GM tablets per standalone game) match the sources, which
  give no number.
- **Roles.** Each "who" names the person the glossary and roadmap give
  that work: designer, venue technician, GM, director, operator,
  developer.
