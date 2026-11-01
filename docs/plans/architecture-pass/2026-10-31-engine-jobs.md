# The engine's jobs: the front of step 1, restructured

> **Vocabulary note (2026-11-01, the owner's decision 27).** This record says "job" for what the pass now calls a **promise** (what a person can count on at a given moment), uses J1 to J10 where the owner's page now uses each promise's title alone, and says "installer" for the **venue technician**. The record stays as written; the words on the owner's page and in `CONTEXT.md` section 7 are current. J1 "The designer's game is the game the whole kit plays"; J2 "One game, the same on every screen"; J3 "Every tap gets its answer, and the night can be told afterwards"; J4 "The room does what the designer cued and the GM asked"; J5 "Each lifecycle button does exactly what its name says"; J6 "The designer changes a value and plays it within minutes, and the live show never notices"; J7 "Each person sees their part and can do only their part"; J8 "The game fits the venue it is in tonight"; J9 "Anyone reading a screen can act on it without a second question"; J10 "A change is proven before it reaches anyone, and the owner alone sends it to the show".

**Status: draft for the owner's confirmation.** Nothing here is decided. The owner reads the ten jobs, says whether they are the right jobs, and answers the questions in section 4. Step 1's cause analysis stays as the full record behind this document; this document replaces the flaw list as the front of step 1.

- **What changed, and why.** Step 1 was built from the problems up: every known problem was grouped into sixteen design flaws, C1 to C16 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md`), and checked against standalone games (`docs/plans/architecture-pass/2026-10-31-standalone-pass.md`, which proposes a seventeenth flaw, N1). The owner found that hard to follow and asked to restructure step 1 around the engine's jobs first. The owner's decision 26 sets the frame (`docs/plans/CURRENT-STATE.md` section 0, item 26, lines 45-53): design the best architecture for the next iteration of the engine, for long-term use and future development as its use grows beyond ALN; blue's fixes and findings are clues to where today's design is off, never the driver. So the jobs come first here, the flaws sit under the jobs as where today's design falls short, and blue's problems are the clues and the test cases.
- **Date:** 2026-10-31. **Tree:** `/home/user/ALN-Ecosystem`, branch `claude/nice-curie-hescfv`. Nothing was run except `sed` and `grep` to re-check cited lines. The stale clones beside the repository were not read. `backend/.env` was not opened.
- **Sources and citation keys.** JC = `docs/plans/architecture-pass/2026-10-31-jobs-capabilities.md` (the 52 capabilities against the draft jobs); JF = `docs/plans/architecture-pass/2026-10-31-jobs-flaws.md` (the sixteen flaws and the proposed N1 against the draft jobs); AN = `docs/plans/architecture-pass/2026-10-30-cause-analysis.md`; SP = `docs/plans/architecture-pass/2026-10-31-standalone-pass.md`; MD = `docs/plans/architecture-pass/2026-10-30-map-direction.md` (section 1 is the engine's purpose and standing rules, lines 48-71; section 2 is the capability table, lines 79-130; section 3 is what each capability asks of the design, lines 140-260); PD = `docs/plans/2026-10-30-architecture-pass.md` (its section 3, lines 96-106, holds the nine questions); CS = `docs/plans/CURRENT-STATE.md`; CTX = `CONTEXT.md`. RM, PGS, HP, C23, PRG, BILL, CMD and BCM are the direction map's own keys (MD:7-20); where a roadmap or plan line is cited "via MD:N", the direction map quotes it at that line. A citation `KEY:N` is line N of that file.
- **Ids.** A capability is called by its name with its number in brackets, for example hot-apply (capability 16); the direction map's table numbers them 1 to 52. C1 to C16 and N1 name the design flaws only. J1 to J10 are the jobs. The nine questions are the program document's.
- **Words.** Authority, copy and delivery path are CTX section 4b (lines 383-407): the authority is the place that decides a runtime fact, a copy is that fact held anywhere else, and the delivery path is its route to a screen. "Game" means one played game, a game session (CTX:67-73). "Standalone" and "networked" are deployment modes (CTX:88). A verdict is one truth's answer to what the show needs against what the kit has (CTX:198). In owner-facing text below, "the engine" is the backend plus everything it drives, "the tablet" is a GM scanner, "the phone" is the web player scanner and "the hardware scanner" is the ESP32.
- **How to read a job.** Each entry says what the job means for any game, who relies on it, where the roadmap and the owner's decisions already point it (or that the goal is open for step 3), what the planned capabilities need from it, where today's design falls short (the flaws, primary first), what a standalone game adds, which of the nine questions it answers, and two to four test cases drawn from the shows. No entry decides a design.

## 1. What the engine is for

The engine is the game-independent software that runs a show, and it is going toward an open-source show platform that designers who are not technical can use and technical people can extend. [MD:52; RM:40-44]

A game designer builds a whole game as a pack in the design tool, never touching code or configuration files, and tunes it by changing a value, applying it and playing. [MD:53; RM:48-54]

A venue installer fills in a profile of what the venue has, connects the pack's names to the real instruments in the room on one page, and runs one preflight that answers go or no-go with every line traceable. [MD:54; RM:55-61]

A GM runs the show from four sections (Game Ops, Show Control, Environment, Game Admin), and the post-game report builds itself from what was captured during play. [MD:55; RM:62-65]

A player taps tokens on a phone or a shared station with no account, no login, no app to install and no recorded identity unless the game designs an identification moment. [MD:56; RM:66-70]

The business is one production, one kit and many games on it; a second kit or operator is not planned, but must stay cheap to start, so nothing in the engine may assume one kit, one pack or one production. [MD:57, MD:59; RM:71-75, RM:102-111]

The standing rules: players' data stays on the kit; media never lives inside the pack; phones and hardware scanners stay equal; the engine holds no opinion about game design; red always means act now; the preflight states its own limits; and nothing deploys to the live machine until the owner says the new engine is ready. [MD:58-70]

A second, toy game stays in the repository for good, so every change is proven on two games and ALN stays one pack among others. [MD:71; CTX:248-250]

## 2. The jobs at a glance

The orchestrator's draft, written for any game. Three lines carry a change the mapping sheets both asked for; each is marked and put to the owner in section 4.

- **J1.** Run any game from its pack. The pack describes the game: its tokens and their content, modes, scoring, groups, cues, the clock, what each screen shows. The engine runs whatever the pack says, nothing in the engine assumes ALN, and every part of the kit runs the same version of the pack and says which. ALN is one pack; the toy pack proves the engine is generic. *(Two clauses added, see section 4 (question A).)*
- **J2.** Keep one true record of the game, and show it truly everywhere. Teams, scores, used tokens, exposed evidence and the game's phase are decided in one place, and every screen (GM tablets, the TV and other scoreboards, player devices) shows that record, also after it reconnects.
- **J3.** Answer every action, and remember what happened. Every scan and every GM command gets one clear answer, and the game keeps a record of what was done, so the show can be reviewed, reported and captured afterwards.
- **J4.** Run the show's equipment, and know its true state. Video, music, sound, lights, displays and speakers: the engine drives them, knows whether each one works or is not installed tonight, and lets the GM control them, by hand or by cues.
- **J5.** Move each game through its life cleanly. Setup, start, pause, end, reset, an engine restart and the next game: every fact has a defined fate at each of these moments.
- **J6.** Let designers build, change and try games safely. Publish a pack, apply a change to a running game, rehearse on a preview engine, all without disturbing a live show.
- **J7.** Give each person exactly what their role needs, and let each do only what their role allows. The GM gets the command center, the audience the public scoreboard, players the content of what they scan, designers and installers their tools. The engine knows who is connected and keeps private what should be private. *(Title widened, see section 4 (question B).)*
- **J8.** Run wherever the venue and the game need. On the show machine, with the venue's equipment, with or without an engine (standalone games, as a choice the game declares, decision 22), and on other kits later. *(One clause added, see section 4 (question C).)*
- **J9.** Tell the truth about what it knows. Unknown, out of date, broken and not installed tonight each show as what they are; red always means act now; the preflight answers go or no-go honestly.
- **J10.** Stay trustworthy as it changes. Tests prove the real show path, the parts that join are checked against each other, the installed pieces match, and testing never touches a live show.

## 3. The jobs, one by one

### J1. Run any game from its pack

**What it means for any game.** The pack describes the game: its tokens and their content, modes, scoring, groups, cues, the clock, what each screen shows. The engine plays whatever the pack says, and nothing in the engine assumes ALN. Every part of the kit runs the same version of the pack and can say which. The toy pack proves the engine is generic.

**Who relies on it.** The game designer, whose pack is the whole game; the GM and the players, who play what the pack declares; the venue installer, who reads the pack's needs; the engine itself, which must not know ALN's words.

**The long-term goal, as the roadmap and the owner's decisions set it.** A designer builds a complete game as a pack and never touches code or configuration; everything a designer iterates on is pack data, never firmware. The engine holds no opinion about game design. The pack names media by fingerprint; a bundle carries the files. A second game stays in the repository, and every change passes the two-pack run. [RM:48-54, RM:145-146, RM:151-154, RM:112-126 (via MD:53, MD:60-63); CTX:248-250 and MD:71 (toy pack)]

**What the planned capabilities need from it.**
- The pack (capability 1) and the activation gate (capability 2): every part of the engine takes the game's tokens, rules, modes and cues from the pack, never from code; the engine refuses to start on a pack that fails the check and keeps the pack it adopted for as long as it runs. [JC:24-25; MD:142-143]
- The second game's modules (capability 38), interaction primitives (capability 36) and the entity-field migration (capability 37): scoring models, hidden facts, multi-tap actions and even the word for a score-holder come from the pack. [JC:103; MD:234-235, CTX:163-170]
- The media bundle (capability 40) and the ledger retirements (capability 50): the pack names its files by a fingerprint of their contents and carries no venue-hardware name. [JC:104; MD:243, MD:128]
- Hot-apply (capability 16) and the pack channel (capability 3): one complete list of every part that holds a copy of the pack. No document has this list today. [JC:105; MD:143-144]
- Content tooling (capability 41): a replacement for Notion feeds the same pack through the same gate. [JC:106; MD:119]
- Hardware-scanner parity (capability 49): a mechanic that needs a fleet re-flash breaks the designer's loop, so everything a designer changes is pack data. [JC:107; MD:239, MD:62]

**Where today's design falls short.** Primary flaws first, then the flaws that touch this job from another home. [JF:59; JF:69]
- **C12** (primary). The pack is read at scattered moments and no message says it changed, so the TV, the engine and a tablet can end up running different versions of one game.
- C14 (secondary). The shape of the files the pack hands each device is kept by hand on both sides, so the hardware scanner cannot read the pack's own token file.
- C15 (secondary). The videos and other media files the pack names are copied onto the show machine by hand, and nothing checks that every file the pack names is there.
- N1 (secondary). The pack has no field that says a game runs without an engine, yet it declares a scoreboard, a clock and videos that an engine-less device cannot show.

**In a standalone game.** Each device loads whatever pack copy its source holds; a tablet that reloads online mid-game adopts the newest published pack under the game in progress, no game record carries a pack stamp, and no player device shows a pack identity, so nothing compares the devices. [SP:115-119; SG-03 at SP:167; SP:291]

**The pass's questions it answers.** 6 (What does each fact and each copy do at a boundary?), 5 (Does one question get one answer?), 8 (How may a copy be updated, and can a screen tell how old it is?). Question 6 for a pack change while a game runs, questions 5 and 8 for the scattered reads (the analysis files C12 under 6, 5 and 8, AN:41).

**Test cases from the shows.** What to do, and what must happen.
1. Edit one token's rating on disk with the engine running and no restart: the token list, the pack file and the points a scan awards all agree, and the file's fingerprint matches the one in the engine's own list of pack files. [AN:634 (B-07 / D-04)]
2. Connect a tablet that runs a different pack: the GM sees a mismatch on screen, or the tablet is refused. [AN:634 (B-20 / C-08)]
3. Run the group-completion test on the real pack and on the toy pack: it runs on both and does not skip. [AN:835 (A-82)]
4. With no alternate pack chosen, compare the phone scanner's token file with the engine's own pack: they are the same version. [AN:634 (D-05)]

### J2. Keep one true record of the game, and show it truly everywhere

**What it means for any game.** Teams, scores, claimed tokens, exposed evidence and the game's phase are each decided in one place: the engine in a networked game, the GM tablet in a standalone one. Every screen (GM tablets, the TV and other scoreboards, player devices) shows that record, also after reconnecting. J2 makes a screen right; J9 makes it say so when it cannot be.

**Who relies on it.** The GM, whose every decision must show the same on every tablet; the audience, who read the public scoreboards; players, in future games with hidden facts; the designer, whose hidden facts must have one home.

**The long-term goal, as the roadmap and the owner's decisions set it.** The engine decides the scores in a networked game and the GM tablet in a standalone one, with the engine's pure rule functions as the surface both must match. Games with hidden facts need the engine to filter what each screen receives; filtering on the screen is fatal for them. How copies are kept correct is step 3's work. [CMD:89-93, CTX:244, MD:64 (authority split); PRG:244-249 and BILL:75-79 via MD:232; PD:98 (question 1)]

**What the planned capabilities need from it.**
- The truth sweep (capability 28) and the GM scanner redesign (capability 27): a named decider for each fact the GM sees, applied to the ten service domains and the twenty-two accepted events; the redesign adds a new fact the GM writes, the game's phase. [JC:111; MD:212, MD:218-219]
- Capture (capabilities 30 and 31): roster, notes, accusation and photos each need a decider, a place that survives a restart and a place in the reconnect catch-up. A note held only on a tablet is a copy, not a record. [JC:112; MD:223, MD:226]
- The second game (capability 38) and players' phones (capability 35): hidden facts have a decider and a saved home, and the engine filters what each screen receives. [JC:113; MD:232, MD:236]
- Service domains (capability 15): state and health travel together on one route, and every catch-up message carries every service. The same bug has come back four times. [JC:114; MD:178, MD:214]
- Credentials (capability 12) and remote displays (capability 39): the engine knows which screens are connected and which record each may see. [JC:115; MD:177, MD:237]
- Hot-apply (capability 16): every client is told that the pack changed. [JC:116; MD:184]

**Where today's design falls short.** Primary flaws first, then the flaws that touch this job from another home. [JF:75; JF:86]
- **C1** (primary). Every tablet keeps its own list of claimed tokens that only grows, so after a delete every connected tablet keeps refusing the token the engine has freed, and a tablet that lost its connection during a Reset All Scores, and did not reload, keeps the old claims when it reconnects.
- **C6** (primary). What a tablet gets when it connects and what it gets live for the same fact come from different code, so a tablet that reloaded can differ from one that watched everything happen.
- **C9** (primary). Tablets and phones work out claims, points and 'seen before' from their own copy of the rules, so the result screen shows a verdict the engine has not given.
- **C11** (primary). One question has several answerers inside one part of the engine or one tablet, so 'is a video playing', 'which teams exist' and 'may I scan' get different answers in different places.
- C2 (secondary). Equipment state reaches the panels on a different route from its health, so a panel can look calm while the engine knows the player is down.
- C4 (secondary). A reconnecting tablet infers a game boundary from whatever arrives and may wipe its own history.
- C5 (secondary). After a Reset System the broadcasts are wired before the saving step, so a later Reset All Scores sends every tablet and the TV the old transaction list, and cleared evidence comes back.
- C7 (secondary). A reply does not say which request it answers, so a tablet's copy and the engine's record part ways.
- C12 (secondary). A tablet running a different pack than the engine is only written to a log.
- C14 (secondary). Team Details reads the score from a place the tablet never fills, so it shows the wrong score while the scoreboard screen shows the right one.

**In a standalone game.** One GM tablet holds the only copy, so tablets cannot drift, but it refreshes screens only on wired events. Two standalone tablets are two separate games, and whether a standalone game means one tablet is undecided. [SP:27-31; SG-06 at SP:170; SP:251, question 2]

**The pass's questions it answers.** 1 (Who decides each fact the GM sees?), 5 (Does one question get one answer?), 8 (How may a copy be updated, and can a screen tell how old it is?), 9 (Is each fact's reconnect snapshot built the same way as its live update?). Question 1 is the pass's central question and lives here; 5, 8 and 9 come with C11, C1 and C6.

**Test cases from the shows.** What to do, and what must happen.
1. Delete a transaction on one tablet, then rescan its token on a second tablet with no reload: the scan is accepted. [AN:95 (A-05 / C-04)]
2. Drop a tablet's connection without reloading it, press Reset All Scores from another tablet, reconnect the first and rescan an old token: accepted. [AN:95 (A-06 / C-30)]
3. For each fact, build the live message and the connect-time entry from the same state: equal keys and values. [AN:313 (B-30)]
4. Scan a token the engine will refuse: the result screen never says 'complete' and shows the engine's reason. [AN:473 (C-07)]

### J3. Answer every action, and remember what happened

**What it means for any game.** Every scan and every GM command gets one clear answer: done, refused and why, or try again. The game keeps a record of what was done, by GMs and by players, so the night can be reviewed, reported and captured afterwards. The two halves have different flaws and different tests; section 4 asks whether they are two jobs.

**Who relies on it.** The GM, who needs a plain answer to every tap; players, whose devices need to know whether a scan was kept; after the show, the director, who tells the players the story of their night (for ALN, an article written in the Director Console), and the players it is told to; the owner, who reviews and reports the night; the designer, whose Review stage tells the story of the night. What reaches the players after the show is the game's own business, not a promise of the engine's (decision 28, 2026-11-01).

**The long-term goal, as the roadmap and the owner's decisions set it.** The post-game report builds itself from material captured during play instead of being reconstructed afterwards. Roster, notes, accusation and later photos are captured into the engine's own record, and a structured record of the night is written when the game ends. It carries the game it ran and the texts the players saw. ALN's Director Console stays a separate program that reads that record; the record leaves room for the console to run inside the engine's Review stage later. Players' emails stay outside the engine (decision 28; the survey is `2026-11-01-after-game-report.md`). Whether every scan attempt's outcome is recorded is still the owner's open question. [RM:62-65 (via MD:55); RM:348-373 via MD:108-112 and MD:223-228; CS:56-57 (question 19)]

**What the planned capabilities need from it.**
- No planned capability concerns the answer to a scan or a GM command; that half of J3 is the engine's existing core, which the capability list does not grade. [JC:120; JC:15]
- Capture (capabilities 30 and 31), the session-bundle emitter (capability 32), the Review stage (capability 34) and the report pipeline move (capability 33): the engine writes a structured record of the night when the game ends, from facts the engine itself decided. Nothing writes that record today. [JC:121; MD:225-226, MD:228]
- Photo capture (capability 31): a way to receive a picture, which the engine lacks, with the data kept on the kit and retention set per game by the owner. [JC:122; MD:224, MD:227]
- Held items (capability 14): a held cue counts as an answer the GM can see, with a defined end for holds caused by a broken service. [JC:123; MD:162, MD:178]

**Where today's design falls short.** Primary flaws first, then the flaws that touch this job from another home. [JF:92; JF:102]
- **C7** (primary). A reply does not say which request it answers, whether it is final or whether anything was stored, so a device deletes scans the engine never kept and replays scans that can never succeed.
- C4 (secondary). When the GM ends the game, a reconnecting tablet loses its history and the wall scoreboard goes blank.
- C9 (secondary). The tablet shows its own verdict before the engine answers, so the GM can see 'Transaction Complete' for a scan the engine then refuses; in a standalone game a scan into a paused game shows complete and records nothing. Whether refused scans belong in the night's record is the owner's open question, not this flaw. One game's sale and adjustment times come from two clocks, so the night's timeline has to be repaired before it can be told (X-08, decision 28).
- C11 (secondary). The downloaded report's two totals disagree.
- C13 (secondary). The device list records a hardware scanner as a phone scanner, because the route it checks in on assumes 'player' when a device sends no type.
- N1 (secondary). In a standalone game nothing records what players found.

**In a standalone game.** No network reply exists, but each device's own store answers and the caller ignores it: a refused scan still shows Transaction Complete, and the hardware scanner shows a queued scan as recorded. Nothing records what players found, and the only way to start over deletes the finished game's record. [SP:75-79; SG-02 at SP:166; SP-05 at SP:186]

**The pass's questions it answers.** 1 (Who decides each fact the GM sees?), 8 (How may a copy be updated, and can a screen tell how old it is?). The analysis files C7 under questions 1 and 8 (AN:31).

**Test cases from the shows.** What to do, and what must happen.
1. Send a batch of player scans while no game exists: the engine either refuses it so the device keeps the scans, or stores them. Never 'processed' with nothing kept. [AN:359 (B-22 / D-13)]
2. Send a batch, restart the engine, send the same batch again: the scans appear once. [AN:359 (B-21 / D-15)]
3. End a game and reconnect a tablet: it still shows its history, its scans and Download Report, and the wall scoreboard keeps the final scores until a new game starts. [AN:239 (A-01 / C-39)]
4. Press Skip twice quickly when the second press must fail: one success and one failure, each matched to its own press. [AN:359 (B-65 / C-33)]

### J4. Run the show's equipment, and know its true state

**What it means for any game.** Video, music, sound, lights, displays and speakers do what the GM and the cues ask. The engine knows whether each is working, down, or not installed tonight, restarts what it can and lets the GM control the rest, by hand or by cue. The outside programs it drives decide what they are doing; the engine reads them, never guesses.

**Who relies on it.** The GM, who runs the venue from the Environment and Show Control sections; the audience, who watch the TV and hear the speakers; the venue installer, whose profile says what is installed tonight; players, whose video tokens start a video.

**The long-term goal, as the roadmap and the owner's decisions set it.** Three health words: healthy, down and dormant; dormant sticks, with two doors: not installed tonight, or taken out of service by the GM. One supervisor restarts a crashed program a few times, then shows a red row with a Restart button. A host file says whether the engine starts or adopts a program. An outside program decides what it does. [CTX:338-349 and MD:273 (health words); CTX:362-366, HP:198-215 via MD:274 and MD:168-169 (supervisor); HP:55 via MD:172 (host modes); PD Appendix A, decision 3 (an outside program as authority)]

**What the planned capabilities need from it.**
- The supervisor (capability 9): each program gets one restart rule with bounded tries and then a red row, and the engine tells its own video or music player from a stranger's. Today four different restart shapes exist and the TV's browser has none. [JC:127; MD:168-170]
- The host-config file (capability 10): a plain setting for whether the engine starts a program itself or adopts a running one. [JC:128; MD:171-172]
- Self-heal (capability 11): the engine fixes a crashed program silently and raises a red row only for what it cannot fix. [JC:129; MD:176]
- Dormancy (capability 8): a not-installed-tonight verdict that sticks, silences the cues that depend on it and is never restarted, plus a decision about what a reset and a restart do to a service the GM has taken out of service. [JC:130; MD:153-154, MD:159]
- Service domains (capability 15): no service keeps a private 'connected' note beside the shared health list, and one store for hold expiry instead of two. [JC:131; MD:175, MD:178]
- Remote displays (capability 39) and the media bundle (capability 40): the engine knows whether a second screen is alive and whether the named video files exist on its disk. [JC:132; MD:243, MD:117]

**Where today's design falls short.** Primary flaws first, then the flaws that touch this job from another home. [JF:108 (with the consistency check's K4 reading, JF:8)]
- **C2** (primary). 'Is it working' and 'what is it doing' reach the screens by different routes, so the music panel can keep a calm playing look while the engine knows the player is down.
- **C3** (primary). The engine runs the video player, the music player and the sound server from a remembered picture it re-reads only in part and never dates, so the queue and the cues act on a belief that has drifted from the truth.
- C5 (secondary). A Reset System leaves the music panel's feed out, so the panel is dead until a restart.
- C10 (secondary). When the venue profile fails to load, six services that are installed read 'not installed', and the panel shows a calm green count.
- C11 (secondary). 'Is a video playing' has eight answers, and a paused video counts as not playing for four of them.

**In a standalone game.** No venue service runs and no outside program is driven: the service panels are hidden on the tablet and each player device plays its own audio. These two flaws produce no fault with no engine. [SP:33-47]

**The pass's questions it answers.** 2 (Does a service's state travel with its health?), 3 (How does the engine read the programs it drives?), 5 (Does one question get one answer?). Question 2 is C2's, question 3 is C3's, question 5 for the gates that read the engine's cached picture (AN:21, AN:23).

**Test cases from the shows.** What to do, and what must happen.
1. Play a video: the engine reports 'started' within half a second every time, whichever order the player sends its signals. [AN:183 (A-68)]
2. Kill the music player during play: the next push says stopped with no track, and the controls come back within about ten seconds with no reload. [AN:183 (A-72, A-73)]
3. Stop the lighting system, then start it again: the lighting panel shows 'unavailable', then its scene tiles, with no reload. [AN:131 (A-11)]
4. Pause a video, then run the queue: the paused video is not replaced, and a player who scans while a video is paused is not told the video was triggered. [AN:587 (B-39)]

### J5. Move each game through its life cleanly

**What it means for any game.** Setup, start, pause, end, Reset System, an engine restart, the next game and a pack change: at each moment every fact, and every copy of it, has a defined fate: kept, cleared or carried on, by one code path. J5 has no deliverable of its own; it is a table of facts against moments that every other job reads.

**Who relies on it.** The GM, who starts, pauses, ends and resets games; the designer, whose edit-apply-play loop runs between games; players, whose scans must not land in an ended game; the engine itself, at every restart.

**The long-term goal (open question for step 3).** Partly set: a pack change is refused while a game is active or paused; the engine updates only between events; a scanner's stale pack copy is replaced at a game boundary; reset is one code path everywhere. Open for step 3: the table of every fact against every moment (question 6), and whether standing cues fire in setup. [PGS:490-492 via MD:183; RM:567-570 via MD:245; HP:256-271 via MD:176; BCM:137 via MD:255; PD:103 (question 6); MD:200 (the setup gap); MD:153 (the latch after a reset)]

**What the planned capabilities need from it.**
- No capability exists mainly for J5, but thirteen list it as a secondary job (the eleven in the capabilities sheet's table, plus dormancy (capability 8) and the second game's modules (capability 38), which that sheet's section 3 places here); together they ask for one table of every fact against every moment. [JC:136]
- Hot-apply (capability 16): refused while a game is active or paused; the setup, ended and no-game cases defined. [JC:138; MD:183, MD:199]
- Self-heal (capability 11): the scanner's pack copy replaced at a game boundary, once per connection and engine version. [JC:139; MD:176]
- Dormancy (capability 8) and the preflight (capability 7): verdicts recomputed at reset, at game create and at restore, and the display's health not falsely red after a reset. [JC:140; MD:160-163]
- The session-bundle emitter (capability 32) and capture (capability 30): every fact that exists only on a tablet reaches the engine before the game ends. [JC:141; MD:226]
- The GM scanner redesign (capability 27): the new phase fact has a defined fate at pause, end and reset. [JC:142; MD:218]
- The second game (capability 38): hidden state persists across a restart. [JC:143; MD:236]
- Blue/green cutover (capability 44): the engine updates only between events; the test environment (capability 46): reset is one code path in tests and in production. [JC:145-146; MD:245, MD:255]

**Where today's design falls short.** Primary flaws first, then the flaws that touch this job from another home. [JF:124]
- **C4** (primary). Nothing says what a game boundary clears or keeps, so an ended game returns after a restart and a once-only cue stays spent into the next game.
- **C5** (primary). Starting the engine and rebuilding it after Reset System are two hand-kept lists of steps that differ, so a reset leaves out the music feed and brings old data back to the TV.
- C1 (secondary). A tablet that lost its connection during a Reset All Scores, and did not reload, keeps its old claims when it reconnects.
- C6 (secondary). A reload restores the saved game without firing the events a live change would.
- C7 (secondary). A slow reset reports failure and the new game is skipped.

**In a standalone game.** The tablet decides every boundary, but start, pause, end, reload, a day change and a pack change each run their own code; the tablet opens into an unnamed Active game, no screen can start a named or second game, and Pause cannot work on the opening one; the phone's seen list and the hardware scanner's queue outlive every game, and the queue's lines are sent into a later networked game, which refuses those without a real time. [SP:49-55; SG-01 at SP:165; SP-18 at SP:199]

**The pass's questions it answers.** 6 (What does each fact and each copy do at a boundary?). Question 6 is this job's question, and J5 is reached by no other (JC:265).

**Test cases from the shows.** What to do, and what must happen.
1. End a game, restart the engine, scan a player token: refused with 'no game', and the engine reports no current game. [AN:239 (B-61 / D-31)]
2. Fire a once-only cue in game one, end it, create and start game two by the plain flow, trigger the cue again: it fires. [AN:239 (B-17 / C-38)]
3. Run Reset System with tablets connected: every tablet at once shows an empty game with no scores, claims or history. [AN:239 (C-36)]
4. Scan three tokens, run Reset System, create and start a game, scan two, press Reset All Scores: the GM history and the TV evidence are empty. [AN:273 (A-53 / B-02 / C-37 / D-30)]

### J6. Let designers build, change and try games safely

**What it means for any game.** The week before the show, not the show itself. A designer edits a private draft, publishes it through the engine's own check, applies a change to a running engine between games, and rehearses on a second engine, without disturbing the live show or writing into its records. Edit, apply, play, repeat is the point of the engine work.

**Who relies on it.** The game designer, in the edit-apply-play loop; the owner, who designs the second game at his own pace; the venue installer, who receives the handoff.

**The long-term goal, as the roadmap and the owner's decisions set it.** Edit, apply, playtest, repeat; the mechanics editor and hot-apply are one deliverable. Hot-apply runs four named steps and is refused while a game is active or paused. A preview engine runs the draft under a preview profile, so hardware-shaped needs read as not installed on a laptop. Where a preview engine runs is decided nowhere. [RM:128-135 (via MD:61); PGS:344-352 and PGS:490-492 via MD:182-183; PGS:502-505 via MD:197; MD:40 and MD:305 (the gap)]

**What the planned capabilities need from it.**
- The five Design pages (capability 17) and the draft and publish store (capability 4): edits touch a draft only, with the live engine's adopted version shown beside it. [JC:151; MD:185, MD:192]
- Hot-apply (capability 16) and the design-iteration loop (capability 18): edit, publish, apply and play work in setup or after an end; a GM-scored trial needs a started game and so passes the start gate. [JC:152; MD:182-183, MD:199]
- The preview engine (capability 20) and simulation profiles (capability 21): a second engine that cannot kill the live engine's programs, write into its records or mint passes it accepts. [JC:153; MD:194-198]
- Live verdict badges (capability 19): the same verdict function as the engine, run on the draft, labeled paper or live. [JC:154; MD:193]
- First-run state (capability 48), content tooling (capability 41) and the preset-load gate (capability 52) set no demand in the direction map's section 3. [JC:155; MD:260]

**Where today's design falls short.** Primary flaws first, then the flaws that touch this job from another home. [JF:140 (why no flaw is primary: hot-apply, the loop and the preview engine are not built; the direction map's rows for capabilities 16, 18 and 20, MD:94, MD:96, MD:98)]
- *No flaw has this job as its main home.* Hot-apply (capability 16), the design-iteration loop (capability 18) and the preview engine (capability 20) are planned, not built; today's flaws describe the ground they will stand on.
- C8 (secondary). A second engine on the same machine kills some of the live engine's helpers (the sound system's watcher, the TV's browser and the music player); the design-tool plan warns that a preview engine would also write into the live engine's saved records and issue passes the live engine accepts.
- C12 (secondary). Publishing a pack from the config tool tells the running engine nothing; the engine scores by the change only after a restart, while a reloaded TV already shows it.

**In a standalone game.** No standalone shortfall of its own: a standalone tablet runs no engine to rehearse against. The one standalone finding nearby, a tablet adopting a newer pack on a mid-game reload, is filed under J1. [JF:149; SP:167]

**The pass's questions it answers.** 4 (Can anything other than the live engine touch the live show?), 6 (What does each fact and each copy do at a boundary?). Question 4 for the preview engine beside the live one; question 6 for a pack change while a game runs (PD:101, PD:103).

**Test cases from the shows.** What to do, and what must happen.
1. Publish a changed rating through the tool with the engine running: within a bounded time scoring, the token lists, the scoreboard and every tablet use it, or the tool says a restart is needed. [AN:634 (B-28 / D-38)]
2. Start a second engine on the same machine while a show runs: the first engine's video player, music player, the TV's browser and the sound system's watcher are untouched. [AN:424 (B-63, D-72 to D-74)]
3. Swap a pack mid-game and delete a transaction: scores equal what the original rules awarded, or the swap is refused during a game. Today a swap needs an engine restart, so the test swaps across a restart and keeps the game. [AN:634 (B-29); SP:223]

### J7. Give each person exactly what their role needs, and let each do only what their role allows

**What it means for any game.** The GM gets the command center, the audience the public scoreboard, players the content of what they scan, designers and installers their tools. The engine knows who is connected, sends each screen only what its role needs, keeps private what should be private, and keeps starting, pausing, ending and score changes in the GM's hands alone.

**Who relies on it.** The GM, the only one who may start, pause, end or change a score; the audience, who see team scores and exposed evidence and nothing else; players, who see the content of what they scan, with no account; the designer and the installer, with their tools; the owner, whose secrets must rotate before outsiders touch the system.

**The long-term goal, as the roadmap and the owner's decisions set it.** Players never get accounts; the engine's only identity is the device or session id; game data stays on the kit. Every connection presents a verified pass; a device's own word no longer counts. Each screen receives only what its role needs, filtered by the engine. Lifecycle, show control and score changes stay operator-only. Secrets rotate before outsiders arrive. [RM:81-100 via MD:58; HP:272-285 via MD:177 (ruling R5); PRG:244-249 via MD:232; CTX:570 and MD:67 (the floor); RM:222-226 via MD:70]

**What the planned capabilities need from it.**
- Credentials on every connection (capability 12) and auth tiers (capability 13): every connection presents a verified pass, and the floor stays operator-only. [JC:159; MD:177, MD:237]
- Players' phones (capability 35): passes issued without accounts, engine-side filtering of what each phone sees, and a measured capacity for how many phones one kit carries. No number exists. [JC:160; MD:232-233, MD:238]
- The second game (capability 38): hidden state kept from every screen except the one entitled to it. [JC:161; MD:234]
- Remote displays (capability 39): a read-only pass minted per page and capped in number. [JC:162; MD:237]
- The GM scanner redesign (capability 27): the GM's four sections keep working while mid-game controls change. [JC:163; MD:104-105]
- Open-sourcing (capability 47) and the standing safety rule: the committed lighting token and admin password rotate before any outsider touches the system. [JC:164; MD:70]

**Where today's design falls short.** Primary flaws first, then the flaws that touch this job from another home. [JF:155; the unpinned certificate inside C15 and the secrets rotation fit here loosely (JF:220)]
- **C13** (primary). A client's own word or a route's default decides whether a credential is asked for and what the station is called, so every connection gets everything and the engine cannot tell two tablets or a display from a GM.

**In a standalone game.** No engine, no credential and no connection exist, so this flaw produces no fault; a tablet never set up for a networked game keeps device id 001 and is known to nobody. [SP:121-127]

**The pass's questions it answers.** 7 (Does each component receive what its role needs, and no more?), 1 (Who decides each fact the GM sees?). Question 7 is this job's question; the analysis files C13 under 7 and 1 (AN:43).

**Test cases from the shows.** What to do, and what must happen.
1. Open a connection with no credential and a device type of 'scanner', then ask for the state: refused, nothing arrives. [AN:680 (B-04)]
2. Ask the engine for the game state with no credential from the kit network: refused, or only what a player needs. [AN:680 (B-27 / D-27)]
3. Connect as a TV: it receives only the events its role needs, and what it receives on connecting holds only exposed evidence and team totals. [AN:680 (D-25, D-26)]
4. Drop a tablet's network, or kill its browser without a clean close, then reload it mid-game: it reconnects under its own station name within five seconds. [AN:680 (B-24 / C-59)]

### J8. Run wherever the venue and the game need

**What it means for any game.** On the show machine with this venue's equipment, fitted by the installer through a profile; with or without an engine, as a choice the game declares and never mixed; and on another kit, another pack or another operating system later. Nothing in the engine assumes one kit, one pack or one production.

**Who relies on it.** The venue installer, who fits the game to the room; the GM running a standalone game on one tablet; players on standalone devices; a future operator with a second kit.

**The long-term goal, as the roadmap and the owner's decisions set it.** Pack and profile are chosen by path or id, engine code holds no kit-unique names, and the seams for more kits are built now. The installer fills a profile, binds names to instruments, runs one preflight. Phones and hardware scanners stay equal. A standalone game is a declared choice, never mixed. Open: where that fact lives; one tablet or several. [RM:102-111 via MD:59; RM:55-61 via MD:54; RM:137-149 via MD:62; CS:36-44 (decision 22); CS:60-62 and SP:251 (the open questions)]

**What the planned capabilities need from it.**
- Installation profiles (capability 5), the bindings page (capability 23), the hardware editor and rider (capability 24) and the Deploy stage (capability 22): the profile is read once at start, and the design says what a profile change ends in, since the pack side will have hot-apply and the profile side will not. [JC:168; MD:152, MD:206]
- The host-config file (capability 10), the seams for more kits (capability 42) and the kit network (capability 43): no kit-unique names in engine code, per-engine names for process files, and a name server the engine reads but does not drive. [JC:169; MD:244, MD:246]
- Hardware-scanner parity (capability 49): every new mechanic has matching firmware, and a decision on the hardware scanner's missing standalone mode. [JC:170; MD:239, SP:19]
- Standalone games need something that says a game is standalone. Today the tablet's mode is a tap, the phone's is its URL path, the hardware scanner has no such notion, and the pack has no field for it. [JC:171; SP:19]
- The planning view (capability 25) needs nothing from the running engine. [JC:172; MD:207]

**Where today's design falls short.** Primary flaws first, then the flaws that touch this job from another home. [JF:171; JF:181]
- **N1** (primary). Nobody declares that a game is standalone, so each device reads a missing engine as an outage, nothing says which of the pack's effects an engine-less game drops, and nothing can refuse a mixed game.
- C4 (secondary). With no engine the tablet decides every boundary by its own code.
- C8 (secondary). The engine and its helpers assume one engine per machine.
- C9 (secondary). With no engine the tablet is the only judge and its copy of the rules has gaps.
- C10 (secondary). A standalone game is drawn as an outage on every player device.
- C15 (secondary). Program names and install commands are fixed to one operating-system release, so a new machine logs warnings or refuses its install.

**In a standalone game.** This is the standalone job. The tablet's mode is its own tap, the phone's is its URL path, the hardware scanner has none and treats a missing engine as an outage that never ends; the hardware scanner is behind the phone in seven rows of the 24-row parity table. [SP:19; SP:259-284; SP:288-289]

**The pass's questions it answers.** 1 (Who decides each fact the GM sees?), 6 (What does each fact and each copy do at a boundary?). None of the nine names standalone; decision 22 adds it to the list every rule must serve. The standalone pass asks that every rule name its decider with the engine absent (question 1) and that the boundary rule have a defined input (question 6) (SP:288-289).

**Test cases from the shows.** What to do, and what must happen.
1. In a standalone game, pause the game and scan: refused with a reason and the token not used; end the game and scan: refused. [AN:473 (A-02 / C-09), read with the consistency check's K2 (JF:8)]
2. On a new machine whose operating system gives the speaker rule and the TV's browser their new names, start the engine: it logs no warning and the TV page opens. [AN:786 (B-98)]
3. Start a player device with no engine in a game declared standalone: it says 'standalone', not 'offline' or 'disconnected'. [Not an analysis proving test: the standalone pass, parity row 17 (SP:275) and the card change at SP:102; N1 has no proving test in the analysis.]
4. Build a clean machine from the deployment guide: it pairs a speaker and plays through it, and the install line works on the new operating-system image. [AN:786 (A-88 / X-03, B-100)]

### J9. Tell the truth about what it knows

**What it means for any game.** Unknown, out of date, broken and not installed tonight each look like what they are, on every screen. Red always means act now; grey means absent on purpose. The preflight answers go or no-go honestly, says what it cannot check, and labels each line paper or live. J9 makes a screen say so when it cannot be right.

**Who relies on it.** The GM, who must trust red to mean act now; the venue installer, who reads the preflight's go or no-go; the designer, whose editor badges use the same words as the show; the audience, whose TV clock must not count on its own.

**The long-term goal, as the roadmap and the owner's decisions set it.** The preflight states its own limits and labels every check paper or live. Red always means act now; intentional absence shows grey. An equipment list the engine cannot read gives unknown, never broken. A missing or broken profile is a failed check and a start refusal, never 'nothing installed'. One verdict function answers in the editor and at the show. [RM:309-317 and CTX:434-442 via MD:68; CTX:356 and MD:69; C23:251 via MD:157; HP:49 via MD:156; PGS:483-489 via MD:193]

**What the planned capabilities need from it.**
- One truth (capability 6) and the preflight (capability 7): unknown for an equipment list the engine cannot read; a missing or broken profile is a failed check, not 'nothing installed'; each line labeled paper or live. [JC:176; MD:156-158]
- Dormancy (capability 8): grey for intentional absence, so that red keeps meaning act now. [JC:177; MD:153, MD:69]
- Live verdict badges (capability 19): the same words in the editor as at the show. [JC:178; MD:193]
- The truth sweep (capability 28) and screen baselines (capability 29): an audit that finds screens that say something false, and images that catch accidental change. [JC:179; MD:212, MD:107]
- A reset must not leave the display row red for good. [JC:180; MD:161]

**Where today's design falls short.** Primary flaws first, then the flaws that touch this job from another home. [JF:187]
- **C10** (primary). Facts do not carry whether they are known, unknown, old or partial, so a screen shows a calm normal value where the truth is 'I do not know' or 'this is broken'.
- C2 (secondary). A service's own state travels on a different route from its health, so a panel can keep showing an old state after the health row has changed, with nothing to say it is behind.
- C3 (secondary). The engine's picture of a program carries no age.
- N1 (secondary). No screen can tell 'standalone by choice' from 'engine down'.

**In a standalone game.** Every device draws the missing engine as an outage: the phone says Offline all night, the hardware scanner shows a red Disconnected and a rising queue count, a video token says Rescan later though rescanning can never work. No verdict says a standalone tablet is ready for the night. [SP:97-103; SG-09 at SP:173]

**The pass's questions it answers.** 8 (How may a copy be updated, and can a screen tell how old it is?), 2 (Does a service's state travel with its health?). The analysis files C10 under questions 8 and 2 (AN:37).

**Test cases from the shows.** What to do, and what must happen.
1. Start the engine with a mistyped profile path: the tablet shows a red 'profile failed to load' row, not a green summary. [AN:524 (B-72 / C-48)]
2. Fire a mixed standing cue with lighting dormant: the finish message and the standing-cue row name the skipped command. [AN:524 (B-76 / C-47)]
3. Cut a tablet's connection for a minute: every live panel shows its numbers are old, and the header turns 'disconnected'. [AN:524 (C-03)]
4. Kill the engine: each player scanner shows offline within one poll interval, and the TV shows its clock as unconfirmed, not counting. [AN:524 (D-16, D-22)]

### J10. Stay trustworthy as it changes

**What it means for any game.** Nothing in the code or the deployment drifts unseen. Tests prove the path the show really runs; the parts that join are checked against each other; the installed pieces match; testing never touches a live show. Shipping a new version to the show, and rolling it back, sits here loosely today; section 4 asks whether this job is too big.

**Who relies on it.** The owner, who decides when the new engine is ready; the people building the engine, whose green run must mean something; the GM, whose live show no test may touch.

**The long-term goal, as the roadmap and the owner's decisions set it.** A ladder of test environments, with a first rung that runs the real software stack with fake physics. Tests skip loudly with a reason, never silently. Every slice passes the two-pack run. Nothing deploys to the live machine until the owner's show-ready decision; rollback is plugging the old machine back in. Open: whether tests and previews share one naming layer. [CTX:443-460 via MD:251; C23:385-388 via MD:252; CTX:248-250 and MD:71; RM:160-166 and RM:442-460 via MD:65 and MD:122; PGS:357-364 via MD:194-196 and MD:256]

**What the planned capabilities need from it.**
- The test environment (capability 46): tests cannot touch the live machine's tracking files, the TV or its players; they skip loudly with a reason; a switch that stops test copies of the engine from starting the sound system is not built. [JC:184; MD:250-253]
- The seams for more kits (capability 42) and the preview engine (capability 20): the same per-engine naming layer as test runs, built once. Eight fixed temporary paths and two machine-wide kills exist today. [JC:185; MD:195-196, MD:256]
- The supervisor (capability 9): process cleanup that cannot hit the wrong process. [JC:186; MD:173]
- Screen baselines (capability 29) and the two-pack run: guards against changes the owner did not choose. [JC:187; MD:107, MD:71]
- Blue/green cutover (capability 44), the Block 1 deliverables (capability 45) and the Block 6 close (capability 51): frozen production and blue containment honored; nothing deploys until the owner says so. [JC:188; MD:65-66, MD:122-123, MD:129]
- The rig that ran the real stack was lost with the container; its recipe survives. [JC:189; MD:254]

**Where today's design falls short.** Primary flaws first, then the flaws that touch this job from another home. [JF:203]
- **C8** (primary). The engine names its helper files in fixed places and kills by pattern across the whole machine, and the tests adopt the real display and audio, so a test run killed the live show's video player on blue, and in today's tree the same run kills the live engine's video-signal watcher and overwrites its helper files.
- **C14** (primary). Names and shapes that join two places are kept by hand on each side and nothing checks that the sides agree, so a mismatch fails silently.
- **C15** (primary). The deployed game is several separately versioned checkouts, a built folder, hand-copied media and hand-run steps that nothing compares, so a rollback quietly runs a mixture.
- **C16** (primary). Hand-written fakes are never checked against the real classes, skips and silent passes count as green, and coverage is counted per file, so a green run does not show the real path works.

**In a standalone game.** The phone's pack-identity test passes on a file the deployed folder lacks, the hardware scanner's production boot path has no test, and no automatic test run covers either device's standalone path end to end; the one cross-mode proof compares tablet and engine scores only, and its group case skips on the real pack. [SP:147; SP-10 at SP:191; SP-23 at SP:204; SP:237]

**The pass's questions it answers.** 4 (Can anything other than the live engine touch the live show?), 5 (Does one question get one answer?). Question 4 is C8's. Question 5 is the nearest for C14. C15 and C16 have no question among the nine; the analysis flags both as gaps for the owner (AN:47, AN:49; CS:55-56, question 18).

**Test cases from the shows.** What to do, and what must happen.
1. Start a live engine and run the unit tests: the music player, the video-signal watchers, the sound system's watcher and the TV's browser all keep running, and the files that track them are unchanged. [AN:424 (A-75 / D-52)]
2. A test compares every fake with the real class it stands for and fails on a member the real class lacks or a different return shape. [AN:835 (A-51)]
3. Give the tests a layer that runs Reset System the way the show does (today the wiring between services is undone only under test): on it, after a reset the music panel shows the new track within a second, and a cue on video start fires exactly once. Both fail today on that layer. [AN:835 (X-04); AN:273 (B-01, B-03)]
4. Roll back the deployed game: every checkout moves, and a status check lists any that did not. [AN:786 (A-91)]

## 4. Proposed job changes, each as a question for the owner

The rule for this document: keep the draft jobs unless the mapping sheets give a strong reason to change one. Three wording changes are applied (A to C): in A each sheet asked for one of the two clauses; in B and C the flaws sheet asked for the wording and the capabilities sheet already files the same rules or need under that job. The owner can undo any of them with a word. Four more proposals are not applied (D to G). Nothing below decides a design.

**Question A. J1 gained two clauses (applied)** *(applied, please confirm)*

Both sheets asked for an addition to J1. The capabilities sheet proposed "and nothing in the engine may assume it" after "ALN is one pack", so that the rules the engine holds no opinion and toy pack proof, and the second game's capabilities, have a sentence to stand on (JC:278, proposal 8). The flaws sheet proposed "and every part of the kit runs the same version of the pack, and says which", because C12's main fault is parts running different versions of one game, which the draft sentence did not name (JF:234). Both are in J1's line in section 2. Question: keep both clauses?

**Question B. J7 widened to "who may do what" (applied)** *(applied, please confirm)*

The flaws sheet proposed widening J7 from "who gets what" to "who gets what and who may do what", because the operator-only floor, the unpinned certificate and the secrets rotation had no job (JF:227, proposal 3; JF:220). The capabilities sheet files the identity rule, the floor and the secrets rule under J7 as its primary rules (JC:203, JC:212, JC:215, JC:228) and reads the draft J7 as already holding who may do what, so it asked for no new words (JC:275). The title now reads "...and let each do only what their role allows". Question: agree?

**Question C. J8 names the standalone choice as declared (applied)** *(applied, please confirm)*

The flaws sheet proposed "with or without an engine, as a choice the game declares" (JF:229, proposal 4), and the capabilities sheet lists the same need under J8 without proposing words: something must say a game is standalone, where today it is a tap, a URL path or nothing (JC:171; SP:19). The words are decision 22's own (CS:36-40). With this clause the standalone finding N1 has a home under J8; whether N1 is a seventeenth flaw stays the owner's question 23 (CS:59). Question: agree?

**Question D. Split J3 into answering and remembering?** *(not applied, please choose)*

The flaws sheet recommends splitting J3: "answer every action" (C7, tests about replies) stays J3, and a new job takes "keep the night's history so it can be reviewed, reported and captured" with capture (capability 30), the bundle emitter (capability 32) and the Review stage (capability 34), a whole block of planned work (JF:223, proposal 1). The capabilities sheet saw the same two halves, noting that no planned capability concerns the answer to a scan and all five of J3's capabilities concern recording after the fact (JC:120, JC:249), but proposed no split. Kept as one job here, because only one sheet asked. The cost of splitting: no flaw would have the new job as primary. Question: one job or two?

**Question E. Split J8 into fitting a game to a venue, and running in any setup?** *(not applied, please choose)*

The capabilities sheet proposes splitting J8: keep J8 as the installer's work (profile, bindings, rider, needs against equipment, the kit network, the host file, the one preflight) and add J11, "run in any setup" (standalone games, other kits and packs, hardware parity, open-sourcing, the seams for second engines). Its reason: the installer is one of the engine's five users and has no job (MD:54), and seven capabilities cluster around that person (JC:271, proposal 1; JC:241). The flaws sheet keeps J8 whole. Kept whole here. Question: split, or rename J8 "Fit the game to the venue, whatever the setup"?

**Question F. J10 is overloaded: widen it, or split it?** *(not applied, please choose)*

Both sheets find J10 carrying more than its sentence says. The capabilities sheet would widen the sentence so that shipping a change to the live show belongs to it: "...and a new version reaches the show only when the owner says it is ready, with rollback as a physical swap", absorbing cutover (capability 44), Block 1 (capability 45) and the Block 6 close (capability 51) and the frozen-production and blue-containment rules (JC:272, proposal 2). The flaws sheet notes four primary flaws of four kinds (make tests safe, make tests real, check the joins, check what is installed) and offers an optional split into two jobs (JF:231, proposal 5). Kept as drafted here. Also for the owner: C15 and C16 are covered by none of the nine questions (AN:47, AN:49; question 18 at CS:55-56). Question: widen, split, or leave?

**Question G. Who owns the equipment's state on screens: J2 or J4?** *(not applied, please choose)*

The flaws sheet says neither J2 (the game's record) nor J4 (the engine knows whether equipment works) states that every panel shows the equipment's state truly, also after a reconnect; C2 and the equipment half of C6 sit in the gap, and it recommends adding "and shows it truly on every screen, also after a reconnect" to J4 (JF:225, proposal 2). The capabilities sheet puts service domains (capability 15) under J2 as primary and words J2 as "which part decides each fact and how it reaches each screen" (JC:38, JC:274). The two sheets differ, so nothing is applied. Question: does J2 carry every fact's route to the screen, or does J4 carry the equipment's?

**Kept as drafted, with a note.**

- **J5 kept, and explained.** Both sheets keep J5 although no capability and only two flaws have it as their main home. The capabilities sheet asks that it be stated as a table of every fact against every moment with no deliverable of its own, because that table is what finds bugs like a display row left red after a reset (JC:273); the flaws sheet rejects merging it into J2 because J5 is the moment a fact changes fate and J2 is copies agreeing (JF:240). J5's entry says so.
- **J2 and J9 kept apart, with the boundary written in.** J2 makes the screen right; J9 makes it say so when it cannot be right. Both sheets reached this wording (JC:274, proposal 4; JF:238). Each entry carries the sentence.
- **J6 and J10 overlap on purpose.** "Without disturbing a live show" (J6) and "testing never touches a live show" (J10) are met by one per-engine naming layer, named once under J10 (JC:276; JF:241). J6 points to it; C8 is primary under J10 because its worst finding is a test killing a live player.
- **Base rows before grading.** The capability list names what the roadmap still has to build and almost nothing of the engine's existing core (sessions, scan answers, scoring, cues, the clock, video, music, sound, lights). The capabilities sheet asks that rows for that core be added before the jobs are graded against the flaws (JC:277, proposal 7; source: root CLAUDE.md, "GM Scanner Admin Capabilities"). This document notes the gap in J3, J4 and J5 and adds no rows; that is a step for the orchestrator, not a question.

## 5. Coverage: every capability and every flaw, and the job it went to

Primary job is the one the capability exists for, or the job the flaw's strongest show-night finding is filed under; secondary jobs are the others it touches. "Loose" means the capability fits the job only because no better job exists (JC:20, JC:239-242). Both tables are copied from the mapping sheets (JC:22-75; JF:27-45). The flaw table is checked against section 3 by the script that built this file. Five capability rows (8, 16, 31, 38, 39) add a secondary job that the capabilities sheet's section 3 lists but its table omits; the jobs added are J5, J1, J2, J5 and J2.

### 5.1 The 52 capabilities

| Capability | Name | Primary job | Secondary jobs |
|---|---|---|---|
| 1 | The pack | J1 | J3 |
| 2 | The activation gate | J1 | J6, J10 |
| 3 | Pack channel and identity reporting | J1 | J2, J9 |
| 4 | Draft and publish pack store | J6 | J1 |
| 5 | Installation profiles | J8 (loose) | J4, J9 |
| 6 | One truth: collectPackNeeds and resolve() | J9 | J6, J8 |
| 7 | The preflight | J9 | J4, J5, J8 |
| 8 | Dormancy | J4 | J5, J8, J9 |
| 9 | The supervisor | J4 | J9, J10 |
| 10 | The host-config file | J8 | J4 |
| 11 | Self-heal | J4 | J2, J5, J9 |
| 12 | Credentials on every connection | J7 | J2 |
| 13 | Auth tiers, the floor, the observe token | J7 | J5 |
| 14 | Held items | J4 | J3, J5, J9 |
| 15 | Service domains and service:state | J2 | J4, J9 |
| 16 | Hot-apply | J6 | J1, J2, J5, J10 |
| 17 | The five Design workspace pages | J6 | J1, J8 |
| 18 | The design-iteration loop | J6 | J5 |
| 19 | Live verdict badges in the editor | J6 | J9, J8 |
| 20 | Rehearsing on a preview engine | J6 | J10, J8 |
| 21 | Simulation and preview profiles | J6 | J10, J8 |
| 22 | The Deploy stage | J8 (loose) | J6, J7 |
| 23 | Bindings page and profile-manager page | J8 (loose) | J4 |
| 24 | Hardware/roles editor, tech rider, capability catalog, reference kit | J8 (loose) | J1, J6 |
| 25 | Planning view | J8 (loose) | J6 |
| 26 | The GM scanner's four domains | J7 | J3, J4 |
| 27 | The GM scanner redesign | J7 | J1, J2, J5 |
| 28 | The truth sweep | J2 | J9, J10 |
| 29 | Screen baselines and screen-capture tests | J10 | J9 |
| 30 | Capture: roster, notes, accusation | J3 | J2, J5, J7 |
| 31 | Photo capture and the photo store | J3 | J2, J7 |
| 32 | The session-bundle emitter | J3 | J5 |
| 33 | Report pipeline migration to the bundle | J3 | none |
| 34 | The Review stage | J3 | J6, J7 |
| 35 | Players' phones | J7 | J2, J8 |
| 36 | Interaction primitives v1 | J1 | J7, J8 |
| 37 | Entity-field wire migration | J1 | J2, J3 |
| 38 | The second game's modules | J1 | J2, J5, J7 |
| 39 | Remote displays | J7 | J2, J4, J8 |
| 40 | Media bundle and asset channel | J1 | J4, J8 |
| 41 | Content tooling and the source adapter | J6 | J1 |
| 42 | Seams for more kits and packs | J8 | J1, J10 |
| 43 | Kit network, DNS and certificate | J8 (loose) | J7, J9 |
| 44 | Blue/green cutover | J10 (loose) | J5, J8 |
| 45 | Block 1 deliverables | J10 (loose) | J8, J9 |
| 46 | Test environment | J10 | J4, J5, J8 |
| 47 | Open-sourcing and the release block | J8 (loose) | J7, J10 |
| 48 | First-run state | J6 | J7 |
| 49 | Hardware-scanner parity | J8 | J7, J1 |
| 50 | Ledger retirements L7, L8, L12 | J1 | J8, J10 |
| 51 | Block 6 close | J10 (loose) | J6 |
| 52 | Preset-load differential gate | J6 | J10 |

Primary counts: J1 8, J2 2, J3 5, J4 4, J5 0, J6 10, J7 6, J8 10, J9 2, J10 5; total 52 (JC:83-93). J5 has no capability of its own, by design: it is a table every other job reads (section 4, kept notes).

### 5.2 The 16 design flaws and the proposed N1

| Flaw | Name (the card's title) | Primary job | Secondary jobs |
|---|---|---|---|
| C1 | Each tablet keeps its own list of claimed tokens | J2 | J5 |
| C2 | Service health and service state travel on separate paths | J4 | J9, J2 |
| C3 | Engine trusts its stale picture of outside programs | J4 | J9 |
| C4 | Nothing says what a game boundary clears or keeps | J5 | J2, J3, J8 |
| C5 | Boot and Reset System wire the engine differently | J5 | J4, J2 |
| C6 | Reconnect snapshot and live update are built apart | J2 | J5 |
| C7 | A reply never says which request, final or stored | J3 | J2, J5 |
| C8 | Engine and tests both assume they own the machine | J10 | J6, J8 |
| C9 | Tablets and phones decide facts the engine owns | J2 | J3, J8 |
| C10 | Screens show a normal value when nothing is known | J9 | J4, J8 |
| C11 | Several places answer the same question, each differently | J2 | J4, J3 |
| C12 | Pack edits reach each part of the kit differently | J1 | J6, J2 |
| C13 | The engine does not know who is connected | J7 | J3 |
| C14 | Names joining two places are kept by hand | J10 | J2, J1 |
| C15 | The deployed game is many parts nothing compares | J10 | J8, J1 |
| C16 | A green test run proves nothing about the show | J10 | none |
| N1 | Nobody declares that a game is standalone (proposed; the owner's question 23) | J8 | J1, J9, J3 |

Primary counts: J1 1, J2 4, J3 1, J4 2, J5 2, J6 0, J7 1, J8 1, J9 1, J10 4; total 17, counting the proposed N1 (JF:47). The standalone pass's 35 new findings are filed by job in JF:248: J1 7, J2 4, J3 4, J5 2, J8 8, J9 8, J10 2. J4, J6 and J7 have none: the main flaws of J4 and J7 (C2, C3, C13) produce no fault with no engine, and J6 has no standalone shortfall of its own (a standalone tablet runs no engine to rehearse against; the nearby SG-03 is filed under J1).

## 6. Completion check

- Every job has every field: meaning (at most 60 words), who relies on it, the long-term goal (at most 60 words, cited or marked open), the planned capabilities' needs, the flaws (primary first), the standalone line, the questions, and two to four tests. Checked by assertion in the generating script.
- Every capability 1 to 52 and every flaw C1 to C16 and N1 appears once in section 5; each flaw's primary job in section 5 is the job whose entry in section 3 lists it as primary, and each secondary job's entry lists it too. Checked by assertion.
- The JSON for the page (`docs/plans/architecture-pass/report/2026-10-31-engine-jobs.json`) is built from the same data and parses; its owner-facing fields carry no file names and no finding ids.
- Not checked: no test, build or server was run; the show-night clues and tests are as the analysis, the cards and the standalone pass state them, with the consistency check's corrections where JF applied them (JF:8).
- **Files written:** this document and the JSON named above.

## 7. Corrections from the check

Applied 2026-11-01 from `docs/plans/architecture-pass/2026-10-31-engine-jobs-check.md` (CK; a citation `CK:N` is line N). Each line names the field changed in this document and, where the page data mirrors it, in the JSON. Nothing else was touched.

1. J1 goal: "names its media by hash" is now "names media by fingerprint" (CK:18; also JSON `goal`).
2. J1 needs, media bundle bullet: "by hash" is now "by a fingerprint of their contents" (CK:19; also JSON `needs[2]`).
3. J1 C15: the sentence now says media is hand-copied onto the show machine with no check that every named file is there; the hardware scanner's asset sync is no longer implied to be hand copy (CK:22; also JSON).
4. J1 test 1: "hash equals the one in the engine's own list" is now "fingerprint matches the one in the engine's own list of pack files" (CK:26; also JSON).
5. J1 test 4: the standalone mid-game publish test, not from the analysis's proving tests, is replaced by the analysis's D-05 test, the phone's token file against the engine's own pack (CK:29; also JSON).
6. J2 C1: scope split, every connected tablet after a delete, only a tablet offline during a Reset All Scores (CK:38; also JSON).
7. J2 C5: mechanism and scope, a later Reset All Scores sends every tablet and the TV the old list and brings cleared evidence back (CK:44; also JSON).
8. J2 C14: "a score field the facade does not have" is now plain words, a place the tablet never fills, with the scoreboard screen right (CK:47; also JSON).
9. J3 C9: the refused-scan-recorded-nowhere sentence, which belonged to the owner's question 19, is replaced by the tablet's early verdict and the standalone paused-game scan (CK:64; also JSON).
10. J3 C13: the cause is now the route's default when a device sends no type, not the device's own word (CK:66; also JSON).
11. J4 needs, supervisor bullet: "the kiosk" is now "the TV's browser" (CK:81; also JSON `needs[0]`).
12. J4 needs, service domains bullet: "no second private flag beside the health registry" is now plain words (CK:81; also JSON `needs[4]`).
13. J4 C10: the sentence now names the failed profile load making installed services read as not installed (CK:85; also JSON).
14. J5 needs, first bullet: "eleven" is now "thirteen", naming dormancy (capability 8) and the second game's modules (capability 38) as the two the capabilities sheet's section 3 adds (CK:100; also JSON `needs[0]`).
15. J5 standalone line: "no screen can restart" is now "no screen can start a named or second game"; only the hardware scanner's queue lines reach a later networked game, and those without a real time are refused (CK:106; also JSON).
16. J6 flaws citation: "MD rows C16, C18, C20" is now "the direction map's rows for capabilities 16, 18 and 20, MD:94, MD:96, MD:98" (CK:120).
17. J6 C8: the kill is the finding, limited to some helpers; writing into records and issuing passes is the design-tool plan's warning (CK:121; also JSON).
18. J6 test 2: "kiosk and sound-server listener" is now "the TV's browser and the sound system's watcher" (CK:126; also JSON).
19. J6 test 3: the analysis's caveat is restored, today a swap needs a restart so the test swaps across one and keeps the game (CK:127; also JSON).
20. J7 test 3: "connect payload ... exposed-evidence entries and totals" is now plain words (CK:141; also JSON).
21. J8 test 2: the cross-mode scoring test, not from the analysis and not failing today, is replaced by the analysis's new-machine naming test, B-98 (CK:156; also JSON).
22. J8 test 3: the citation now states that the test is the standalone pass's, not an analysis proving test, and that N1 has none there (CK:157).
23. J9 C2: the sentence now describes state and health on different routes, not C10's missing age (CK:168; also JSON).
24. J10 goal: "One naming layer serves tests and preview engines alike" is now marked open, since it is the direction map's inference (CK:183; also JSON `goal`).
25. J10 needs, test environment bullet: "an audio-init off switch for harness children" is now plain words (CK:184; also JSON `needs[0]`).
26. J10 C8: the kill of the live video player is placed on blue; today's tree kills the video-signal watcher and overwrites helper files (CK:185; also JSON).
27. J10 standalone line: "no CI job runs" is now "no automatic test run covers" (CK:189; also JSON).
28. J10 test 1: "unit suite ... signal monitors, the sound-server listener and the kiosk ... process file" is now plain words (CK:191; also JSON).
29. J10 test 3: the expected result is no longer inverted; the test states what must happen after a reset on a production-like layer and that both fail today (CK:193; also JSON).
30. Section 4 rule: "both mapping sheets" is now "the mapping sheets", with how A, B and C each met the bar (CK:204).
31. Question B: "Both sheets put permissions here" is replaced; the capabilities sheet files the rules under J7 and asked for no new words (CK:206).
32. Question C: the paragraph no longer both says question 23 is unchanged and asks whether the clause settles it; N1's status stays question 23 (CK:207).
33. Kept note "J5 kept": the display-row reason is now the capabilities sheet's and the fate-versus-copies reason the flaws sheet's (CK:212).
34. Section 5 intro: only the flaw table is script-checked against section 3; the five capability rows that gain a secondary job are named (CK:216).
35. Capability row 8, Dormancy: secondary jobs gain J5 (CK:258).
36. Capability row 16, Hot-apply: secondary jobs gain J1 (CK:266).
37. Capability row 31, Photo capture: secondary jobs gain J2 (CK:281).
38. Capability row 38, The second game's modules: secondary jobs gain J5 (CK:288).
39. Capability row 39, Remote displays: secondary jobs gain J2 (CK:289).
40. Section 5.2 heading: "The 17 design flaws" is now "The 16 design flaws and the proposed N1" (CK:218).
41. Flaw row C3 name: the card's title, "Engine trusts its stale picture of outside programs" (CK:310).
42. Flaw row C6 name: the card's title, "Reconnect snapshot and live update are built apart" (CK:313).
43. Flaw row N1 name: marked "(proposed; the owner's question 23)" (CK:324).
44. Section 5.2 counts: "total 17" is now "total 17, counting the proposed N1" (CK:218).
45. J2 C1 and J5 C1: "offline" and "disconnected during a reset" are now "lost its connection during a Reset All Scores, and did not reload", as analysis §6 C1-3 narrowed them (consistency check K1; also JSON).
46. JSON `jobChanges[2]`: the missing declaration has a home under J8; whether it is a seventeenth flaw stays question 23 (as item 32; consistency check X5).
47. J2 standalone line: the claim list beside the transactions is no longer named, the analysis filing it under C11 (check 1, C1-24; consistency check X3; also JSON).
48. J4 test 2: "(A-72 / A-73)" is now "(A-72, A-73)", two findings, not one (consistency check K6).
49. J6 C12: the engine scores by the change only after a restart, while a reloaded TV already shows it (consistency check causes 9 to 16, K10; also JSON).
50. Section 5.2: why J4, J6 and J7 have no standalone finding, with J6's own reason (consistency check X4).
51. Sources line: JF holds "the sixteen flaws and the proposed N1", not "the 17 flaws" (consistency check X8).

Not changed, by the check's own verdicts: the JSON's `jobChanges` (apart from `[2]`, item 46) and `purpose` strings (CK:240-241), every other job field, and section 6.
