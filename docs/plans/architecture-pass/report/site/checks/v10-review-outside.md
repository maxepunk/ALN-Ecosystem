# Version 10, read from outside: an architect's review

Written 2026-11-09 for the agent running the pass. One of four independent reviews of version 10 (commit e1004d6b).

## Scope

I read the front page, Decisions and Design in full as published, the forty-three quality targets and twenty-eight extension cases from their source files, the owner's comments of 2026-11-02, the decision record's entries on standalone games, failures, hardware, extensions and the top-down order, and the panel's brief. In today's code I read the cue engine and the pack's cue files, the scoring and rules modules, both player scanners' offline queues, and I measured the server's code by area. I did not read the other reviewers' reports. I checked every finding against the pages first, and where a page already covers a point I say where.

## Verdict

The cut from eighteen questions to ten is right, and the "what it means at a show" treatment is what the owner asked for. Three questions would still lead the owner to an answer they could not defend later. "A GM tablet cut off from the engine" prices its richest option with a cost the requirements already pay. "What a game's maker may build inside the pack" describes when-then rules as new, and today's pack already has them. "The show machine fails mid-game" asks the owner to pick mechanisms. The larger risk is in the design approach: four of the ten questions are one architectural decision asked in pieces (on which devices the game's rules and record can run), and the owner's separate answers would settle it before the panel proposes anything. Nothing among the six decisions ahead covers how the engine drives the room, which is about four lines in ten of today's server. I would move two questions to the agent's calls ("Which hardware the first new engine requires" and most of "What a standalone game gives up"), reverse one recommendation, add one where the page gives none, and change what the blind round is handed.

## Findings

### O1. Question A prices its third option with a cost the requirements already pay, and does not say what its answer does to question B

Severity: high.

Where: Decisions, "A. A GM tablet cut off from the engine". The third option's cost, `groups[0].questions[0].options[2].cost` in `v9/decisions.json`: "The game's rules must run equally on the engine and the tablet; every fact the tablet shows must carry “provisional” in the protocol; a conflict rule and a conflict screen exist. The most to keep equal across two places, for years." And the recommendation, "Keep and label."

What is wrong, in three parts.

1. The rules already have to run on the tablet. The quality target "A standalone game is normal, never a fault" (QT37, marked settled by the owner) says "The tablet decides teams, claims, scores, evidence and whether the game is in setup, running, paused or ended under the same rules as the engine, and a test proves the two equal." The extension case "A game with no show machine" (EX12, settled) says the tablet "runs the same rules the engine would" and must not need "a second hand-kept copy of the rules on the tablet". So "the most to keep equal across two places, for years" is paid whatever the owner answers here. What the third option adds is small: a "provisional" mark on what the tablet shows, and a screen for verdicts the engine overturned. Keep and label needs the provisional state and the ordering too.

2. The page never tells the owner what keep and label does if the gap does not end. Question B's first option reads "Each GM tablet keeps taking scans, as kept or as provisional under the question above." Under keep and label that means no team sees a result or a score from the moment the show machine dies until after the show. The game "goes on" in name only: ALN's loop is sell, see the money, watch the scoreboard. The owner should see this before choosing.

3. The conflict the options are weighed against may be near impossible in ALN, and the page does not say. A token is one physical object. Two tablets can both sell it during a gap only if it travels from one GM to the other inside that gap. If a GM keeps a sold token, it cannot happen. The page's example ("If another tablet sold the same token during that minute") is given as the normal case, and "A production with four tablets at four tables has conflicts every time the wifi drops" is not true for physical tokens. The owner knows ALN's practice; the page should ask or state it.

A smaller point in the same question: "the earlier by the tablets' clocks (clocks differ)" overstates the problem. A tablet can measure its offset from the engine's clock whenever it is connected and stamp kept scans with the corrected time. Ordering to well under a second is ordinary. The conflict rule can be the agent's default, with the GM able to overrule, and need not be an open ask.

Proposed change. In `groups[0].questions[0]`:

- `options[2].cost`, replace with: "Every fact the tablet shows carries “provisional” in the protocol, and a screen shows the GM each result the engine overturned. The rules already have to run on the tablet for standalone games (“A standalone game is normal, never a fault”), so this option adds no second copy of them. Its cost is at the table: a GM may have to take back a result a team already heard."
- `evidence`, add after "At a show": "How often two tablets can disagree. A token is one physical object. Two tablets can both sell it during a gap only if it is carried from one GM to the other inside that gap. If your GMs keep a sold token, that cannot happen in ALN, and the only results the engine could overturn are a scan into a game someone paused meanwhile, and a group bonus the tablet could not see. Tell us which is true at your shows."
- `evidence`, add: "If the gap does not end. Under keep and label a team hears no result until the engine is back. If the show machine is gone for the night and the game carries on from the tablets (the question “The show machine fails mid-game”), no team sees a result or a score until after the show."
- `evidence`, in the conflict-rule item, replace "The earlier by the tablets' clocks (clocks differ)." with "The earlier scan, by times each tablet corrects against the engine's clock while it is connected."
- `recommendation`, replace with: "Keep and label for a short gap, and a fallback the GMs choose when the gap lasts. For a dropped wifi or an engine restart the tablet keeps each scan, shows “in, result when we are back”, and the engine answers when it returns. No team is told something the engine has not decided. If the gap lasts longer than a time each production sets, the tablet offers the fallback you choose under “The show machine fails mid-game”, and from then on one device gives results. For conflicts the agent proposes a default you can overrule: the earlier scan wins, the losing scan becomes a red row with its reason, and the GM can overrule it. From you: whether a team may ever be told a result that the engine could later overturn."

### O2. Question D describes when-then rules as a new thing; today's pack already has them

Severity: high.

Where: Decisions, "D. What a game's maker may build inside the pack". The first option, "Tables of values only ... The engine stays as today in kind", and the second, "Declared when-then rules over the engine's abilities. The pack names triggers the engine knows (a scan of this kind, a clock mark, a phase change, a cue finishing) and responses the engine knows (play, light, score, show, hold), and the designer wires them", with its cost "A rule format inside the pack and so inside the published protocol; a check at publish ...; a runner in the engine ...; a listing on the GM's tablet".

What is wrong. That second option is today's engine for everything except "score". The pack's cue file is a declared rule format. `ALN-TokenData/cues.schema.json:34-58` lists sixteen trigger events, among them `player:scan`, `transaction:accepted`, `group:completed`, `phase:changed`, `cue:completed` and the video events, and seven condition operators. `ALN-TokenData/cues.json:5-33` is a live rule in ALN's pack: when a video is loading and its token is not a named one, play a sound and light the look "video-playback". The runner is `backend/src/services/cue/standingEvaluator.js` (the `player:scan` fields at line 32, the phase fields at line 54) with the game's own fields in `backend/src/gameRules/cueVocabulary.js:23-55`. The check at publish refuses a role the pack never declared. The GM's tablet lists standing cues and switches each on and off (`ALNScanner/src/admin/CueController.js:39,49`). The owner's own example can be written today: one cue per token, triggered by `player:scan` with a condition on the token, running `lighting:scene:activate` with a role. The page half says so ("one standing cue per token, which is the tables-only workaround") while calling it tables.

Why it matters. The owner would read "rules" as a new cost and a new risk ("it becomes a programming language by accident") when the format, the runner, the check and the GM's switch exist. "Tables of values only" would remove something ALN's pack uses. And the choice that is open stays hidden. Today's rules can only cause room effects, and their conditions can only read the event that fired them. The open steps are whether a condition may read the game's other facts (the phase, a team's score, a group's progress), whether a rule may change the game's facts (award, claim, free, move the phase), and whether rules must run with no engine. The second step is the expensive one. A rule that awards points is part of the game's rules, so it must run wherever the rules run, standalone tablets and failure fallbacks included.

Proposed change. In `groups[0].questions[3]`:

- `decides`, replace from "Values in tables, as today" to "Or scripts, code the designer writes into the pack." with: "Today's pack already holds rules of the form “when this happens, do that”. Its cues name an event the engine knows (a player's scan, an accepted sale, a completed group, a phase change, a video starting or ending), conditions on that event, and room effects to run (play a sound, light a look, start a video). Your example, players changing the lighting by scanning tokens, can be written that way today, one cue per token. The question is how much further those rules may reach. Whether a rule's condition may read the game's other facts: the phase, a team's score, a group's progress. Whether a rule may change the game's facts (award points, claim or free a token, move the phase) and not only the room. Or whether the pack may hold scripts, code the designer writes."
- `options`, replace the first two with three:
  - label "Room effects only, as today." means "Rules react to the engine's events and act on the room. Scoring, claims and phases stay in the pack's tables." cost "A mechanic that needs a condition on the game's facts, or that changes a score, waits for a developer."
  - label "Rules may also read the game's facts." means "A rule can say “only while the clock is in this phase” or “only for a team that completed this group”. Still room effects only." cost "The list of facts a rule may read becomes part of the pack's format, and the check at publish must know it."
  - label "Rules may also change the game's facts, through actions the engine names." means "A rule can award points, claim or free a token, or move the phase. Most new mechanics need no developer." cost "Such a rule is part of the game's rules. It must run wherever the rules run, on a tablet in a standalone game and in any fallback, and the check at publish must refuse rules that loop or contradict the scoring tables. This is the step that costs."
- `recommendation`, replace the first three sentences with: "Grow the rules the pack already has, one step now. Let a rule's condition read the game's facts. Leave changes to the game's facts to scoring models and modules a developer adds once, as the roadmap's block for the second game's modules already plans, until a real game needs more. Your lighting example works today and gets simpler when the pack says what a scan causes."
- Move the closing ask ("whether that standalone subset is enough ...") out of this question. It is the same rule as "What a standalone game gives up, and what it keeps"; see O8.

### O3. Question B asks the owner to choose mechanisms, flags the wrong option against "never mixed", and leaves out three facts

Severity: high.

Where: Decisions, "B. The show machine fails mid-game", the five options and "What we need from you": "which of the first three fallbacks the engine must offer (one or more); whether the fourth ... may be offered as well (yes or no), which amends your decision on standalone games only if you say yes".

What is wrong.

1. "A spare machine takes over at once", "A cold spare from the last saved record ... kept every few seconds on the tablets or on a stick" and "Carry on from the tablets and reconcile afterwards" are designs. The page's first test says a question is "never about how to build it". With a record kept as an ordered list of facts and copied as it changes, the first three are one ability at three speeds, and the panel should say so. What only the owner can say is the outcome: what must keep working, how fast, and whether a kit may be required to carry a spare computer.

2. The page tells the owner that only the fourth option "amends your decision". The decision's words are "no game mixes networked and standalone devices" (`DECISIONS.md`, "Standalone games: declared, never mixed"). After the show machine is gone, no device is on an engine under the first option or the fourth, so neither mixes by those words. If anything strains the decision's purpose it is the first option: for the rest of the night each tablet decides alone, and one game has as many deciders as it has tablets until the records are merged. Under the fourth, one device decides at every moment. The "amendment" label will steer the owner away from the option with a single decider and toward the one that needs a merge, which is the hardest piece in this whole area to get right and keep right.

3. Three facts are missing. The spare's cost is given as "a second machine in every kit", but ALN's kit already holds a second small computer, the one that shows the scoreboard on the second screen (the front page's "Pi 4"). The player scanners do not keep scans through a long outage: both keep 100 and drop the oldest without a word (`arduino-cyd-player-scanner/ALNScanner_v5/config.h:64` and `services/OrchestratorService.h:1241`; `aln-memory-scanner/js/orchestratorIntegration.js:171-172`), so "their scans counted exactly once" already fails at a busy station fifty minutes into a dead machine. And the page gives no count of how often a show machine has failed for good at one of ALN's shows. I found none in the production fixes triage. An owner who is not told the failure is rare will ask for the strongest promise, and that promise is the most expensive thing on the page to build and own.

Proposed change. In `groups[0].questions[1]`:

- `options[3]` (declare standalone once), `means`: replace "This would amend ... no device is on an engine." with "One device decides at every moment: the show machine until it fails, then one tablet or spare for the rest of the game, with every device told. No device stays on an engine, so no game is mixed. The agent reads this as inside your decision “Standalone games: declared, never mixed”; say so if you read it otherwise." `cost`: replace with "The game's rules and its record must be able to run on that device."
- `options[0]` (carry on from the tablets), `cost`, add: "For the rest of the night the game has as many deciders as tablets, and no team sees a shared score until the records are merged."
- `evidence`, add: "What ALN's kit already has. A second small computer, the one that shows the scoreboard on the second screen. A spare need not be a new purchase for you." And: "How often. The agent has found no record of the show machine failing for good during one of your shows; say if it has. A rare failure deserves a fallback the GMs can trust, and it may not deserve the most expensive one."
- `recommendation` ("What we need from you"), replace with: "From you, as outcomes; the panel proposes how. First, for the rest of a night with no show machine, say must, good to have or may be lost for each of these: the GMs take scans and give results; the teams see shared scores; the public evidence screen; video, music and lights. Second, how long the players may wait before the game is going again: seconds, a minute, or a few minutes with a step the GMs do by hand. Third, whether a kit may be required to carry a spare computer. Fourth, whether the TV may keep counting while the engine is silent (yes or no)."
- In `2026-11-01-quality-targets.json`, QT40 `numberToSet`, and the matching line under "How each number is sorted": replace "An engine limit stated per kind of device (today both player scanners keep 100)" with "An engine requirement: each device keeps at least a whole game's scans and never drops one without saying so (today both player scanners keep 100 and drop the oldest silently)".

### O4. Four questions are one architectural decision asked in pieces, and the six decisions split it across two rounds with the protocol between them

Severity: high. This is the finding on the approach.

Where: Decisions, questions A, B, G and I; Design, "The decisions ahead".

What is wrong. Each of these asks, from a different side, on which devices the game's rules and its record can run.

- A: may a cut-off tablet reach a verdict by itself.
- B: may a tablet or a spare become the decider.
- G, fourth option: "One GM tablet as the engine for other devices over a small network".
- I: "whether a tablet-class device or a GM's laptop must be able to run the engine itself".
- Later choices: "The game rules as one shared body of code ... or two bodies kept equal by tests" and "The standalone tablet: the same record and lifecycle parts the engine runs, or an engine of its own".

There are two families of design here. In one, the show machine is a server and each device carries its own copy of some rules, which is today's engine. In the other, one body of rules and one record format run on whichever device is the decider, and failover, standalone play and a cut-off tablet are the same ability used three ways. That choice is the hardest to reverse in the whole pass, because it fixes the language and the shape of the core. The page asks the owner for its parts one at a time, with separate recommendations, before the panel's blind round. The owner can give four reasonable answers that together pick a family, or that fit neither.

The page sees the links. Question G says "A link the agent notes ...: several tablets with no engine is the same problem", and question I says a laptop running the engine "is a large simplification of the standalone questions, if you want it". But both are asides, and the second sits under "Hardware".

The six decisions carry the same split. Design says the first decides "Where each fact of a running game lives and is decided" (design.md line 27) and the third decides "For each fact, which device or program decides it" (line 67). Those are one decision. The protocol's form is second, between them, although question A says "“The published protocol's form” follows: what every reply carries ... depends on whether provisional replies exist". A round on the protocol's form held before the round on authority will either guess the authority answer or be reopened.

A second inconsistency sits on the same point. The conflicts introduction says "Whether the engine and the tablet run one body of rules or two kept equal by tests is a later choice for the design rounds", while EX12, settled, already rules out "a second hand-kept copy of the rules on the tablet".

Proposed change.

- `decisions.json`, `groups[0].intro`, add a last paragraph: "Four questions on this page are linked: “A GM tablet cut off from the engine”, “The show machine fails mid-game”, “Which standalone games the engine must run” and the hardware call below. Each asks, from a different side, where the game's rules and its record can run: only on the show machine, or also on a tablet, a laptop or a spare. Answer them as outcomes, what the GMs and the players must still be able to do. Where the rules run is the panel's to propose, and you choose among its designs in the first design round. If two of your answers pull against each other, the agent says so before the panel runs."
- `design.json`, the panel's "The blind round" section, add to what each architect writes: "on which devices the game's rules and its record run, and whether one body of rules serves the show machine, a standalone tablet and a failure; whether how the engine holds the game's state and where authority lives are one decision or two; and whether the protocol's form should be decided before or after them."
- The order is the owner's list (the decision "Design top-down, hardest-to-reverse choices first"), so put it to the owner as one line with question J: "The agent proposes to run the rounds on the game's state and on where authority lives as one round, and the protocol's form after it, because each reply in the protocol depends on who decides. Say no to keep the order as you set it."
- `later`, the item on the game rules: add "The settled case “A game with no show machine” already rules out a second copy of the rules kept by hand, so what is open is how the one body reaches the tablet."

### O5. No decision ahead covers how the engine drives the room

Severity: high.

Where: Design, "The decisions ahead"; the panel's three lenses; Decisions, "Coming in the design rounds".

What is wrong. The six are the game's state, the protocol's form, authority, extension, copies and the move. None decides how the engine starts, watches and restarts the outside programs, which of them is the authority for what it alone knows, how a cue runs, or what happens to a running cue, a queued video or a held item at a pause, a failure, a restart and the end of a game. That work is the difference between a show engine and a game server. By my count it is about 11,000 of the 27,000 lines under `backend/src`: the video, music, sound, Bluetooth, audio routing, lighting and display services, the cue engine and its timeline, held items, the health registry and the command executor. The game's facts, rules and persistence are about 7,800.

The evidence that it has no home is on the Design page itself. "Engine trusts its stale picture of outside programs" and "Screens show a normal value when nothing is known" are listed as test situations under "How games and venues extend the engine". "Service health and service state travel on separate paths" is under the protocol's form. "The equipment's interface" is a later choice. The panel has no lens for it, and the failure list each architect must answer names "an outside program" only as one of four failures.

Why it matters for the owner's goal. A panel handed these six decisions will design the game's facts with care and carry the room over as it stands. The room is where "no technical failure stops a game" is tested most often at a real show: a speaker drops, the video player hangs, the lighting controller is slow to answer.

Proposed change. The list is the owner's, so it comes back as a question with J.

- `design.json`, `ahead`, add an entry after authority. Title: "How the engine drives the room". `decides`: "How the engine starts, watches and restarts the outside programs: video, music, sound, speakers, lights and the TV's browser. Which of them is the authority for what it alone knows, and how the engine learns it. How a cue runs, and what happens to a running cue, a queued video or a held item at a pause, a failure, a restart and the end of a game. What the GM sees and can press when a program is slow, wrong or gone."
- `decisions.json`, `designRounds`, add the matching line, and in question J's `evidence` add: "The agent proposes a seventh decision ahead, “How the engine drives the room”. About four lines in ten of today's engine do this work, and none of the six decides it. Say no to keep the list at six."
- `design.json`, the panel's first lens: after "on a network that drops" add "and how the engine drives outside programs that crash, hang or answer late".

### O6. The blind round is handed the pass's own division of the problem

Severity: medium.

Where: Decisions, "J. What the panel gets in its blind round", the recommendation "Also give the blind round your binding decisions and the six decisions ahead."

What is wrong. Giving the owner's binding decisions is right. The six decisions ahead are different: they are how the agent running the pass divided the problem, approved by the owner on 2026-11-01. Each architect must write "a top-level design, decision by decision", so three architects will answer inside that division, and the blind round cannot show whether an outsider would divide it otherwise. O4 and O5 are two places where I would. "They may add, split or merge decisions" is a weak guard once the template is the agenda.

The requirements carry a second pull toward today's engine that the page does not name. Several targets state a mechanism: "The engine's program watcher restarts it a bounded number of times" (QT2), "Each keeps its own files, network ports and settings" (QT43), "the owner plugs the old machine back in" (QT42), "Within one check-in period" (QT5). Most rest on roadmap rulings, so they stand. The panel should still be asked to name them.

Proposed change. In `groups[3].questions[0]`:

- `options`, add a third: label "Give your binding decisions now, and the six decisions ahead only after each architect has written a list of their own." means "Each architect first reads the goal, the requirements, the setting and your decisions, and writes the hardest decisions to reverse as they see them, in order. Only then do they get the six decisions ahead, say where their list differs and why, and write their design." cost "One more step per architect. You see three independent lists beside your own before any design is compared."
- `recommendation`, replace with: "The third option. Your decisions bind any design, so the panel should have them. The six decisions ahead are how the agent running the pass divided the problem, and a panel that starts from them answers inside that division. The blind round is the one chance to learn whether three architects who have not seen it would divide the problem the same way."
- Panel brief and `design.json`, "The blind round", add to what each architect writes: "any requirement that says how to build something and not only what is needed, and what they would propose if it stated only the need."

### O7. Question I is mostly answered by the owner's own words, and its third part is the panel's

Severity: medium.

Where: Decisions, "I. Which hardware the first new engine requires, and what it must allow replacing", "What we need from you": "Whether the first release's fixed list is ALN's kit as it stands; whether the GM's station must be allowed, now, to be something other than an Android tablet reading NFC itself, and if so which of the three shapes above; and whether a GM's device must be able to run the engine."

What is wrong. The owner's comment 5 answers the first two: "we should build the fundamental architecture to allow flexibility with the hardware down the line. Meanwhile, we need to set realistic boundaries about what our current roadmap should incorporate". The architecture allows other hardware; the roadmap sets the bounds. The recorded decision then says where the line falls "is open, for the design rounds and the build plan". The question asks now what the decision gave to the build plan, so it fails the page's second test. It also fails the fourth: the panel's setting already gives ALN's kit "as facts, not as the engine's requirements", so the blind round does not wait on it. "Which of the three shapes" is seam design, with "a reader device kind in the protocol" as a cost. "Whether a GM's device must be able to run the engine" is the decision in O4.

Proposed change. Remove the question and the "Hardware" group's question list; keep the group's introduction as a pointer. Add to `calls`:

- `title`: "The design allows other hardware; the first release is tested on ALN's kit"
- `call`: "Every class of device in ALN's kit can be replaced in the design: the show machine, the GM's station, the players' devices, the public screens, the room's programs and the network. The first release of the new engine is tested and supported on ALN's kit as it stands. The GM app runs in any current browser, reads tokens by NFC where the device has it and takes typed codes where it does not. Reading printed codes with the camera and a separate token reader stay possible and are not built now. The build plan proposes, for each stage of the roadmap, the hardware the engine names as required and the hardware it supports, and brings that list to you."
- `why`: "Your words settle both halves: “we should build the fundamental architecture to allow flexibility with the hardware down the line”, and “realistic boundaries about what our current roadmap should incorporate”. Which parts can be swapped is how to build it. What an adopter must buy at each stage is yours, and it comes to you with the build plan, when the cost of each choice is known."

The panel's setting keeps its sentence on ALN's devices, with no conditional rewording.

### O8. Most of question H follows from a rule the owner already ratified, and its record half is asked twice

Severity: medium.

Where: Decisions, "H. What a standalone game gives up, and what it keeps"; the closing ask of D; G's evidence on the record.

What is wrong. The recommended answer is "the pattern the pack already has for lights", skip it or block the show, from the settled case "A cue names roles, the venue binds them". Applying a ratified rule to one more case is, by the page's own sorting, a reading "that follow[s] from the owner's earlier decisions", an agent's call. The other half of H, whether a standalone night leaves a record of what players found, is also asked inside G ("[QT39] asks whether a standalone game's record holds what the players found, which depends on the answer") and D ends by asking the same rule a third way ("whether a rule that cannot run on a scanner alone should keep a game from being declared standalone"). The owner would answer one question in three places.

Proposed change. Remove H as a question. Add to `calls`:

- `title`: "A standalone game uses the marks the pack already has"
- `call`: "Each effect a pack declares that needs an engine (video on the TV, public evidence, cues on the room's equipment, music, lights, hidden facts) carries the designer's mark, skip it or block the show, as lights do today. A game declared standalone publishes only if no effect it needs is marked block the show, and the check names the effect. An effect marked skip it reads as not installed tonight, grey. A rule that cannot run on a device alone is treated the same way."
- `why`: "It is the rule you ratified for lights in “A cue names roles, the venue binds them”, applied to one more case. A second rule for standalone games would give designers two rules to learn."

Move the record ask into G (see O9).

### O9. Question G asks for fifteen ratings, and leaves out two facts that change them

Severity: medium.

Where: Decisions, "G. Which standalone games the engine must run", "For each shape, whether it is required now, allowed later, or never; and whether “standalone” means no show machine or no network."

What is wrong. The owner said of the earlier standalone question "I don't understand the distinction between the two scenarios you presented." Five shapes times three ratings plus a definition is a harder form of the same thing, and two of the shapes are designs. Two facts would shorten it.

1. A page in a tablet's browser cannot take connections from other devices. "One GM tablet as the engine" therefore means either a separate app installed on the tablet, which is a second program to build and keep, or "a small computer in the GM's bag". The second is the ordinary engine with nothing installed, which "A whole game runs with no venue hardware" (QT25) already requires. It is a networked game on a very small kit, and it serves every "other logistics" case the owner named with one shared game and one record. The page gives it one clause.

2. Nothing says how a standalone device gets the game. Today's engine page has the rows: the phone "Needs internet: the first load, from the website and a code library online", and caches "only pictures already viewed"; the hardware scanner's token list is "written only when the engine sends it". A room where "a network connection is simply not feasible" needs every device loaded beforehand. For phones it also means the whole game, every token and its text, sits on each player's phone, which sets aside "The engine filters before it sends; no device filters for itself" (QT32) for that game. The conflicts list has no entry for privacy and access against standalone and offline.

Proposed change. In `groups[1].questions[0]`:

- `evidence`, add: "What a tablet can be. A page in a tablet's browser cannot take connections from other devices. So a tablet acting as the engine means a separate app installed on it, a second program to build and keep. A small computer in the GM's bag running the ordinary engine, with nothing installed in the room, is a networked game on a very small kit, and the requirements already ask the engine to run that way (“A whole game runs with no venue hardware”)."
- `evidence`, add: "How a standalone device gets the game. Today the phone's page loads from a public website and needs the internet for its first load and for each picture it has not shown yet, and the hardware scanner gets its token list only from an engine. A standalone game needs every device loaded before it leaves for the room. For players' phones that puts every token and its text on each phone, where a curious player can read it."
- `recommendation` ("What we need from you"), replace with: "From you, three things. First, when the devices of a game with no show machine can reach each other, must they play one shared game, with one list of claimed tokens, one set of scores and one record, or is each device always alone? Say required now, later or never. Second, must a standalone night leave a record of what the players found, collected from the devices afterwards (yes, later or no)? Third, may a game for players' phones alone put the whole game on each phone (yes or no)? The panel proposes which shapes follow."

### O10. Question F should carry a recommendation, and it should be no

Severity: medium.

Where: Decisions, "F. Where the trial copy runs while a show runs", which ends "What we need from you" with no recommendation.

What is wrong. The page gives a recommendation "where the agent running the pass has a sound view", and there is a sound view here. A second engine with its own video and music players, on the one small computer a live show depends on, adds load and heat for a convenience a laptop gives at no risk, and QT25 already requires that a whole game runs on a laptop with stand-ins. The front page's own glossary says the director is "usually the same person as the GM or the designer", so the designer is rarely free to rehearse while a show runs. Keeping two copies apart on one machine is still needed between games and for test runs, so nothing in "How one engine runs as many separate copies" is lost.

Proposed change. In `groups[0].questions[5]`, set `recKind` to "Recommendation" and `recommendation` to: "Only between games on the show machine, and on a laptop at any time. The requirements already ask that a whole game runs on a laptop with stand-ins, so the designer can rehearse during a show without touching the show machine. A second engine with its own video and music players on the show machine during a live show adds load and heat to the one computer the show depends on. Copies still stay separate on one machine, for a trial between games and for test runs. From you: yes or no." If the owner agrees, QT11's `situation` opens "Between games, or on a laptop while a show runs, the designer starts a separate trial copy of the engine with a draft pack."

### O11. Three things an outside architect needs from the setting are not in it

Severity: medium.

Where: Design, "The panel's brief", "The setting, as facts"; Requirements.

1. Secure connections on a network with no internet. Browsers give a page NFC and the camera only over a connection with a certificate. Today the kit serves its own certificate and each staff device accepts a warning once; the hardware scanner does not check the certificate at all (`OrchestratorService.h:714`). The roadmap defers the kit's name and certificate to the players' phones block (`ROADMAP.md:629`). No page of the site mentions it, and it bounds several options on the Decisions page: a spare that "takes the engine's name", a GM station in "any browser", players' own phones, and any small computer acting as the engine. Add to the setting item in `design.json` and the brief: "Phones and tablets let a page read NFC tokens or use the camera only over a secure connection with a certificate the browser trusts. Today the kit uses a certificate it made itself, and each staff device accepts a warning once; players' phones cannot be asked to do that. The roadmap leaves the kit's name and certificate to the players' phones block."

2. Whether players are trusted. A token's code is plain text, the printed code holds the same text, and the phone's scanner takes a typed code (Today's engine, "Input: QR camera, NFC, typed entry, a link carrying the token"). Today that is harmless, because a player's scan scores nothing. The extension cases change it: "Players change the room's lighting by scanning tokens", "Players' own phones and two-tap actions". No requirement says whether the engine must resist a player who types a code for a token they do not hold. This is the owner's: it is what the product must do, and it shapes what a scan carries in the protocol. Since something new comes back as a question first, I propose one short question in the first group, "A player who cheats", with three options (trust the players, as today; refuse a typed or guessed code on any scan that changes the game or the room; also resist a copied tag) and the recommendation: "The second. A typed code is the easy cheat, and refusing it costs little if it is designed in. A copied tag takes tools and intent, and a GM in the room is the better answer to it."

3. An order of size. "A few dozen devices" is ALN's kit. An architect needs a ceiling to design to, and "the engine states the largest kit it supports, measured" comes after the design. Add to the agent's call "The show machine's limits": "The design aims at a kit ten times ALN's on the same machine, a few hundred devices, so that players' phones and larger productions need no redesign. The engine states the limit it measures."

### O12. Smaller points on E and C

Severity: low.

- E, the recommendation: "build the places where an add-on would plug in as fixed places in the engine's code with their own versions ... the places cost their versions and their tests from the first release". Versioned plug-in places with no outside user are a promise paid for early. The swap points already exist as a requirement ("Replacing an outside program leaves the rest untouched"). Keep those, and leave versions and promises to the release block, as the next sentence of the recommendation already half says. The options also miss the form of add-on that fits an engine with a published protocol: a separate program that joins through the protocol with its own pass and its own health row, so a crash in it cannot take the engine down. Add it to `options[1].means`: "An add-on can also be a separate program that joins through the published protocol with a pass of its own, so that its failure is one more red row and never the engine's." The closing ask is the owner's and can stay.
- C is sound and I would keep the recommendation. State the window in time as well as in versions ("a scanner flashed for one release keeps working for at least a year of releases"), because the owner has no release rhythm yet to count versions against.

## Every question and decision, in one table

| Item | Would I change it | See |
|---|---|---|
| A. A GM tablet cut off from the engine | Yes: option three's cost, the long-gap consequence, the recommendation, the conflict rule as a default | O1 |
| B. The show machine fails mid-game | Yes: ask outcomes; fix the "amends" label; add three facts | O3 |
| C. Release day | No; add a window in time | O12 |
| D. What a game's maker may build inside the pack | Yes: the baseline and the options | O2 |
| E. How an extension for all games reaches a production | Small: one option, lighter recommendation | O12 |
| F. Where the trial copy runs | Yes: add a recommendation | O10 |
| G. Which standalone games the engine must run | Yes: three outcome asks; two facts | O9 |
| H. What a standalone game gives up | Move to the agent's calls; record ask into G | O8 |
| I. Which hardware the first new engine requires | Move to the agent's calls and the build plan | O7 |
| J. What the panel gets in its blind round | Yes: a third option, and two proposals put to the owner with it | O4, O5, O6 |
| Reading: a standalone game may have no GM tablet | Keep; G's first ask covers it | O9 |
| Reading: a cut-off tablet keeps taking scans | Keep; say that answering A confirms or rejects it | O1 |
| Reading: the design says how a game carries on if the show machine fails | Keep | O3 |
| How the engine holds the game's state | Run with authority as one round | O4 |
| The published protocol's form | Move after state and authority | O4 |
| Where authority lives | Run with state | O4 |
| How games and venues extend the engine | Keep; move the three room situations out of it | O5 |
| How one engine runs as many separate copies | Keep | |
| How today's engine moves to the new design | Keep | |
| (missing) How the engine drives the room | Add | O5 |
| The fourteen agent's calls | Keep all; change the offline-queue sorting and add a size to the machine's limits | O3, O11 |

## What is right

- The four tests are the right tests, and the page applies them in the open. Most of what I move, I move by those tests.
- "No technical failure stops a game" is recorded in the owner's words, with the two readings held apart from it. That separation is worth keeping everywhere.
- Question C is the best on the page. It says what the two phrases mean, what today's code does for each kind of device, and what each answer does to the protocol and the tests. A, B and D should be brought to that standard.
- Withholding the agent's readings from the panel and giving it the open questions is correct.
- The second round reading the code after a fact sheet is fine, with the architects revising their blind proposals. The pull toward today's engine comes earlier, from the agenda and the requirements (O6).
- Sorting the numbers into the engine's, a production's and technical defaults is what the owner's comment 7 asked for, and none of those numbers needs the owner now.
- The settled case "A game with no show machine" already forbids a second hand-kept copy of the rules. It is the strongest architectural constraint in the requirements, and the questions should lean on it.
