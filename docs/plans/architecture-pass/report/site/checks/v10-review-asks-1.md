# Version 10 review, lens 1: "Where the qualities pull against each other"

Written 2026-11-09 for the agent running the pass. One of four independent reviews the owner asked for before answering.

## Scope

I reviewed the first group on the Decisions page: its introduction (nine conflicts called answered, and the closing count) and questions A to F. I read the owner's comments of 2026-11-02, the decision record, the 43 quality targets, the 28 extension cases, the six decisions ahead on Design, the roadmap and the glossary. I checked every "today" fact in A to F against the code under `/home/user/ALN-Ecosystem`. I did not review questions G to J, the readings, the calls or the other pages, except where A to F depend on them. Source fields are named as `groups[0]...` in `report/site/v9/decisions.json`. Text I propose for the site follows the owner's rules. Link tokens such as `[[qt:QT42]]` are in the source's own form.

## Verdict

The owner should not answer this group as it stands. Three questions rest on a wrong or missing fact. D describes today's pack as tables only, when the pack already holds checked when-then rules for the room. B says the TV freezes when the show machine dies, when the TV goes dark. F describes a trial copy that drives the real room, which the ratified design forbids. Two questions hide a choice that changes the owner's answer. A's recommended answer plus B's first option gives a rest of the night with no points on any tablet, and nothing says so. C's first option breaks the settled rollback, and its second option puts old packs in a window after another line says old packs always run. B also asks the owner to choose between mechanisms, where the four tests say the owner chooses what the product must do. Six of the introduction's nine answers hold. Two are written in no requirement and one is really question F. E is the closest to ready.

Counts: 34 findings, 8 high, 17 medium, 9 low.

## Findings: the introduction

### I-1 (medium). The nine lines give the answer and leave out the conflict

Where: Decisions, "Where the qualities pull against each other", `groups[0].intro[1]` to `intro[9]`. Example: "Testable without the live show against easy to extend. Every added program or device kind comes with a software stand-in and its tests".

What is wrong: each line names two qualities and then states the resolution. It never says why the two conflict or what the losing side gives up. It also never says whether the answer rests on the owner's decision or on a target the agent proposed. The opening sentence admits the mix ("some rest on your decisions, some on targets still marked proposed or partly settled") but no line says which is which.

Why: the owner's words were "I would need to understand the specific conflicts and what they mean functionally". A reader of the line above cannot tell that the conflict is "an extension is faster to add with no stand-in, and then the show cannot be tested without that hardware".

Change: rewrite each of the nine in three short parts. Proposed text for `intro[1]` to `intro[9]`:

1. "A fast change against buttons that do what they say. The conflict: the designer wants a changed value to play at once; the GM needs a running game to stay the game it started as. The answer: a change reaches a game only between games, or the engine refuses and says why. It rests on your ratification of the design tool's pages ([[qt:QT9]], [[ex:EX2]])."
2. "A fast change against a safe release. The conflict: packs change often and the engine changes rarely, so a pack can ask for something this engine cannot do. The answer: packs publish at any time; the engine changes only between events; a pack that needs an ability this engine lacks is refused at publish with the ability named; abilities are only ever added. It rests on the roadmap's rulings ([[qt:QT42]], [[qt:QT10]], [[qt:QT21]]). One part is still open: what happens to an old pack when the pack's format changes. It is in the question “Release day: what must update together, and how long older devices work”."
3. "Standalone games against code that is easy to understand. The conflict: a standalone tablet decides the game with no engine, so the rules run in a second place. The answer: every game has one decider, the engine or the tablet, never both. It rests on your decision “[[dec:standalone-games-declared-never-mixed]]”. Whether the two run one body of rules or two kept equal by tests is for the design rounds."
4. "Access checks against staying up. The conflict: every request is checked against a pass; a restart or a swapped machine could make every pass void and send the GMs back to the login screen mid-show. The answer the agent proposes: a pass holds through a reconnect, a restart of the engine and a swap of the show machine, and nobody logs in again during a show. No requirement says this yet; the agent adds it to “[[qt:QT31]]” as proposed, for your review."
5. "Privacy against telling the night afterwards. The conflict: the director needs the night's record; the players' data should not leave the kit. The answer: game data stays on the kit, you move the record, and the director's console stays a separate program. It rests on your decision “[[dec:the-night-s-record-and-the-after-game-article]]” ([[qt:QT30]])."
6. "No technical help against access checks. The conflict: checks need passwords and passes; a GM with no technician must not manage them. The answer the agent proposes: devices get their passes with no login; a GM logs in once before the show; staff who log in hold the game's controls. The staff-only limit rests on your ruling of 2026-07-09; the single login is proposed ([[qt:QT31]])."
7. "The size of a show against more than one copy on one machine. The answer so far covers size only: a few dozen devices is the setting the panel gets, and phones are measured before the first is admitted ([[qt:QT34]]). Whether a second copy of the engine may run on the show machine during a show is open. It is the question “Where the trial copy runs while a show runs”."
8. "Testing with no venue against easy extension. The conflict: an extension is quicker to add with no stand-in, and then the show cannot be tested without that equipment. The answer: every added program or device kind comes with a software stand-in and its tests. It rests on rulings of 2026-09-04 ([[ex:EX15]], [[qt:QT26]])."
9. "True screens against standalone games. The conflict: with no engine, every service the engine runs is missing, and a screen could show that as a fault. The answer: a standalone game says standalone, and each such service reads not installed tonight, grey. It rests on your decision “[[dec:standalone-games-declared-never-mixed]]” ([[qt:QT37]])."

### I-2 (medium). Two "answered" conflicts are answered nowhere in the requirements

Where: `intro[4]` "Passes survive a reconnect, a restart and a machine swap, and nobody logs in again mid-show" and `intro[6]` "The kit holds its own passes, the GM logs in once a night".

What is wrong: these sentences appear only in this introduction. The cited targets do not contain them. "Every request is checked against its pass" says who is refused. "A tablet reconnects to the same facts" says the tablet is back under its station name in five seconds. "Replugging the old machine undoes a release" says devices carry on "without noticing the machine changed", which implies it and does not state it. A search of the published Requirements page for "logs in once", "log in again" and "passes survive" finds nothing.

Why it matters: the introduction says "the panel designs to them as they stand", and the panel reads the requirements, not this paragraph. Question B also lists the same point as open under its decisions ahead: "whether a pass issued by one machine holds on another". The page says both "answered" and "open".

Change: add one sentence to the situation of QT31 in `requirements/2026-11-01-quality-targets.json`, and add "that a pass holds through a restart and a machine swap is proposed" to its status. Proposed sentence: "A pass issued before a reconnect, a restart of the engine or a swap of the show machine still holds afterwards, and nobody logs in again during a show." Then use the I-1 wording for `intro[4]` and `intro[6]`.

### I-3 (medium). Conflict 7 is not answered by what it cites, and it is question F

Where: `intro[7]` "Running well at the size of a show against more than one copy, kit or pack. A few dozen devices is the setting the panel gets ... and phones are measured before the first is admitted".

What is wrong: the cited answers are about kit size. The conflict between show size and a second copy on one small machine is exactly what F asks ("whether the show machine must carry two running copies of the engine during a show"). The introduction calls it answered and F calls it open.

Change: the I-1 wording for item 7.

### I-4 (medium). Five real conflicts are in neither the introduction nor the questions

1. Staying up against code that is easy to understand and change. This is the largest long-term cost under A and B, and the owner's goal names it ("intuitive and easy to maintain"). A names only "every screen telling the truth". B names "standalone and offline" and truth. The target "Every fact is decided in one place" is only proposed, and A and B decide how far it bends. Change: add "and against easy to understand and change" to `questions[0].decides` and `questions[1].decides`, with one sentence: "Each fallback is a second path through the code that must be kept working for years."
2. Safe rollback against everything updating together. See C-1.
3. Easy to extend against access checks and staying up. An add-on is code on the show machine. What it may see, and what its crash does to the show, is said nowhere in E. See E-2.
4. Testing against the size of a show. The proposed target "A test run cannot touch the live show" has someone run the whole test set on the show machine during a show. F's answer decides that case too, and F never mentions it. See F-3.
5. Access checks against standalone and offline. A standalone tablet, or a tablet cut off under A, decides with no engine to check a pass. Whoever holds the tablet holds the game's controls. This belongs with the standalone group, outside my lens; I name it so the reviewer of that group or the agent can place it.

### I-5 (low). The closing count is hard to follow

Where: `intro[10]` "Seven conflicts stay open, and six questions below answer them: two conflicts meet in ... one ... gives two questions ... and one ... sits with the standalone games below."

What is wrong: the seventh conflict is answered by a question outside this group, so "six questions below answer them" is not true as written. That conflict also sets a standing rule against a quality, after the paragraph said the conflicts are between the twelve qualities.

Change: "Six questions follow. Each names the qualities in conflict, says what happens at a show under each answer, and names the decision ahead that waits on it. One more conflict, between the rule that phones and hardware scanners stay equal in ability and standalone games, is in the standalone group below."

## Findings: A. A GM tablet cut off from the engine

Verdict on A: the owner's question by the four tests. The "today" facts are true. In networked mode the tablet computes points itself (`ALNScanner/src/app/domains/gameOps.js:320`), queues the scan (`:338`) and shows the result at once (`:376`, "Transaction Complete!" at `src/ui/uiManager.js:466`); a later refusal repaints it (`src/app/app.js:228-251`). The three options are distinct. The recommendation's argument is not sound as written, and the question misses its link to B.

### A-1 (high). The recommended answer plus B's first option gives a night with no points, and nothing says so

Where: `questions[0].decides` "The same answer holds for the first minutes of a longer failure"; B's first option, `questions[1].options[0].means`, "Each GM tablet keeps taking scans, as kept or as provisional under the question above".

What is wrong: if the owner takes the recommendation here (kept, no points shown) and "carry on from the tablets" in B, then from the moment the show machine dies no tablet shows a result or a score until the game ends. The TV is dark too. Teams sell tokens for an hour and learn nothing. Someone must still compute the final scores, so the rules must run on a tablet anyway.

Why: the owner's words are "keep a game running with as minimal impact on the player experience as possible". A game with no visible result for an hour is running in name only. The owner cannot see this from either question.

Change: limit A to the short gap and say what changes when the gap does not end. Replace the last sentence of `questions[0].decides` with: "This question is about a short gap, a minute or a few. If the engine does not come back, the GMs choose a fallback (the question “The show machine fails mid-game”), and from then on a tablet that carries the game must show results and scores, so it must run the rules itself." Add to `questions[1].options[0].means`: "From that moment the tablets show results and scores from their own copy of the rules, whatever you answer for a short gap."

### A-2 (medium). The cost of the third option is overstated, and the recommendation leans on the agent's own proposal

Where: `questions[0].options[2].cost` "The game's rules must run equally on the engine and the tablet ... The most to keep equal across two places, for years"; `questions[0].recommendation` "which “A refused scan never reads as complete” proposes for a networked game and your words on fallbacks support".

What is wrong: the settled target "A standalone game is normal, never a fault" already requires that "the tablet decides teams, claims, scores, evidence ... under the same rules as the engine, and a test proves the two equal". The introduction says the same in its third line. So the engine pays for rules on the tablet whatever A's answer is. The cost that belongs to the third option alone is smaller: a "provisional" mark on what the tablet shows, and a screen for a result the engine overturns. The recommendation then cites two supports that do not hold. The networked half of "A refused scan never reads as complete" is the agent's own proposal. The owner's words on fallbacks say the GMs must know them; they do not choose between a label and a result.

Why it matters: with the cost corrected, the choice is a pure values call. May a GM tell a team its points before the engine has confirmed them, knowing a few will be taken back? The owner's words lean neither way.

Change: `options[2].cost`: "The tablet already runs the rules for standalone games. Added here: every result the tablet shows while cut off carries “not yet confirmed”, and a screen tells the GM when the engine overturns one. The GM may have to take a result back from a team." `recommendation`: "Keep and label, for a short gap. A team waits a minute for its result, and no GM ever takes one back. The agent recommends it because a result taken back costs a GM more trust than a minute's wait. This is a call about your show, so say if you would rather your GMs give the result at once and correct the rare wrong one. Either way, once the GMs choose to carry on with no engine, the tablets show results and scores."

### A-3 (medium). "Come to the same thing" is wrong for a production with one tablet

Where: `questions[0].evidence[4]` "A production with one GM tablet can never have a conflict, so for them a kept scan and a provisional verdict come to the same thing."

What is wrong: the outcome is the same; what the GM can say is not. With one tablet a provisional result is never overturned by another tablet, so the third option gives that production its results at once at no risk, and the second makes it wait for nothing.

Change: "A production with one GM tablet can never have a conflict. For them a result shown at once is never taken back, so keeping the scan with no result makes their teams wait with nothing gained."

### A-4 (medium). The conflict rule is asked as three exclusive choices, and it is a game's rule

Where: `questions[0].evidence[5]` and the end of `recommendation`: "the earlier by the tablets' clocks, the first to reach the engine, or the GM decides from a red row ... the design cannot make it for you."

What is wrong, in four parts. Today's rule is not stated: the first claim the engine accepts wins, and the refusal names the team that holds the token (`backend/src/gameRules/duplicatePolicy.js:4-8`). The three choices are not exclusive: the GM can already delete a sale and enter one by hand, so any automatic rule can be overruled by the GM. Under "keep and label" nobody was told a result, so the rule only decides who gets the token; no team has anything taken back, and the choice weighs less than the page suggests. And who wins a tie is a rule of the game. The pack already declares its duplicate rule, and the standing rule says the engine holds no opinion about game design. Asking the owner for one rule for the engine sets ALN's fairness for every game.

Change: give a recommendation and shrink the ask. Proposed `evidence[5]`: "When two tablets sold one token while apart, the engine needs a rule. Today the first sale to reach the engine wins, and the other tablet is told which team holds the token. The agent proposes to keep that as the default, to show the losing sale as a red row, and to let the GM give the token to the other team from that row. The engine also keeps the time each tablet stamped, so a game can choose “the earlier sale wins” in its pack later. From you: whether that default suits ALN." Drop "the design cannot make it for you".

### A-5 (low). The page never says how one token reaches two tables during a gap

Where: `evidence[1]` "If another tablet sold the same token during that minute".

What is wrong: a token is one physical object. The owner knows whether a GM keeps a sold token or hands it back. If GMs keep sold tokens, a conflict needs a second copy of a token and is close to impossible, which makes results shown at once almost always right. I could not settle this from the repository.

Change: ask it in one clause, or state it once the owner says: "A conflict needs the same token to reach two tables during the gap. Say if your GMs keep a token once it is sold."

## Findings: B. The show machine fails mid-game

Verdict on B: the need is the owner's and "No technical failure stops a game" names it. As asked, B fails the first test in part, states one fact wrongly, leaves out a fact about ALN's kit that changes the costs, and asks four things in "one line". It needs a rewrite before the owner answers.

### B-1 (high). B asks the owner to choose mechanisms

Where: `questions[1].options[0..3]` and `recommendation`: "which of the first three fallbacks the engine must offer (one or more) ... What the players may lose follows from the fallback you pick".

What is wrong: the options are designs: tablets that merge afterwards, a spare with "a numbered log of facts" copied live, a cold spare from "a stick", a tablet with "a small engine". The page's own first test says the owner decides "what the product must do or allow ... never about how to build it". The last sentence has it backwards. What the players may lose is the owner's decision, and the fallback follows from it. The owner asked for a top-down pass; this is the one question in the group that asks from the bottom.

Change: ask for outcomes and let the panel propose mechanisms. Replace the four options with three levels, and keep "pause" as the excluded line.

- Label: "The game finishes on the tablets." Means: "The GMs keep selling and exposing tokens, the tablets show results and scores, and the GMs end the game from a tablet. The night's record is put together from the tablets and the player scanners afterwards. Video, music, lights and the TV are gone for the rest of the night." Cost: "Each tablet holds enough of the game to finish it, and the records of several tablets are joined afterwards. No extra equipment. The GMs rehearse it."
- Label: "The room comes back after a GM starts a spare." Means: "As the first, and the kit carries a second show machine. A GM powers it on, it takes over from the last saved copy of the game, the tablets send what they kept, and video, music, lights and the TV return within a few minutes." Cost: "A second machine in the kit, a saved copy of the game every few seconds, and one more thing to rehearse."
- Label: "The room comes back by itself." Means: "As the first, and a second show machine runs all night with a live copy of the game. It takes over within about a minute with no action by a GM." Cost: "A second machine running at every show, a live copy of every change, and the most to build and keep working."

Proposed `recommendation` under "What we need from you": "Three answers. Which is the most the engine must be able to offer: the first, the second or the third. Whether the engine may require a second show machine in every kit, or a spare must stay each production's choice. And which you want for ALN." The panel's state lens then designs to the level, and the choice between a live copy and a saved copy stays a design matter inside it.

### B-2 (high). The TV does not freeze, and the TV question does not belong here

Where: `evidence[1]` "The TV freezes on the scoreboard"; `evidence[5]` and `recommendation` "whether the TV may keep counting while the engine is silent (yes or no)".

What is wrong: the main TV is driven by the show machine's own HDMI output. The site's panel setting says so ("one Raspberry Pi 5 that drives the TV over HDMI") and so does the code (`backend/src/services/displayControlService.js:5-12`). When the power supply dies the TV has no signal. Only the second screen, which runs on its own small computer, keeps its last page; today it marks itself offline and its clock keeps counting from the browser (`backend/public/scoreboard.html:996`, `:1608-1611`). So in B's own scene the question "may the TV keep counting" has nothing to count on. The question is real for a short silence with the machine alive, and for the second screen. That case is the target "Screens say when the engine goes silent", which already proposes that the clock stops.

Change: `evidence[1]`: "The TV goes dark, because the show machine drives it. The second scoreboard screen keeps its last page, says offline, and its clock keeps counting by itself." Take the TV question out of B's ask. Put it where the target is reviewed, or as one line in A: "While the engine is silent for a short time, the target “[[qt:QT5]]” proposes that a public clock stops and shows as unconfirmed. Today the second screen's clock keeps counting. Say if you want a public clock to keep counting through a short silence."

### B-3 (medium). ALN's kit already has a second show machine, and B never says so

Where: `options[1].cost` "The most to build and to own (a second machine in every kit)"; `evidence[4]` "A production with no spare machine."

What is wrong: the ratified swap method leaves the owner with two machines. The old one "stays frozen for at least the first few events, then is wiped and becomes the standing test device" (`docs/plans/ROADMAP.md:461-475`). The kit's router gives the show machine a reserved address, so a second machine can take its place by replugging (`CONTEXT.md:486-499`). For ALN a spare costs no new purchase; it costs keeping the second machine current and bringing it.

Change: add to `evidence[4]`: "For you. After the swap to the new engine you own two show machines: the new one and the old one, which the roadmap makes the standing test machine. A spare for ALN means keeping the second one ready and bringing it, with nothing new to buy."

### B-4 (medium). The options overlap, and one capability is asked in three questions

Where: `options[1].means` "or a tablet running an engine of its own"; `options[2].means` "A second machine or a tablet starts the engine"; `options[3].means` "One GM tablet becomes the decider ... in effect a small engine on the tablet".

What is wrong: "a tablet runs the engine" sits inside three of the four options. It is also the fourth shape in question G and the third ask in question I. The owner would answer the same capability three times and could answer it three ways. The fourth option's yes or no is about a label, a declaration that changes once, and the page never says what the GM or the players see differently from the first option. Tablets carrying on is also the base under every option, since it covers the minutes before any spare takes over and every production with no spare; "one or more" hides that.

Change: with B-1's levels, the first level is stated as the base of the other two. Ask "may a GM's own device act as the engine for other devices" once, in question G, and have B and I point to it. Drop the fourth option, and move its one real point to `evidence[0]`: "When the show machine is gone, no device is on an engine, so carrying on does not mix networked and standalone devices. Whether the screens then say “standalone” or “engine down” is for the design rounds."

### B-5 (medium). The kit's network failing for the night is in neither A nor B

Where: `questions[1].title` and `decides`.

What is wrong: the kit carries its own router (`CONTEXT.md:486`). If the router fails, the show machine keeps the TV, the music and the clock running, and every tablet and scanner is cut off for the night. A covers a short gap. B covers a dead machine. A spare machine does nothing for a dead router. The owner's words cover it: "a connection was lost or a device goes down".

Change: add to `decides`: "The same question holds when the kit's network fails for the night and the show machine keeps running: the room carries on and every tablet and scanner is cut off." Add one sentence to B-1's first level: "It also covers a failed network."

### B-6 (low). "In one line" asks four things

Where: `recommendation` "From you, in one line: which ...; whether ...; and whether ... add to it only if ...".

Change: B-1's three numbered answers.

## Findings: C. Release day

Verdict on C: the owner's question. Its explanation answers the owner's request to know what the question "means in practice" and its long-term effect; the two "long term" items and the item on the protocol and the build are the best explanation in the group. Every "today" fact I checked is true: the engine records a tablet's version, uses it for the station's label and only logs a pack mismatch (`backend/src/websocket/socketServer.js:126-145`, `gmAuth.js:69`); the pack's format must match exactly (`backend/src/services/packService.js:45`, `:725-763`); the tablet applies only that check (`ALNScanner/src/core/packLoader.js:36`); the scanner's board has no room for an update over the air (`arduino-cyd-player-scanner/CLAUDE.md:276`). The recommendation is sound. Two gaps would mislead the owner's answer.

### C-1 (high). "Everything updates together" breaks the settled rollback

Where: `options[0].means` "the engine refuses any device at another version ... hardware scanners must be flashed before the show".

What is wrong: the settled target "Replugging the old machine undoes a release" says that when the new machine fails on a show night the owner replugs the old one and "every tablet, scanner and screen carries on without noticing the machine changed". By then every hardware scanner was flashed for the new release. Under the first option the old engine refuses all of them, on a show night, with a cable and a computer as the only cure. The first option and the settled rollback cannot both hold. The same fact shapes the window: it must run both ways, an older scanner on a newer engine and a newer scanner on the older engine after a rollback. The page offers only "one or two engine versions back".

Why it matters: the owner leans to the first option ("Generally speaking, yes") and nothing on the page says the lean costs them the rollback they ratified.

Change: add to `options[0].cost`: "It also ends rollback by replugging. After a rollback the scanners carry the new release, and the old engine refuses them." Add to `options[1].means`: "The window runs both ways: a scanner one release older than the engine works, and after a rollback a scanner one release newer works." Add to `recommendation`: "The rollback you ratified needs this: a scanner flashed for the new release must still work when the old machine is plugged back in."

### C-2 (high). The page says old packs always run, and its recommended option gives packs a window

Where: `evidence[7]` "Packs already have their rule and it does not change here ... so an old pack runs on a new engine"; `evidence[4]` "The engine refuses a pack whose format version does not match exactly"; `options[1].means` "Cable-updated devices and packs work for a stated window (one or two engine versions back)".

What is wrong: three statements conflict. Abilities are only ever added, so an old pack runs for good as far as abilities go. Today's exact check on the pack's format means an old pack is refused the day the format changes. And the recommended option gives packs a window of one or two versions. An owner who takes the recommendation and says "one version" sets a rule under which a game they built two releases ago stops loading. The settled case "A different installed game each night" needs a library of games that keep working.

Change: take packs out of the window and state their rule. `options[1].means`: "Cable-updated devices work inside a stated window, and the GM's tablet shows which are behind." New sentence in `evidence[7]`, replacing "Packs already have their rule and it does not change here": "Packs get their own rule, which the agent proposes: an old pack always opens on a newer engine. When the pack's format changes, the design tool upgrades the pack and says so. Today the engine refuses a pack whose format is not exactly its own, so this is new work." List it under the agent's calls so the owner can overrule it.

### C-3 (medium). The window is asked in units the owner cannot weigh

Where: `recommendation` "how long the window is (one or two engine versions back), and whether a device outside it is refused or only warned about".

What is wrong: the page never says how often the engine is released. One version back is a month or a year depending on that. "Only warned" is also not explained: outside the window nothing tests that device against that engine, so a warning means "it runs unchecked".

Change: "From you: whether a hardware scanner that missed the last update must still work at tonight's show (the agent recommends yes); for how long a scanner may go without its cable update before the engine refuses it, in months or in shows; and after that, whether the engine refuses it or lets it play with a warning. With a warning the scanner plays unchecked: no test covers that pairing, and a wrong scan is possible."

### C-4 (medium). The first option's show-night cost is understated

Where: `options[0].cost` "show-night work at every release for every cable-updated device"; `evidence[7]` "unless someone has a cable and a laptop".

What is wrong: updating a scanner today takes a computer with the build tools installed and commands typed in a terminal (`arduino-cyd-player-scanner/CLAUDE.md`, "Upload and Monitor"). That is technical help, which the quality "Operating it without technical help" exists to remove. C's own first line names that quality and the options never spell out the conflict.

Change: add to `options[0].cost`: "Today an update takes a computer with the build tools and typed commands, so every release needs a technical person with each scanner in hand before the next show."

### C-5 (low). Standalone games are missing

What is wrong: in a standalone game no engine exists to refuse or warn. Each device holds its own app and its own copy of the pack.

Change: one sentence in `evidence[5]`: "In a standalone game no engine checks versions, so each device must check the pack it holds and say so on its own screen."

### C-6 (low). "A copy placed in its public folder"

Where: `evidence[3]`. The engine serves the phones' page through a link to the page's own folder (`backend/public/player-scanner` links to `aln-memory-scanner`), with no copy. Change: "the engine serves the phones' page too, straight from the page's own folder".

## Findings: D. What a game's maker may build inside the pack

Verdict on D: the owner's question, and the owner asked for it to be reframed. As written it misstates today's engine, hides the one choice only the owner can make, and ends in an ask that question H already answers. It needs the largest rewrite in the group.

### D-1 (high). Today's pack already holds checked when-then rules

Where: `decides` "Values in tables, as today: modes by their flags, scoring tables, groups, cues on a clock"; `options[0].means` "The engine stays as today in kind"; `options[1].cost` "A rule format inside the pack ...; a check at publish that refuses rules the engine or the venue cannot run; a runner in the engine ...; a listing on the GM's tablet"; `evidence[1]` "the settled case “The pack says what a scan causes”, due with players' phones".

What is wrong: the pack's cue file is a declared rule format today. A standing cue names a trigger out of sixteen events, among them a player's scan, an accepted sale, a completed group, a phase change and a video starting or ending (`backend/src/gameRules/cueValidation.js:42-59`). It carries conditions with seven comparisons (`:61`). It names responses out of twenty-four actions: sounds, lighting looks by role, video, music, the TV's picture and audio routing (`:91-116`). The check at activation and in the design tool refuses a rule it cannot run (same file, header). The GM's tablet lists standing cues with an off switch. ALN's own pack ships two such rules: when a video is loading, unless it is one named video, play a sound and light the look for video (`ALN-TokenData/cues.json`, first two cues).

Two consequences. Everything listed as the cost of the second option exists already. And the owner's lighting example can be written today in a networked game: one standing cue triggered by a player's scan, with a condition on which tokens, and the response "light this look" (`cueValidation.js:50`, `:94`; `backend/src/services/cue/standingEvaluator.js:32`). It does not wait for the players' phones block.

Why it matters: the owner reads that their example needs a later block and that rules are new. The choice the page offers, tables as today or rules as a new thing, is not the real choice.

Change: rewrite `decides` to open: "Today the pack already holds when-then rules for the room. A rule names something the engine sees (a player's scan, a sale, a completed group, a new phase, a mark on the clock, a video starting or ending), adds conditions, and names what the room does (a sound, a lighting look, a video, the music, the TV's picture). The engine checks each rule when the pack is published and the GM's tablet lists each one with an off switch. Your example, players changing the lighting by scanning tokens, can be written this way today in a networked game. What is open is how far these rules may grow." Correct `evidence[1]`, and the "when" lines of the extension cases "The pack says what a scan causes" and "Players change the room's lighting by scanning tokens" in `requirements/2026-11-01-extension-cases.json`, which both say "later ... until then, one standing cue per token". One standing cue can name a list of tokens.

### D-2 (high). The choice only the owner can make is hidden in a list of five words

Where: `options[1].means` "responses the engine knows (play, light, score, show, hold)".

What is wrong: "score" in that list lets a designer's rule change the game's facts: award or remove points, claim or free a token, expose evidence, move the phase. Today's code forbids exactly that, on purpose. Pack rules may fire room effects only; the comment says "Excluded: session lifecycle, score intervention, and transaction surgery ... a standing cue firing them would act with no operator in the loop" (`backend/src/gameRules/cueValidation.js:20-25`). The glossary gives the source: "Three functions are always operator-only: session lifecycle, show control, and score intervention ... (owner-fixed, 2026-07-09)" (`CONTEXT.md:586-588`). So the second option, as worded, crosses a line the owner drew, without saying so. It also carries the heavy cost the page ties to standalone games: a rule that changes scores must run on a standalone tablet with no engine and stay equal to the engine's. A rule that lights a look needs an engine anyway.

Change: replace the three options with the real steps.

- "Rules for the room, as today." Means: "A rule can react to what the engine sees and change what the room does. It cannot read the game's state and cannot change it." Cost: "Nothing new. A mechanic that depends on the game's state waits for a developer."
- "Rules for the room that can read the game." Means: "As today, and a rule's conditions can use the token's group, type and rating, the phase, and a team's score. Example: a scan of a token in this group lights this look only during this phase." Cost: "The engine gives rules more to read. Rules still change nothing in the game, so they need an engine and do not run in a standalone game."
- "Rules that also change the game." Means: "A rule can award or remove points, claim or free a token, expose evidence, or move the phase, with no GM acting." Cost: "It changes your ruling of 2026-07-09 that score changes stay with staff. Such rules decide game facts, so they must run on a standalone tablet too and be kept equal to the engine's by tests. A rule that misfires changes scores before a GM sees it."
- "Scripts in the pack." Means: "The designer writes code." Cost: "Out unless you change the standing rule that games are built without code."

Proposed `recommendation`: "Rules for the room that can read the game. They cover your lighting example and the combinations after it with no developer, and the check at publish and the GM's off switch stay as they are. The game's facts keep changing only through what the pack declares in its modes, scoring and groups, and through abilities a developer adds for every game, as the second game's needs will be. From you: whether a designer's rule may ever change points, claims or evidence with no GM acting. The agent recommends no for the first release."

### D-3 (medium). The closing ask repeats question H

Where: `recommendation` "From you: whether that standalone subset is enough, or whether a rule that cannot run on a scanner alone should keep a game from being declared standalone."

What is wrong: a rule that cannot run with no engine is "an effect no device can carry alone". Question H asks what happens to those, and recommends that the designer marks each as skip-it or block-the-show. The owner would answer the same thing twice.

Change: remove the ask. Add to `evidence[4]`: "In a standalone game no rule for the room can run, since the room's equipment needs the engine. What then happens is the question “What a standalone game gives up, and what it keeps”."

### D-4 (low). "A programming language by accident"

Where: `options[1].cost` "It must be kept small or it becomes a programming language by accident." With D-2's steps the limit is stated in each option and this warning can go.

## Findings: E. How an extension for all games reaches a production

Verdict on E: the owner's question in the owner's own words ("how those extensions then interact with the main release"). The explanation is honest, and "For ALN the difference is small, because you make the releases" is exactly what the owner needs to read. The ask is a clean yes or no. Four repairs.

### E-1 (medium). The recommendation assumes the answer it then asks for

Where: `recommendation` "Ship the first release as main-release-only, and build the places where an add-on would plug in as fixed places ... with their own versions ... From you now ...: whether a production may ever run an extension the engine did not ship".

What is wrong: building versioned places for add-ons from the first release is only worth it if the answer is yes. The page recommends the build and then asks the question as if it had no view.

Change: "The agent recommends yes, later. The first release takes extensions only through the main release. The places where an add-on would plug in are built from the start with their own versions, and the version mark, the health rows and the night's record are built to name an add-on. What the engine promises about add-ons waits for the release block. If you say no, those places stay inside one body of code with no versions of their own, which is less to keep, and every extension goes through the main release for good."

### E-2 (medium). What an add-on may see, and what its crash does, is missing

Where: `options[1].means` and `cost`.

What is wrong: an add-on is someone else's code on the show machine, beside the game's data. The settled targets say "Game data stays on the kit" and "Every request is checked against its pass", and the owner decided that no technical failure stops a game. The page covers only the health row. It also skips the promise that "the owner alone sends it to the show": an add-on must be on the written list of what the machine should carry, or the settled check "The machine matches what it should carry" passes over it.

Change: add to `options[1].means`: "An add-on runs as its own program and holds a pass that says what it may see and do, as a new kind of device does. If it crashes, the GM sees a red row and can take it out of service for the night, and the game goes on. An add-on is on the written list of what the machine should carry, so each production's owner installs it between events and the check at start names it."

### E-3 (low). One cost is stated at its heaviest, and the third option is not a choice

Where: `options[1].cost` "you keep those places stable and test releases against add-ons you did not write"; `options[2]`.

What is wrong: testing against other people's add-ons is one possible promise, and the page defers that promise to the release block. The third option happens whatever the owner decides, as the page says.

Change: cost: "You keep those places stable from one release to the next. Whether you also test against other people's add-ons is a promise for the release block." Move the third option into `evidence[4]` as a sentence and leave two options.

### E-4 (low). The fourth test is weak here, and that is acceptable

The page says the answer is needed before the blind round because the architect for growth designs the places. Question J says the panel gets the open questions "so it designs for both answers". If the owner leaves E unanswered, the panel can design for both. Say so in one line, so the owner does not feel E blocks the panel.

## Findings: F. Where the trial copy runs while a show runs

Verdict on F: the owner's question. The page is right that the record does not settle where the trial copy runs: the ratified design says "a second orchestrator process" started by the design tool, wherever the tool runs (`docs/plans/2026-09-04-phase3-design-workspace-pages.md:196-203`). But the options describe a trial copy that does not match the ratified one, one cost and one option are missing, and the agent has grounds for a recommendation it does not give.

### F-1 (high). A trial copy never drives the real room, in any option

Where: `options[0].means` "The designer rehearses whenever they like, on the real room's engine"; `options[1].means` "Rehearsals on the real room happen before doors or after the last game"; `evidence[3]` "Between games the designer rehearses on the real room and its equipment".

What is wrong: the ratified trial copy runs with "video/music/bluetooth/audio/lighting services disabled" and "ships with a PREVIEW PROFILE" in which every piece of equipment reads as not installed (same file, `:354-364`, `:502-504`). The glossary defines Rehearse as "performing the show's moments without the venue" (`CONTEXT.md:520`). The page's own "At a show" item agrees: the trial's video must not take the TV. So the benefit the options name, rehearsing on the real room, does not exist for a trial copy. A rehearsal on the real equipment is a game run on the live engine between games, which the settled target "A published change plays within minutes" already gives.

What really differs between the options is where the trial copy's program runs and what the designer needs in hand. On the show machine, the designer needs only a browser on the kit's network. Off the show machine, the designer needs the engine on a computer of their own.

Why it matters: the owner is asked to weigh "the designer's convenience during a show" against risk, and the convenience is misdescribed.

Change: rewrite the three `means`. First: "The designer opens the design tool in a browser on the kit's network and starts a trial at any time, also while a game runs. The trial plays on stand-ins; it never uses the TV, the speakers or the lights." Second: "The same, but the design tool refuses to start a trial while a game is running or paused." Third: "The show machine runs one engine. A trial runs on another computer that has the engine installed." Correct `evidence[3]` to match, and add: "To try a change on the real room, the designer publishes it between games and plays a round on the live engine, under any answer."

### F-2 (medium). The third option's cost is missing, and so is a fourth option

Where: `options[2].cost` "The least to build; the designer never rehearses on the real equipment except by playing."

What is wrong: with the trial off the show machine, a designer must install and run the engine on their own computer. That is technical help, for the person the roadmap describes as "a designer friend [who] can sit down with the tool ... and rehearse" (`docs/plans/ROADMAP.md:224-225`). The missing option is a second machine in the kit: the spare from question B, which the roadmap already makes the "standing test device" (`ROADMAP.md:475`). It hosts the design tool and the trial copies, the show machine stays alone, and nobody installs anything on a laptop.

Change: `options[2].cost`: "The least to build. Each designer needs the engine installed on a computer of their own, which is a technical step." New option: label "On a second machine in the kit." Means: "The kit's spare show machine runs the design tool and the trial copies. The show machine runs one engine. The designer needs only a browser." Cost: "A second machine in the kit, which ALN has after the swap to the new engine. It is the same machine a spare for a failed show machine would be (the question “The show machine fails mid-game”)."

### F-3 (medium). The answer rewrites three targets, and the test-run case rides on it unseen

Where: `evidence[6]` "it also feeds the limits under ... and the number of copies one machine must carry".

What is wrong: two targets marked settled already assume the first option. "A trial copy never touches the live show" opens "While a show runs, the designer starts a separate trial copy of the engine on the same machine". "Running copies of the engine stay separate" says of its number "the situation already needs two". The proposed target "A test run cannot touch the live show" has someone run the whole test set on the show machine during a show. Any answer but the first changes all three, and the page asks about the trial copy only.

Change: add to `decides`: "The same answer covers a test run: whether anyone may run the engine's tests on the show machine while a game runs." Add to `evidence[6]`: "If you answer anything but “during the show”, the agent rewords three targets: a trial copy and a test run never start on a machine with a game running or paused, and one machine carries two copies only between games."

### F-4 (low). One line "For you" is missing, and a recommendation is available

What is wrong: the page does not say who would rehearse during a show. For ALN the owner is the designer and usually works the show. The page also gives no recommendation though its own sentence makes the case: "The strongest isolation the design can build is still weaker than a trial copy that is not there."

Change: add `evidence` item: "For you. During an ALN show you are running the show, so a trial during a show would be for a second designer at the desk." Set `recKind` to "Recommendation" with: "Between games on the show machine, and at any time on a second machine. Never beside a running game. Your decision “[[dec:no-technical-failure-stops-a-game]]” puts the show first, and a trial copy that is not running cannot disturb it. It costs a designer nothing between games. From you: whether you ever need a trial on the show machine while a game runs."

## What is right

- The page's four tests are the right tests, and five of the six questions pass the first one cleanly. A, C, D, E and F are about what the product must do or allow.
- Six of the nine conflicts in the introduction are answered, and answered well. Items 1, 2, 3, 5, 8 and 9 rest on the owner's decisions or ratified rulings, and item 2 needs only the pack-format note from C-2. Items 4 and 6 are answered in no requirement (I-2), and item 7 is question F (I-3).
- The "today" facts in A and C are accurate against the code, down to the tablet's hand-kept list of messages and the exact-match pack check. I found factual errors only in B (the TV), D (what the pack holds today) and F (what a trial copy drives), plus the small one in C-6.
- C does what the owner asked: it says what the two phrases mean, what today does, what changes for the owner's kit over years, and what changes in the build. Its recommendation survives review and gets stronger with C-1.
- Every question excludes or refuses a pause, in line with "No technical failure stops a game". B lists pausing only to say it is out.
- E's "For you" item and F's admission that the record disagrees with itself are the kind of plain statement the owner asked for. Keep that pattern in the rewrites.
- Each question names the decisions ahead that wait on it, and those links match the Design page.
