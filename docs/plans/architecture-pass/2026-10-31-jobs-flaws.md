# The design flaws laid against the engine's jobs

**Status: draft for the owner. Nothing here is decided.** The owner found the sixteen-flaw list hard to follow and asked to restructure step 1 around the engine's jobs first. This file does one part of that: it puts every known design flaw under the job it keeps the engine from doing well. The job changes in section 4 are proposals.

- **Date:** 2026-10-31. **Tree:** `/home/user/ALN-Ecosystem`, branch `claude/nice-curie-hescfv`. Nothing was run. Every claim below is read from the files named.
- **Sources.** "Analysis" is `docs/plans/architecture-pass/2026-10-30-cause-analysis.md` (sections 1, 2, 6, 7). "Standalone pass" is `docs/plans/architecture-pass/2026-10-31-standalone-pass.md`. "Cards" is `docs/plans/architecture-pass/report/2026-10-31-cause-cards.json`. "Consistency check" is `docs/plans/architecture-pass/consistency/2026-10-31-consistency-causes-9-16.md`. "Direction" is `docs/plans/architecture-pass/2026-10-30-map-direction.md`. The analysis has no section 8; its corrections are section 6 and section 7. Citations read "analysis line N" or "standalone pass line N".
- **Words.** The draft jobs J1 to J10 are the orchestrator's. The design flaws keep their names C1 to C16, plus N1 (standalone pass line 241, a question for the owner). A planned or built capability is named in words with its number in brackets, for example hot-apply (capability 16); Direction section 2 holds the table. A flaw is never called a "cause" here except where a file title says so.
- **Where the consistency check corrects the analysis.** It found nine disagreements between documents and settled them from code (nine rows, K1 to K9). The analysis and cards do not yet carry those fixes. This file uses the corrected reading in four places: C11's video question has eight answers, not seven (K4); a standalone scan into a paused game locks the token until a reload, not for good (K2); the "disconnected" block after a reload ends when the first catch-up picture arrives (K5); the rollback flaw C15 does its damage between shows and reaches the next one (K8).

## 1. In short

Every one of the seventeen flaws fits a job. None is left over. Two fit one job only loosely: the unpinned certificate inside C15 (D-34), and the committed secrets that Direction section 1 says must rotate before outsiders touch the system, which no draft job names (section 4, proposal 3).

The flaws pile up on a few jobs. Job J2 (one true record, shown truly everywhere) holds four primary flaws: C1, C6, C9 and C11. Job J10 (stay trustworthy as it changes) holds four: C8, C14, C15 and C16. Job J6 (build, change and try games safely) holds none as primary, because what it depends on (hot-apply, capability 16; rehearsing on a preview engine, capability 20) is not built yet. Today's flaws only describe the ground it will stand on: C12 and C8.

The proposals in section 4, in order of weight:
1. Split J3 in two: answering each action, and keeping the night's history for review.
2. Say in J4 and J2 which one owns the equipment's state on screens.
3. Widen J7 from "who gets what" to "who gets what and who may do what".
4. Let J8 declare the standalone choice. Under the jobs, N1 needs no seventeenth flaw number to have a home.
5. Optionally split J10, which carries four different kinds of work.

## 2. The flaw table

"Standalone game" gives the standalone pass's two verdicts: does the flaw apply in a whole game with no engine, and does the first design idea for it still work there (standalone pass lines 153-155, counts). Titles are the cards' owner-facing titles.

| Flaw | Primary job | Secondary jobs | How it keeps the job from being done well | Standalone game | Citation |
|---|---|---|---|---|---|
| C1. Each tablet keeps its own list of claimed tokens | J2 | J5 | The engine decides which tokens are used, but every tablet keeps a copy that only grows, so after a delete or a Reset All Scores a tablet keeps refusing a token the engine has freed. | Applies in part; idea works in part (one tablet holds the only copy; a second tablet is a second game, SG-06) | analysis lines 19, 55-101; standalone pass line 25; card C1 |
| C2. Service health and service state travel on separate paths | J4 | J9, J2 | "Is it working" and "what is it doing" reach the screens by different routes, so the music panel can keep a calm playing look while the engine knows the player is down. | Does not apply (no equipment); idea works | analysis lines 21, 103-137; standalone pass line 33; card C2 |
| C3. The engine trusts its stale picture of outside programs | J4 | J9 | The engine runs the video player, music player and sound server from a remembered picture it re-reads only in part and never dates, so what it believes about the equipment drifts from the truth and the queue and cues act on the belief. | Does not apply (no outside program); idea works | analysis lines 23, 139-189; standalone pass line 41; card C3 |
| C4. Nothing says what a game boundary clears or keeps | J5 | J2, J3, J8 | Starting, pausing, ending, resetting, restarting the engine and reconnecting a tablet each clear whatever their author remembered, so an ended game returns after a restart and a reconnecting tablet loses the history. | Applies; idea works in part (the tablet decides every boundary; the phone's seen list and the ESP32's queue outlive every game) | analysis lines 25, 191-245; standalone pass line 49; card C4 |
| C5. Boot and Reset System wire the engine differently | J5 | J4, J2 | Starting the engine and rebuilding it after Reset System are two hand-kept lists of steps, so a reset leaves out the music panel's feed, wires the broadcasts before the persistence listeners, and old data comes back on the TV. | Applies in part (the same shape in small: a new game and Reset All Scores clear different things); idea works in part | analysis lines 27, 247-279; standalone pass line 57; card C5 |
| C6. The catch-up picture and the live update are built apart | J2 | J5 | What a tablet gets when it connects and what it gets live for the same fact come from different code, so a tablet that reloaded can differ from one that watched everything happen. | Applies in part (the saved game is the one catch-up picture; reading it back fires no live event); idea works in part | analysis lines 29, 281-319; standalone pass line 65; card C6 |
| C7. A reply never says which request, final or stored | J3 | J2, J5 | A reply does not say which request it answers, whether it is final or whether anything was stored, so a device deletes scans the engine never kept and replays scans that can never succeed. | Applies in part (the local store's answer is ignored: a refused scan still paints "Transaction Complete"); idea works in part | analysis lines 31, 321-365; standalone pass line 73; card C7 |
| C8. Engine and tests both assume they own the machine | J10 | J6, J8 | The engine names its helper files in fixed places and kills by pattern across the whole machine, and the test layers adopt the real display, audio and Bluetooth, so a test run or a second engine kills the live show's helpers. | Does not apply (a browser tab starts no helpers); idea works | analysis lines 33, 367-430; standalone pass line 81; card C8 |
| C9. Tablets and phones decide facts the engine owns | J2 | J3, J8 | The tablet and the phones work out claims, points and "seen before" from their own copy of the rules, so the result screen shows a verdict the engine has not given; with no engine the tablet is the only judge and its rules have gaps. | Applies; idea works in part (no shared rules module exists; the phone and the ESP32 match token ids by different rules) | analysis lines 35, 432-479; standalone pass line 89; consistency check K1, K2; card C9 |
| C10. Screens show a normal value when nothing is known | J9 | J4, J8 | Facts do not carry whether they are known, unknown, old or partial, so a screen shows a calm normal value where the truth is "I do not know" or "this is broken". | Applies (widest on the player devices: a standalone game is drawn as an outage); idea works in part | analysis lines 37, 481-530; standalone pass line 97; card C10 |
| C11. Several places answer the same question, each differently | J2 | J4, J3 | One question has several answerers inside one part of the engine or one tablet, each with its own rule, so "is a video playing", "which teams exist" and "may I scan" get different answers in different places. | Applies; idea works (one answer per question fits with no engine) | analysis lines 39, 532-593; standalone pass line 105; consistency check K3, K4, K5; card C11 |
| C12. Pack edits reach each part of the kit differently | J1 | J6, J2 | The pack and the files the config tool edits are read at scattered moments and no message says the pack changed, so parts of the kit end up running different versions of one game. | Applies; idea works in part (a tablet can adopt a newer pack on a mid-game reload; no device shows which pack it runs) | analysis lines 41, 595-640; standalone pass line 113; card C12 |
| C13. The engine does not know who is connected | J7 | J3 | A client's word or a route's default decides whether a credential is asked for and what the station is called, so every connection gets everything and the engine cannot tell two tablets or a display from a GM. | Does not apply (no engine, no credential); idea works | analysis lines 43, 642-686; standalone pass line 121; card C13 |
| C14. Names joining two places are kept by hand | J10 | J2, J1 | Names and shapes that join two places are kept by hand on each side and nothing checks the sides agree, so a mismatch fails silently (a wrong score box, a badge that never draws). | Applies; idea works in part (the check misses the transaction shape two producers build and the pack-to-device file shape) | analysis lines 45, 688-750; standalone pass line 129; card C14 |
| C15. The deployed game is many parts nothing compares | J10 | J8, J1 | The deployed game is several separately versioned checkouts, a built folder, hand-copied media, hand-run steps, one-OS assumptions and an unpinned certificate, and nothing compares them, so a rollback or a new machine quietly runs a mixture. | Applies; idea works in part (the whole supply chain is hand work; no build id on screen) | analysis lines 47, 752-792; standalone pass line 137; consistency check K7, K8; card C15 |
| C16. A green test run proves nothing about the show | J10 | none | Hand-written fakes are never checked against the real classes, skips and silent passes count as green, and coverage is counted per file instead of per path from decision to screen, so a green run does not show the real path works. | Applies; idea works in part (rules copied across two code bases and the ESP32 boot path are out of reach) | analysis lines 49, 794-841; standalone pass line 145; card C16 |
| N1. Nobody declares that a game is standalone | J8 | J1, J9, J3 | No record says a game runs without an engine, so each device reads a missing engine as an outage, nothing says which of the pack's effects an engine-less game drops, and nothing can refuse a mixed game. | This flaw is the standalone finding (it is not one of the sixteen); the owner has not ruled on it | standalone pass lines 241-251 (eight instances: SG-05, SG-07, SG-10, SP-02, SP-05, SP-06, SP-11, SP-17), line 5 (decision 22) |

Counts. Primary jobs: J1 1, J2 4, J3 1, J4 2, J5 2, J6 0, J7 1, J8 1, J9 1, J10 4; total 17. The standalone verdicts (standalone pass line 155) match the table: applies in full for C4, C9, C10, C11, C12, C14, C15, C16; in part for C1, C5, C6, C7; not at all for C2, C3, C8, C13.

How I chose a primary job. I asked which job the strongest show-night finding in the flaw would be filed under, and kept the others as secondary. Where a flaw has two equally strong faces (C8: a test run kills the live player, and a second engine collides; C12: the TV and engine disagree, and the publish tells the engine nothing) I took the face with the worst show-night finding and said so in section 3.

## 3. The ten jobs, each with its flaws, clues and tests

Each job is stated in everyday words as what it does at a show. "Clues" are show-night examples with their finding ids. "Tests" are cases the new design must pass, taken from the analysis's candidate proving tests (the line number is where the test sits). The standalone shortfalls are the 35 new findings of the standalone pass (SG-01 to SG-12 on the GM tablet, SP-01 to SP-23 on the player devices), filed here by what each is about; I note where that differs from the home the pass gave it.

### J1. Run any game from its pack

At a show: whatever the designer put in the pack is what the whole kit plays, and every part says which version of the pack it is running. The toy pack proves ALN is just one game.

- **Flaws.** Primary: C12. Secondary: C14 (the pack-to-device file shape), C15 (media files the token sync cannot carry), N1 (the pack has no field that says a game is standalone).
- **Clues.**
  - D-03 (analysis line 609): after a pack edit with no restart, the TV shows evidence by the new rules while the engine scores by the old.
  - B-07 / D-04 (line 605): the file the engine serves no longer matches the hash in its own list, so a scanner that checks rejects it.
  - B-20 / C-08 / D-18 (line 607): a tablet running a different pack is only written to a log; nothing tells the GM.
- **Tests.**
  1. Edit one token's rating on disk with no restart: the token list, the pack file and the points a scan awards all agree, and the file's hash equals the list's (B-07 / D-04; analysis line 634).
  2. Connect a tablet with a different pack hash: the GM sees a mismatch, or the tablet is refused (B-20 / C-08; line 634).
  3. With no alternate pack path set, the web scanner's token file and the active pack's token file have equal hashes (D-05; line 634).
  4. A group-completion test runs on the real pack and the toy pack and does not skip (A-82; line 835).
- **Standalone shortfalls.** SG-03 (line 167; a tablet that reloads online mid-game adopts the newest pack under the game in progress) and SG-08 (line 172; the tablet reads neither the pack's `requires` list nor its engine version, which the engine's gate does). SG-07, SG-10 and SP-06 are N1 instances where the pack declares a scoreboard surface, a game clock and a video that no engine-less device can show (standalone pass lines 171, 174, 187; pass home N1, with C14 as fallback). SP-14 and SP-15 (the ESP32 cannot read the pack's flat token file, and it plays only `.wav`) sit in C14 in the pass and are about reading the pack, so I file them here (pass lines 195-196).

### J2. Keep one true record of the game, and show it truly everywhere

At a show: a delete, a reset or a new team is decided in one place, and every GM tablet, the TV and the other scoreboards show the same thing, also a tablet that just reloaded or lost Wi-Fi.

- **Flaws.** Primary: C1, C6, C9, C11. Secondary: C2 (equipment state on screens), C4, C5 (old transaction list returns to the TV), C7, C12, C14 (a wrong score box).
- **Clues.**
  - A-05 / C-04 (analysis line 65): the GM deletes a transaction and every connected tablet keeps refusing the token as already scanned.
  - C-07 (line 442): the result screen says "Transaction Complete" with points the tablet worked out itself, before the engine answers; the engine may refuse.
  - A-22 (line 295): after a reload the History badge stays hidden until the next scan, because the restore path fires no event.
  - B-39 (line 542), as the consistency check reads it (K4): "is a video playing" has eight answers, and a paused video counts as not playing for four of the seven in the video code.
- **Tests.**
  1. Delete a transaction on one tablet and rescan its token on a second tablet with no reload: accepted (A-05 / C-04; line 95).
  2. Drop a tablet's connection without reloading, press Reset All Scores from another tablet, reconnect the first and rescan an old token: accepted (A-06 / C-30; line 95).
  3. For each fact, build the live message and the connect-time entry from the same state: equal keys and values (B-30; line 313).
  4. Scan a token the engine will refuse: the result screen never says "complete" and shows the engine's reason (C-07; line 473).
- **Standalone shortfalls.** SG-06 (two standalone tablets are two separate games, each with its own claim list; home C1), SG-11 (the rules a standalone tablet copies are not all in the engine's shared rules module; home C9), SG-12 (the tablet's transaction lacks fields readers expect; home C14), SP-16 (the phone lowercases a tag before lookup, the ESP32 does not; home C9). The pass's first idea for C9 ("a shared rules module the engine also loads") needs three more rule pieces in it, and the player rules can only be shared as test data (standalone pass lines 89-96; section 5, line 290).

### J3. Answer every action, and remember what happened

At a show: every scan and every GM command gets one clear answer ("done", "refused, and why", "try again"), and the game keeps a record of what was done so the night can be reviewed and reported. See proposal 1: this job holds two jobs.

- **Flaws.** Primary: C7. Secondary: C4 (history lost at a boundary), C9 (nothing records a refused scan, B-08), C11 (the report's two totals), C13 (records name the wrong device), N1 (nothing records what players found, SP-05).
- **Clues.**
  - B-22 / D-13 / D-14 (analysis line 337): player devices upload queued scans while no game exists; the engine answers "processed", stores nothing, and both devices delete the scans.
  - B-64 / C-32 (line 331): a scan failure that can never succeed comes back as a generic error and the tablet replays it at every reconnect.
  - A-01 / C-39 (line 202): after the GM ends the game, a reconnecting tablet loses history, scans and Download Report, and the wall scoreboard goes blank.
- **Tests.**
  1. Send a scan batch while no game exists: the engine either refuses it so the device keeps it, or stores it (B-22 / D-13; analysis line 359).
  2. Send batch X, restart the engine, send X again: the scans appear once (B-21 / D-15; line 359).
  3. Press "Skip" twice quickly when the second must fail: one success and one failure (B-65 / C-33; line 359).
  4. End a game and reconnect a tablet: it still shows its history, scans and Download Report, and the wall scoreboard still shows the final scores until a new game starts (A-01 / C-39; line 239).
- **Standalone shortfalls.** SP-22 (the phone's standalone branch would claim `logged:true` with nothing stored; latent), SP-05 (nothing records what players found), SG-02 (the only way to start over deletes the finished game's record, with no report or export) and SG-04 (the game's only copy is one browser's storage). SG-02 and SG-04 are C4 in the pass; they are about keeping the record, so I file them here.

### J4. Run the show's equipment, and know its true state

At a show: video, music, sound, lights, displays and speakers do what the GM and the cues ask, and the panel says the truth about each, including the ones that are down or not installed tonight.

- **Flaws.** Primary: C2, C3. Secondary: C5 (the reset leaves the music panel dead), C10 (services shown "not installed" read calm green), C11 (the video, held-item and ducking answerers).
- **Clues.**
  - A-68 (analysis line 149): a video stayed "stopped" for about 28 seconds because the parser held each player message until the next one arrived.
  - A-72 (line 153): when MPD dies, the engine's picture still says "playing" with the last track, and only the health row changes.
  - A-11 (line 113): if Home Assistant was down when the engine started, the lighting panel stays unavailable all night.
- **Tests.**
  1. Play a video: the engine reports "started" within half a second every time, whichever order the player sends its signals (A-68; analysis line 183).
  2. Kill MPD during play: the next push says stopped with no track, and the controls return within about ten seconds with no reload (A-72 / A-73; line 183).
  3. Stop Home Assistant, then start it: the lighting panel shows "unavailable", then its scene tiles, with no reload (A-11; line 131).
  4. Pause a video, then run the queue: the paused video is not replaced, and a player's scan while a video is paused is not told the video was triggered (B-39; line 587).
- **Standalone shortfalls.** None. C2 and C3 do not apply with no engine (standalone pass lines 33, 41). Service panels are hidden on the standalone tablet.

### J5. Move each game through its life cleanly

At a show: setup, start, pause, end, Reset System, an engine restart and the next game each leave every fact in a known state: kept, cleared or carried on.

- **Flaws.** Primary: C4, C5. Secondary: C1 (a reset while a tablet was disconnected), C6 (a reload restores without firing events), C7 (a slow reset reports failure and the new game is skipped, B-69).
- **Clues.**
  - B-61 / D-31 (analysis line 201): an ended game comes back after an engine restart as the current game, and player scans keep landing in it.
  - B-17 / C-38 (line 203): a once-only cue spent in game one stays spent in game two.
  - B-01 (line 257): after Reset System the music panel stops updating until the engine restarts.
- **Tests.**
  1. End a game, restart the engine, scan a player token: refused with "no game", and `GET /api/session` returns 404 (B-61 / D-31; analysis line 239).
  2. Fire a once-only cue in game one, end it, create and start game two by the plain flow, trigger the cue again: it fires (B-17 / C-38; line 239).
  3. Run Reset System with tablets connected: every tablet at once shows an empty game with no scores, claims or history (C-36; line 239).
  4. Scan three tokens, Reset System, create and start, scan two, press Reset All Scores: the GM history and the TV evidence are empty (A-53 / B-02 / C-37 / D-30; line 273).
- **Standalone shortfalls.** SG-01 (the tablet opens into an unnamed "Active" game and no screen starts a named or second one, so Pause cannot work on the opening game) and SP-18 (every ESP32 queue line stays on the card across games and is sent into a later networked game). Start, pause, end, reload, a day change and a pack change each run their own code on the tablet (standalone pass line 49).

### J6. Let designers build, change and try games safely

At a show: it is not a show. This job is the week before: publish a pack, apply a change to a running game, rehearse on a second engine, without touching the live one.

- **Flaws.** Primary: none. Secondary: C8 (a second engine collides with the live one), C12 (a publish tells the running engine nothing). The reason for the empty primary slot: hot-apply (capability 16), the design-iteration loop (capability 18) and rehearsing on a preview engine (capability 20) are all planned and none is built (Direction section 2, rows C16, C18, C20). The flaws describe the ground those stand on, and analysis lines 279, 430 and 640 name each one's dependency.
- **Clues.**
  - B-28 / D-38 (analysis line 606): publishing a pack from the config tool tells the running engine nothing; the edit shows only after a restart.
  - D-72 (line 378): starting any engine kills every `pactl subscribe` process of the user, including the live engine's sink monitor.
  - B-29 (analysis line 613; standalone pass line 223): a pack swap mid-game changes what stored scores mean, and nothing refuses it.
- **Tests.**
  1. Publish a changed rating through the tool with the engine running: within a bounded time scoring, the token lists, the scoreboard and every tablet use it, or the tool says a restart is needed (B-28 / D-38; analysis line 634).
  2. Start a second engine on the same machine while a show runs: the first engine's VLC, MPD, kiosk and sound-server listener are untouched (B-63, D-72 to D-74; line 424).
  3. Swap a pack mid-game and delete a transaction: scores equal what the original rules awarded, or the swap is refused during a game (B-29; line 634; in this tree a swap needs a restart, so the test swaps across a restart with the game record kept).
- **Standalone shortfalls.** None.

### J7. Give each person exactly what their role needs

At a show: the GM gets the command centre, the audience gets the public scoreboard, players get the content of what they scan, and the engine knows who is connected and keeps private what should be private.

- **Flaws.** Primary: C13. Secondary: none. Fitting this job with the planned players' phones (capability 35), the second game's hidden state (capability 38) and credentials on every connection (capability 12) is the largest forward demand in Direction section 3.9; the flaw list holds one flaw for it because none of it is built.
- **Clues.**
  - B-04 / B-27 / D-27 / C-20 (analysis line 652): anyone on the kit network can fetch the whole game state, and a socket that says it is not a GM station gets it too.
  - B-89 / D-25 / D-26 (line 654): the TV joins the GM room, receives every transaction and all ten service domains, and filters on its own side.
  - B-24 / C-59 (line 661): a tablet that reloads after losing Wi-Fi cannot replace its own stale connection for up to about 85 seconds.
- **Tests.**
  1. Open a connection with no token and a device type of "scanner" and ask for the state: refused, nothing arrives (B-04; analysis line 680).
  2. Call `GET /api/state` with no token on the kit network: refused, or only what a player needs (B-27 / D-27; line 680).
  3. Connect as a TV: the event names it receives equal what its role needs, and its connect payload holds only exposed-evidence entries and totals (D-25, D-26; line 680).
  4. Drop a tablet's network, or kill its browser without a clean close, then reload it mid-game: it reconnects under its own station name within five seconds (B-24 / C-59; line 680).
- **Standalone shortfalls.** None. C13 does not apply with no engine; the tablet's device id stays `001` until a networked setup runs, which is recorded under C1 (standalone pass line 121).

### J8. Run wherever the venue and the game need

At a show: on the show machine with this venue's equipment, with or without an engine (a standalone game, decision 22), and on another kit later.

- **Flaws.** Primary: N1. Secondary: C4 (the tablet decides every boundary), C8 (the engine and its helpers assume one per machine), C9 (the tablet as sole judge), C10 (a standalone game drawn as an outage), C15 (a new machine, a new OS release, a rollback).
- **Clues.**
  - SG-05 (standalone pass line 169): nothing declares that a game is standalone; the tablet's mode is its own tap, the phone's is its URL path, the ESP32 has none.
  - SP-20 / SP-03 (standalone pass lines 201, 184): the ESP32's status screen reads red "DISCONNECTED" with a rising queue count, and the phone's header says "Offline" all night.
  - B-98 / B-100 (analysis line 772): program names and install commands are fixed to one OS release, so a new machine logs warnings or refuses its install.
- **Tests.**
  1. Standalone: pause the game and scan: refused with a reason and the token not used; end the game and scan: refused (A-02 / C-09; analysis line 473, using the consistency check's K2 reading).
  2. Run the same transactions through the engine's rules and through the tablet's standalone store: results equal (the standalone pass's change for C16, line 150).
  3. A clean machine built from the deployment guide pairs a speaker and plays through it (A-88 / X-03; analysis line 786).
  4. The install line works on the new OS image in every file that gives one (B-100; line 786).
- **Standalone shortfalls.** SG-05, SP-01, SP-02, SP-04, SP-11, SP-13, SP-17, SP-21 (standalone pass lines 169, 182, 183, 185, 192, 194, 198, 202). SP-01 and SP-04 are C11 in the pass; they are about deciding "am I standalone", so they sit here. The ESP32 parity gap is 24 rows (standalone pass lines 253-284); the ESP32 is behind the phone in rows 1 to 4, 17, 23 and 24, and it falls under hardware-scanner parity (capability 49). The pass's own summary is in section 5 of that file, line 286: every rule must name its authority with the engine absent.

### J9. Tell the truth about what it knows

At a show: unknown, out of date, broken and not installed tonight each look like what they are; red always means act now; the preflight (capability 7) answers go or no-go honestly.

- **Flaws.** Primary: C10. Secondary: C2 (a panel that cannot tell it is behind), C3 (a picture with no age), N1 (standalone by choice versus engine down).
- **Clues.**
  - B-72 / C-48 (analysis line 491): a missing venue profile turns six services "not installed" and the panel shows a calm green "3 of 9".
  - D-22 (line 505): if the TV loses the engine while the clock runs, it keeps counting down with no mark.
  - B-76 / C-47 (line 493): a cue with commands on a dormant service skips them quietly and reports a clean finish.
- **Tests.**
  1. Start the engine with a mistyped profile path: the tablet shows a red "profile failed to load" row, not a green summary (B-72 / C-48; analysis line 524).
  2. Fire a mixed standing cue with lighting dormant: the finish message and the standing-cue row name the skipped command (B-76 / C-47; line 524).
  3. Cut a tablet's connection for a minute: every live panel shows its numbers are old, and the header turns "disconnected" (C-03; line 524).
  4. Kill the engine: each player scanner shows offline within one poll interval, and the TV shows its clock as unconfirmed, not counting (D-16, D-22; line 524).
- **Standalone shortfalls.** SG-09 (no verdict says a standalone tablet is ready for the night), SP-03, SP-07, SP-08, SP-09, SP-12, SP-19, SP-20 (standalone pass lines 173, 184, 188-190, 193, 200, 201). The pass's idea is that each device stamps its own copies and draws "standalone by choice" differently from "engine down" (line 99).

### J10. Stay trustworthy as it changes

At a show: nothing in the code or the deployment drifted unseen. Tests prove the path the show really runs, the parts that join are checked against each other, the installed pieces match, and testing never touches a live show.

- **Flaws.** Primary: C8, C14, C15, C16. Secondary: none. J10 has four primary flaws because its draft sentence holds four different kinds of work (section 4, proposal 5).
- **Clues.**
  - A-75 / D-64 / B-63 / D-52 (analysis line 377): a unit test killed the live video player on blue's tree; in this tree the same run kills the engine's signal monitor and overwrites its process files.
  - A-51 (line 804): unit-test fakes drifted from the real classes, so tests stayed green while Team Details showed the wrong score.
  - X-04 (line 810): the listener registry removes listeners only under the test flag, so no test layer runs the Reset System the show runs.
- **Tests.**
  1. Start a live engine and run the unit suite: MPD, the signal monitors, the sound-server listener and the kiosk all survive, and every `/tmp/aln-pm-*.pid` is unchanged (A-75 / D-52; analysis line 424).
  2. A test compares every fake with the real class and fails on a member the real class lacks or a different return shape (A-51; line 835).
  3. A test layer runs Reset System with the listener registry behaving as in production; the B-03 and B-01 tests fail on it today (X-04; line 835).
  4. A rollback restores every checkout and a status check lists any that did not move (A-91; line 786).
- **Standalone shortfalls.** SP-10 (the phone's pack-identity test passes on a fixture the deployed folder lacks) and SP-23 (the ESP32's production boot path has no test). No parent CI job runs either device's standalone path end to end (standalone pass line 237, row D-47).

## 4. Testing the draft: proposed job changes

These are proposals. None is applied.

**Which flaw fits no job.** None. All seventeen fit at least one. Two weak fits:
- C15's unpinned certificate (D-34, analysis line 771) and the secrets Direction section 1 says must rotate before outsiders touch the system (the committed Home Assistant token and admin password; Direction line 70) have no draft job. The nearest is J7, but J7 says who gets what, not who may do what. The standing rule that session lifecycle, show control and score intervention stay operator-only (Direction line 67) has the same problem.
- C16's "coverage counted per file, not per path from decision to screen" fits J10 only because J10's sentence is broad.

**Proposal 1. Split J3 in two.** J3 now says "answer every action" and "remember what happened". They have different flaws and different tests. Answering is C7 and its tests are about replies. Remembering is the history of the night: A-01 / C-39 (history lost at the end), A-08 (the report's two totals), B-08 (a refused scan recorded nowhere; owner question 19 is still open, standalone pass line 225), SG-02, SG-04, A-37 (no report standalone), SP-05 (nothing records what players found). It also carries the planned capture of notes (capability 30), the session-bundle emitter (capability 32) and the Review stage (capability 34), a whole block of planned work (Direction section 2). Recommended: J3 keeps "answer every action"; a new job, call it J11, takes "keep the night's history so it can be reviewed, reported and captured". The cost: no flaw has J11 as primary today; the evidence is the planned capabilities and four secondary flaws (C4, C9, C11, N1). The owner may decide the evidence is too thin and keep one job.

**Proposal 2. Say which job owns the equipment's state on screens.** J2 reads as the game's record (teams, scores, used tokens, evidence, phase). J4 says the engine "knows whether each one works". Neither says that every panel shows the equipment's state truly and after a reconnect. C2 and the equipment half of C6 (clock and cue shapes, A-30 / C-46) sit in the gap. Recommended wording for J4: "...knows its true state, and shows it truly on every screen, also after a reconnect". J2 then stays the game's own facts.

**Proposal 3. Widen J7.** Draft: "Give each person exactly what their role needs." Proposed: "Give each person exactly what their role needs, and let each do only what their role allows." That covers the operator-only floor, the unpinned certificate and the secrets rotation.

**Proposal 4. Let J8 declare the standalone choice, and give N1 that home.** J8 as drafted says "with or without an engine (standalone games, decision 22)" but nothing in the draft says the game declares it. Proposed: "...with or without an engine, as a choice the game declares". Under the jobs, N1's eight instances have one home, J8, plus two secondary homes: J1 for what the pack declares that an engine-less device cannot show (SG-07, SG-10, SP-06) and J3 for what a standalone game records (SP-05). So the owner's question 1 in the standalone pass (is N1 a seventeenth flaw?) matters less once the jobs are the frame. The owner's other three questions (one GM tablet per game; what exposure does with no TV; whether "standalone" belongs to the game record, the pack, the profile or each device; standalone pass line 251) stay open and need an answer either way.

**Proposal 5 (optional). Split J10.** J10 holds C8, C14, C15 and C16, four different fixes: make tests safe (C8), make tests real (C16), check the joins (C14), check what is installed (C15). Splitting them gives two jobs: tests prove the real show path and never touch a live show (C16, C8), and the parts that join agree and the installed pieces match (C14, C15). Reason against: they all answer the owner's single question "can I trust the next change?" Recommendation: split only if the owner finds the job too big to hold in the head; four primary flaws is the same load J2 carries.

**Two wording additions, no new job.**
- J1: add "and every part of the kit runs the same version of the pack, and says which". C12's main fault is parts running different versions of one game (B-07, D-03, B-20), a fact J1's sentence does not name.
- J6: keep as drafted, but note in the step-1 text that its flaws are secondary because its capabilities are not built.

**Merges considered and not recommended.**
- J2 and J9: J2 makes the screen right; J9 makes the screen say so when it cannot be right. C1 and C10 show the difference (a tablet with a wrong list versus a tablet with no list that looks full).
- J1 and J6: J1 is what the engine does with a pack; J6 is what a designer does to one. The flaws that separate them are C12 for J1 and C8 for J6.
- J5 and J2: both involve a reload. J5 is about the moment a fact changes fate (C4, C5); J2 is about copies agreeing (C1, C6).
- J6 and J10: both say "do not disturb a live show", and C8 sits across them. Keep the two, with C8 primary under J10 because its worst finding is a test killing a live player.

## 5. Completion check

- C1 to C16 and N1 each have a row in section 2: yes, 17 rows.
- Every job in section 3 lists its flaws: J6 and J7 are the two that need a note. J6 lists none as primary and names C8 and C12 as secondary, with the reason. J7 lists C13 only.
- Every flaw in section 2 appears under its primary job and each of its secondary jobs in section 3. Check by job: J1 (C12; C14, C15, N1), J2 (C1, C6, C9, C11; C2, C4, C5, C7, C12, C14), J3 (C7; C4, C9, C11, C13, N1), J4 (C2, C3; C5, C10, C11), J5 (C4, C5; C1, C6, C7), J6 (none; C8, C12), J7 (C13), J8 (N1; C4, C8, C9, C10, C15), J9 (C10; C2, C3, N1), J10 (C8, C14, C15, C16).
- Every standalone finding is filed once: 35 findings, J1 7 (SG-03, SG-07, SG-08, SG-10, SP-06, SP-14, SP-15), J2 4 (SG-06, SG-11, SG-12, SP-16), J3 4 (SG-02, SG-04, SP-05, SP-22), J5 2 (SG-01, SP-18), J8 8 (SG-05, SP-01, SP-02, SP-04, SP-11, SP-13, SP-17, SP-21), J9 8 (SG-09, SP-03, SP-07, SP-08, SP-09, SP-12, SP-19, SP-20), J10 2 (SP-10, SP-23).
- **Not checked.** I did not rerun any test or reread the code; the show-night clues and tests are as the analysis and cards state them. Where the consistency check corrected the analysis, I used the correction and said so. The primary-job choice for C8, C12 and C9 is a judgment call between two faces; the secondary list shows the other face.
- **Files written:** this document only.
