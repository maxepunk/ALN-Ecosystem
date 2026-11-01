# Jobs and capabilities: mapping the 52 capabilities onto the draft jobs

**Status: working paper for the engine-jobs restructure of step 1.** Written 2026-11-01 under workflow `wf_f3c1ef9e-a97`. It tests the orchestrator's draft of ten jobs against the engine's 52 capabilities and 20 standing rules. Nothing here is decided. Every change to the jobs is a proposal for the owner.

- **Tree:** `/home/user/ALN-Ecosystem`, branch `claude/nice-curie-hescfv`. Nothing was run except `grep`, `sed` and a short script that builds this file and its counts. No test, build or server. `backend/.env` was not opened. The stale clones beside the repository were not read.
- **Sources.** MD = `docs/plans/architecture-pass/2026-10-30-map-direction.md`; a citation `MD:79` is a line of that file. The capability table is MD:79-130, the standing rules are MD:52-71, and what each capability asks of the design is MD:140-260 (section 3). SP = `docs/plans/architecture-pass/2026-10-31-standalone-pass.md`. CTX = `CONTEXT.md`. CS = `docs/plans/CURRENT-STATE.md`. Other short keys (CTX, RM, HP, PGS) are those the direction map defines at its top, lines 5-21.
- **Ids.** A capability is written by name with its number in brackets, for example hot-apply (capability 16). The ids C1 to C16 and N1 are kept for the design flaws and appear in this paper only in this sentence. The jobs are J1 to J10, as the orchestrator drafted them.
- **Words.** Authority, copy and delivery path are CONTEXT.md section 4b (lines 383-407). Deployment mode (standalone, networked) is section 1. Verdict is section 2. "Game" means one game session.

## 1. In short

- All 52 capabilities and all 20 standing rules found a job. No capability is homeless. The count was checked against a raw count of the table rows in the direction map (section 7 below).
- Where the primary jobs land: J1 8, J2 2, J3 5, J4 4, J5 0, J6 10, J7 6, J8 10, J9 2, J10 5. The two biggest groups, 10 and 10, land in the designer job (J6) and the venue job (J8). J5 has no capability whose main purpose is lifecycle, and J2 and J9 have two each.
- 10 capabilities fit their job loosely (marked "loose" in the table). Six are about the person who fits a game to a venue (capabilities 5, 22, 23, 24, 25 and 43). The draft has no job for that person's work, because J8 names the venue's equipment and not the act of fitting a game to it. Four are about shipping and closing project work, not about what the running engine does (capabilities 44, 45, 47 and 51).
- The list of 52 names what the roadmap still has to build or finish. It has almost no row for the engine's existing core: sessions, scan answers and scoring, the cue engine, the game clock, video, music, sound and lights. So J3's "answer every action", J4's "drive the equipment" and J5 are tested here only by what changes around them, not by what they already do. The root `CLAUDE.md` section "GM Scanner Admin Capabilities" lists that core (session, video, scoring, environment, show control, service health, held items, game activity).
- Proposed changes, in section 6. Split J8 in two (the installer's fitting work, and running in other setups). Widen J10's wording so shipping a change to the live show belongs to it. Keep J5, J2 and J9 as they are, and write the boundary between J2 and J9 into the job text. Add base rows for the engine's existing core before the jobs are graded against the design flaws.

## 2. The capability table

Primary job is the one the capability exists for. Secondary jobs are the others it touches. "Loose" means the capability fits the job only because no better job exists. The "needs" sentence says what the capability asks of its primary job, taken from section 3 of the direction map at the cited lines. Where section 3 has no bullet, the sentence says so and is drawn from the capability's table row instead. Status words are the direction map's, shortened.

| Capability N | Name | Status | Primary job | Secondary jobs | What it needs from that job | Citation |
|---|---|---|---|---|---|---|
| 1 | The pack | built | J1 | J3 (media named, never stored) | Every part of the engine takes the game's tokens, rules, modes and cues from the pack and never from code. | MD:79; MD:142-143 |
| 2 | The activation gate | built | J1 | J6, J10 | The engine refuses to start on a pack that fails the check, and keeps the pack it adopted for as long as it runs, ignoring edits on disk. | MD:80; MD:142 |
| 3 | Pack channel and identity reporting | built | J1 | J2, J9 | Every scanner and screen gets the pack the engine adopted and says which version it holds, so a stale copy shows up. | MD:81; MD:143-145 |
| 4 | Draft and publish pack store | built | J6 | J1 | A designer edits a private copy, and publishing runs the engine's own check and refuses if the live pack moved in the meantime. | MD:82; MD:146-148, MD:192 |
| 5 | Installation profiles | partly built | J8 (loose) | J4, J9 | One document says what this venue has installed tonight, and a missing or broken one must stop the start instead of reading as 'nothing installed'. | MD:83; MD:152, MD:156 |
| 6 | One truth: collectPackNeeds and resolve() | partly built | J9 | J6, J8 | One function turns what the game needs and what the venue has into a verdict, every screen repeats that verdict, and an equipment list the engine cannot read gives 'unknown', never 'broken'. | MD:84; MD:157 |
| 7 | The preflight | partly built | J9 | J4, J5, J8 | The engine checks everything it can see, says plainly what it cannot, labels each line paper or live, and keeps one latest result that the start gate and the screens quote. | MD:85; MD:155, MD:158, MD:163 |
| 8 | Dormancy | built | J4 | J9, J8 | Equipment that is not installed tonight, or that the GM took out of service, stays grey, silences the cues that depend on it and is never restarted. | MD:86; MD:153-154, MD:159 |
| 9 | The supervisor | planned | J4 | J9, J10 | A crashed program restarts a few times with waits in between, then shows one red row with a Restart button, and the engine knows which program is its own and not a stranger of the same kind. | MD:87; MD:168-170, MD:173 |
| 10 | The host-config file | planned | J8 | J4 | A plain file says whether the engine starts its own music and video programs or adopts ones already running, while whether they are needed tonight stays the profile's call. | MD:88; MD:171-172 |
| 11 | Self-heal | planned | J4 | J2, J5, J9 | The engine fixes what it can without asking, such as replacing a scanner's old pack copy at a game boundary or restarting a program, and raises a red row only for what it cannot fix. | MD:89; MD:176 |
| 12 | Credentials on every connection | planned | J7 | J2 | Every connection shows a verified operator or observe pass, and a device's own claim about what it is no longer counts. | MD:90; MD:177 |
| 13 | Auth tiers, the floor, the observe token | built | J7 | J5 | Operator, device and session levels exist, start, pause, end and score changes stay operator-only, and a read-only pass for displays is minted per page and capped in number. | MD:91; MD:237 |
| 14 | Held items | built | J4 | J3, J5, J9 | A cue or video blocked by an outage or a busy screen waits for the GM instead of vanishing, and a hold caused by a broken service needs a defined end. | MD:92; MD:162, MD:178 |
| 15 | Service domains and service:state | built | J2 | J4, J9 | Every change to equipment state reaches the GM screens by one route, together with its health, and the catch-up after a reconnect carries every service. | MD:93; MD:174-175, MD:178, MD:214 |
| 16 | Hot-apply | deferred | J6 | J2, J5, J10 | A pack change reaches a running engine in four steps, is refused while a game is running, and needs a complete list of every part that holds a copy of the pack. | MD:94; MD:182-188 |
| 17 | The five Design workspace pages | planned | J6 | J1, J8 | Editing changes a draft only, never the live pack, and the version the live engine adopted stays visible beside the draft. | MD:95; MD:192, MD:185 |
| 18 | The design-iteration loop | planned | J6 | J5 | Edit, apply and play must work with the game in setup, ended or not created, and a trial that scores through the GM path needs a started game and so the start gate. | MD:96; MD:199 |
| 19 | Live verdict badges in the editor | planned | J6 | J9, J8 | Each badge is the engine's own verdict run against the draft and says whether it came from paper or from a live check. | MD:97; MD:193 |
| 20 | Rehearsing on a preview engine | planned | J6 | J10, J8 | A second engine can run a draft on the same machine without killing the live engine's programs, writing into its records or minting passes the live engine accepts, and where it runs is undecided. | MD:98; MD:194-198, MD:201 |
| 21 | Simulation and preview profiles | partly built | J6 | J10, J8 | A generated profile binds every need to a software stand-in, so hardware-shaped needs show as not installed on a laptop. | MD:99; MD:197 |
| 22 | The Deploy stage | planned | J8 (loose) | J6, J7 | The handoff from designer to installer to GM is one visible chain that ends in a system ready to run, and the design must say whether a profile change ends in a restart or a reload. | MD:100; MD:205-206 |
| 23 | Bindings page and profile-manager page | planned | J8 (loose) | J4 | Pack roles connect to real venue instruments through the profile, and the profile is read once at start. | MD:101; MD:206 |
| 24 | Hardware/roles editor, tech rider, capability catalog, reference kit | planned | J8 (loose) | J1, J6 | The technician's rider comes from the pack's needs and is never a second list kept by hand. | MD:102; MD:205 |
| 25 | Planning view | deferred | J8 (loose) | J6 | It answers for an imagined profile on paper and never touches a running game (section 3 lists no demand of its own). | MD:103; MD:207, MD:260 |
| 26 | The GM scanner's four domains | built | J7 | J3, J4 | The GM sees every game fact and every piece of equipment in four sections, each showing the engine's current facts and not a private copy that only grows. | MD:104; MD:211-212 |
| 27 | The GM scanner redesign | deferred | J7 | J1, J2, J5 | A manual phase control and cue timing relative to phases make the game's phase a fact the GM writes, so the design must say who owns it, how it reaches every screen and what a reset does to it. | MD:105; MD:218 |
| 28 | The truth sweep | planned | J2 | J9, J10 | Every path from an engine event to what the panel shows gets audited, and each fact gets a named decider before the audit starts. | MD:106; MD:212-215, MD:219 |
| 29 | Screen baselines and screen-capture tests | planned | J10 | J9 | Section 3 has no bullet for it; from the row, reference images of the panel catch a screen that changes by accident. | MD:107; row only |
| 30 | Capture: roster, notes, accusation | planned | J3 | J2, J5, J7 | Roster, notes and accusation must reach the engine's own record before the game ends, survive a restart and come back in the reconnect catch-up. | MD:108; MD:223, MD:226 |
| 31 | Photo capture and the photo store | planned | J3 | J7 | The engine needs a way to receive a picture, stored on the kit under the privacy defaults, which it does not have today. | MD:109; MD:224, MD:227 |
| 32 | The session-bundle emitter | planned | J3 | J5 | The record of the night is written when the game ends, from the engine's own facts, and nothing writes it today. | MD:110; MD:225-226 |
| 33 | Report pipeline migration to the bundle | deferred | J3 | none | Section 3 lists no demand; the outside report pipeline reads the bundle in place of the markdown report. | MD:111; MD:260 |
| 34 | The Review stage | partly built | J3 | J6, J7 | The story of the night is told from the bundle and must stand alone. | MD:112; MD:228 |
| 35 | Players' phones | chartered later | J7 | J2, J8 | A phone sees only what its pass allows, the engine does the filtering, and the number of phones one kit can carry is not yet measured. | MD:113; MD:232-233, MD:238 |
| 36 | Interaction primitives v1 | chartered later | J1 | J7, J8 | A multi-tap player action is described in the pack and works the same on phones and on the hardware scanners, with no reflashing to iterate. | MD:114; MD:239 |
| 37 | Entity-field wire migration | chartered later | J1 | J2, J3 | Section 3 has no bullet for it; from the row, the pack names what holds a score and the old team field leaves the wire. | MD:115; row only, CTX:163-170 |
| 38 | The second game's modules | chartered later | J1 | J2, J7 | Secret per-player and per-token facts, graph state and a second scoring model chosen by the pack, held by the engine and never sent whole to every screen. | MD:116; MD:234-236 |
| 39 | Remote displays | partly built | J7 | J4, J8 | A second screen on the kit network shows only the scoreboard page on a read-only pass, and the engine says whether it is alive. | MD:117; MD:235, MD:237 |
| 40 | Media bundle and asset channel | partly built | J1 | J4, J8 | The pack names files by hash, the engine finds them in known folders on its machine, and the preflight needs a check that a named video file exists. | MD:118; MD:243 |
| 41 | Content tooling and the source adapter | chartered later | J6 | J1 | Section 3 lists no demand; from the row, a replacement for Notion feeds the same pack through the same gate. | MD:119; MD:260 |
| 42 | Seams for more kits and packs | partly built | J8 | J1, J10 | Pack and profile are chosen by path, and process files, sockets and records get their own names per engine, so a second engine or a test run never collides with the first. | MD:120; MD:244, MD:256 |
| 43 | Kit network, DNS and certificate | deferred | J8 (loose) | J7, J9 | The kit's name server runs on the Pi, the engine does not drive it, and the preflight reads it. | MD:121; MD:246 |
| 44 | Blue/green cutover | built | J10 (loose) | J5, J8 | The new machine goes in by plugging it in, rollback is plugging the old one back, and afterwards the engine updates only between events. | MD:122; MD:245, MD:260 |
| 45 | Block 1 deliverables | built | J10 (loose) | J8, J9 | Section 3 lists no demand; from the row, review and merge work, repaired deployment docs and a machine that starts the show on boot. | MD:123; MD:260 |
| 46 | Test environment | partly built | J10 | J4, J5, J8 | Tests must not share files, ports, the TV or the video and music players with the live show, must skip loudly with a reason, and must reset through the same code path as production. | MD:124; MD:250-256 |
| 47 | Open-sourcing and the release block | chartered later | J8 (loose) | J7, J10 | Section 3 lists no demand beyond the secrets rule; from the row, a stranger can stand the system up and the privacy defaults hold. | MD:125; MD:260, MD:70 |
| 48 | First-run state | planned | J6 | J7 | Section 3 has no bullet for it; from the row, a new designer meets a checklist, teaching empty screens and templates. | MD:126; row only |
| 49 | Hardware-scanner parity | partly built | J8 | J7, J1 | Every new interaction needs matching firmware on the ESP32, so the pack cannot rely on reflashing, and the ESP32 has no standalone mode today. | MD:127; MD:239, SP:19 |
| 50 | Ledger retirements L7, L8, L12 | planned | J1 | J8, J10 | Section 3 lists no demand; from the row, the pack carries no venue-hardware name and the loud fallbacks go. | MD:128; MD:260 |
| 51 | Block 6 close | planned | J10 (loose) | J6 | Section 3 lists no demand; from the row, the pages unit closes through the two-pack run and a sweep of the debt list. | MD:129; MD:260 |
| 52 | Preset-load differential gate | deferred | J6 | J10 | Section 3 lists no demand; from the row, the config tool's preset load refuses only problems the preset newly adds. | MD:130; MD:260 |

Table rows: 52. Status counts: built 11, chartered later 6, deferred 6, partly built 10, planned 19.

Primary-job counts and secondary-job counts, computed from the table above:

| Job | Name | Primary | Secondary |
|---|---|---|---|
| J1 | Run any game from its pack | 8 | 7 |
| J2 | Keep one true record and show it truly everywhere | 2 | 9 |
| J3 | Answer every action and remember what happened | 5 | 4 |
| J4 | Run the show's equipment and know its true state | 4 | 9 |
| J5 | Move each game through its life cleanly | 0 | 11 |
| J6 | Let designers build, change and try games safely | 10 | 7 |
| J7 | Give each person exactly what their role needs | 6 | 10 |
| J8 | Run wherever the venue and the game need | 10 | 15 |
| J9 | Tell the truth about what it knows | 2 | 12 |
| J10 | Stay trustworthy as it changes | 5 | 10 |
| Total | | 52 | 94 |

The primary column sums to 52. The secondary column is not a count of capabilities, only of links.

## 3. What the planned capabilities need from each job

Each list covers the capabilities that are planned, partly built, deferred or chartered later, and names built ones only where they set a demand that still stands. A capability appears under every job it touches, so some needs repeat. The wording is plain on purpose. Line numbers are MD lines.

### J1. Run any game from its pack

- The second game (capability 38), interaction primitives (capability 36) and the entity field (capability 37) need the engine to take scoring models, hidden facts, multi-tap actions and the word for a score-holder from the pack. Engine code must not know ALN's words. [MD:234-235, MD:114-116, CTX:163-170]
- The media bundle (capability 40) and the ledger retirements (capability 50) need the pack to name its files by hash and to carry no venue-hardware name, so that the audio role resolves through the venue's profile. [MD:243, MD:128]
- Hot-apply (capability 16) and the pack channel (capability 3) need one complete list of every part that holds a copy of the pack: baked token values, the cue engine's boot copy, each GM scanner's start-up load, the setup game's pack stamp and the ESP32's download. No document has this list. [MD:143-144]
- Content tooling (capability 41) needs a replacement for Notion to feed the same pack through the same gate. [MD:119]
- Hardware parity (capability 49) needs everything a designer iterates on to be pack data, because a mechanic that needs a fleet re-flash breaks the loop. [MD:239, MD:62]

### J2. Keep one true record and show it truly everywhere

- The truth sweep (capability 28) and the GM scanner redesign (capability 27) need a named decider for each fact the GM sees, applied to the 10 service-state domains and 22 accepted events before the sweep audits them. The redesign adds a new fact the GM writes, the game's phase. [MD:212, MD:218-219]
- Capture (capability 30 and 31) adds roster, notes, accusation and photos. Each needs a decider, a place that survives restart and a place in the reconnect catch-up. A note held only on a tablet is a copy, not a record. [MD:223, MD:226]
- The second game (capability 38) and players' phones (capability 35) need hidden facts to have a decider and a saved home, and need the engine to filter what each screen receives. Filtering on the screen is, in the direction map's words, fatal for a hidden-information game. [MD:232, MD:236]
- Service domains (capability 15) need state and health to travel together on one route, and every catch-up message to carry every service. The same bug has come back four times. [MD:178, MD:214]
- Credentials (capability 12) and remote displays (capability 39) need the engine to know which screens are connected and which record each may see. [MD:177, MD:237]
- Hot-apply (capability 16) needs every client told that the pack changed. [MD:184]

### J3. Answer every action and remember what happened

- No planned capability concerns the answer to a scan or a GM command; that part of J3 is existing core (see section 5).
- Capture (capabilities 30 and 31), the bundle emitter (capability 32), the Review stage (capability 34) and the report pipeline move (capability 33) need the engine to write a structured record of the night when the game ends, from facts the engine itself decided. Nothing writes that record today. [MD:225-226, MD:228]
- Photos (capability 31) need a way to receive a picture, which the engine lacks, with data kept on the kit and retention set per game by the owner. [MD:224, MD:227]
- Held items (capability 14) need a held cue to count as an answer the GM can see, with a defined end for holds caused by a broken service. [MD:162, MD:178]

### J4. Run the show's equipment and know its true state

- The supervisor (capability 9) needs each program to have one restart rule, with bounded tries and then a red row, and needs the engine to tell its own VLC or MPD from a stranger's. Today four different restart shapes exist and Chromium has none. [MD:168-170]
- The host-config file (capability 10) needs a plain setting for whether the engine starts a program itself or adopts a running one. [MD:171-172]
- Self-heal (capability 11) needs the engine to fix a crashed program silently and escalate only what it cannot fix. [MD:176]
- Dormancy (capability 8) needs a not-installed-tonight verdict that sticks, silences dependent cues and is never restarted, plus a decision about what a reset and a restart do to the GM's out-of-service latch. [MD:153-154, MD:159]
- Service domains (capability 15) need no second private flag beside the registry (the music service keeps one, `musicService.js:73` and `:231`), and one store for hold expiry instead of two. [MD:175, MD:178]
- Remote displays (capability 39) and the media bundle (capability 40) need the engine to know whether a second screen is alive and whether the named video files exist on its disk. [MD:243, MD:117]

### J5. Move each game through its life cleanly

No capability exists mainly for J5, but 11 capabilities list it as a secondary job. Together they ask for one table of every fact against every moment (start, pause, end, reset, restart, the next game, a pack change).

- Hot-apply (capability 16) needs a rule that a pack change is refused while a game is active or paused, and needs the setup, ended and no-game cases defined. [MD:183, MD:199]
- Self-heal (capability 11) needs the scanner's pack copy replaced at a game boundary, once per connection and engine version. [MD:176]
- Dormancy and the preflight (capabilities 8 and 7) need their verdicts recomputed at reset, at game create and at restore, and need the display's health not to stay falsely red after a reset. [MD:160-163]
- The bundle emitter (capability 32) and capture (capability 30) need every fact that exists only on a tablet to reach the engine before the game ends. [MD:226]
- The GM scanner redesign (capability 27) needs the new phase fact to have a defined fate at pause, end and reset. [MD:218]
- The second game (capability 38) needs hidden state to persist across a restart. [MD:236]
- The retained ended game changes what a scanner sees at the next boundary, so it and self-heal are designed together. [MD:217]
- Cutover (capability 44) needs the engine to update only between events while packs update any time. [MD:245]
- The test environment (capability 46) needs reset to be one code path in tests and in production. [MD:255]
- Open: whether the cue engine fires standing cues in setup. [MD:200]

### J6. Let designers build, change and try games safely

- The five pages (capability 17) and the draft and publish store (capability 4) need edits to touch a draft only, with the live engine's adopted version shown beside it. [MD:185, MD:192]
- Hot-apply (capability 16) and the loop (capability 18) need edit, publish, apply and play to work in setup or after an end. A GM-scored trial needs a started game and so passes the start gate. [MD:182-183, MD:199]
- The preview engine (capability 20) and simulation profiles (capability 21) need a second engine that cannot kill the live engine's programs, write into its records or mint passes it accepts. Where that engine runs is not decided anywhere. [MD:194-198]
- Badges (capability 19) need the same verdict function as the engine, run on the draft, labeled paper or live. [MD:193]
- First-run state (capability 48), content tooling (capability 41) and the preset gate (capability 52) have no demand in section 3.

### J7. Give each person exactly what their role needs

- Credentials (capability 12) and auth tiers (capability 13) need every connection to present a verified pass and the floor to stay operator-only. [MD:177, MD:237]
- Players' phones (capability 35) need passes issued without accounts, engine-side filtering of what each phone sees, and a measured capacity for how many phones one kit carries. No number exists. [MD:232-233, MD:238]
- The second game (capability 38) needs hidden state kept from every screen except the one entitled to it. [MD:234]
- Remote displays (capability 39) need a read-only pass minted per page and capped in number. [MD:237]
- The GM scanner redesign (capability 27) needs the GM's four sections to keep working while mid-game controls change. [MD:104-105]
- Open-sourcing (capability 47) and the standing safety rule need the committed Home Assistant token and the admin password rotated before any outsider touches the system. [MD:70]

### J8. Run wherever the venue and the game need

- Profiles, bindings, the rider and the Deploy stage (capabilities 5, 23, 24, 22) need the profile read once at start and a clear statement of what a profile change ends in. The pack side will have hot-apply and the profile side will not. [MD:152, MD:206]
- Host config (capability 10), seams (capability 42) and DNS (capability 43) need no kit-unique names in engine code, per-engine names for process files, and a name server the engine reads but does not drive. [MD:244, MD:246]
- Hardware parity (capability 49) needs every new mechanic to have matching firmware, and a decision on the ESP32's missing standalone mode (decision 22). [MD:239, SP:19]
- Standalone games need something that says a game is standalone. Today the tablet's mode is a tap, the phone's is its URL path, the ESP32 has no such notion, and the pack has no field for it. [SP:19]
- The planning view (capability 25) needs nothing from the running engine. [MD:207]

### J9. Tell the truth about what it knows

- One truth (capability 6) and the preflight (capability 7) need the engine to say unknown for an equipment list it cannot read, to treat a missing or broken profile as a failed check and not as "this venue installed nothing", and to label each line paper or live. [MD:156-158]
- Dormancy (capability 8) needs grey for intentional absence so that red keeps meaning act now. [MD:153, MD:69]
- Badges (capability 19) need the same words in the editor as at the show. [MD:193]
- The truth sweep (capability 28) and baselines (capability 29) need an audit that finds screens that say something false, and images that catch accidental change. [MD:212, MD:107]
- A reset must not leave the display row red for good. [MD:161]

### J10. Stay trustworthy as it changes

- The test environment (capability 46) needs tests that cannot touch the live machine's tracking files, the TV or its players, that skip loudly with a reason, and an audio-init off switch for harness children that is not built. [MD:250-253]
- Seams (capability 42) and the preview engine (capability 20) need the same per-engine naming layer as test runs, built once. Eight fixed `/tmp/aln-*` paths and two machine-wide kills exist in `backend/src`. [MD:195-196, MD:256]
- The supervisor (capability 9) needs process cleanup that cannot hit the wrong process. [MD:173]
- Baselines (capability 29) and the two-pack run need to guard against changes the owner did not choose. [MD:107, MD:71]
- Cutover, Block 1 and the Block 6 close (capabilities 44, 45, 51) need the frozen-production and blue-containment rules honored: nothing deploys until the owner says so. [MD:65-66, MD:122-123, MD:129]
- The rig that ran the real stack was lost with the container; its recipe is in `docs/plans/2026-09-12-container-baseline.md` section 7. [MD:254]

## 4. Standing rules by job

Section 1 of the direction map (MD:48-71) has 20 bullets. Six of them describe the engine's purpose or its users (SR1 to SR6). Fourteen are constraints and rules (SR7 to SR20). All 20 have a row. The ids SR1 to SR20 are this paper's, numbered in the order the bullets appear.

| Rule | Name | What it says | Primary job | Secondary jobs | Citation |
|---|---|---|---|---|---|
| SR1 | Final outcome | An open-source show platform, usable by non-technical designers and extensible by technical people. | J6 | J1, J8 | MD:52 |
| SR2 | Designer (user) | Builds a whole game as a pack in the tool, never touches code or config files, and tunes it in the edit-apply-play loop. | J6 | J1 | MD:53 |
| SR3 | Venue installer (user) | Fills in the venue profile, connects the pack's abstract names to real instruments on one page, then runs one preflight that says go or no-go with every line traceable. | J8 | J9 | MD:54 |
| SR4 | GM (user) | Runs the show from four domains (Game Ops, Show Control, Environment, Game Admin), and the post-game report builds itself from material captured during play. | J7 | J4, J3 | MD:55 |
| SR5 | Player (user) | Taps tokens on a phone or shared station with no account, no login, no app install and no recorded identity unless the game designs an identification moment. | J7 | J8 | MD:56 |
| SR6 | Business shape | One production, one kit, many games on it; a second kit or operator is not planned but must stay cheap to start. | J8 | J10 | MD:57 |
| SR7 | Constraint 2.1, identity | No accounts or logins for players; the engine's only built-in identity is the device or session id; game data stays on the kit; the owner sets retention per game. | J7 | J3 | MD:58 |
| SR8 | Constraint 2.2, growth without corners | Pack and profile chosen by path or id, no kit-unique names in engine code, media bundles movable between machines, multi-kit features later but the seams now. | J8 | J1, J10 | MD:59 |
| SR9 | Constraint 2.3, media model | Media files never live in git packs; the pack names files by hash; a managed bundle carries them. | J1 | J8 | MD:60 |
| SR10 | Constraint 2.4, the design-iteration loop | Edit, apply, playtest, repeat; the mechanics editor and hot-apply are one deliverable. | J6 | J5 | MD:61 |
| SR11 | Constraint 2.5, platform parity | Phones and hardware scanners stay equal in what the engine offers, and no mechanic may need a fleet re-flash to iterate; everything a designer iterates on is pack data. | J8 | J1, J7 | MD:62 |
| SR12 | Constraint 2.6, the engine holds no opinion | Identification, rosters, station scarcity and tracking policy are pack and kit parameters. | J1 | J7 | MD:63 |
| SR13 | Authority split | The backend decides scores in networked mode, the GM scanner computes locally in standalone mode, and the backend's gameRules functions are the parity surface. | J2 | J8, J10 | MD:64 |
| SR14 | Frozen production | Nothing deploys to the live venue machine until the owner's show-ready decision; the game runs on blue until the new engine is ready on green, with no date. | J10 (loose) | J8 | MD:65 |
| SR15 | Blue containment | Work on the new engine never touches blue's branch; lessons from blue go into architecture and interfaces, never patches or one-for-one ports. | J10 (loose) | none | MD:66 |
| SR16 | The floor | Session lifecycle, show control and score intervention stay operator-only. | J7 | J5 | MD:67 |
| SR17 | Honesty rule | The preflight states its own limits and labels each check paper or live. | J9 | J8 | MD:68 |
| SR18 | Alarm integrity | Red always means act now; intentional absence shows grey. | J9 | J4 | MD:69 |
| SR19 | Pre-previewable safety | The committed live Home Assistant token and admin password rotate before the first outside person touches the system. | J7 | J6, J10 | MD:70 |
| SR20 | Toy pack proof | A second game stays in the repo forever, and every slice passes the two-pack run. | J1 | J10 | MD:71 |

Rule rows: 20. Primary-job counts: J1 3, J2 1, J6 3, J7 5, J8 4, J9 2, J10 2.

Rules for each job, as a list (primary rules first):

- **J1.** Primary: SR9, SR12, SR20. Also: SR1, SR2, SR8, SR11.
- **J2.** Primary: SR13. Also: none.
- **J3.** Primary: none. Also: SR4, SR7.
- **J4.** Primary: none. Also: SR4, SR18.
- **J5.** Primary: none. Also: SR10, SR16.
- **J6.** Primary: SR1, SR2, SR10. Also: SR19.
- **J7.** Primary: SR4, SR5, SR7, SR16, SR19. Also: SR11, SR12.
- **J8.** Primary: SR3, SR6, SR8, SR11. Also: SR1, SR5, SR9, SR13, SR14, SR17.
- **J9.** Primary: SR17, SR18. Also: SR3.
- **J10.** Primary: SR14, SR15. Also: SR6, SR8, SR13, SR19, SR20.

Two things show up. J2 holds a single rule (the authority split, SR13) although it is the job about deciding facts. And three rules (SR14, SR15 and SR20) are about how the project changes, not what the engine does at a show; SR14 and SR15 have no home in the draft except J10 stretched.

## 5. Testing the draft

### Capabilities that fit no job cleanly

None is homeless, but two groups sit loosely.

- **The installer's work.** The venue profile (capability 5), bindings and profile manager (capability 23), the hardware editor and rider (capability 24), the planning view (capability 25), the Deploy stage (capability 22) and the kit network (capability 43). The installer is one of the engine's five users (MD:54), yet no draft job names the act of fitting a game to a venue. J8 names the venue's equipment and the engine running there, and a reader looking for the profile finds it under J8 only by reading the words "the venue's equipment".
- **Shipping and closing.** Cutover (capability 44), Block 1 (capability 45), open-sourcing (capability 47) and the Block 6 close (capability 51), with the rules on frozen production and blue containment. They concern how a change reaches the live show or the public. J10's title, "stay trustworthy as it changes", covers them, but its sentence names only tests.

Section 3 of the direction map has no demand of its own for 12 capabilities: 25, 33, 41, 44, 45, 47, 50, 51 and 52 (named in MD:260) and 29, 37 and 48 (silent). Their "needs" sentences come from the table row and are weaker evidence.

### Jobs with no capability

- **J5, move each game through its life cleanly.** No capability has it as primary. Eleven capabilities list it as a secondary job (section 2) and the 'B' bullets of MD section 3 ask for it again and again, so it is a real job, but it is a lens across the others and not a deliverable. That fits the owner's question about who re-checks after a reset (CS:18-26 as quoted at MD:293).
- **The core of J2, J3 and J4.** J2 has two primary capabilities, J3 has five that all concern recording after the fact, and J4 has four that all concern keeping equipment honest. None is about the existing work: deciding a scan, scoring it, firing a cue, playing a video. The list is the roadmap's list of things still to build or finish, so these jobs are underfed by construction. The base rows are missing, not the jobs.
- **J9 and J2 are thinly fed** (two primary capabilities each), but the standing rules honesty and alarm integrity (SR17, SR18) are J9's alone, and the authority split (SR13) is J2's alone. Both are needed.

### The pass's six questions against the jobs

The six questions are at MD:293.

| Question | Job |
|---|---|
| Who decides each fact the GM sees | J2 |
| Does a service's state travel with its health | J2 and J4 |
| How does the engine read the programs it drives | J4 |
| Can a test touch the live show | J10, and J6 for the preview engine |
| Does one question get one answer | J2 and J9 (one function behind every verdict) |
| Who re-checks after a reset | J5 |

Every question has a job, and J5 is reached only by the last one, which is a sign that J5 needs its own place in the list.

## 6. Proposed changes to the jobs

These are proposals. None is applied. Each says why and what it would cost.

1. **Split J8.** J8 packs four ideas: the show machine, the venue's equipment, running with or without an engine, and other kits. Proposal: keep J8 as "Fit a game to a venue" (profile, bindings, rider, needs against equipment, the kit network, the host file, the installer's one preflight) and add a new job J11, "Run in any setup" (standalone games, other kits and packs, hardware parity, open-sourcing, the seams for second engines). Reason: the installer is one of five users and has no job (MD:54), seven capabilities cluster around that person (5, 10, 22, 23, 24, 25 and 43), and three more, with standalone games, cluster around reach (42, 47 and 49; SP:19). Cost: one more job to explain to the owner; capabilities 5, 10, 22 to 25 and 43 move to J8, and 42, 47 and 49 move to J11. Alternative: leave J8 whole and rename it "Fit the game to the venue, whatever the setup", which keeps ten jobs but hides the second audience.
2. **Widen the sentence of J10, not its title.** Proposal: "Stay trustworthy as it changes. Tests prove the real show path; the parts that join are checked against each other; installed pieces match; testing never touches a live show; and a new version reaches the show only when the owner says it is ready, with rollback as a physical swap." Reason: it absorbs capabilities 44, 45 and 51 and the rules SR14 and SR15 without a new job. Rejected: an eleventh job for shipping, because no engine behavior sits under it, only a rule about timing.
3. **Keep J5 and write what it is.** Proposal: state J5 as a table of every fact against every moment (start, pause, resume, end, reset, restart, next game, pack change), and say plainly that J5 has no deliverable of its own. Reason: eleven capabilities lean on it and the pass's last question is about it. Rejected: merging J5 into J2. A fact's fate at a boundary does depend on who decides the fact, so J5 reads J2's list, but the boundary table is the artifact that finds bugs like a display row left red after reset (MD:161), and it deserves its own name.
4. **Keep J2 and J9 apart; write the boundary into both.** Proposal: J2 is "which part decides each fact and how it reaches each screen". J9 is "how sure a screen says it is" (healthy, down, not installed tonight, unknown, out of date, and the rule that red means act now). Reason: capabilities 15 and 28 serve both, so a merge is tempting, but SR17 and SR18 are J9's alone and a merged job would bury them. Cost: a sentence in each job.
5. **Keep J7 whole.** J7 joins two ideas, who is allowed to do what and what each screen shows. Reason for not splitting: the second game's need for filtering on the engine (MD:232) ties them, and capabilities 12, 13, 35 and 39 each touch both.
6. **Say the overlap between J6 and J10 on purpose.** "Without disturbing a live show" is a clause of J6 and "testing never touches a live show" is a clause of J10. Both are met by one per-engine naming layer (MD:256). Proposal: name the layer once, under J10, and have J6 point to it.
7. **Add base rows before grading the jobs against the design flaws.** Proposal: before the next step, add rows for the engine's existing core (session lifecycle, scan and transaction handling, scoring, the cue engine, the game clock, video, music, sound, lights, the scoreboard display). Reason: J3, J4 and J5 cannot be graded on what already exists. Source for the list: root `CLAUDE.md` section "GM Scanner Admin Capabilities". This adds rows to the capability list, not jobs.
8. **Add one note to J1.** Proposal: after the sentence "ALN is one pack", add "and nothing in the engine may assume it", so SR12, SR20 and capabilities 36 to 38 and 50 have a sentence to stand on. Cost: none.

If proposals 1 and 2 are accepted, the primary counts become: J8 7, J11 3, J10 5 (unchanged, with 44, 45 and 51 now at home). The other jobs stay as in the table.

## 7. Count check

- **Capabilities.** The direction map's table has 52 rows, counted with `grep -cE '^\| C[0-9]+ \|' docs/plans/architecture-pass/2026-10-30-map-direction.md` (rows on lines 79 to 130). This paper's table in section 2 has 52 rows numbered 1 to 52 with no gap and no repeat, checked in the generator by an assertion. The primary-job counts sum to 52 and the status counts to 52.
- **Standing rules.** The direction map's section 1 has 20 bullets on lines 52 to 71 (`sed -n 52,71p ... | grep -c '^- '`; the same command over lines 48 to 71 gives 20, because lines 48 to 51 hold the heading and the intro). This paper's rule table has 20 rows.

