# Version 10 review, design lens: is this the approach most likely to give a long-term optimal architecture

Written 2026-11-09 for the agent running the pass. Read only. One of four independent reviews.

## Scope

I read the six pages of version 10 as published (the text copies of the front page, Decisions, Requirements, Design, and parts of Today's engine), the owner's comments of 2026-11-02, the decision record, the panel's brief, the program document, the roadmap's standing constraints, cutover method and later blocks, the glossary's first and runtime-state sections, both requirements files, and the page overlays. I checked claims against today's code where a finding rests on it. I judged the six decisions ahead, their order, what the list leaves out, the decided directions, the standing rules, the twelve qualities and their targets, the panel's set-up and the later choices. I did not review the wording of the ten questions as questions, except where a question changes what the design does. Site text I propose follows the owner's rules. Typographic quotes appear only inside proposed site text.

## Verdict

The frame is right: requirements first, an independent panel, then rounds ordered by how hard a choice is to undo, with today's flaws as tests and no date pressure. The six decisions are the right core, but the list was fixed on 2026-11-01 and not re-derived after the owner's four decisions of 2026-11-02, and it shows. State and authority are one decision cut in two with the protocol between them. Four things a build needs have no decision at all: who may do what and how a device proves it, how the engine drives the room's programs, the data the kit keeps, and how a kit is installed and released after the first swap. The larger problem is that version 10 works against its own method in two places. The Decisions page asks the owner to pick build mechanisms from the agent's cost estimates before the panel has priced anything, and the requirements the blind round will read already hold several of the agent's design choices, some marked settled that the pages elsewhere call open. Fix those two and the list, and the approach is sound. Eleven of the forty-three targets and five of the twenty-eight cases drive no decision today, which is how I found the gaps.

## Findings

### High

#### D-H1. Three questions ask the owner to choose how to build, from the agent's costs, before the panel prices anything

Where. Decisions, "B. The show machine fails mid-game", "What we need from you": "which of the first three fallbacks the engine must offer (one or more); whether the fourth, declaring the game standalone once for the rest of the night, may be offered as well". Decisions, C, recommendation: "From you: how long the window is (one or two engine versions back), and whether a device outside it is refused or only warned about." Decisions, D, the options "Tables of values only", "Declared when-then rules over the engine's abilities", "Scripts in the pack". Source: `decisions.json`, `groups[0].questions[1..3]`, fields `options` and `recommendation`.

What is wrong. The page's first test says a question is "never about how to build it". B's three fallbacks are three state designs. The page says so itself: "A spare that takes over live needs a record that can be copied as it changes; carrying on from tablets needs tablets that hold enough of the record to finish a game; a single store on one machine serves neither." C's window is a rule of the protocol. D's three options are three kinds of pack format. Each option's "What it costs" line is the agent's own estimate. The owner's answer then enters the decision record, and the panel receives it as a decision that binds any design. So the agent's architecture reasoning reaches the panel through the owner, and the hardest choice to undo is made before any independent architect has looked at it.

Why. The Design page says the opposite of what the Decisions page does: "No options are proposed here; the panel proposes them, and each round then puts two or three designs side by side in front of you." The panel decision withholds "the recommendations of the agent running the pass". The owner asked for this order too. On the conflicts: "I would need to understand the specific conflicts and what they mean functionally in order to be able to answer optimally." On release day: "I'd like to understand more specifically what this question means in practice and how it impacts the actual design and build." The panel is the tool that prices those options. The brief already lets the panel run with questions open: "the panel gets the open questions instead, so it designs for both answers."

Proposed change. Keep each question, but ask now only what the owner can say without costs, and send the mechanism to the design round with the panel's prices. Keep the options as a list of ways it could be built, not as a choice. Replacement texts:

B, field `recommendation` (kind "What we need from you"):

> From you now, four things, a line each. How long the game may go without scoring when the show machine dies for the night: no gap, a minute or two, or several minutes with a step the GM does by hand. Whether a production must own a second machine to get that, or whether a kit with one machine must also carry on in a smaller form. What the players may lose for the rest of the night (video, music, lights, the TV) and what they must never lose. Whether the TV may keep counting while the engine is silent. How it is built comes back to you from the panel, with what each way costs, in the round on how the engine holds the game's state. The four ways above are what the panel will price. Until then “Standalone games: declared, never mixed” stands as it is.

C, field `recommendation`:

> From you now, two things. When a hardware scanner that missed its update meets a newer engine on a show night, must it work tonight with a warning, or may the engine refuse it? And do you want to promise other productions that a device or a pack made for one version keeps working with later versions for a stated time? The form of the version rules comes back to you from the panel, with what each costs, in the round on the protocol's form. The agent's lean is the middle option above. It is a lean, not a finding.

D, field `recommendation`:

> From you now, two things. Must a game's maker be able to combine the engine's triggers and responses in ways no developer planned for, with no developer? And must such a combination also run in a standalone game, on a scanner alone? Whether that takes tables, when-then rules or something else comes back to you from the panel, with what each costs to keep for years. Scripts stay out unless you say otherwise, because they end the standing rule that games are built without code.

Add one sentence to the page intro, `decisions.json` `intro[1]`, after the four tests: "Where a question's options are ways to build something, you are asked only for what must be true at a show; the panel prices the ways, and you choose among them in the design round." E's ask ("whether a production may ever run an extension the engine did not ship") and A, F and I already ask for outcomes and can stay.

#### D-H2. Undoing a release by replugging a second machine is written as the engine's standing method and marked settled. The roadmap ratified it for one swap

Where. Requirements, "Replugging the old machine undoes a release": "If the new machine fails on a show night, the owner plugs the old machine back in; it takes the same network address and name, and every tablet, scanner and screen carries on without noticing the machine changed." Status: "Settled". Requirements, "A new engine version by swapping machines": "A new engine version is ready. The owner builds a second machine", and "Must not need An upgrade of the live machine in place". Decisions, C: "In the long term, for your kit. Once the new engine runs ALN, your kit updates between events: build the new machine, check it [...] rehearse, swap by replugging". Sources: `2026-11-01-quality-targets.json` QT42 (`title`, `situation`, `status`), `2026-11-01-extension-cases.json` EX17 (`title`, `case`, `throughWhat`, `mustNotNeed`, `status`).

What is wrong. Four things.

1. The owner ratified the swap for the one move from the machine in use now to the new one. `ROADMAP.md:462`: "The cutover is a hardware swap, not an in-place upgrade". Line 474: after it the old machine "stays frozen for at least the first few events, then is wiped and becomes the standing test device". For every later release the roadmap says only this (line 585): "after a cutover, engine updates happen only between events; pack updates can happen any time". Nothing ratified says every release needs a freshly built machine or that an upgrade in place is forbidden. The target and the case say both and are marked settled.
2. As a requirement of the engine it makes a second show machine part of every kit. That is a fixed hardware requirement nobody sorted, against "The engine says what is fixed and what each production sets" and against a business of one kit.
3. It contradicts Question C's first option. Under "Everything updates together" the hardware scanners are flashed to the new version by cable before the show. Replug the old machine and every scanner is now newer than the engine and is refused. The rollback takes a cable and a laptop per scanner, not a minute. So the settled rollback promise already forces the old engine to accept newer scanners, which is a window in both directions. C does not tell the owner this.
4. Two machines hold two sets of data. Nights played on the new machine are recorded on it. After a replug the old machine has none of them, and none of the packs published since. "Brings everything back as it was" is true of the software and false of the kit's data. No page says where the kit's data lives.

Why it matters. The panel will read "release means swap machines" as fixed and will not propose two installed versions on one machine, which is the usual cheap way to make a release undoable. The owner is told on the Decisions page that every future release means building a machine.

Proposed change. State the outcome and keep the swap as ALN's ratified first method.

QT42 `title`: "A release can be undone before the next game".

QT42 `situation`:

> Nothing reaches the show machine until the owner says the new engine is ready. After that the engine changes only between events, while packs may be published at any time. If a new version fails on a show night, the owner puts the kit back on the version before it within a few minutes, with no developer and no terminal. The engine, the tablet and phone apps, the pack, the media and the venue profile go back together, and the check names any piece that did not. The records of earlier nights are still on the kit. Every hardware scanner still works with the version the kit went back to. For the first swap the method is ratified: the owner replugs the old machine, which takes the same network address and name.

QT42 `status`, kind "partly settled":

> Your word for the first swap (the roadmap's method for swapping in the new machine, 2026-08-29) and for engine updates only between events. That every later release is undone the same way is proposed, and so is the second machine it would need in every kit. The design rounds compare a second machine with two installed versions on one machine.

EX17 `title`: "A new engine version reaches the kit and can be taken back". EX17 `mustNotNeed`: replace "An upgrade of the live machine in place" with "A release the owner cannot undo". EX17 `throughWhat`: add "for later releases the design rounds choose between a second machine and two installed versions on one machine".

Question C, one more item under "What it means in practice" (`evidence`):

> What undoing a release needs. If a new version fails and you go back to the one before, every hardware scanner already flashed for the new version meets the older engine. Under everything-together the older engine refuses them all, and going back takes a cable and a laptop for each scanner. So the promise that a release can be undone within minutes already needs the engine to accept a scanner one version newer or older.

Change C's recommendation to say that this is a second reason for its middle option. Add the kit's data to the copies decision (see D-M1).

#### D-H3. State and authority are one decision, cut into rounds one and three, with the protocol decided between them

Where. Design, the order: "how the engine holds the game's state; the published protocol's form; where authority lives across devices, offline and standalone included". Round one "What it decides": "Where each fact of a running game lives and is decided". Round three "What it decides": "For each fact, which device or program decides it". Sources: `front.json` `intros.design`, `design.json` `ahead[0]`, `ahead[1]`, `ahead[2]`.

What is wrong. Both rounds decide who decides a fact. Round one's text also says "how the game's state carries on through a failure, and how it comes back together afterwards, is part of this decision", which is the cut-off tablet and the failed machine, which round three says it designs. The Decisions page confirms the tie: A, B and G each list both rounds under "Which decision ahead depends on it". And the protocol's form, decided between them, depends on round three. A says: "what every reply carries (how sure the engine is) depends on whether provisional replies exist". G says: "whether devices ever speak to a tablet instead of the engine". So the owner would choose a way to hold state before seeing where authority sits, then fix what a reply carries, then find in round three that both must reopen.

Why. The owner's first method decision already said this. Program document, section 3: the questions on who decides each fact, each fact at a game boundary, how copies update and the reconnect snapshot are designed together, "because between them they make one rule for live state". Version 10's call "Four readings of earlier decisions are confirmed" reads that as overtaken. The order of rounds changed. The reason they belong together did not.

Proposed change. Take rounds one and three as one round with one page, or run authority straight after state and before the protocol. Reword `front.json` `intros.design`:

> The decisions ahead come in this order: how the engine holds the show's state and who decides each fact, on the show machine, on a device that is cut off, and with no show machine; the published protocol's form; [...]

Merge `ahead[2]`'s "decides", "drivers", "settled" and "panel" into `ahead[0]`. In the call "Four readings of earlier decisions are confirmed" drop the clause "the four questions on the game's live facts are no longer designed together as one rule" and say instead: "the four questions on the game's live facts are still designed together, inside the first round". The order is listed in the owner's decision "Design top-down, hardest-to-reverse choices first", so put the change to the owner in one line with Question J, whose subject is already the agenda:

> One change to the agenda, for you to refuse if you disagree: the first and third decisions are taken as one round, because each of your questions on a failure names both.

#### D-H4. No decision settles who may do what and how a device proves who it is

Where. Design, all six "What it decides" texts. The word "pass" appears in one: "How one engine runs as many separate copies" asks that no copy can "accept its passes". Source: `design.json` `ahead[*].decides`.

What is wrong. The requirements ask for a full access model. The roles promise names five kinds of party: "The GM; the audience; a player with no account; designers and venue technicians; a stranger on the venue wifi". Its goal: "Every connection shows a verified pass: kind, name, role, still there or not". Its planned needs: "passes issued without accounts", "a watch-only pass issued to each display that connects, never written into the page's text, capped in number". The Decisions page adds, as already answered, "Passes survive a reconnect, a restart and a machine swap, and nobody logs in again mid-show". No target says that last sentence, and no decision says how a pass is issued, held on the kit, taken back from a lost tablet, honoured by a second machine or a spare, or what stands in for it in a standalone game with several devices. Today one admin password and one signing secret do all of it (`backend/src/config/index.js:67-68`), the state route answers anyone (`backend/src/routes/stateRoutes.js:32` has no check), and player devices send only an id.

Why it matters. This is hard to undo once outside designers, players' phones and other productions exist, and it crosses the protocol, authority and copies rounds, so each will assume another round owns it. The earlier candidate had a part for it, "Connections and roles". The top-down list lost it.

Proposed change. Name it in the protocol round. `ahead[1].title`: "The published protocol's form, and how a device proves who it is". Add to `ahead[1].decides`:

> It also settles who may do what: how a tablet, a phone, a scanner, a screen and the design tool each get a pass, where the kit keeps its passes and its secrets, how a lost tablet's pass is taken back, whether a pass from one machine holds on its spare, and what a device shows in place of a pass when a game has no show machine.

Add to the brief's list of what each architect writes: "how each kind of device and each kind of staff gets its pass and loses it". Add a clause to the target "Every request is checked against its pass" (`QT31.situation`): "A pass survives a reconnect and an engine restart, and the owner can take back the pass of a tablet that was lost."

#### D-H5. No decision covers how the engine drives the room. One of the nine questions is attached to nothing

Where. Design, "Already settled around it" under each decision. Eight of the nine questions are placed: five under state, two under the protocol, one under copies. "How the engine reads its programs" appears nowhere on the page. Sources: `design.json` `ahead[*].settled` and `ahead[*].drivers`.

What is wrong. The room is about half of today's engine: nine services under one health registry, the cue engine, held items, audio routing and ducking, the program watcher (`backend/src/services/`). In the six decisions it appears only as something a developer may add ("a program it drives") and as a later choice on the equipment's interface. I counted which requirements each decision names as its drivers. The promise "The room does what the designer cued and the GM asked" drives only the extension round. These targets drive no decision: "Crashed programs restart on their own", "Every red row carries its own actions", "Power on straight into a running show", "The preflight states its own limits", "Set up the kit from the guide alone", "A whole game runs with no venue hardware", "Players tap with no account and no login", "Game data stays on the kit", "Sized for a two-hour show with headroom", "Phone capacity is measured before the first phone" and "The GMs know their fallbacks at a failure". These cases drive none: the two that are the owner's own examples (lighting by scanning, audio in several rooms), "The owner sets how long records are kept", "Another production adopts the engine for its venue and hardware" and "A different show machine or scanner hardware".

Why it matters. The glossary counts the room as runtime state: "the video queue, the music, held items, the game clock, running cues, and each service's health" (`CONTEXT.md`, section 4b). The state round's drivers leave all of that out, so a state design could be chosen that fits scores and claims and fits the room badly. A failed outside program is one of the four failures every architect must answer, and the owner's second example (audio in several rooms) is an addition to exactly this half.

Proposed change. Add a decision after the state and authority round. Title: "How the engine drives the room's programs and knows what they are doing". `decides`:

> How the engine starts, watches and restarts the video player, the music player, the sound system, the speakers and the lighting system, or uses ones already running. How it learns what each is doing and how old that knowledge is. How a cue is held, skipped or resumed when a program is down, and what the GM sees. How a stand-in takes a program's place in a rehearsal or a test. What a new program, such as one for audio in several rooms, must offer to be driven like the others.

Drivers: the promise "The room does what the designer cued and the GM asked"; the targets on crashed programs, red rows, power-on, red and grey, replacing an outside program, and a whole game with no venue hardware; the cases on a cue naming roles, a different lighting system or video player, and audio in several rooms; the question "How the engine reads its programs"; the flaws "Engine trusts its stale picture of outside programs" and "Service health and service state travel on separate paths". Move the later choice on the equipment's interface into it. Attach the remaining unplaced targets and cases where D-M1, D-M2 and D-M9 say. If you would rather keep six, widen the first round's title to "the show's state" and add the room to its drivers. I think a seventh is cleaner.

#### D-H6. The requirements the blind round reads already hold design choices the pages call open

Where and what.

1. Requirements, "A game with no show machine". "Goes through [...] the same rules module on the tablet." "Must not need An engine, venue equipment, a second hand-kept copy of the rules on the tablet". Design lists both as open later choices: "The game rules as one shared body of code that the engine and the tablet both run, or two bodies kept equal by tests", and "The standalone tablet: the same record and lifecycle parts the engine runs, or an engine of its own". "Must not need an engine" also rules out Question G's fourth shape, a tablet or a small computer that runs the engine. Source: EX12 `throughWhat`, `mustNotNeed`.
2. Requirements, "A trial copy never touches the live show": "While a show runs, the designer starts a separate trial copy of the engine on the same machine". Status "Settled". Question F says: "The record disagrees with itself here" and asks the owner whether a trial copy runs on the show machine during a show at all. "Running copies of the engine stay separate" is also "Settled", with "How many copies of the engine one machine must carry at once: an engine requirement; the situation already needs two". Sources: QT11 `status`, QT43 `status` and `numberToSet`.
3. Requirements, "A test run cannot touch the live show": "A live engine runs a show. On the same machine someone runs the whole test set. The show's music player [...] all keep running". The need is that a test can never harm a show. A test that refuses to start on a machine with a live game meets that need at a fraction of the cost. The situation as written rules it out. Source: QT27 `situation`.
4. The words "no engine". Requirements, "A standalone game is normal, never a fault": "Each device the game uses starts with no engine". The glossary's engine is all the software: "the backend orchestrator, the GM scanner, the player scanners, the scoreboard, and the config-tool" (`CONTEXT.md`, section 0). The owner's words name devices, not software: "only gm and/or player scanners (phone or hardware)". On the site "the engine" also means the program on the show machine ("a tablet cut off from the engine"). An architect who reads "a game with no engine" will not propose the engine's own deciding code running on the tablet, which is the option that removes the second body of rules.
5. The release method, D-H2.

Why it matters. The brief promises to withhold "the recommendations and leading guesses of the agent running the pass". The "Goes through" field of the cases is where those guesses sit. The blind round is the only point at which three architects design without them.

Proposed change.

- EX12 `throughWhat`: "A declaration every device reads (the design rounds choose where it is held); the engine's rules deciding on the device, and the design rounds choose how they are kept the same as on the show machine." EX12 `mustNotNeed`: "A show machine, venue equipment, rules on the tablet that can come to differ from the engine's without a test failing, or a change to the engine's code."
- QT11 `status` to partly settled: "Your word that a trial copy never touches the show. Whether it may run on the show machine while a show runs is your question “Where the trial copy runs while a show runs”." Start QT11's situation: "A show runs, and the designer rehearses a draft pack on a trial copy of the engine, wherever your answer lets it run." QT43 `status` to partly settled and `numberToSet`: "an engine requirement; whether it is one or two during a show waits on the same question".
- QT27 `situation`: "A live engine runs a show. Someone starts the whole test set on the same machine. Either the tests refuse to start and say why, or they run with their own files, network ports and settings. In both cases the show's music player, video watchers, sound watcher and TV browser keep running, and the files that list the show's programs are unchanged. No test can stop a program it did not start."
- In every text the panel gets, say "with no show machine" for a standalone game. QT37: "Each device the game uses starts with no show machine and says “standalone”". Front page, During play: "also when the game runs with no show machine". In `front.json` `words`, add to the entry for the published protocol or a new entry "The engine": "All the game-independent software: the program on the show machine, the GM's app, the player scanners, the screens and the design tool. Where a page says a device lost the engine, it means the program on the show machine."
- When the script builds the blind folder, leave out each case's "Goes through" line unless it names only the pack, the venue profile, the published protocol or the night's record, which are decided. Say so under "What is withheld, and how" in the brief and in `design.json` `panel.sections[4]`.

### Medium

#### D-M1. The data the kit keeps has no decision: its form on disk, its versions, and where it lives when a kit has two machines

Where. Design, round one "What it decides": "how it is kept so that a restart loses nothing". Nothing else on stored data. Question C covers devices and packs and leaves out files that are kept.

What is wrong. A kit keeps the game in progress, each night's record for as long as the production sets, the photos, the installed packs, the media, the venue profile and the passes. No decision says how an engine one version newer reads a record written by an older one, how long an old night's record stays readable by the Director Console (a separate program on its own release pace, so it lags like a cable-updated device), what a backup of a kit is, or what survives a dead memory card. Today the stored game is patched as it is read, with no version mark (`backend/src/models/session.js:77-90`, three "migration for old sessions" blocks), and the store's write is not atomic (`backend/src/services/sessionService.js:26`).

Proposed change. Add to `ahead[0].decides`: "It also settles how the game in progress and the records of past nights are kept on the kit: in what form, how a newer engine reads what an older one wrote, and how a kit is backed up and brought back after a machine dies." Add the targets "Game data stays on the kit" and the case "The owner sets how long records are kept" to its drivers. Add to the copies round: "what belongs to the kit and moves with it from one machine to the next (records, installed packs, media, the profile, the passes)". Add to Question C's practice items: "The night's record is a file that is kept. A record written this year must still open after later releases, in the engine and in the Director Console, whatever you answer here." Add a target under Safe release and rollback, proposed: "The kit's data survives the loss of a machine. The show machine's memory card dies between events. The owner builds a machine from the guide and restores the kit's last backup: the installed packs, the venue profile, the passes and every night's record still inside its keeping time are back, and the check says what, if anything, was lost."

#### D-M2. Installing, starting and releasing a kit in steady state has no decision. The release targets hang on the one-off move

Where. Design, "How today's engine moves to the new design", "What drives it": "The machine matches what it should carry", "Replugging the old machine undoes a release". Design, "How one engine runs as many separate copies".

What is wrong. The last decision is a one-time move. Those two targets describe every release for years. The sorted numbers lean on "each supported machine" five times on the Decisions page alone, and no decision says what a supported machine is, how the engine is packaged for one, how it starts at power-on, or how a release is put on and taken off. The hardware decision makes this larger, not smaller. The earlier candidate had a part named Release.

Proposed change. Widen the fifth decision. `ahead[4].title`: "How the engine is installed and run on a machine, as one copy or several". Add to `decides`: "What a supported machine is and how the engine is put on one from the guide. How it starts at power-on. How a new version is put on a kit and taken back. Where the design tool runs." Move "The machine matches what it should carry", the reworded QT42, "Power on straight into a running show", "Set up the kit from the guide alone" and the cases on a new engine version and on a different show machine into its drivers. Keep the last decision for the move alone. Move the later choice on the config tool into this round.

#### D-M3. The extension round puts back together what the owner took apart

Where. Design, "How games and venues extend the engine", "What it decides": seven things in one paragraph, from "What a pack may declare and what a venue profile may declare" to "Where settings that belong to no game live".

What is wrong. The owner said of the agent's question on mechanics: "you may be conflating a couple of different framings". The round now holds both kinds of extension, the venue profile, a production's settings, the publish check and where settings live. Fourteen cases drive it. One page with two or three whole designs across all of that cannot be compared.

Proposed change. Keep one round and give it two parts with their own side-by-side designs. Part one, "What a game and a venue declare": the pack, the venue profile, a production's settings, the publish check. Part two, "Where a developer adds to the engine, and how an addition ships": the places for a scoring model, a screen, a device kind, a driven program, a content source, and the owner's answer on add-ons. Say so in `ahead[3].decides` and in the brief's agenda line.

#### D-M4. The panel gets "No technical failure stops a game" as an absolute. The owner's words have limits, and one planned game cannot meet it without a second machine

Where. Design, the brief, first lens: "with [No technical failure stops a game] as its first test". Requirements, "The GMs know their fallbacks at a failure": "The failure alone never pauses the game". Decisions, B: "Pause until the machine returns. [...] Listed only to say it is out."

What is wrong. The owner said "For more or less all use cases" and "if at all possible". The roadmap says of the second game (`ROADMAP.md:560`): "The game requires an orchestrator by nature (hidden server-side state plus a live public screen)". For that game, on a kit with one machine, the only honest fallbacks when the machine dies are a wait or an orderly end. Read as an absolute, the rule pushes every architect to a live spare, the most expensive design on the table, for every production.

Proposed change. The title is the record's and can stay. In the brief's first lens add: "The owner's words set the limit: “for more or less all use cases”, “if at all possible”. A design says for which games and kits it keeps the game going, and what the GMs do in the cases it cannot." In B, add an item: "For a game that needs the show machine by nature. Your second game keeps hidden facts on the show machine and shows a live public screen. If its machine dies, tablets cannot carry it on. For such a game the choice is a second machine or an orderly end, and the pack should say which the game needs." In QT44's situation, after "never pauses the game", add: "unless the game cannot be played without the thing that failed, and then every GM tablet says so and what to do".

#### D-M5. The failures every architect must answer leave out the kit's network and a dead tablet

Where. Design, the brief: "for each kind of failure mid-show (a tablet's connection, a device, the show machine, an outside program)". Requirements, "The GMs know their fallbacks at a failure": "a tablet loses its connection, the show machine stops, or a program the engine drives dies".

What is wrong. When the kit's router dies, every device is cut off at once and the show machine keeps running the clock, the cues and the video. That differs from a dead machine. If the tablets carry on, the engine and each tablet all decide for a while, which is Question A at its largest. A GM tablet that dies is also missing: the scans it kept and had not sent die with it, and in a standalone game it is the only copy, as G says.

Proposed change. In `design.json` `panel.sections[1]` and the brief: "(one tablet's connection, the kit's whole network, a tablet or scanner that dies holding scans it has not sent, the show machine, an outside program)". Add the same two to QT44's first sentence.

#### D-M6. The settled roles go to the panel as a binding decision, in ALN's words, against a standing rule

Where. Design, the brief, "Your decisions that bind any design": "[The role question starts from settled roles]". Design, the protocol round: "the player scanners show token content and report scans, the GM scanner is the command center, the scoreboards show the public results".

What is wrong. The record's entry adds "with no scoring and no live game feed" for player scanners and "team scores and exposed evidence" for scoreboards. A standing rule says: "A game's kit declares which kinds of device its players use and what part each plays." The cases the panel also gets go beyond the roles: two-tap actions on players' phones, "A hidden fact reaches only its owner's screen", and "A third lets a shared station make a transaction that only a GM may make today". "Exposed evidence" is ALN's mode, against "No word of ALN's inside the engine". The decision was made on 2026-10-30 to give one of the nine questions a starting point ("it starts from these roles"), not to fix every game's devices.

Proposed change. This is a reading of the owner's words that no earlier decision settles, so add it under "Readings of your words, to confirm" (`decisions.json` `readings`):

> The settled roles describe ALN's devices today and are where the question of what each device receives starts. They do not limit what another game's pack may give a kind of device, within the rule that only staff who log in run the game. Read from your standing rule that a game's kit declares which kinds of device its players use and what part each plays.

Until confirmed, give the panel the roles under the setting, as facts about ALN, not under the binding decisions.

#### D-M7. The three lenses change emphasis, not designs, and none argues for less

Where. Design, the brief: "Each has one lens, so that the three proposals differ." Decisions, the call "The panel's three lenses": "No fourth architect."

What is wrong. Three fresh agents on one model, with one folder and one agenda, differ mostly where their lenses point. That gives three write-ups of one mainstream design with different chapters filled in. A design round needs two or three different designs per decision. Also, each lens adds: more recovery, more places to extend, more process. The owner's goal starts with "intuitive and easy to maintain", and the owner is one person who is not an engineer. Every requirement on the site asks for an ability. Nothing asks for less to keep.

Proposed change, in the brief and `design.json` `panel.sections[0]` and `[1]`:

- Each architect gives, for the state and authority decision and the extension decision, two designs that differ in kind, and says which it prefers and why.
- The third lens becomes "Living with it, and the least engine that meets the requirements". Its architect must name what the design leaves out and which requirement that costs.
- Every architect adds, for each mechanism in the design, what must be kept working or kept equal for years because of it.
- In the second round each proposal gets a price for the move from today's engine, and each design round's page shows that price beside each design. Add to `ahead[0..4].panel`: "and what moving today's engine to it would cost".

The reason given for no fourth architect is "two more agents and a longer synthesis". This step chooses the shape of years of work for about the cost of one site build. If the budget allows one more agent, spend it on a fourth architect whose brief is the least engine.

#### D-M8. Six engine requirements have no value, the restart time is sorted where it will not be designed for, and the size the engine is designed for is ALN's

Where. Decisions, "How each number is sorted". "A power cut loses nothing of the game: [...] A production's setting; the engine states its own restart time on each supported machine." Requirements: "within a set time" six times.

What is wrong. The time from a crash or a power cut to a running game is the number that decides whether a restart is a good enough fallback or a spare is needed. Sorted as a production's setting, with no value, no architect has to meet it. A production cannot set how fast an engine restarts. It can only check that the engine's time fits. The same holds for power-on. Six engine requirements have no value at all: publish to playing, a scan's answer, a live message's delivery, the fallbacks shown after a failure, the newcomer's first change, the longest silence. An architect cannot tell a tenth of a second from ten seconds. The largest kit is "a few dozen devices, from ALN's show". With players' own phones a show of thirty players is past that before a tablet connects.

Proposed change. Sort the restart and power-on times as "Mixed": the production's tolerance is its setting, and "the engine's own time from power back to a running game on each supported machine" is an engine limit with a first proposed value for ALN's machine, measured, not guessed. For the six, the agent proposes a first value marked as proposed, taken from what today's engine does: the GM app gives a command five seconds before calling it failed, the hardware scanner gives a scan ten seconds, the engine rechecks each service every fifteen. State the size the engine is designed for as a rough order with phones counted, marked proposed, for example "about a hundred devices on one show machine, to be measured". Put all of it in the call "The quality targets' numbers are sorted, not asked" so the owner can overrule one line.

#### D-M9. Four situations a build will meet have no target

What is missing, each a proposed target in the form the page uses.

1. Taking back a published pack. Packs are the release that happens most, between games on a show night. Under The designer's iteration speed: "A published pack can be taken back. Between games the designer publishes a change, plays one game and finds it worse. In the design tool they put the kit back on the pack it played before. Every device takes it up before the next game, and the night's record names which pack each game ran."
2. An extension that fails. Under Easy to extend: "An extension that fails leaves the game running. A rule the designer wrote fires without end, or a program a developer added hangs. The engine stops the rule or marks the program down within a set time, the GM sees a red row that names it with a button to switch it off, and scans, scores and the other cues carry on."
3. Finding out afterwards. Under Easy to understand and change: "The developer can tell what happened without having been there. After a night with a fault, the owner hands over one file from the kit. From it a developer or an agent can say what failed, when, what each device saw and what the GMs pressed. The file names no player and leaves the kit only when the owner moves it." Today this is a script over logs (`npm run session:validate`). One owner working with agents depends on it.
4. The kit's data and a dead machine, in D-M1.

Where they go. `2026-11-01-quality-targets.json`, new targets, each marked proposed. The first is also a product question the owner may want to see: mention it in the review block for the quality targets (`decisions.json` `review[1].what`).

#### D-M10. A rule the owner bounded is stated without its bound in four places

Where. Front page: "nothing in the engine may assume one kit, one pack or one production". Front page, words: "nothing assumes one kit, one pack or one production". Requirements, target title: "Nothing assumes one kit, one pack, one production". Design, the extension round: "nothing in the engine assumes one kit, one pack or one production".

What is wrong. The rule, as the Requirements page itself gives it: "No block may build in the assumption of one kit, one pack or one production where avoiding it costs little. Features for several kits or several packs belong to the operations era; the seams that make them possible are built now." (`ROADMAP.md:103-104`.) Without the bound, an architect builds for many kits now.

Proposed change. In each of the four: "nothing assumes one kit, one pack or one production where avoiding it costs little; features for several kits come later, and the places for them are built now". QT24 `title`: "A second kit or production needs no rework".

### Low

#### D-L1. The later choices do not say which round settles them, and two are not later choices

Where. Design, "Later choices": "Each is settled inside one of the decisions ahead, or by the build plan." Eight of the fifteen name no round.

Proposed change, in `design.json` `later[*].text` and `decisions.json` `later[*].text`. Getting facts onto screens, the life of a game, and when a changed pack may be loaded: the state and authority round. The game rules as one body or two, and the standalone tablet: the same round, as part of its main question, since they are the cost side of A, B and G. The equipment's interface: the new round on the room. The scoreboard: the extension round, part one. The config tool: the install and copies round. "Whether paper documents join the pack" is about what the product tracks, so say "you decide it in the round on how games and venues extend the engine". "When a changed pack may be loaded" says the requirements already allow it only between games, so say what is left to choose: "how a changed pack is taken up between games with no restart".

#### D-L2. "With a version number" settles something the protocol round is meant to decide

Where. Design, Decided directions: "kept in one place with a version number". Decisions, C: "Under everything-together the protocol has one version number for the whole release".

What is wrong. Live messages, the pack format and the night's record have different lives: one release, many releases, and years. The record says "versioned", not one number.

Proposed change. `design.json` `decided[0].paragraphs[0]`: "kept in one place and versioned. Whether the messages and each file format share one version or carry their own is part of the decision on the protocol's form."

#### D-L3. A scanner keeps a hundred scans, which may not last a game with no show machine

Where. Decisions, sorted numbers: "Offline scans are kept and sent once: [...] An engine limit stated per kind of device (today both player scanners keep 100)". The limit is in `arduino-cyd-player-scanner/ALNScanner_v5/config.h:64` and `aln-memory-scanner/js/orchestratorIntegration.js:15`.

Proposed change. Add to QT40 `numberToSet`: "If you choose that a game carries on after the show machine dies, the limit must cover a whole game, and a device that reaches it says so and loses nothing."

#### D-L4. One target states the TV's clock as decided while B asks about it

Where. Requirements, "Screens say when the engine goes silent": "the TV shows its clock as unconfirmed and stops counting on its own". Decisions, B: "whether the TV may keep counting while the engine is silent (yes or no)".

Proposed change. QT5 `situation`: "the TV shows its clock as unconfirmed; whether it stops counting or keeps counting with that mark waits on the owner's question “The show machine fails mid-game”". Name the question in QT5 `status`.

#### D-L5. Today's engine reaches the blind round through the "Why it matters" lines

Where. Requirements, for example "At a show today, “is a video playing” has eight answers, and start and reset follow two hand-kept lists." The brief withholds "today's engine and its review" from the blind round.

Proposed change. The folder script drops any sentence in `why` that starts with "Today" or "At a show today". The second round gets them back.

#### D-L6. Two examples on the owner's pages lean toward one state design

Where. Design, Decided directions: "if facts are numbered in order, a reconnecting screen asks for everything after a given number". Decisions, B: "(a numbered log of facts)".

Proposed change. Keep the first as an example and add "one way among several". Cut the second with D-H1's rewording.

## A verdict for each item in the lens

### The six decisions ahead

| Decision | Right decision? | Right place? | What to change |
|---|---|---|---|
| How the engine holds the game's state | Yes, and the hardest to undo | First, yes | Take authority with it (D-H3). Add the data the kit keeps (D-M1). Either add the room or give the room its own decision (D-H5). |
| The published protocol's form | Yes | After state and authority, not between them | Say it settles the way messages and files are defined and versioned, not their content. Add how a device proves who it is (D-H4). Drop the single version number (D-L2). |
| Where authority lives | Yes, but it is the other half of the first | Wrong place | Merge with the first or run it second (D-H3). The rules as one body or two belongs here (D-L1). |
| How games and venues extend the engine | Yes | Fine | Two parts, as the owner split them (D-M3). Add the owner's two example cases to its drivers by link. |
| How one engine runs as many separate copies | Yes, too narrow | Fine | Widen to installing, starting and releasing on a supported machine, and what belongs to the kit (D-M2, D-M1). Its size waits on F (D-H6). |
| How today's engine moves to the new design | Yes | Last, with the second round. Right. | Keep it to the move. Take the steady-state release targets out (D-M2). Show the move's price on every earlier round's page (D-M7). |

Missing as decisions or named parts of one: who may do what (D-H4), the room (D-H5), the kit's data (D-M1), install and release (D-M2). Covered well enough without a decision of their own: testing (a decided direction with four targets), versions and upgrades of devices and packs (the protocol round and Question C, once D-H2 is fixed), capacity (a check on every design, and the page should say so).

### The decided directions

| Direction | Verdict |
|---|---|
| The published protocol | Sound, and the best decision in the set for an engine others build against. Fix D-L2. Name which side of its edge the GM's app is on (D-H6, item 4). |
| The test bench outside the engine | Sound. No change. |
| The test rig built when building starts | Sound, with its stated exception. The design rounds rest on reading, not on a running engine, until then. The panel's trial runs cover the riskiest assumptions. Say who runs them and when. |
| The after-game boundary | Sound. The record's long life adds a need (D-M1). |
| No technical failure stops a game | Sound as the owner said it. Too absolute as passed on (D-M4). Its failure list is short (D-M5). |
| The engine is hardware-flexible; the roadmap sets the bounds | Sound. It needs "a supported machine" to mean something (D-M2). |
| Two kinds of game extension | Sound, and kept tentative as the owner left it. The round re-merges them (D-M3). |
| The engine says what is fixed and what each production sets | Sound. The sorting hides two engine limits and leaves six without values (D-M8). A second machine per kit is an unsorted fixed requirement (D-H2). |

### The panel's set-up

| Part | Verdict |
|---|---|
| Three fresh architects, blind first | Right. The independence is of context, not of habit, so make them differ on purpose (D-M7). |
| The lenses | Each is a real concern. None argues for less (D-M7). |
| What the blind round gets | The goal, the setting and the owner's decisions: right, and Question J's recommended yes is right. The requirements carry the agent's design choices in five places (D-H6) and today's facts in the "why" lines (D-L5). The settled roles should go in as setting (D-M6). |
| What is withheld | Right list. The "Goes through" lines should join it (D-H6). The owner's pre-panel answers on mechanisms pass the agent's reasoning through anyway (D-H1). |
| What each architect writes | Good, above all the table against every requirement and the riskiest assumption with its trial run. Add passes (D-H4), the two missing failures (D-M5), two designs in kind and the cost of keeping each mechanism (D-M7). |
| The second round | Right, including reading the code after proposing. Add the move's price per proposal to each round's page. |
| The synthesis and its checker | Right. |
| When it runs | After the review and the brief's approval: right. It need not wait for B, C and D's mechanisms (D-H1). It should wait for F, I and the reading in D-M6, which change the folder. |
| Size and cost | Small for what it decides. One more architect is cheap (D-M7). |

### The standing rules

| Rule | Verdict |
|---|---|
| Players never have accounts | Sound. Consistent everywhere. |
| The engine knows devices, not people | Sound. |
| How players are identified is the game's choice | Sound. |
| Game data stays on the kit | Sound. It bounds how a fault is studied afterwards (D-M9, third target) and needs "the kit's data" defined across two machines (D-M1). |
| The owner sets how long data is kept | Sound. Now "a production's setting", which fits. The engine's shipped default has no value, and it is a privacy default others inherit. Propose one. |
| Avoid one-kit assumptions where avoiding them is cheap | Sound as ratified. Stated without its bound in four places (D-M10). |
| Pack and venue profile chosen, never assumed | Sound. |
| No one kit's names inside engine code | Sound. |
| Network names and addresses work per kit | Sound. A spare machine taking the kit's name (B) must respect it. |
| Media never lives inside the pack | Sound. The roadmap says "out of the current era", the site says never. Fine for this design. One gap: nobody says how a pack and its media reach each device, and how the GM knows they match, when a game has no show machine. Add that to the state and authority round. |
| A managed media bundle carries the files | Sound. |
| A designer can upload the pack's media | Sound. A tool requirement, no effect on the top-level design. |
| Media bundles move between machines | Sound. Part of what belongs to the kit (D-M1). |
| Games are playtested without code or settings files | Sound. It rules out scripts in D, as the page says. |
| The editor and live apply are built together | Sound. A delivery rule. Consistent with changes only between games. |
| Phones and hardware scanners stay equal in ability | Sound as ratified, and the most expensive rule here: every interaction a pack may declare must run on a small board updated by cable. It caps D and shapes C. Ask each architect to say what parity costs its design. Do not loosen it without the owner. |
| Equal in ability, not in screens | Sound. It is also the rule D-M6 rests on. |
| Hardware scanner work waits on no game | Sound. A planning rule. |
| Designers change pack data, never device code | Sound. With D it means the scanner's program reads whatever rules a pack may hold. |
| Game-design choices are pack and kit settings | Sound. Two things on the site lean against it: the settled roles in ALN's words (D-M6), and the call "Exposed evidence and video with no engine", which builds an engine default around one of ALN's modes. Word that call without ALN's mode or make it the pack's choice. |

### The twelve qualities

| Quality | Complete? | Testable? | Consistent, and numbers sorted right? |
|---|---|---|---|
| Staying up through a live show | Missing the kit's network and a dead device (D-M5) | Yes | Restart time mis-sorted and without a value (D-M8). The absolute in QT44 (D-M4). |
| Every screen telling the truth | Yes | Yes | The TV clock is stated and asked (D-L4). Ten seconds comes from how player scanners poll and is slow for a GM tablet on a live connection. Sort it per kind of connection. |
| The designer's iteration speed | Missing taking a pack back (D-M9) | Yes | QT11 marked settled against Question F (D-H6). "Minutes" has no value (D-M8). |
| Operating it without technical help | Missing a dead memory card and a backup (D-M1) | Yes | Fine. "No terminal" for building the machine is honestly marked proposed. |
| Easy to understand and change, for people and for AI agents | Missing finding out afterwards (D-M9). Nothing asks for less to keep (D-M7). | Mostly. "One sitting" needs its number. | Fine. |
| Easy to extend | Missing an extension that fails (D-M9) | Yes | QT24's title drops the rule's bound (D-M10). |
| Testable without the live show | Yes | Yes | QT27 fixes the costly way to be safe (D-H6). |
| Privacy and access | Missing a pass's life: issued, kept across a restart, taken back (D-H4) | Yes | The Decisions page cites three targets for "passes survive [...] a machine swap". None says it. |
| Running well at the size of a show | Yes | Not until the values exist | Largest kit is ALN's (D-M8). |
| Standalone and offline | Missing how the pack reaches devices with no show machine | Yes | "No engine" wording, and a case that picks the design (D-H6). The limit of 100 (D-L3). |
| Safe release and rollback | Missing the kit's data (D-M1) | Yes | A method written as a requirement and marked settled (D-H2). |
| More than one copy, kit or pack without rework | One target carries three things. Enough. | Yes | Two copies on one machine during a show waits on F (D-H6). |

### The later choices

Mostly mid-level and rightly later. The rules as one body or two, and the standalone tablet, are the cost side of the owner's questions A, B and G and belong inside the state and authority round's main comparison. Paper documents is the owner's to answer when its round comes. The rest in D-L1.

## What is right

- The method. Requirements, then a panel that has not seen the agent's reasoning, then rounds by how hard a choice is to undo, with a thin first version to start the build. Few projects of this size do it in that order.
- The published protocol and the test bench outside the engine. These two decisions do more for "easy to maintain, continue development on, and extend" than anything else on the site, and the explanation of the protocol on the Design page is clear about what it is not.
- Today's flaws used as tests and never as the reason for a design. The page holds that line everywhere.
- The second toy game kept for good, and every test run on two games. That is the only real proof that the engine is not ALN.
- Keeping the owner's tentative words tentative ("should probably"), and holding back two of the agent's readings from the panel.
- Each requirement says what it rests on and whether the owner settled it. That is what let me find the three that are marked wrong.
- Question I's remark that an engine able to run on the GM's own device "is a large simplification of the standalone questions". It is the most useful design remark on the Decisions page. D-H6 asks only that the requirements stop ruling it out.
- Moving the last decision to the second round, and letting the architects add, split or merge decisions. Most of what I propose for the list the panel could also reach that way. It is better fixed before the folder is built.

## Summary

Twenty-two findings: six high, ten medium, six low. The approach is right and two things work against it. The Decisions page asks the owner to choose build mechanisms for B, C and D before the panel prices them, and the requirements the blind round reads hold the agent's design choices in five places, three marked settled against the pages' own open questions. The six decisions need state and authority taken together and four additions: passes, the room, the kit's data, and install and release. The release method is ALN's one-time swap written as a requirement for every production, and it quietly rules out Question C's first option.
